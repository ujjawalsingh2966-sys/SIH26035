/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'w8lab-blue': '#1e3a8a',
        'w8lab-gray': '#f1f5f9',
      }
    },
  },
  plugins: [],
}
