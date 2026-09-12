const PDFDocument = require('pdfkit');

const NAVY = '#132038';
const NAVY_MID = '#365182';
const INK = '#16202e';
const MUTED = '#5b6675';
const LINE = '#d7dce3';
const SAFFRON = '#ff9933';
const GREEN = '#128807';

function inr(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `Rs ${Math.round(Number(value)).toLocaleString('en-IN')}`;
}

function compact(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  if (Math.abs(n) >= 1e7) return `Rs ${(n / 1e7).toFixed(2)} Cr`;
  if (Math.abs(n) >= 1e5) return `Rs ${(n / 1e5).toFixed(2)} L`;
  return `Rs ${Math.round(n).toLocaleString('en-IN')}`;
}

/**
 * Streams a statistical screening report as a PDF.
 * Every figure comes from the analysis output — nothing is illustrative.
 */
function buildReportPdf(report, stream) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 56, bottom: 64, left: 48, right: 48 },
    info: {
      Title: `PRAMANA Statistical Screening Report — ${report.datasetName}`,
      Author: 'PRAMANA (statistical transparency prototype)',
      Subject: 'MPLADS statistical screening summary',
    },
  });
  doc.pipe(stream);

  const W = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const L = doc.page.margins.left;
  const s = report.statistics || {};

  const rule = (y, color = LINE, h = 0.75) => {
    doc.save().rect(L, y, W, h).fill(color).restore();
  };

  const tricolour = (y) => {
    const third = W / 3;
    doc.save();
    doc.rect(L, y, third, 2.5).fill(SAFFRON);
    doc.rect(L + third, y, third, 2.5).fill('#e9edf3');
    doc.rect(L + third * 2, y, third, 2.5).fill(GREEN);
    doc.restore();
  };

  // ---------------- Masthead ----------------
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(19).text('PRAMANA', L, 52, { characterSpacing: 3 });
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED)
    .text('MPLADS Statistical Integrity & Transparency Explorer', L, 76);
  doc.font('Helvetica').fontSize(8).fillColor(MUTED)
    .text('Government of India · Ministry of Statistics and Programme Implementation (illustrative context)',
      L, 88, { width: W });
  tricolour(104);

  doc.font('Helvetica-Bold').fontSize(14).fillColor(INK)
    .text('Statistical Screening Report', L, 122);
  doc.font('Helvetica').fontSize(10).fillColor(NAVY_MID)
    .text(report.datasetName, L, 141, { width: W });

  let y = doc.y + 10;
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
  doc.text(`Source: ${report.source || 'Not recorded'}`, L, y, { width: W });
  y = doc.y + 2;
  doc.text(`Generated: ${new Date(report.generatedAt).toLocaleString('en-IN')}`, L, y);
  y = doc.y + 12;
  rule(y);
  y += 16;

  // ---------------- Coverage tiles ----------------
  const tiles = [
    ['Records analysed', Number(report.recordsAnalysed || 0).toLocaleString('en-IN')],
    ['Records excluded', Number(report.recordsExcluded || 0).toLocaleString('en-IN')],
    ['Mean allocation', compact(s.mean)],
    ['Median allocation', compact(s.median)],
  ];
  const tileW = W / tiles.length;
  tiles.forEach(([label, value], i) => {
    const x = L + i * tileW;
    doc.font('Helvetica').fontSize(7).fillColor(MUTED)
      .text(String(label).toUpperCase(), x, y, { width: tileW - 8, characterSpacing: 0.6 });
    doc.font('Helvetica-Bold').fontSize(12).fillColor(NAVY)
      .text(String(value), x, y + 12, { width: tileW - 8 });
  });
  y += 40;
  rule(y);
  y += 18;

  // ---------------- Descriptive statistics ----------------
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text('Descriptive statistics', L, y);
  y = doc.y + 8;

  const statRows = [
    ['Count', Number(s.count || 0).toLocaleString('en-IN')],
    ['Mean', inr(s.mean)],
    ['Median', inr(s.median)],
    ['Standard deviation', inr(s.stddev)],
    ['Minimum', inr(s.min)],
    ['Maximum', inr(s.max)],
    ['Q1 (25th percentile)', inr(s.q1)],
    ['Q3 (75th percentile)', inr(s.q3)],
    ['Interquartile range (IQR)', inr(s.iqr)],
    ['IQR upper bound (Q3 + 1.5 x IQR)', inr(s.iqrUpper)],
    ['Extreme IQR bound (Q3 + 3 x IQR)', inr(s.iqrExtreme)],
    ['Median absolute deviation (MAD)', inr(s.mad)],
    ['95th percentile', inr(s.p95)],
    ['99th percentile', inr(s.p99)],
    ['Skewness', s.skewness !== undefined ? Number(s.skewness).toFixed(4) : '—'],
  ];

  statRows.forEach(([label, value], i) => {
    if (i % 2 === 0) doc.save().rect(L, y - 2.5, W, 14).fill('#f6f8fb').restore();
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(String(label), L + 6, y, { width: W * 0.6 });
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(INK)
      .text(String(value), L + W * 0.6, y, { width: W * 0.4 - 6, align: 'right' });
    y += 14;
  });

  y += 12;

  // ---------------- Method applicability ----------------
  if (s.applicable) {
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text('Method applicability', L, y);
    y = doc.y + 6;
    const methodLabels = {
      iqr: 'IQR rule',
      zscore: 'Z-score',
      modz: 'Modified Z-score',
      percentile: 'Percentile screening',
    };
    Object.entries(methodLabels).forEach(([key, label]) => {
      const ok = s.applicable[key];
      doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(`${label}:`, L + 6, y, { width: 150, continued: false });
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(ok ? '#15803d' : '#b45309')
        .text(ok ? 'Applied' : 'Not applicable', L + 160, y);
      const note = s.notes && s.notes[key];
      if (!ok && note) {
        y = doc.y + 1;
        doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(MUTED).text(note, L + 12, y, { width: W - 24 });
      }
      y = doc.y + 5;
    });
    y += 8;
  }

  // ---------------- Risk distribution ----------------
  if (doc.y > doc.page.height - 240) { doc.addPage(); y = doc.page.margins.top; }
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text('Risk distribution', L, y);
  y = doc.y + 8;

  const total = report.recordsAnalysed || 1;
  const maxCount = Math.max(...(report.riskDistribution || []).map((r) => r.c), 1);
  (report.riskDistribution || []).forEach((r) => {
    const pct = (r.c / total) * 100;
    doc.font('Helvetica').fontSize(8.5).fillColor(INK).text(r.classification, L + 6, y, { width: 180 });
    const barX = L + 195;
    const barW = W - 265;
    doc.save().rect(barX, y + 1.5, barW, 7).fill('#e3e9f2').restore();
    doc.save().rect(barX, y + 1.5, Math.max(1, barW * (r.c / maxCount)), 7).fill(NAVY_MID).restore();
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(MUTED)
      .text(`${r.c.toLocaleString('en-IN')}  (${pct.toFixed(1)}%)`, L + W - 62, y, { width: 62, align: 'right' });
    y += 15;
  });
  y += 10;

  // ---------------- Top flagged records ----------------
  if (y > doc.page.height - 200) { doc.addPage(); y = doc.page.margins.top; }
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text('Highest-scoring flagged records', L, y);
  y = doc.y + 4;
  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
    .text('Ordered by number of agreeing methods, then allocation. Signals require human review.', L, y, { width: W });
  y = doc.y + 8;

  const cols = [
    { key: 'mp_name', label: 'MP / Member', w: 0.30 },
    { key: 'state', label: 'State', w: 0.18 },
    { key: 'amount', label: 'Allocation', w: 0.16, align: 'right' },
    { key: 'classification', label: 'Classification', w: 0.26 },
    { key: 'anomaly_score', label: 'Score', w: 0.10, align: 'right' },
  ];

  const header = () => {
    doc.save().rect(L, y - 3, W, 15).fill('#eef2f7').restore();
    let x = L + 5;
    cols.forEach((c) => {
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(NAVY)
        .text(c.label.toUpperCase(), x, y + 1, { width: W * c.w - 8, align: c.align || 'left', characterSpacing: 0.4 });
      x += W * c.w;
    });
    y += 16;
  };
  header();

  (report.topFlaggedRecords || []).slice(0, 22).forEach((r, i) => {
    if (y > doc.page.height - 90) {
      doc.addPage();
      y = doc.page.margins.top;
      header();
    }
    if (i % 2 === 0) doc.save().rect(L, y - 2.5, W, 13).fill('#fafbfd').restore();
    let x = L + 5;
    cols.forEach((c) => {
      let v = r[c.key];
      if (c.key === 'amount') v = compact(v);
      doc.font('Helvetica').fontSize(7.5).fillColor(INK)
        .text(String(v ?? '—'), x, y, { width: W * c.w - 8, align: c.align || 'left', lineBreak: false, ellipsis: true });
      x += W * c.w;
    });
    y += 13;
  });

  y += 14;

  // ---------------- Methodology & disclaimer ----------------
  if (y > doc.page.height - 190) { doc.addPage(); y = doc.page.margins.top; }
  rule(y); y += 12;
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(INK).text('Methodology', L, y);
  y = doc.y + 3;
  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(report.methodology, L, y, { width: W, align: 'left' });
  y = doc.y + 10;

  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(INK).text('Interpretation', L, y);
  y = doc.y + 3;
  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(report.interpretation, L, y, { width: W });
  y = doc.y + 12;

  const boxTop = y;
  doc.save().rect(L, boxTop, W, 46).fill('#fff8ec').restore();
  doc.save().rect(L, boxTop, 2.5, 46).fill(SAFFRON).restore();
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#7a4a09').text('Disclaimer', L + 12, boxTop + 8);
  doc.font('Helvetica').fontSize(7.5).fillColor('#7a4a09')
    .text(report.disclaimer, L + 12, boxTop + 20, { width: W - 24 });

  // ---------------- Footer on every page ----------------
  const range = doc.bufferedPageRange ? doc.bufferedPageRange() : { start: 0, count: 1 };
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);

    /* Diagonal prototype legend behind the page content. Drawn per page so an
       extracted page cannot circulate without the words that qualify it, and kept
       faint enough that the figures stay legible in print. */
    doc.save();
    doc.opacity(0.06).fillColor('#0f172a').font('Helvetica-Bold').fontSize(17);
    for (let row = -1; row < 8; row++) {
      for (let col = -1; col < 3; col++) {
        doc.rotate(-24, { origin: [120 + col * 300, 90 + row * 120] })
          .text('PRAMANA STATISTICAL PROTOTYPE — FOR DEMO USE ONLY',
            120 + col * 300 - 150, 90 + row * 120, { lineBreak: false, width: 420 })
          .rotate(24, { origin: [120 + col * 300, 90 + row * 120] });
      }
    }
    doc.restore();

    const fy = doc.page.height - 44;
    doc.save().rect(L, fy - 8, W, 0.75).fill(LINE).restore();
    doc.font('Helvetica').fontSize(7).fillColor(MUTED)
      .text('PRAMANA is a statistical transparency prototype and is not the official e-SAKSHI portal.', L, fy, { width: W * 0.75 });
    doc.font('Helvetica').fontSize(7).fillColor(MUTED)
      .text(`Page ${i - range.start + 1} of ${range.count}`, L + W * 0.75, fy, { width: W * 0.25, align: 'right' });
  }

  doc.end();
}

module.exports = { buildReportPdf };
