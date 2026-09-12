const db = require('../db');
const { describe, evaluateAnomaly, sortedCopy } = require('./stats');
const { normalizeName } = require('./clean');
const crypto = require('crypto');

function runDuplicateDetection(datasetId) {
  const records = db.prepare('SELECT * FROM records WHERE dataset_id = ?').all(datasetId);
  const seenExact = new Map();
  const seenProjectId = new Map();
  const update = db.prepare('UPDATE records SET is_duplicate = ?, duplicate_of = ? WHERE id = ?');
  const tx = db.transaction(() => {
    for (const r of records) {
      const hash = crypto.createHash('sha1').update(r.raw_json).digest('hex');
      let dupOf = null;
      if (seenExact.has(hash)) dupOf = seenExact.get(hash);
      else seenExact.set(hash, r.id);

      if (!dupOf && r.project_id) {
        const key = `${r.project_id}`.trim().toLowerCase();
        if (key && seenProjectId.has(key)) dupOf = seenProjectId.get(key);
        else if (key) seenProjectId.set(key, r.id);
      }
      if (dupOf) update.run(1, dupOf, r.id);
    }
  });
  tx();
}

function runStatisticalAnalysis(datasetId) {
  runDuplicateDetection(datasetId);
  const records = db.prepare('SELECT * FROM records WHERE dataset_id = ?').all(datasetId);
  const amounts = records.filter((r) => r.amount !== null && r.amount !== undefined).map((r) => r.amount);
  const summary = describe(amounts);
  const sortedAmounts = sortedCopy(amounts);

  db.prepare('DELETE FROM anomalies WHERE dataset_id = ?').run(datasetId);
  const insert = db.prepare(`INSERT INTO anomalies
    (record_id, dataset_id, iqr_flag, iqr_extreme, z_flag, z_extreme, modz_flag, pct95_flag, pct99_flag,
     method_count, anomaly_score, classification, z_score, mod_z_score, percentile_rank, explanation, review_status)
    VALUES (@record_id, @dataset_id, @iqr_flag, @iqr_extreme, @z_flag, @z_extreme, @modz_flag, @pct95_flag, @pct99_flag,
     @method_count, @anomaly_score, @classification, @z_score, @mod_z_score, @percentile_rank, @explanation, 'Unreviewed')`);

  const tx = db.transaction(() => {
    for (const r of records) {
      if (r.amount === null || r.amount === undefined) continue;
      const ev = evaluateAnomaly(r.amount, summary, sortedAmounts);
      insert.run({
        record_id: r.id,
        dataset_id: datasetId,
        iqr_flag: ev.iqrFlag ? 1 : 0,
        iqr_extreme: ev.iqrExtreme ? 1 : 0,
        z_flag: ev.zFlag ? 1 : 0,
        z_extreme: ev.zExtreme ? 1 : 0,
        modz_flag: ev.modZFlag ? 1 : 0,
        pct95_flag: ev.pct95Flag ? 1 : 0,
        pct99_flag: ev.pct99Flag ? 1 : 0,
        method_count: ev.methodCount,
        anomaly_score: ev.anomalyScore,
        classification: ev.classification,
        z_score: ev.z,
        mod_z_score: ev.modZ,
        percentile_rank: ev.pctRank,
        explanation: ev.explanation,
      });
    }
    db.prepare('UPDATE datasets SET stats_json = ?, status = ?, analyzed_at = CURRENT_TIMESTAMP, row_count = ? WHERE id = ?')
      .run(JSON.stringify(summary), 'analyzed', records.length, datasetId);
  });
  tx();
  return summary;
}

// Cross-dataset entity resolution: exact project id, normalized name+state, mp+constituency.
function runCrossDatasetMatching() {
  const datasets = db.prepare("SELECT id FROM datasets WHERE status = 'analyzed'").all();
  db.prepare('DELETE FROM cross_matches').run();
  if (datasets.length < 2) return { activated: false, matches: 0 };

  const insert = db.prepare(`INSERT INTO cross_matches (dataset_a, dataset_b, record_a, record_b, match_type, confidence) VALUES (?,?,?,?,?,?)`);
  let matchCount = 0;
  const tx = db.transaction(() => {
    for (let i = 0; i < datasets.length; i++) {
      for (let j = i + 1; j < datasets.length; j++) {
        const dsA = datasets[i].id, dsB = datasets[j].id;
        const recsA = db.prepare('SELECT * FROM records WHERE dataset_id = ?').all(dsA);
        const recsB = db.prepare('SELECT * FROM records WHERE dataset_id = ?').all(dsB);

        const byProjectId = new Map();
        for (const b of recsB) {
          if (b.project_id) byProjectId.set(String(b.project_id).trim().toLowerCase(), b);
        }
        const byMpConst = new Map();
        for (const b of recsB) {
          if (b.mp_name) {
            const key = `${normalizeName(b.mp_name)}|${(b.constituency || '').toLowerCase()}`;
            byMpConst.set(key, b);
          }
        }
        for (const a of recsA) {
          if (a.project_id) {
            const key = String(a.project_id).trim().toLowerCase();
            if (byProjectId.has(key)) {
              insert.run(dsA, dsB, a.id, byProjectId.get(key).id, 'exact_project_id', 1.0);
              matchCount++;
              continue;
            }
          }
          if (a.mp_name) {
            const key = `${normalizeName(a.mp_name)}|${(a.constituency || '').toLowerCase()}`;
            if (byMpConst.has(key)) {
              insert.run(dsA, dsB, a.id, byMpConst.get(key).id, 'mp_constituency', 0.9);
              matchCount++;
              continue;
            }
            // fuzzy: normalized name only, cross state check for confidence
            for (const b of recsB) {
              if (b.mp_name && normalizeName(b.mp_name) === normalizeName(a.mp_name)) {
                const sameState = (a.state || '').toLowerCase() === (b.state || '').toLowerCase();
                insert.run(dsA, dsB, a.id, b.id, 'mp_name_fuzzy', sameState ? 0.75 : 0.55);
                matchCount++;
                break;
              }
            }
          }
        }
      }
    }
  });
  tx();
  return { activated: true, matches: matchCount };
}

module.exports = { runStatisticalAnalysis, runDuplicateDetection, runCrossDatasetMatching };
