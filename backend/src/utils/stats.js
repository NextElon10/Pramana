// PRAMANA Statistical Engine
// Transparent, explainable descriptive statistics and anomaly-signal calculations.
//
// Design rule: a method that cannot be computed meaningfully for a distribution is
// reported as NOT APPLICABLE and excluded from the method count. It is never allowed
// to silently flag every record. This matters for real MPLADS data, where a large
// share of members share an identical entitlement and the IQR or MAD can be exactly 0.
//
// Statistical anomaly !== fraud. See the product disclaimer.

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function sortedCopy(arr) {
  return [...arr].sort((a, b) => a - b);
}

function median(arr) {
  return percentile(arr, 50);
}

// Linear-interpolation percentile (the definition used for Q1/Q3/95th/99th here).
function percentile(arr, p) {
  if (!arr.length) return 0;
  const s = sortedCopy(arr);
  return percentileOfSorted(s, p);
}

function percentileOfSorted(sorted, p) {
  if (!sorted.length) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function stddev(arr, m) {
  if (arr.length < 2) return 0;
  const mu = m !== undefined ? m : mean(arr);
  const variance = arr.reduce((sum, x) => sum + (x - mu) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

/** Median absolute deviation. */
function mad(arr, med) {
  if (!arr.length) return 0;
  const m = med !== undefined ? med : median(arr);
  return median(arr.map((x) => Math.abs(x - m)));
}

/** Mean absolute deviation about the median — fallback scale estimate when MAD is 0. */
function meanAbsoluteDeviation(arr, med) {
  if (!arr.length) return 0;
  const m = med !== undefined ? med : median(arr);
  return mean(arr.map((x) => Math.abs(x - m)));
}

function skewness(arr, m, sd) {
  if (arr.length < 3) return 0;
  const mu = m !== undefined ? m : mean(arr);
  const s = sd !== undefined ? sd : stddev(arr, mu);
  if (s === 0) return 0;
  const n = arr.length;
  const sum = arr.reduce((acc, x) => acc + ((x - mu) / s) ** 3, 0);
  return (n / ((n - 1) * (n - 2))) * sum;
}

/** Percentile rank of `value` within a pre-sorted array (binary search, O(log n)). */
function percentileRankOfSorted(sorted, value) {
  if (!sorted.length) return 0;
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  const below = lo;
  let equal = 0;
  while (below + equal < sorted.length && sorted[below + equal] === value) equal++;
  // Mid-rank convention: ties share the midpoint of the band they occupy.
  return ((below + equal / 2) / sorted.length) * 100;
}

function percentileRank(arr, value) {
  return percentileRankOfSorted(sortedCopy(arr), value);
}

/** Full descriptive summary for a numeric distribution. */
function describe(values) {
  const arr = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  const n = arr.length;
  if (n === 0) {
    return {
      count: 0, mean: 0, median: 0, min: 0, max: 0, stddev: 0,
      q1: 0, q3: 0, iqr: 0, iqrUpper: 0, iqrExtreme: 0,
      skewness: 0, p95: 0, p99: 0, mad: 0, meanAd: 0,
      applicable: { iqr: false, zscore: false, modz: false, percentile: false },
    };
  }
  const s = sortedCopy(arr);
  const m = mean(arr);
  const sd = stddev(arr, m);
  const med = percentileOfSorted(s, 50);
  const q1 = percentileOfSorted(s, 25);
  const q3 = percentileOfSorted(s, 75);
  const iqr = q3 - q1;
  const madValue = median(s.map((x) => Math.abs(x - med)));
  const meanAd = meanAbsoluteDeviation(s, med);

  return {
    count: n,
    mean: m,
    median: med,
    min: s[0],
    max: s[n - 1],
    stddev: sd,
    q1,
    q3,
    iqr,
    iqrUpper: q3 + 1.5 * iqr,
    iqrExtreme: q3 + 3 * iqr,
    skewness: skewness(arr, m, sd),
    p95: percentileOfSorted(s, 95),
    p99: percentileOfSorted(s, 99),
    mad: madValue,
    meanAd,
    // A method is applicable only when its scale estimate is non-degenerate.
    applicable: {
      iqr: iqr > 0,
      zscore: sd > 0,
      modz: madValue > 0 || meanAd > 0,
      percentile: n >= 20 && s[n - 1] > s[0],
    },
    // Reported so the UI can explain *why* a method was skipped.
    notes: {
      iqr: iqr > 0 ? null : 'IQR is zero — more than half of the values are identical, so the IQR rule cannot separate outliers and is reported as not applicable.',
      zscore: sd > 0 ? null : 'Standard deviation is zero — all values are identical, so the Z-score is not applicable.',
      modz: (madValue > 0 || meanAd > 0) ? null : 'Both MAD and mean absolute deviation are zero, so the Modified Z-score is not applicable.',
      percentile: (n >= 20 && s[n - 1] > s[0]) ? null : 'Too few distinct values for meaningful percentile screening.',
    },
  };
}

/**
 * Evaluate one value against a pre-computed distribution summary.
 * `sortedValues` (optional) enables an exact percentile rank.
 */
function evaluateAnomaly(value, summary, sortedValues) {
  const app = summary.applicable || { iqr: true, zscore: true, modz: true, percentile: true };
  const signals = [];

  // --- Z-score ---
  const z = app.zscore && summary.stddev > 0 ? (value - summary.mean) / summary.stddev : 0;

  // --- Modified Z-score: MAD-based, falling back to the mean absolute deviation
  //     (consistency constant 1.253314) when MAD is exactly zero. ---
  let modZ = 0;
  let modZBasis = null;
  if (summary.mad > 0) {
    modZ = (0.6745 * (value - summary.median)) / summary.mad;
    modZBasis = 'MAD';
  } else if (summary.meanAd > 0) {
    modZ = (value - summary.median) / (1.253314 * summary.meanAd);
    modZBasis = 'mean absolute deviation (MAD is zero)';
  }

  const pctRank = sortedValues && sortedValues.length
    ? percentileRankOfSorted(sortedValues, value)
    : 0;

  // --- Flags (a non-applicable method never flags) ---
  const iqrFlag = app.iqr && value > summary.iqrUpper;
  const iqrExtreme = app.iqr && value > summary.iqrExtreme;
  const zFlag = app.zscore && Math.abs(z) > 3;
  const zExtreme = app.zscore && Math.abs(z) > 4;
  const modZFlag = app.modz && Math.abs(modZ) > 3.5;
  const pct95Flag = app.percentile && value >= summary.p95;
  const pct99Flag = app.percentile && value >= summary.p99;

  if (iqrFlag) signals.push({ key: 'iqr', label: 'IQR upper-bound exceeded', weight: 1 });
  if (zFlag) signals.push({ key: 'zscore', label: 'Z-score beyond ±3', weight: 1 });
  if (modZFlag) signals.push({ key: 'modz', label: 'Modified Z-score beyond ±3.5', weight: 1 });
  if (pct99Flag) signals.push({ key: 'p99', label: 'At or above the 99th percentile', weight: 1 });

  const methodCount = signals.length;
  const anomalyScore = signals.reduce((s, x) => s + x.weight, 0);

  // --- Classification ---
  // Extreme requires an extreme threshold breach corroborated by at least one other
  // signal, or convergence of three or more independent methods. This prevents a single
  // borderline method from dominating the whole distribution.
  let classification;
  if (methodCount === 0) classification = 'Normal';
  else if (methodCount >= 3 || ((iqrExtreme || zExtreme) && methodCount >= 2)) classification = 'Extreme Statistical Anomaly';
  else if (methodCount === 2) classification = 'Unusual';
  else classification = 'Slightly Unusual';
  if (methodCount >= 3 && !(iqrExtreme || zExtreme)) classification = 'Highly Unusual';

  // --- Explanation, built from the actual computed values ---
  const inr = (v) => `₹${Math.round(v).toLocaleString('en-IN')}`;
  const parts = [];
  if (iqrFlag) {
    parts.push(`The allocated amount of ${inr(value)} exceeds the IQR upper bound of ${inr(summary.iqrUpper)} (Q3 + 1.5 × IQR)${iqrExtreme ? `, and also exceeds the extreme threshold of ${inr(summary.iqrExtreme)} (Q3 + 3 × IQR)` : ''}.`);
  }
  if (zFlag) parts.push(`Its Z-score is ${z.toFixed(2)}, beyond the ±3 review threshold${zExtreme ? ' and the ±4 extreme threshold' : ''}.`);
  if (modZFlag) parts.push(`Its Modified Z-score is ${modZ.toFixed(2)} (based on the ${modZBasis}), beyond the ±3.5 review threshold.`);
  if (pct99Flag) parts.push(`It sits at or above the 99th percentile (${inr(summary.p99)}) of the analysed distribution.`);
  else if (pct95Flag) parts.push(`It sits at or above the 95th percentile (${inr(summary.p95)}) of the analysed distribution.`);

  const skipped = Object.entries(summary.notes || {}).filter(([k, v]) => v && !app[k]).map(([, v]) => v);

  let explanation;
  if (methodCount === 0) {
    explanation = `This value falls within the statistically expected range for the analysed distribution (percentile rank ${pctRank.toFixed(1)}%). No screening method flagged it.`;
  } else {
    explanation = `Statistically unusual relative to the analysed distribution. ${parts.join(' ')} ${methodCount} of 4 independent methods agree; percentile rank ${pctRank.toFixed(1)}%.`;
  }
  if (skipped.length) explanation += ` Note: ${skipped.join(' ')}`;
  explanation += ' A statistical signal is not evidence of wrongdoing and requires human review.';

  return {
    z, modZ, modZBasis, pctRank,
    iqrFlag, iqrExtreme, zFlag, zExtreme, modZFlag, pct95Flag, pct99Flag,
    methodCount, anomalyScore, classification,
    explanation: explanation.replace(/\s+/g, ' ').trim(),
    signals,
  };
}

module.exports = {
  mean, median, percentile, percentileOfSorted, stddev, mad, meanAbsoluteDeviation,
  skewness, percentileRank, percentileRankOfSorted, describe, evaluateAnomaly, sortedCopy,
};
