import { PageHeading } from '../../components/PublicLayout';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-[17px] font-bold tracking-tight text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 text-[13px] leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export default function Policy() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeading
        title="Policies and data disclaimer"
        description="How PRAMANA sources its data, what it stores about you, and the limits of what its analysis can be taken to mean."
      />

      <nav aria-label="On this page" className="mb-5 flex flex-wrap gap-2">
        {[
          ['disclaimer', 'Data disclaimer'],
          ['freshness', 'Data freshness'],
          ['privacy', 'Privacy'],
          ['terms', 'Terms of use'],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900"
          >
            {label}
          </a>
        ))}
      </nav>

      <div className="space-y-4">
        <Section id="disclaimer" title="Data disclaimer">
          <p>
            <strong className="text-slate-900">PRAMANA is not the official e-SAKSHI portal.</strong> It is an
            independent statistical prototype and is not owned, operated or endorsed by the Government of
            India. The Members of Parliament Local Area Development Scheme is administered by the Ministry of
            Statistics and Programme Implementation; authoritative MPLADS information is published on the
            Government&rsquo;s own portal at{' '}
            <a className="font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
              href="https://mplads.mospi.gov.in/digigov/dashboard.html" target="_blank" rel="noreferrer">
              mplads.mospi.gov.in ↗
            </a>. Where the two differ, the official portal is correct.
          </p>
          <p>
            PRAMANA analyses only the files loaded into it. It does not connect to any Government system or
            API, and it never fills in a value the source does not provide — a field absent from a dataset is
            labelled as absent rather than estimated.
          </p>
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
            <strong>A flagged record is a screening signal, not a finding.</strong> The statistical methods
            used here identify values that sit far from the rest of their own distribution. That is a reason
            for a person to look, never evidence of fraud, corruption or wrongdoing by any member, official or
            state. Allocation and utilisation vary legitimately with a member&rsquo;s term length, House, date
            of entry and the pace of local implementation.
          </p>
        </Section>

        <Section id="freshness" title="Data freshness">
          <p>
            PRAMANA holds a point-in-time extract. It does not poll any upstream system, so nothing here
            updates on its own: the figures are exactly as current as the most recent dataset an administrator
            uploaded, and the upload date of every dataset is recorded and visible in the administrator&rsquo;s
            dataset manager.
          </p>
          <p>
            Published MPLADS data is itself a lagging record — works are entered, sanctioned, executed and
            paid over months, so recommended, completed and paid figures for the same work appear at different
            times. A low utilisation figure frequently reflects that lag rather than inactivity.
          </p>
          <p>
            For any decision that matters, verify against the official portal and the relevant district
            authority before acting.
          </p>
        </Section>

        <Section id="privacy" title="Privacy">
          <p>
            <strong className="text-slate-900">The public portal requires no account.</strong> You can browse
            every public page without signing in, and PRAMANA does not ask for your name, email or any other
            personal detail to do so.
          </p>
          <p>What is stored, in full:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Administrator session cookie</strong> — set only when an official signs in. HTTP-only, so
              page scripts cannot read it, and revoked on sign-out or password change.
            </li>
            <li>
              <strong>Display preferences in your browser</strong> — language, House filter and your cookie
              choice, kept in local storage. These never reach the server.
            </li>
            <li>
              <strong>Administrator audit log</strong> — actions taken inside the admin portal, with the acting
              account and IP address, so that every change to a review or dataset is attributable.
            </li>
          </ul>
          <p>
            There is <strong>no analytics, advertising or third-party tracking</strong> of any kind, and no
            data is shared with anyone. Questions asked of the data assistant are logged as text so that
            administrators can see what the system was asked; do not type personal information into it.
          </p>
        </Section>

        <Section id="terms" title="Terms of use">
          <p>
            PRAMANA is provided for demonstration and evaluation. It carries no warranty of accuracy,
            completeness or fitness for any purpose, and nothing in it constitutes legal, financial or
            official advice.
          </p>
          <p>
            You may explore, filter and export the data it holds. You may not present its output as an
            official Government record, nor represent a statistical flag as a finding of misconduct against
            any person or body. Exports carry a prototype watermark for that reason.
          </p>
          <p>
            Names of Members of Parliament, constituencies and states appear here because they are part of
            published public records of a public scheme. They are shown as published, and PRAMANA draws no
            conclusion about any individual.
          </p>
        </Section>
      </div>
    </div>
  );
}
