/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Domates kirmizisi. Beyaz yaziyla okunakli koyulukta (600) eylem rengi.
        lz: {
          50: '#fff2ee',
          100: '#ffe0d8',
          200: '#ffc0b0',
          300: '#ff957d',
          400: '#f86a4d',
          500: '#ee4c2e',
          600: '#d93d20',
          700: '#b52f17',
          800: '#8f2716',
          900: '#6f2214'
        }
      }
    }
  },
  plugins: []
}
