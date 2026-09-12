import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { api, formatCompactINR, formatINR, formatNumber } from '../../lib/api';
import { Card, CardHead, LoadingState, ErrorState, EmptyState, RiskBadge, Disclaimer, WorkflowSteps } from '../../components/Shared';

export default function Reports() {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/datasets').then((d) => {
      setDatasets(d.datasets);
      if (d.datasets.length) generate(d.datasets[0].id);
    }).catch((e) => setError(e.message));
  }, []);

  const generate = async (id: number) => {
    setSelected(id); setLoading(true); setError(''); setReport(null);
    try { setReport(await api.get(`/reports/${id}/json`)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const stats = report?.statistics;

  return (
    <AdminLayout title="Statistical Screening Report" description="Generated from actual analysis output, per dataset">
      <WorkflowSteps current="report" />
      {datasets.length === 0 && !error && (
        <EmptyState icon="▦" title="No dataset available" description="Upload and analyse a dataset before generating a report." />
      )}

      {datasets.length > 0 && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-center gap-2 p-4">
            <span className="text-2xs uppercase tracking-wide text-ink-muted mr-1">Dataset</span>
            {datasets.map((d) => (
              <button
                key={d.id} onClick={() => generate(d.id)}
                className={selected === d.id ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              >
                {d.name.replace('DEMONSTRATION DATA — ', '')}
              </button>
            ))}
          </div>
        </Card>
      )}

      {loading && <LoadingState label="Generating statistical screening report…" />}
      {error && <ErrorState message={error} />}

      {report && !loading && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div>
                <h2 className="text-base">{report.datasetName}</h2>
                <p className="mt-1 text-2xs text-ink-muted">
                  Source: {report.source} · Generated {new Date(report.generatedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <a className="btn-primary btn-sm" href={`/api/reports/${selected}/pdf`} target="_blank" rel="noreferrer">Download PDF</a>
                <a className="btn-secondary btn-sm" href={`/api/reports/${selected}/csv`} target="_blank" rel="noreferrer">Download CSV</a>
                <a className="btn-secondary btn-sm" href={`/api/reports/${selected}/json`} target="_blank" rel="noreferrer">Download JSON</a>
                <button className="btn-secondary btn-sm" onClick={() => window.print()}>Print</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
              {[
                ['Records analysed', formatNumber(report.recordsAnalysed)],
                ['Records excluded', formatNumber(report.recordsExcluded)],
                ['Mean allocation', formatCompactINR(stats?.mean)],
                ['Median allocation', formatCompactINR(stats?.median)],
              ].map(([l, v]) => (
                <div key={l} className="bg-white px-4 py-3">
                  <div className="text-[10px] uppercase tracking-wide text-ink-muted">{l}</div>
                  <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-navy-900">{v}</div>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHead title="Descriptive statistics" sub="Computed from the dataset's allocation distribution" />
              <div className="table-wrap border-0 shadow-none">
                <table className="data-table">
                  <tbody>
                    {[
                      ['Count', formatNumber(stats?.count)],
                      ['Mean', formatINR(stats?.mean)],
                      ['Median', formatINR(stats?.median)],
                      ['Standard deviation', formatINR(stats?.stddev)],
                      ['Minimum', formatINR(stats?.min)],
                      ['Maximum', formatINR(stats?.max)],
                      ['Q1 (25th percentile)', formatINR(stats?.q1)],
                      ['Q3 (75th percentile)', formatINR(stats?.q3)],
                      ['IQR', formatINR(stats?.iqr)],
                      ['IQR upper bound (Q3 + 1.5×IQR)', formatINR(stats?.iqrUpper)],
                      ['95th percentile', formatINR(stats?.p95)],
                      ['99th percentile', formatINR(stats?.p99)],
                      ['Skewness', stats?.skewness?.toFixed(4)],
                    ].map(([l, v]) => (
                      <tr key={l as string}>
                        <td className="text-ink-muted">{l}</td>
                        <td className="num font-medium">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <CardHead title="Risk distribution" sub="Classification counts for this dataset" />
              <div className="p-5">
                <div className="space-y-2">
                  {report.riskDistribution.map((r: any) => {
                    const pct = (r.c / report.recordsAnalysed) * 100;
                    return (
                      <div key={r.classification}>
                        <div className="flex items-center justify-between text-[13px]">
                          <RiskBadge classification={r.classification} short />
                          <span className="tabular-nums text-ink-muted">{formatNumber(r.c)} · {pct.toFixed(1)}%</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-sm bg-navy-100">
                          <div className="h-1.5 rounded-sm bg-navy-600" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-5 border-t border-line pt-4">
                  <div className="text-2xs uppercase tracking-wide text-ink-muted">Methodology</div>
                  <p className="prose-note mt-1">{report.methodology}</p>
                </div>
              </div>
            </Card>
          </div>

          <Card>
            <CardHead title="Top flagged records" sub="Highest anomaly scores in this dataset" />
            <div className="table-wrap border-0 shadow-none">
              <table className="data-table">
                <thead>
                  <tr><th>MP / Member</th><th>State</th><th className="text-right">Amount</th><th>Classification</th><th className="text-right">Score</th><th>Explanation</th></tr>
                </thead>
                <tbody>
                  {report.topFlaggedRecords.map((r: any, i: number) => (
                    <tr key={i}>
                      <td className="font-medium text-navy-900">{r.mp_name}</td>
                      <td>{r.state}</td>
                      <td className="num font-medium">{formatCompactINR(r.amount)}</td>
                      <td><RiskBadge classification={r.classification} short /></td>
                      <td className="num">{r.anomaly_score}</td>
                      <td className="max-w-md text-2xs text-ink-muted">{r.explanation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-2xs uppercase tracking-wide text-ink-muted">Interpretation</div>
            <p className="prose-note mt-1">{report.interpretation}</p>
          </Card>

          <Disclaimer>{report.disclaimer}</Disclaimer>
        </div>
      )}
    </AdminLayout>
  );
}
