import { useEffect, useRef, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { api, formatCompactINR, formatNumber } from '../../lib/api';
import { Card, CardHead, LoadingState, ErrorState, EmptyState, WorkflowSteps } from '../../components/Shared';
import { useAuth } from '../../context/AuthContext';

type Stage = 'idle' | 'previewing' | 'previewed' | 'uploading';

const STAGE_LABEL: Record<Stage, string> = {
  idle: '',
  previewing: 'Validating file and detecting schema…',
  previewed: '',
  uploading: 'Cleaning data, calculating statistics, detecting anomalies and matching datasets…',
};

const STEPS = ['Select', 'Preview', 'Schema', 'Confirm', 'Analysis'];

export default function Datasets() {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [name, setName] = useState('');
  const [house, setHouse] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const load = () => {
    setLoading(true); setListError('');
    api.get('/datasets').then((d) => setDatasets(d.datasets)).catch((e) => setListError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const onFileSelected = async (f: File) => {
    setFile(f); setStage('previewing'); setError('');
    setName(f.name.replace(/\.(csv|xlsx|xls)$/i, '').replace(/[-_]+/g, ' '));
    try {
      setPreview(await api.upload('/datasets/preview', (() => { const fd = new FormData(); fd.append('file', f); return fd; })()));
      setStage('previewed');
    } catch (e: any) {
      setError(e.message); setStage('idle'); setPreview(null);
    }
  };

  const confirmUpload = async () => {
    if (!file) return;
    setStage('uploading'); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('name', name); fd.append('house', house);
      await api.upload('/datasets/upload', fd);
      setPreview(null); setFile(null); setStage('idle'); setHouse('');
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (e: any) {
      setError(e.message); setStage('previewed');
    }
  };

  const cancelUpload = () => {
    setPreview(null); setFile(null); setStage('idle'); setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const reanalyze = async (id: number) => {
    setBusyId(id);
    try { await api.post(`/datasets/${id}/reanalyze`); load(); }
    catch (e: any) { setListError(e.message); }
    finally { setBusyId(null); }
  };

  const remove = async (id: number) => {
    if (!window.confirm('Delete this dataset and all of its records? This cannot be undone.')) return;
    setBusyId(id);
    try { await api.delete(`/datasets/${id}`); load(); }
    catch (e: any) { setListError(e.message); }
    finally { setBusyId(null); }
  };

  const currentStep = stage === 'idle' ? 0 : stage === 'previewing' ? 1 : stage === 'previewed' ? 2 : 4;

  return (
    <AdminLayout title="Dataset Manager" description="Upload, analyse and manage analytical datasets">
      <WorkflowSteps current="dataset" />
      {/* Upload workflow */}
      <Card className="mb-6">
        <CardHead title="Upload dataset" sub="CSV or XLSX · maximum 25 MB · unlimited number of datasets" />
        <div className="p-5">
          {/* Stepper */}
          <ol className="mb-5 flex flex-wrap items-center gap-2 text-2xs">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold ${
                  i <= currentStep ? 'border-navy-700 bg-navy-700 text-white' : 'border-line-strong text-ink-faint'}`}>
                  {i + 1}
                </span>
                <span className={i <= currentStep ? 'font-medium text-navy-800' : 'text-ink-faint'}>{s}</span>
                {i < STEPS.length - 1 && <span className="text-line-strong" aria-hidden="true">──</span>}
              </li>
            ))}
          </ol>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-line-strong bg-surface-raised px-6 py-8 text-center transition-colors hover:border-navy-400 hover:bg-navy-50">
            <span className="text-2xl text-navy-300" aria-hidden="true">↥</span>
            <span className="mt-2 text-[13px] font-medium text-navy-800">Choose a CSV or XLSX file</span>
            <span className="mt-1 text-2xs text-ink-muted">The file is validated and previewed before anything is stored.</span>
            <input
              ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="sr-only"
              onChange={(e) => e.target.files?.[0] && onFileSelected(e.target.files[0])}
            />
          </label>

          {STAGE_LABEL[stage] && <LoadingState label={STAGE_LABEL[stage]} />}
          {error && <div className="mt-4"><ErrorState message={error} /></div>}

          {stage === 'previewed' && preview && (
            <div className="mt-5 space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  ['Filename', preview.filename],
                  ['File size', `${(preview.sizeBytes / 1024).toFixed(1)} KB`],
                  ['Encoding', preview.encoding],
                  ['Rows', formatNumber(preview.rows)],
                  ['Columns', formatNumber(preview.columns.length)],
                ].map(([l, v]) => (
                  <div key={l} className="rounded border border-line bg-surface-raised px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-ink-muted">{l}</div>
                    <div className="mt-0.5 truncate text-[13px] font-medium" title={String(v)}>{v}</div>
                  </div>
                ))}
              </div>

              <div>
                <div className="mb-2 text-[13px] font-semibold text-navy-900">Detected schema mapping</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(preview.schemaMapping).length === 0 && (
                    <span className="text-[13px] text-ink-muted">No semantic fields detected — the dataset can still be stored, but statistical screening needs an amount column.</span>
                  )}
                  {Object.entries(preview.schemaMapping).map(([field, col]) => {
                    const strong = (preview.schemaConfidence[field] ?? 0) >= 0.7;
                    return (
                      <span key={field} className={`chip ${strong ? 'chip-good' : 'chip-warn'}`}>
                        {field} → {col as string} · {strong ? 'auto-mapped' : 'possible field detected'}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[13px] font-semibold text-navy-900">Sample rows</div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr>{preview.columns.map((c: string) => <th key={c}>{c}</th>)}</tr></thead>
                    <tbody>
                      {preview.sample.slice(0, 5).map((row: any, i: number) => (
                        <tr key={i}>{preview.columns.map((c: string) => <td key={c}>{String(row[c] ?? '')}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
                <div className="min-w-[220px] flex-1">
                  <label className="field-label" htmlFor="dname">Dataset name</label>
                  <input id="dname" className="input" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="field-label" htmlFor="dhouse">House (optional)</label>
                  <select id="dhouse" className="select" value={house} onChange={(e) => setHouse(e.target.value)}>
                    <option value="">Unspecified</option>
                    <option>Lok Sabha</option>
                    <option>Rajya Sabha</option>
                  </select>
                </div>
                <button onClick={confirmUpload} className="btn-primary">Confirm &amp; analyse</button>
                <button onClick={cancelUpload} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Dataset list */}
      {listError && <div className="mb-4"><ErrorState message={listError} onRetry={load} /></div>}
      {loading && <LoadingState label="Loading datasets…" />}
      {!loading && datasets.length === 0 && (
        <EmptyState icon="▤" title="No analytical dataset loaded" description="Upload a CSV or XLSX file above to begin statistical screening." />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {datasets.map((d) => (
          <Card key={d.id}>
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-semibold text-navy-900">{d.name}</span>
                  {d.is_demo ? <span className="badge-demo" title="Bundled sample dataset">Sample</span> : null}
                </div>
                <div className="mt-0.5 truncate text-2xs text-ink-muted">{d.filename} · {d.source}</div>
              </div>
              <span className={`chip ${d.status === 'analyzed' ? 'chip-good' : 'chip-warn'}`}>{d.status}</span>
            </div>

            <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
              {[
                ['Records', formatNumber(d.row_count)],
                ['Columns', formatNumber(d.column_count)],
                ['Mean', d.stats ? formatCompactINR(d.stats.mean) : '—'],
                ['Median', d.stats ? formatCompactINR(d.stats.median) : '—'],
              ].map(([l, v]) => (
                <div key={l} className="bg-white px-4 py-3">
                  <div className="text-[10px] uppercase tracking-wide text-ink-muted">{l}</div>
                  <div className="mt-0.5 text-[13px] font-semibold tabular-nums text-navy-900">{v}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
              <span className="text-2xs text-ink-muted">
                Uploaded {new Date(d.uploaded_at + 'Z').toLocaleString()}
                {d.analyzed_at ? ' · analysed' : ''}
              </span>
              <div className="flex gap-2">
                <button className="btn-secondary btn-sm" disabled={busyId === d.id} onClick={() => reanalyze(d.id)}>
                  {busyId === d.id ? 'Working…' : 'Re-analyse'}
                </button>
                {user?.role === 'superadmin' && (
                  <button className="btn-danger btn-sm" disabled={busyId === d.id} onClick={() => remove(d.id)}>Delete</button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {datasets.length >= 2 && (
        <p className="mt-4 text-2xs text-ink-muted">
          {datasets.length} datasets loaded — cross-dataset analysis is active. There is no maximum: each additional
          dataset joins the same ecosystem and is matched pairwise against every other analysed dataset.
        </p>
      )}
    </AdminLayout>
  );
}
