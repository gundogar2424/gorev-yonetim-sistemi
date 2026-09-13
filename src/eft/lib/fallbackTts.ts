// YEDEK SES: telefonun metin okuma motoru yoksa / Turkce bilmiyorsa / sessiz
// kaliyorsa devreye giren, uygulamanin icine gomulu Turkce ses (meSpeak,
// espeak tabanli). Robotik ama anlasilir; hicbir sisteme bagimli degil.
// Ses WAV olarak uretilir ve Web Audio ile calinir (tik sesleriyle ayni yol).

type Mespeak = typeof import('mespeak').default
import { audioCtx } from './audioCtx'
import { sesLog } from './sesLog'

let modP: Promise<Mespeak | null> | null = null
let source: AudioBufferSourceNode | null = null

function base(): string {
  // eft.html ile ayni klasor (APK'da index.html kokte). Vite base './'.
  return (import.meta.env.BASE_URL || './').replace(/\/?$/, '/')
}

export function fallbackReady(): Promise<Mespeak | null> {
  if (!modP) {
    modP = (async () => {
      sesLog('yedek ses yukleniyor')
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
      sesLog('yedek ses hazir')
      return m
    })().catch((e: unknown) => {
      fallbackError = String((e as Error)?.message ?? e)
      sesLog('yedek ses yuklenemedi: ' + fallbackError)
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

let audioEl: HTMLAudioElement | null = null

export function stopFallback(): void {
  try {
    source?.stop()
  } catch {
    /* zaten durmus */
  }
  source = null
  try {
    if (audioEl) {
      audioEl.pause()
      audioEl.src = ''
      audioEl = null
    }
  } catch {
    /* yok say */
  }
}

// Ikinci yol: klasik <audio> etiketiyle WAV cal (Web Audio calismazsa)
function playViaAudioElement(wav: number[], onDone?: () => void): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const bytes = new Uint8Array(wav)
      let bin = ''
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)))
      const url = 'data:audio/wav;base64,' + btoa(bin)
      const a = new Audio(url)
      audioEl = a
      a.onended = () => {
        sesLog('audio etiketi: bitti')
        if (audioEl === a) audioEl = null
        onDone?.()
      }
      a.onerror = () => {
        sesLog('audio etiketi: hata ' + String(a.error?.code ?? ''))
        resolve(false)
      }
      const p = a.play()
      if (p && typeof p.then === 'function') {
        p.then(() => {
          sesLog('audio etiketi: caliyor')
          resolve(true)
        }).catch((e: unknown) => {
          sesLog('audio etiketi: play reddedildi ' + String((e as Error)?.message ?? e))
          resolve(false)
        })
      } else resolve(true)
    } catch (e) {
      sesLog('audio etiketi: istisna ' + String((e as Error)?.message ?? e))
      resolve(false)
    }
  })
}

// Metni sentezleyip calar; bitince onDone. Basarisizsa false doner.
export async function fallbackSpeak(text: string, rate: 'yavas' | 'normal', onDone?: () => void): Promise<boolean> {
  const m = await fallbackReady()
  if (!m) return false
  stopFallback()
  let wav: number[] | number | null
  try {
    wav = m.speak(text, { rawdata: 'array', speed: rate === 'yavas' ? 125 : 150, pitch: 48, amplitude: 110, wordgap: 1 })
  } catch (e) {
    sesLog('yedek ses sentez hatasi: ' + String((e as Error)?.message ?? e))
    return false
  }
  if (!Array.isArray(wav) || wav.length < 100) {
    sesLog('yedek ses sentez bos')
    return false
  }
  sesLog(`yedek ses sentez: ${wav.length} bayt`)
  const c = audioCtx()
  if (c) {
    if (c.state === 'suspended') {
      try {
        await c.resume()
      } catch {
        /* dokunus gerekebilir */
      }
    }
    sesLog('AudioContext: ' + c.state)
    if (c.state === 'running') {
      try {
        const buf = await c.decodeAudioData(new Uint8Array(wav).buffer)
        const s = c.createBufferSource()
        s.buffer = buf
        s.connect(c.destination)
        s.onended = () => {
          sesLog('web audio: bitti')
          if (source === s) source = null
          onDone?.()
        }
        source = s
        s.start()
        sesLog(`web audio: caliyor ${buf.duration.toFixed(1)} sn`)
        return true
      } catch (e) {
        sesLog('web audio hata: ' + String((e as Error)?.message ?? e))
      }
    }
  } else sesLog('AudioContext yok')
  // Web Audio calismadi: <audio> etiketi
  return playViaAudioElement(wav, onDone)
}
