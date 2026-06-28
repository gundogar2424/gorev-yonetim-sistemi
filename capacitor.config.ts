import type { CapacitorConfig } from '@capacitor/cli'

// Diyet Koçu Android paketi (APK) yapilandirmasi.
// webDir = Vite ciktisi. APK'da acilis sayfasi olarak (CI'da) diyetkocu.html
// index.html'e kopyalanir; boylece uygulama Diyet Koçu olarak acilir.
const config: CapacitorConfig = {
  appId: 'com.diyetkocu.app',
  appName: 'Diyet Koçu',
  webDir: 'dist'
}

export default config
