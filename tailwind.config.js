/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pine: '#1c2b21',
        moss: '#4a5d42',
        sand: '#efe8d8',
        paper: '#f7f3e8',
        clay: '#b5652d',
        dusk: '#2b3a54',
        ink: '#1a1a16',
        line: 'rgba(28, 43, 33, 0.18)',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"Work Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        sm: '2px',
        DEFAULT: '3px',
        md: '4px',
      },
    },
  },
  plugins: [],
}