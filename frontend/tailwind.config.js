/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:      '#0d0f12',
        surface: '#151820',
        card:    '#1c2030',
        border:  '#2a2f45',
        muted:   '#6b7280',
        subtle:  '#9ca3af',
        text:    '#e8eaf6',
        primary: '#5b7cfa',
        success: '#34d399',
        danger:  '#f87171',
        purple:  '#a78bfa',
      },
    },
  },
  plugins: [],
}
