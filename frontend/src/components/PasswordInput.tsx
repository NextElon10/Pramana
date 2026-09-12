import { useId, useState } from 'react';
import { useI18n } from '../i18n';

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** Dark form surfaces (the administrator portal) need inverted control colours. */
  tone?: 'light' | 'dark';
};

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M1.8 10S4.9 4.6 10 4.6 18.2 10 18.2 10 15.1 15.4 10 15.4 1.8 10 1.8 10Z"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.4" />
      {off && <path d="M3.5 3.5l13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />}
    </svg>
  );
}

/** Password field with an accessible show/hide control. */
export default function PasswordInput({
  id, value, onChange, label, autoComplete = 'current-password',
  required, placeholder, hint, tone = 'light',
}: Props) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const inputId = id || generatedId;
  const { t } = useI18n();

  const dark = tone === 'dark';
  const inputClass = dark
    ? 'w-full rounded border border-navy-600 bg-navy-950 px-3 py-2 pr-10 text-sm text-white placeholder:text-white/30 focus:border-saffron-500 focus:outline-none focus:ring-2 focus:ring-saffron-500/25'
    : 'input pr-10';

  return (
    <div>
      {label && (
        <label className={`field-label ${dark ? 'text-white/50' : ''}`} htmlFor={inputId}>
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          value={value}
          required={required}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
          aria-pressed={visible}
          title={visible ? t('auth.hidePassword') : t('auth.showPassword')}
          className={`absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r transition-colors ${
            dark ? 'text-white/45 hover:text-white' : 'text-ink-faint hover:text-navy-700'
          }`}
        >
          <EyeIcon off={visible} />
        </button>
      </div>
      {hint && <p className={`mt-1 text-2xs ${dark ? 'text-white/40' : 'text-ink-muted'}`}>{hint}</p>}
    </div>
  );
}
