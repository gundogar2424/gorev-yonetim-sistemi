/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // MARKA: MyFitnessPal'daki gibi tek, guclu bir MAVI vurgu.
        // Yalnizca EYLEM icin kullanilir (buton / aktif sekme / link);
        // genel yuzeyler notr kalir. Boylece arayuz sakin ve profesyonel durur.
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#1a6dff',
          700: '#1857d6',
          800: '#1746ac',
          900: '#173a86'
        },
        // MAKRO renkleri (MFP ile ayni dil): karbonhidrat / yag / protein
        macro: {
          carb: '#2dd4bf',
          fat: '#a78bfa',
          protein: '#f5a623'
        }
      },
      boxShadow: {
        // Daha sakin golgeler: "kagit" degil, "yuzey" hissi
        card: '0 1px 2px rgba(16, 24, 40, 0.04)',
        raised: '0 4px 12px -4px rgba(16, 24, 40, 0.10), 0 1px 2px rgba(16, 24, 40, 0.04)',
        nav: '0 -1px 0 rgba(16, 24, 40, 0.06)'
      }
    }
  },
  plugins: []
}
