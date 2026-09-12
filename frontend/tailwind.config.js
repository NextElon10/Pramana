/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f2f5f9',
          100: '#e3e9f2',
          200: '#c7d3e6',
          300: '#9db1d1',
          400: '#6c88b6',
          500: '#4a689c',
          600: '#365182',
          700: '#2b4069',
          800: '#1d2e4f',
          900: '#132038',
          950: '#0b1526',
        },
        saffron: {
          400: '#ffab4d',
          500: '#ff9933',
          600: '#e07f1c',
        },
        indiagreen: '#128807',
        ink: {
          DEFAULT: '#16202e',
          muted: '#5b6675',
          faint: '#8b94a1',
        },
        line: {
          DEFAULT: '#e2e6ec',
          strong: '#cfd6e0',
        },
        surface: {
          DEFAULT: '#ffffff',
          sunken: '#f8fafc',
          raised: '#fafbfd',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        display: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['11px', '15px'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(19, 32, 56, 0.05), 0 1px 3px rgba(19, 32, 56, 0.04)',
        raised: '0 2px 4px rgba(19, 32, 56, 0.06), 0 8px 20px -6px rgba(19, 32, 56, 0.12)',
        panel: '-12px 0 40px rgba(11, 21, 38, 0.20)',
        inset: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      },
      borderRadius: {
        DEFAULT: '3px',
        md: '4px',
        lg: '6px',
      },
      keyframes: {
        'slide-in': {
          from: { transform: 'translateX(16px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'slide-in': 'slide-in 180ms ease-out',
        'fade-in': 'fade-in 140ms ease-out',
      },
    },
  },
  plugins: [],
};
