// YEDEK SES: telefonun metin okuma motoru yoksa / Turkce bilmiyorsa / sessiz
// kaliyorsa devreye giren, uygulamanin icine gomulu Turkce ses (meSpeak,
// espeak tabanli). Robotik ama anlasilir; hicbir sisteme bagimli degil.
// Ses WAV olarak uretilir ve Web Audio ile calinir (tik sesleriyle ayni yol).

type Mespeak = typeof import('mespeak').default

let modP: Promise<Mespeak | null> | null = null
let ctx: AudioContext | null = null
let source: AudioBufferSourceNode | null = null

function base(): string {
  // eft.html ile ayni klasor (APK'da index.html kokte). Vite base './'.
  return (import.meta.env.BASE_URL || './').replace(/\/?$/, '/')
}

export function fallbackReady(): Promise<Mespeak | null> {
  if (!modP) {
    modP = (async () => {
      const m = (await import('mespeak')).default
      const [cfg, voice] = await Promise.all([
        fetch(`${base()}eft-ses/mespeak_config.json`).then((r) => r.json()),
        fetch(`${base()}eft-ses/tr.json`).then((r) => r.json())
      ])
      m.loadConfig(cfg)
      // NOT: meSpeak nesne verilince geri cagriya basarili olsa da 'false'
      // gecirir; bu yuzden geri cagriya degil, yuklenme durumuna bakilir.
      m.loadVoice(voice)
      const id = (voice as { voice_id?: string }).voice_id ?? 'tr'
      if (!m.isConfigLoaded()) throw new Error('yapılandırma yüklenemedi')
      if (!m.isVoiceLoaded(id)) throw new Error(`ses yüklenemedi (${id})`)
      return m
    })().catch((e: unknown) => {
      fallbackError = String((e as Error)?.message ?? e)
      console.warn('EFT yedek ses yuklenemedi:', e)
      return null
    })
  }
  return modP
}

let fallbackError = ''
export function getFallbackError(): string {
  return fallbackError
}

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

export function stopFallback(): void {
  try {
    source?.stop()
  } catch {
    /* zaten durmus */
  }
  source = null
}

// Metni sentezleyip calar; bitince onDone. Basarisizsa false doner.
export async function fallbackSpeak(text: string, rate: 'yavas' | 'normal', onDone?: () => void): Promise<boolean> {
  const m = await fallbackReady()
  if (!m) return false
  stopFallback()
  let wav: number[] | number | null
  try {
    wav = m.speak(text, { rawdata: 'array', speed: rate === 'yavas' ? 125 : 150, pitch: 48, amplitude: 110, wordgap: 1 })
  } catch {
    return false
  }
  if (!Array.isArray(wav) || wav.length < 100) return false
  const c = audio()
  if (!c) return false
  try {
    const buf = await c.decodeAudioData(new Uint8Array(wav).buffer)
    const s = c.createBufferSource()
    s.buffer = buf
    s.connect(c.destination)
    s.onended = () => {
      if (source === s) source = null
      onDone?.()
    }
    source = s
    s.start()
    return true
  } catch {
    return false
  }
}
