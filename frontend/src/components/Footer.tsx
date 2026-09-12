import { Link } from 'react-router-dom';
import PramanaMark from './PramanaMark';
import { useI18n } from '../i18n';

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-16">
      <div className="tricolour-rule" />
      <div className="bg-navy-950 text-white/70">
        <div className="shell grid grid-cols-1 gap-8 py-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <PramanaMark size={26} />
              <span className="text-sm font-bold tracking-[0.14em] text-white">PRAMANA</span>
            </div>
            <p className="text-[12px] leading-relaxed">
              A statistical transparency and analytical prototype for exploring MPLADS-related data
              and screening for unusual statistical patterns.
            </p>
          </div>

          <div>
            <div className="mb-3 text-2xs font-semibold uppercase tracking-[0.12em] text-white">{t('footer.explore')}</div>
            <ul className="space-y-1.5 text-[12px]">
              <li><Link className="hover:text-white" to="/projects">Project Explorer</Link></li>
              <li><Link className="hover:text-white" to="/states">State Explorer</Link></li>
              <li><Link className="hover:text-white" to="/compare">Compare Constituencies</Link></li>
              <li><Link className="hover:text-white" to="/about">About &amp; Methodology</Link></li>
            </ul>
          </div>

          <div>
            <div className="mb-3 text-2xs font-semibold uppercase tracking-[0.12em] text-white">{t('footer.information')}</div>
            <ul className="space-y-1.5 text-[12px]">
              <li><Link className="hover:text-white" to="/policy#disclaimer">Data Disclaimer</Link></li>
              <li><Link className="hover:text-white" to="/policy#privacy">Privacy Policy</Link></li>
              <li><Link className="hover:text-white" to="/policy#terms">Terms of Use</Link></li>
              <li><Link className="hover:text-white" to="/policy#freshness">Data Freshness</Link></li>
            </ul>
          </div>

          <div>
            <div className="mb-3 text-2xs font-semibold uppercase tracking-[0.12em] text-white">{t('footer.officialSource')}</div>
            <a
              className="inline-block text-[12px] text-saffron-400 underline underline-offset-2 hover:text-saffron-500"
              href="https://mplads.mospi.gov.in/digigov/dashboard.html" target="_blank" rel="noreferrer"
            >
              e-SAKSHI / MPLADS Portal ↗
            </a>
            <p className="mt-3 text-[11px] leading-relaxed text-white/55">
              PRAMANA is <strong className="text-white/80">not</strong> the official e-SAKSHI portal and is not owned
              or endorsed by the Government of India. Statistical anomalies do not constitute evidence of wrongdoing
              and require human review and verification.
            </p>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="shell py-4 text-[11px] text-white/45 flex flex-col sm:flex-row justify-between gap-2">
            <span>PRAMANA — statistical transparency and analytical prototype.</span>
            <span>Government of India · Ministry of Statistics and Programme Implementation (illustrative context only)</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
