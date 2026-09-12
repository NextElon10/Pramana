const { parse } = require('csv-parse/sync');
const ExcelJS = require('exceljs');
const db = require('../db');
const { detectSchema, recoverFromRow } = require('./schemaMapper');
const { cleanAmount, cleanString } = require('./clean');
const { runStatisticalAnalysis, runCrossDatasetMatching } = require('./analysisEngine');

/** Normalise an ExcelJS cell value (which may be a formula/rich-text/date object) to a scalar. */
function cellToScalar(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('result' in value) return cellToScalar(value.result);      // formula cell
    if ('text' in value) return value.text;                        // hyperlink / rich text
    if (Array.isArray(value.richText)) return value.richText.map((t) => t.text).join('');
    if ('error' in value) return '';
    return String(value);
  }
  return value;
}

async function parseXlsx(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const headers = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    const label = String(cellToScalar(cell.value) || '').trim();
    headers[col] = label || `Column ${col}`;
  });

  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj = {};
    let hasValue = false;
    for (let col = 1; col < headers.length; col++) {
      const key = headers[col];
      if (!key) continue;
      const v = cellToScalar(row.getCell(col).value);
      obj[key] = v;
      if (v !== '' && v !== null && v !== undefined) hasValue = true;
    }
    if (hasValue) rows.push(obj);
  });
  return rows;
}

async function parseBuffer(buffer, filename) {
  const lower = String(filename || '').toLowerCase();

  if (lower.endsWith('.csv')) {
    let text = buffer.toString('utf8');
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip UTF-8 BOM
    return parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
      bom: true,
    });
  }

  if (lower.endsWith('.xlsx')) return parseXlsx(buffer);

  if (lower.endsWith('.xls')) {
    const err = new Error('Legacy .xls files are not supported. Please re-save the file as .xlsx or .csv and upload again.');
    err.code = 'UNSUPPORTED_FILE';
    throw err;
  }

  const err = new Error('Only .csv and .xlsx files are supported.');
  err.code = 'UNSUPPORTED_FILE';
  throw err;
}

async function previewDataset(buffer, filename) {
  const rows = await parseBuffer(buffer, filename);
  if (!rows.length) {
    const err = new Error('The file contains no readable data rows.');
    err.code = 'INVALID_FILE';
    throw err;
  }
  const columns = Object.keys(rows[0]);
  const { mapping, confidence } = detectSchema(columns);

  const missingValues = {};
  for (const col of columns) {
    missingValues[col] = rows.filter((r) => r[col] === '' || r[col] === null || r[col] === undefined).length;
  }

  // Duplicate signal on the raw file, before anything is stored.
  const seen = new Set();
  let duplicateRows = 0;
  for (const r of rows) {
    const key = JSON.stringify(r);
    if (seen.has(key)) duplicateRows++;
    else seen.add(key);
  }

  return {
    filename,
    sizeBytes: buffer.length,
    encoding: 'utf-8',
    rows: rows.length,
    columns,
    sample: rows.slice(0, 10),
    missingValues,
    duplicateRows,
    schemaMapping: mapping,
    schemaConfidence: confidence,
    amountColumnDetected: Boolean(mapping.amount),
  };
}

