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
        },
        // Cihaz renkleri: hangi cihazda oldugun bir bakista anlasilsin
        tm: { DEFAULT: '#2E7D5B', 50: '#e8f4ee', 700: '#23634a' },
        pp: { DEFAULT: '#B06A4F', 50: '#f7ece7', 700: '#8d523c' },
        // Uyari kutulari: beyaz kartta okunur koyu kahve yazi, biraz koyu sari zemin
        amber: {
          50: '#fbe9b7',
          100: '#f8dd94',
          200: '#f3cf6e',
          300: '#e9b949',
          400: '#d9a22e',
          500: '#c08a1c',
          600: '#9a6b12',
          700: '#6e4a10',
          800: '#56380e',
          900: '#3f290b'
        }
      }
    }
  },
  plugins: []
}
