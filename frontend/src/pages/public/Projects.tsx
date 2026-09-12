import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, formatCompactINR, NOT_AVAILABLE } from '../../lib/api';
import { useI18n } from '../../i18n';
import { PageHeading } from '../../components/PublicLayout';
import { Card, EmptyState, ErrorState, TableSkeleton, Pagination, ProjectThumb } from '../../components/Shared';
import ProjectDrawer, { type PublicProject } from '../../components/ProjectDrawer';

const PAGE_SIZE = 25;

type Availability = Record<string, { present: boolean; ratio: number }>;

export default function Projects() {
  const [params, setParams] = useSearchParams();
  const { t } = useI18n();

  const [data, setData] = useState<{ total: number; results: PublicProject[] } | null>(null);
  const [states, setStates] = useState<string[]>([]);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<PublicProject | null>(null);
  const [q, setQ] = useState(params.get('q') || '');

  const page = parseInt(params.get('page') || '1', 10);
  const activeFilters = useMemo(
    () => Array.from(params.entries()).filter(([k]) => k !== 'page'),
    [params],
  );

  const load = () => {
    setLoading(true);
    setError('');
    const qp = new URLSearchParams(params);
    qp.set('page', String(page));
    qp.set('pageSize', String(PAGE_SIZE));
    api.get(`/projects?${qp.toString()}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [params]);
  useEffect(() => { setQ(params.get('q') || ''); }, [params]);
  useEffect(() => {
    api.get('/states').then((d) => setStates(d.states.map((s: any) => s.state))).catch(() => setStates([]));
    api.get('/projects/field-availability')
      .then((d) => setAvailability(d.availability))
      .catch(() => setAvailability(null));
  }, []);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.set('page', '1');
    setParams(next);
  };

  const goToPage = (p: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(p));
    setParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** A column is shown only when the loaded data actually fills it. */
  const show = (field: string) => !availability || availability[field]?.present;

  /* The thumbnail column appears only when the loaded data can actually fill it —
     with a photograph, or at least a sector to draw a mark from. Otherwise it would
     be a column of identical placeholders carrying no information. */
  const showThumb = Boolean(availability && (availability.imageUrl?.present || availability.domain?.present));

  return (
    <div>
      <PageHeading
        title={t('projects.title')}
        description="Search and filter the MPLADS records loaded into PRAMANA. Columns appear only where the source data provides them, so the table shows what exists rather than empty structure."
      />

      <Card className="mb-5">
        <form
          onSubmit={(e) => { e.preventDefault(); setFilter('q', q); }}
          className="grid gap-4 p-5 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end"
        >
          <div>
            <label className="field-label" htmlFor="q">{t('projects.search')}</label>
            <input
              id="q" value={q} onChange={(e) => setQ(e.target.value)} className="input"
              placeholder={`${t('projects.member')}, ${t('projects.state')}…`}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="state">{t('projects.state')}</label>
            <select id="state" className="select" value={params.get('state') || ''} onChange={(e) => setFilter('state', e.target.value)}>
              <option value="">{t('projects.allStates')}</option>
              {states.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="house">{t('projects.house')}</label>
            <select id="house" className="select" value={params.get('house') || ''} onChange={(e) => setFilter('house', e.target.value)}>
              <option value="">{t('projects.bothHouses')}</option>
              <option value="Lok Sabha">Lok Sabha</option>
              <option value="Rajya Sabha">Rajya Sabha</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">{t('action.search')}</button>
            <button type="button" className="btn-secondary" onClick={() => { setQ(''); setParams({}); }}>
              {t('action.reset')}
            </button>
          </div>
        </form>

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-raised px-5 py-2.5">
            <span className="text-2xs uppercase tracking-wide text-ink-muted">Active filters</span>
            {activeFilters.map(([k, v]) => (
              <button
                key={k} onClick={() => setFilter(k, '')}
                className="chip chip-neutral transition-colors hover:border-navy-400"
              >
                {k}: {v} <span aria-hidden="true">✕</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {loading && <TableSkeleton rows={8} cols={6} />}
      {error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && data && data.total === 0 && (
        <EmptyState
          icon="⌕"
          title={t('projects.noResults')}
          description="No records match the current filters. Try widening your search or clearing the filters."
          action={<button className="btn-secondary" onClick={() => { setQ(''); setParams({}); }}>{t('action.reset')}</button>}
        />
      )}

      {!loading && !error && data && data.total > 0 && (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {showThumb && <th className="w-14"><span className="sr-only">Image</span></th>}
                  <th>{t('projects.member')}</th>
                  {show('state') && <th>{t('projects.state')}</th>}
                  {show('constituency') && <th>{t('projects.constituency')}</th>}
                  {show('district') && <th>District</th>}
                  {show('projectName') && <th>Project</th>}
                  {show('domain') && <th>{t('projects.domain')}</th>}
                  <th className="text-right">{t('projects.allocation')}</th>
                  {show('house') && <th>{t('projects.house')}</th>}
                  {show('financialYear') && <th>Year</th>}
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((p) => (
                  <tr
                    key={p.id}
                    className="row-clickable"
                    tabIndex={0}
                    onClick={() => setSelected(p)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setSelected(p); }}
                  >
                    {showThumb && (
                      <td>
                        <ProjectThumb
                          imageUrl={p.imageUrl}
                          domain={p.domain}
                          projectName={p.projectName}
                          state={p.state}
                          size="sm"
                        />
                      </td>
                    )}
                    <td className="font-medium text-navy-900">{p.mp}</td>
                    {show('state') && <td>{p.state}</td>}
                    {show('constituency') && (
                      <td>
                        {p.constituencyStatus === 'provided' ? p.constituency : (
                          <span className="text-2xs italic text-ink-faint" title={p.constituencyNote || undefined}>
                            {p.constituencyStatus === 'not-applicable' ? 'Rajya Sabha seat' : 'Not in source'}
                          </span>
                        )}
                      </td>
                    )}
                    {show('district') && <td>{p.district === NOT_AVAILABLE ? '—' : p.district}</td>}
                    {show('projectName') && <td>{p.projectName === NOT_AVAILABLE ? '—' : p.projectName}</td>}
                    {show('domain') && <td>{p.domain === NOT_AVAILABLE ? '—' : p.domain}</td>}
                    <td className="num font-medium">{formatCompactINR(p.allocation)}</td>
                    {show('house') && <td>{p.house === NOT_AVAILABLE ? '—' : p.house}</td>}
                    {show('financialYear') && <td>{p.financialYear === NOT_AVAILABLE ? '—' : p.financialYear}</td>}
                    <td className="text-right">
                      <button
                        className="btn-secondary btn-sm"
                        onClick={(e) => { e.stopPropagation(); setSelected(p); }}
                      >
                        {t('projects.viewDetails')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onChange={goToPage} />
        </>
      )}

      <ProjectDrawer project={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
