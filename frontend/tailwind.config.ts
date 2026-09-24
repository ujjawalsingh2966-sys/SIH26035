import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
          200: '#e2e8f0',
          100: '#f1f5f9'
        }
      }
    },
  },
  plugins: [],
}
export default config
