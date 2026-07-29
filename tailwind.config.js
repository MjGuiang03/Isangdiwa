/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: '#0D1F45',
        'navy-light': '#1e3a5f',
        'navy-accent': '#4a90d9',
        gold: {
          DEFAULT: '#F5C800',
          text: 'var(--gold-text)',
          tint: 'var(--gold-tint)',
        },
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          accent: 'var(--sidebar-accent)',
          border: 'var(--sidebar-border)',
        },
        'input-bg': 'var(--input-background)',
        'input-border': 'var(--input-border)',
        'switch-bg': 'var(--switch-background)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted-custom': 'var(--text-muted)',
        'text-timestamp': 'var(--text-timestamp)',
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        cormorant: ['Cormorant Garamond', 'serif'],
        dm: ['DM Sans', 'sans-serif'],
        arial: ['Arial', 'sans-serif'],
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        badgePop: {
          from: { transform: 'scale(0.6)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        shine: {
          '0%': { transform: 'translateX(-100%) rotate(30deg)' },
          '20%': { transform: 'translateX(300%) rotate(30deg)' },
          '100%': { transform: 'translateX(300%) rotate(30deg)' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.95)', opacity: '0.8' },
          '50%': { transform: 'scale(1.05)', opacity: '0.4' },
          '100%': { transform: 'scale(0.95)', opacity: '0.8' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.2s ease',
        slideUp: 'slideUp 0.25s ease',
        badgePop: 'badgePop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        shimmer: 'shimmer 1.5s infinite',
        ticker: 'ticker 35s linear infinite',
        shine: 'shine 6s ease-in-out infinite',
        pulseRing: 'pulseRing 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
