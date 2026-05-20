import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f6f6f7',
          100: '#e2e3e5',
          200: '#c4c6cb',
          300: '#9ea2ab',
          400: '#787d88',
          500: '#5e636e',
          600: '#494d56',
          700: '#3a3d44',
          800: '#27292e',
          900: '#16171a',
          950: '#0b0c0e',
        },
        brand: {
          DEFAULT: '#C9A84C',
          50: '#fbf6e6',
          500: '#C9A84C',
          700: '#8a7126',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['ui-serif', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config
