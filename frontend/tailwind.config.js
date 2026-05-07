/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:      'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        card:    'rgb(var(--card) / <alpha-value>)',
        border:  'rgb(var(--border) / <alpha-value>)',
        muted:   'rgb(var(--muted) / <alpha-value>)',
        subtle:  'rgb(var(--subtle) / <alpha-value>)',
        text:    'rgb(var(--text) / <alpha-value>)',
        primary: 'rgb(var(--primary) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        danger:  'rgb(var(--danger) / <alpha-value>)',
        purple:  'rgb(var(--purple) / <alpha-value>)',
      },
    },
  },
  plugins: [],
}
