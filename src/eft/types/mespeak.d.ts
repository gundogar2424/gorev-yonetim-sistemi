// meSpeak (espeak tabanli, tarayicida calisan ses sentezleyici) tip bildirimi.
declare module 'mespeak' {
  interface SpeakOptions {
    rawdata?: 'array' | 'base64' | 'data-url' | 'buffer' | 'mime'
    speed?: number
    pitch?: number
    amplitude?: number
    wordgap?: number
    variant?: string
    voice?: string
    volume?: number
  }
  const meSpeak: {
    loadConfig(data: object | string): void
    loadVoice(data: object | string, cb?: (ok: boolean, msg: string) => void): void
    isConfigLoaded(): boolean
    isVoiceLoaded(voice?: string): boolean
    speak(text: string, opts?: SpeakOptions, cb?: (ok: boolean) => void): number[] | number | null
    stop(id?: number): void
    resetQueue(): void
  }
  export default meSpeak
}
