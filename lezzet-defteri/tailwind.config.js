/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        defter: ['Fraunces', 'Georgia', 'Times New Roman', 'serif'],
        elyazisi: ['Caveat', 'Segoe Print', 'cursive']
      },
      colors: {
        // Kagit beyazi: saf beyaz yerine cok hafif krem (kartlar "fis" gibi dursun)
        white: '#FFFDF8',
        // Domates kirmizisi. Beyaz yaziyla okunakli koyulukta (600) eylem rengi.
        lz: {
          50: '#F3EADB', // kagit tonu (eski acik pembe yerine)
          100: '#EADFCB',
          200: '#ffc0b0',
          300: '#ff957d',
          400: '#f86a4d',
          500: '#ee4c2e',
          600: '#D0381B', // kagit beyazi yaziyla 4,8:1
          700: '#8E2A14', // kiremit murekkebi
          800: '#8f2716',
          900: '#6f2214'
        },
        // Cihaz renkleri: hangi cihazda oldugun bir bakista anlasilsin
        tm: { DEFAULT: '#2E7D5B', 50: '#e8f4ee', 700: '#23634a' },
        pp: { DEFAULT: '#A0603F', 50: '#f7ece7', 700: '#8d523c' },
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
