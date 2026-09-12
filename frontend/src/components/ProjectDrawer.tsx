import { useEffect } from 'react';
import { formatINR, NOT_AVAILABLE } from '../lib/api';
import { useI18n } from '../i18n';
import { ProjectThumb } from './Shared';

export type PublicProject = {
  id: number;
  datasetId: number;
  projectId: string;
  projectName: string;
  description: string;
  domain: string;
  state: string;
  district: string;
  constituency: string;
  constituencyStatus?: 'provided' | 'not-applicable' | 'missing';
  constituencyNote?: string | null;
  mp: string;
  allocation: number | null;
  financialYear: string;
  house: string;
  memberType: string;
  status: string;
  imageUrl?: string | null;
};

function Row({ label, value, note }: { label: string; value: string; note?: string | null }) {
  const notApplicable = value.startsWith('Not applicable');
  return (
    <div className="grid grid-cols-[132px_1fr] gap-3 border-b border-line py-2.5 last:border-b-0">
      <dt className="pt-0.5 text-2xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className={notApplicable ? 'text-[13px] leading-relaxed text-ink-muted' : 'text-[13px] text-ink'}>
        {value}
        {note && <span className="mt-1 block text-2xs leading-relaxed text-ink-faint">{note}</span>}
      </dd>
    </div>
  );
}

export default function ProjectDrawer({ project, onClose }: { project: PublicProject | null; onClose: () => void }) {
  const { t } = useI18n();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (project) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [project, onClose]);

  if (!project) return null;

  /**
   * Only fields the source actually carries are listed. A field the dataset does not
   * provide is left out entirely rather than printed as a row of "not available" —
   * except where absence is itself meaningful (a Rajya Sabha member has no
   * constituency by design), which is explained in place.
   */
  const candidates: [string, string, (string | null)?][] = [
    ['Project', project.projectName],
    ['Project ID', project.projectId],
    [t('projects.domain'), project.domain],
    [t('projects.state'), project.state],
    ['District', project.district],
    [
      t('projects.constituency'),
      project.constituency,
      project.constituencyStatus === 'provided' ? null : project.constituencyNote,
    ],
    [t('projects.member'), project.mp],
    ['Financial year', project.financialYear],
    [t('projects.house'), project.house],
    ['Member type', project.memberType],
    ['Status', project.status],
  ];
  const rows = candidates.filter(([, value]) => value && value !== NOT_AVAILABLE);
  const omitted = candidates.length - rows.length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Record details">
      <div className="absolute inset-0 bg-navy-950/45 animate-fade-in" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-panel animate-slide-in">
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <ProjectThumb
              imageUrl={project.imageUrl}
              domain={project.domain}
              projectName={project.projectName}
              state={project.state}
              size="sm"
            />
            <div className="min-w-0">
              <div className="text-2xs uppercase tracking-wide text-ink-muted">MPLADS record</div>
              <h2 className="mt-0.5 truncate text-base">{project.mp}</h2>
            </div>
          </div>
          <button onClick={onClose} className="btn-secondary btn-sm" aria-label="Close panel">
            {t('action.close')}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-5 rounded-md border border-line bg-surface-raised p-4">
            <div className="stat-label">{t('projects.allocation')}</div>
            <div className="stat-value mt-1.5">
              {project.allocation === null
                ? <span className="text-base italic text-ink-faint">Not recorded</span>
                : formatINR(project.allocation)}
            </div>
          </div>

          <dl>{rows.map(([label, value, note]) => <Row key={label} label={label} value={value} note={note} />)}</dl>

          {omitted > 0 && (
            <p className="mt-5 border-t border-line pt-4 text-2xs leading-relaxed text-ink-muted">
              {omitted} further field{omitted === 1 ? ' is' : 's are'} not carried by the dataset this record
              came from, so {omitted === 1 ? 'it is' : 'they are'} not shown. PRAMANA never infers a value the
              source does not provide.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
