// Data cleaning utilities. Preserves the original raw row (stored separately)
// while producing a cleaned analytical value.

function cleanAmount(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  let s = String(raw).trim();
  if (s === '' || s.toLowerCase() === 'na' || s.toLowerCase() === 'n/a') return null;
  s = s.replace(/[₹$,\s]/g, '');
  s = s.replace(/[()]/g, ''); // remove stray parens
  const num = parseFloat(s);
  return Number.isFinite(num) ? num : null;
}

function cleanString(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  return s === '' ? null : s;
}

// Strip a leading formula-trigger character to neutralise CSV injection when the
// value is later re-exported to CSV/Excel by an admin.
function sanitizeForCsv(value) {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return s;
}

function normalizeName(raw) {
  if (!raw) return '';
  return String(raw)
    .toLowerCase()
    .replace(/^(dr|shri|smt|ms|mr|prof|adv|kumari|capt|captain)\.?\s+/gi, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { cleanAmount, cleanString, sanitizeForCsv, normalizeName };
