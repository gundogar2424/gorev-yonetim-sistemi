/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // MARKA MAVISI — MyFitnessPal ekran goruntusunden PIKSEL ORNEKLEMEYLE
        // alindi: #4d9bff (600). Yalnizca EYLEM icin kullanilir (buton /
        // aktif sekme / link); yuzeyler notr kalir.
        brand: {
          50: '#eef5ff',
          100: '#d8e8ff',
          200: '#b7d5ff',
          300: '#8ec0ff',
          400: '#70b8ff', // MFP'de "Yiyecek" catal simgesinin mavisi
          500: '#4d9bff',
          600: '#4d9bff', // ana vurgu (Düzenle hapi, aktif nokta, FAB)
          700: '#3b83e0',
          800: '#2f68b4',
          900: '#27528b'
        },
        // MFP paletinden ORNEKLENEN renkler
        mfp: {
          bg: '#151724', // sayfa zemini
          card: '#252733', // kart yuzeyi
          sunken: '#151724', // bos ilerleme cubugu / halka izi (zeminle ayni)
          text: '#e0e1e6', // ana metin
          muted: '#9b9ea7', // ikincil metin
          dot: '#52555c', // pasif nokta
          step: '#f54b72', // adim (ayakkabi + cubuk)
          flame: '#f59525' // egzersiz alevi
        },
        // MAKRO renkleri (MFP'den orneklendi): karbonhidrat / yag / protein
        macro: {
          carb: '#63d4ce',
          fat: '#c38dd8',
          protein: '#ffc66d'
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
