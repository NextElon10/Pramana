import { PageHeading } from '../../components/PublicLayout';
import { Card, Disclaimer } from '../../components/Shared';

const CAPABILITIES = [
  ['Public transparency', 'Browsing project, allocation, member and state information exactly as loaded from uploaded datasets.'],
  ['Statistical analysis', 'Descriptive statistics with IQR, Z-score, Modified Z-score and percentile screening, computed per dataset.'],
  ['Dataset comparison', 'Cross-dataset entity matching with visible confidence scores once two or more datasets are loaded.'],
  ['Human review', 'Every statistical signal enters an administrator review workflow rather than producing an automated verdict.'],
];

const METHODS = [
  ['Interquartile range (IQR)', 'Q1 and Q3 are the 25th and 75th percentiles; IQR = Q3 − Q1. A value above Q3 + 1.5×IQR is flagged, and above Q3 + 3×IQR is treated as extreme.'],
  ['Z-score', 'Z = (x − mean) / standard deviation. Flagged when |Z| > 3, extreme when |Z| > 4. Handled safely when the standard deviation is zero.'],
  ['Modified Z-score', 'M = 0.6745 × (x − median) / MAD, using the median absolute deviation, which is robust to outliers. Flagged when |M| > 3.5.'],
  ['Percentile position', 'Each value is positioned against the 95th and 99th percentiles of the analysed distribution.'],
];

export default function About() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeading
        title="About PRAMANA"
        description="PRAMANA is a statistical transparency and analytical prototype designed to help users explore available MPLADS-related data and identify unusual statistical patterns."
      />

      <div className="space-y-5">
        {/* About the scheme — the MPLADS artwork sits behind this section as a faint
            watermark (see .scheme-watermark in index.css). It is decorative only. */}
        <Card className="scheme-watermark overflow-hidden p-6 sm:p-8">
          <h2 className="text-base">About the MPLADS scheme</h2>
          <p className="prose-note mt-3 max-w-2xl text-pretty">
            The Members of Parliament Local Area Development Scheme (MPLADS) is administered by the Ministry
            of Statistics and Programme Implementation. Under the scheme, each Member of Parliament may
            recommend works of a developmental nature — with an emphasis on durable community assets — to the
            district authority responsible for implementation. Lok Sabha members recommend works in their own
            constituency; Rajya Sabha members recommend works anywhere in the State from which they are
            elected. Entitlements, eligible works and sanction procedures are set out in the Government&rsquo;s
            published scheme guidelines.
          </p>
          <p className="prose-note mt-3 max-w-2xl text-pretty">
            PRAMANA does not administer any part of the scheme and holds no authority over it. It reads
            allocation data that has already been published, and reports where the numbers in that data
            differ from the rest of their own distribution.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="text-base">What PRAMANA provides</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {CAPABILITIES.map(([t, d]) => (
              <div key={t} className="rounded border border-line bg-surface-raised p-4">
                <dt className="text-[13px] font-semibold text-navy-800">{t}</dt>
                <dd className="prose-note mt-1">{d}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="p-6">
          <h2 className="text-base">Screening methodology</h2>
          <p className="prose-note mt-2">
            Each dataset is analysed independently. Thresholds are derived from that dataset's own distribution — no
            threshold is hard-coded. Classification is driven by how many independent methods agree:
            one signal is “Slightly Unusual”, two is “Unusual”, three or more is “Highly Unusual”, and any extreme
            IQR or Z threshold escalates to “Extreme Statistical Anomaly”.
          </p>
          <div className="mt-4 divide-y divide-line border-y border-line">
            {METHODS.map(([t, d]) => (
              <div key={t} className="grid gap-1 py-3 sm:grid-cols-[190px_1fr] sm:gap-4">
                <div className="text-[13px] font-semibold text-navy-800">{t}</div>
                <div className="prose-note">{d}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-base">Limitations</h2>
          <ul className="prose-note mt-3 list-disc space-y-1.5 pl-5">
            <li>PRAMANA analyses only the data it is given. It does not connect to any Government system or API.</li>
            <li>A field a source file does not carry is labelled “Not provided in source data”, and a fact that does not apply — a Rajya Sabha member has no constituency — is labelled and explained. Neither is ever inferred or filled in.</li>
            <li>Allocation limits vary legitimately with a member's term length, house and entry date — a high or low value is frequently explained by these factors alone.</li>
            <li>Cross-dataset matches are shown with a confidence score; uncertain matches are never silently merged.</li>
          </ul>
        </Card>

        <Disclaimer>
          <strong>Disclaimer.</strong> PRAMANA is a statistical screening and transparency prototype. Statistical
          anomalies do not constitute evidence of wrongdoing and require human review and verification. Statistical
          deviation is not misconduct, a high allocation is not corruption, and a high anomaly score is not guilt.
        </Disclaimer>

        <Card className="p-6">
          <h2 className="text-base">Relationship to e-SAKSHI</h2>
          <p className="prose-note mt-2">
            <strong className="text-ink">PRAMANA is not the official e-SAKSHI portal</strong> and is not owned,
            operated or endorsed by the Government of India. Official MPLADS information is available through the
            Government of India e-SAKSHI portal.
          </p>
          <a className="btn-secondary btn-sm mt-4" href="https://mplads.mospi.gov.in/digigov/dashboard.html" target="_blank" rel="noreferrer">
            Visit the official e-SAKSHI portal ↗
          </a>
        </Card>
      </div>
    </div>
  );
}
