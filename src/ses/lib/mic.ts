// Mikrofonla ses olcumu: en uzun "a" tutma suresi (MPT) ve goreli ses duzeyi.
// Web Audio AnalyserNode ile RMS hesaplanir; belirli bir esigin ustu "ses var"
// sayilir. Ses basladiginda kronometre baslar, 0.6 sn sessizlikte durur.
// Ses dosyasi KAYDEDILMEZ; yalnizca anlik olcum yapilir.

export interface MicFrame {
  db: number // goreli dB (yaklasik -90..0)
  voiced: boolean
  buf: Float32Array // ham ornekler (bu cerceve; akustik analiz icin)
  sr: number // ornekleme hizi (Hz)
}

export type MicStatus = 'kapali' | 'aciliyor' | 'acik' | 'izin-yok' | 'yok'

export interface Mic {
  status: MicStatus
  start(): Promise<void>
  stop(): void
  onFrame(cb: (f: MicFrame) => void): void
}

const SILENCE_DB = -50 // bunun altinda: sessiz (arka plan)

export function createMic(): Mic {
  let stream: MediaStream | null = null
  let ctx: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let raf = 0
  let cb: ((f: MicFrame) => void) | null = null
  let buf: Float32Array<ArrayBuffer> | null = null
  const mic: Mic = {
    status: 'kapali',
    async start() {
      if (mic.status === 'acik' || mic.status === 'aciliyor') return
      if (!navigator.mediaDevices?.getUserMedia) {
        mic.status = 'yok'
        return
      }
      mic.status = 'aciliyor'
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
          video: false
        })
      } catch {
        mic.status = 'izin-yok'
        return
      }
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        ctx = new AC()
        await ctx.resume()
        const src = ctx.createMediaStreamSource(stream)
        analyser = ctx.createAnalyser()
        analyser.fftSize = 2048
        analyser.smoothingTimeConstant = 0.2
        src.connect(analyser)
        buf = new Float32Array(analyser.fftSize)
        mic.status = 'acik'
        const tick = () => {
          if (!analyser || !buf) return
          analyser.getFloatTimeDomainData(buf)
          let sum = 0
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
          const rms = Math.sqrt(sum / buf.length)
          const db = rms > 0 ? Math.max(-90, 20 * Math.log10(rms)) : -90
          cb?.({ db, voiced: db > SILENCE_DB, buf, sr: ctx?.sampleRate ?? 48000 })
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      } catch {
        mic.stop()
        mic.status = 'yok'
      }
    },
    stop() {
      cancelAnimationFrame(raf)
      raf = 0
      try {
        stream?.getTracks().forEach((t) => t.stop())
      } catch {
        /* yok say */
      }
      stream = null
      try {
        void ctx?.close()
      } catch {
        /* yok say */
      }
      ctx = null
      analyser = null
      buf = null
      if (mic.status === 'acik' || mic.status === 'aciliyor') mic.status = 'kapali'
    },
    onFrame(f) {
      cb = f
    }
  }
  return mic
}

// MPT olcum durum makinesi: ses basladiginda baslar, 0.6 sn sessizlikte biter.
export interface MptState {
  phase: 'bekliyor' | 'olcuyor' | 'bitti'
  sec: number
  dbSum: number
  dbN: number
}

export function mptInit(): MptState {
  return { phase: 'bekliyor', sec: 0, dbSum: 0, dbN: 0 }
}

const GAP_MS = 600 // bu kadar sessizlik = bitti
const MIN_START_MS = 120 // bu kadar surekli ses = basladi

// Zaman damgali cerceve akisini isler; cagiran taraf state'i tutar.
export function mptStep(st: MptState, f: MicFrame, now: number, mem: { t0: number; lastVoice: number; firstVoice: number }): MptState {
  if (st.phase === 'bitti') return st
  if (st.phase === 'bekliyor') {
    if (f.voiced) {
      if (!mem.firstVoice) mem.firstVoice = now
      if (now - mem.firstVoice >= MIN_START_MS) {
        mem.t0 = mem.firstVoice
        mem.lastVoice = now
        return { phase: 'olcuyor', sec: (now - mem.t0) / 1000, dbSum: f.db, dbN: 1 }
      }
    } else {
      mem.firstVoice = 0
    }
    return st
  }
  // olcuyor
  if (f.voiced) {
    mem.lastVoice = now
    return { ...st, sec: (now - mem.t0) / 1000, dbSum: st.dbSum + f.db, dbN: st.dbN + 1 }
  }
  if (now - mem.lastVoice >= GAP_MS) {
    return { ...st, phase: 'bitti', sec: (mem.lastVoice - mem.t0) / 1000 }
  }
  return st
}

// Yetiskinlerde tipik MPT: kadin ~15-25 sn, erkek ~25-35 sn (Iowa Voice Clinic
// protokolleri); yaslilarda kadin 10-21, erkek 13-23 sn. 10 sn'nin altinda
// konusurken nefessiz kalma bildirilir; 12 sn'nin alti yasa bagli ses
// zayifligi olasiligini artirir. Yalnizca BILGI amacli; tani koymaz.
export function mptComment(sec: number): string {
  if (sec <= 0) return ''
  if (sec < 5) return 'Çok kısa. Nefesi derin al, sesi rahat tut. Zamanla uzayacak.'
  if (sec < 10) return '10 sn altı: konuşurken nefessiz kalmayla ilişkili aralık. Düzenli egzersizle uzaması beklenir; hekimin/terapistinle paylaş.'
  if (sec < 15) return 'Orta (yaşlı yetişkinlerde normal aralığın içinde). İyi gidiyorsun, sürdür.'
  if (sec < 25) return 'İyi bir süre 👏 (yetişkin kadın normali 15-25 sn)'
  return 'Çok iyi! (yetişkin erkek normali 25-35 sn) Ses tellerin verimli kapanıyor.'
}