async function ingestDataset({ buffer, filename, name, source, house, uploadedBy, schemaOverride, isDemo }) {
  const rows = await parseBuffer(buffer, filename);
  if (!rows.length) {
    const err = new Error('The file contains no readable data rows.');
    err.code = 'INVALID_FILE';
    throw err;
  }

  const columns = Object.keys(rows[0]);
  const { mapping: autoMapping } = detectSchema(columns);
  const mapping = { ...autoMapping, ...(schemaOverride || {}) };

  // Drop "Grand Total" style summary rows — they are not real records.
  const dataRows = rows.filter((r) => {
    const stateVal = mapping.state ? String(r[mapping.state] ?? '').trim().toLowerCase() : '';
    const mpVal = mapping.mp ? String(r[mapping.mp] ?? '').trim().toLowerCase() : '';
    if (stateVal === 'grand total' || mpVal === 'grand total') return false;
    if (mapping.state && stateVal === '') return false;
    return true;
  });

  if (!dataRows.length) {
    const err = new Error('No usable data rows remained after validation. Check that the file has a state or member column.');
    err.code = 'INVALID_FILE';
    throw err;
  }

  const info = db.prepare(`INSERT INTO datasets
    (name, filename, source, house, uploaded_by, row_count, column_count, columns_json, schema_map_json, status, is_demo)
    VALUES (?,?,?,?,?,?,?,?,?, 'uploaded', ?)`).run(
    name, filename, source || 'User upload', house || null, uploadedBy || null,
    dataRows.length, columns.length, JSON.stringify(columns), JSON.stringify(mapping), isDemo ? 1 : 0,
  );
  const datasetId = info.lastInsertRowid;

  const insertRecord = db.prepare(`INSERT INTO records
    (dataset_id, row_index, raw_json, state, district, constituency, mp_name, project_id, project_name, domain, amount, financial_year, house, member_type, status, image_url,
     expenditure, recommended_amount, utilization, works_completed, works_recommended, completion_rate, balance_unpaid, transactions)
    VALUES (@dataset_id, @row_index, @raw_json, @state, @district, @constituency, @mp_name, @project_id, @project_name, @domain, @amount, @financial_year, @house, @member_type, @status, @image_url,
     @expenditure, @recommended_amount, @utilization, @works_completed, @works_recommended, @completion_rate, @balance_unpaid, @transactions)`);

  /**
   * Reads a semantic field for one row. If the header-level mapping did not find a
   * column for the field, a per-row recovery pass looks for an equivalent key in the
   * row itself, so an unusual header spelling does not silently drop real data.
   * Nothing is ever synthesised — a field absent from the source stays null.
   */
  const field = (row, name) => {
    const mapped = mapping[name] ? row[mapping[name]] : null;
    const value = cleanString(mapped);
    if (value !== null) return value;
    return cleanString(recoverFromRow(row, name));
  };

  /** Numeric variant of `field`. "N/A" and blanks stay null rather than becoming 0. */
  const num = (row, name) => cleanAmount(field(row, name));
  const int = (row, name) => {
    const v = num(row, name);
    return v === null ? null : Math.round(v);
  };

  const tx = db.transaction(() => {
    dataRows.forEach((row, idx) => {
      insertRecord.run({
        dataset_id: datasetId,
        row_index: idx,
        raw_json: JSON.stringify(row),
        state: field(row, 'state'),
        district: field(row, 'district'),
        constituency: field(row, 'constituency'),
        mp_name: field(row, 'mp'),
        project_id: field(row, 'project_id'),
        project_name: field(row, 'project_name'),
        domain: field(row, 'domain'),
        amount: cleanAmount(mapping.amount ? row[mapping.amount] : null),
        financial_year: field(row, 'financial_year'),
        house: field(row, 'house') || house || null,
        member_type: field(row, 'member_type'),
        status: field(row, 'status'),
        // Only http(s) image references are stored, so a stray value cannot become a
        // javascript: or data: URL in the browser.
        image_url: (() => {
          const v = field(row, 'image');
          return v && /^https?:\/\//i.test(v) ? v : null;
        })(),
        expenditure: num(row, 'expenditure'),
        recommended_amount: num(row, 'recommended_amount'),
        utilization: num(row, 'utilization'),
        works_completed: int(row, 'works_completed'),
        works_recommended: int(row, 'works_recommended'),
        completion_rate: num(row, 'completion_rate'),
        balance_unpaid: num(row, 'balance_unpaid'),
        transactions: int(row, 'transactions'),
      });
    });
  });
  tx();

  const summary = runStatisticalAnalysis(datasetId);
  const cross = runCrossDatasetMatching();
  return { datasetId, rows: dataRows.length, mapping, summary, cross };
}

module.exports = { previewDataset, ingestDataset, parseBuffer };
