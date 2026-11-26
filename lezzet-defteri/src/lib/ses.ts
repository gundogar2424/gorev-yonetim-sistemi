// SESLI ADIM OKUMA: telefonda Android'in kendi sesiyle (eklenti), tarayicida speechSynthesis ile
export async function sesliOku(metin: string): Promise<void> {
  const t = metin.trim()
  if (!t) return
  const { Capacitor } = await import('@capacitor/core')
  if (Capacitor.isNativePlatform()) {
    const { TextToSpeech } = await import('@capacitor-community/text-to-speech')
    await TextToSpeech.stop().catch(() => undefined)
    await TextToSpeech.speak({ text: t, lang: 'tr-TR', rate: 0.95, pitch: 1, volume: 1, category: 'playback' })
    return
  }
  const s = window.speechSynthesis
  if (!s) throw new Error('Bu cihazda sesli okuma yok')
  s.cancel()
  const u = new SpeechSynthesisUtterance(t)
  u.lang = 'tr-TR'
  u.rate = 0.95
  s.speak(u)
}
export async function sesiDurdur(): Promise<void> {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (Capacitor.isNativePlatform()) {
      const { TextToSpeech } = await import('@capacitor-community/text-to-speech')
      await TextToSpeech.stop()
    } else window.speechSynthesis?.cancel()
  } catch {
    /* yok */
  }
}

// Mutfak modu tercihi (pisirme ekranlarinda ortak)
const KEY_MUTFAK = 'lz-mutfak-modu'
export function mutfakModu(): boolean {
  try {
    return localStorage.getItem(KEY_MUTFAK) === '1'
  } catch {
    return false
  }
}
export function mutfakModuKaydet(v: boolean): void {
  try {
    localStorage.setItem(KEY_MUTFAK, v ? '1' : '0')
  } catch {
    /* yok */
  }
}
