import { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { audioState, unlockAudio } from '../lib/audioCtx'
import { fallbackSpeak } from '../lib/fallbackTts'
import { sfxTick } from '../lib/sound'
import { clearSesLog, getSesLog, sesLog } from '../lib/sesLog'
import { nativeSpeakTest } from '../lib/speech'
import { readSettings } from '../lib/store'

// SES TESTI: tik sesi -> yedek ses -> telefon motoru sirayla denenir; her
// adimin sonucu ve ses gunlugu ekrana yazilir, tek dokunusla kopyalanir.
export default function SesTesti() {
  const [acik, setAcik] = useState(false)
  const [calisiyor, setCalisiyor] = useState(false)
  const [sonuc, setSonuc] = useState<string[]>([])
  const [log, setLog] = useState<string[]>([])
  const [kopya, setKopya] = useState('')

  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms))

  async function calistir() {
    setCalisiyor(true)
    setKopya('')
    clearSesLog()
    const out: string[] = []
    const s = readSettings()
    sesLog(`platform=${Capacitor.isNativePlatform() ? 'apk' : 'web'} rehber=${s.voice ? 'acik' : 'KAPALI'} motor=${s.voiceEngine}`)
    unlockAudio()
    out.push(`Ses bağlamı: ${audioState()}`)
    // 1) tik
    sfxTick()
    await bekle(400)
    sfxTick()
    out.push('1 · Tık sesi çalındı (duydun mu?)')
    setSonuc([...out])
    await bekle(600)
    // 2) yedek ses
    let bitti = false
    const ok = await fallbackSpeak('Bir, iki, üç. Yedek ses çalışıyor.', s.voiceRate, () => (bitti = true))
    out.push(`2 · Yedek ses: ${ok ? 'başlatıldı' : 'BAŞLAMADI'}`)
    setSonuc([...out])
    for (let i = 0; i < 50 && ok && !bitti; i++) await bekle(100)
    out[out.length - 1] = `2 · Yedek ses: ${ok ? (bitti ? 'çaldı ve bitti' : 'başladı, bitiş sinyali gelmedi') : 'BAŞLAMADI'}`
    setSonuc([...out])
    // 3) telefon motoru
    const n = await nativeSpeakTest('Telefon sesi çalışıyor.')
    out.push(`3 · Telefon motoru: ${n}`)
    out.push(`Ses bağlamı (son): ${audioState()}`)
    setSonuc([...out])
    setLog(getSesLog())
    setCalisiyor(false)
  }

  async function kopyala() {
    const metin = ['EFT SES TESTİ', ...sonuc, '--- günlük ---', ...getSesLog()].join('\n')
    try {
      await navigator.clipboard.writeText(metin)
      setKopya('Kopyalandı ✔ Buraya yapıştırıp gönderebilirsin.')
    } catch {
      setKopya('Kopyalanamadı; ekran görüntüsü al.')
    }
  }

  return (
    <section className="eft-card">
      <button className="w-full flex items-center justify-between text-left" onClick={() => setAcik((a) => !a)}>
        <span className="text-[17px] font-bold text-slate-900 dark:text-[#e8f2f1]">🔊 Ses testi</span>
        <span className="text-slate-400 text-[20px]">{acik ? '▾' : '▸'}</span>
      </button>
      {acik && (
        <div className="mt-3 space-y-3">
          <p className="text-[14px] text-slate-500 dark:text-[#7f9896]">
            Telefonun <b>medya</b> sesini aç, sonra düğmeye bas. Sırayla tık sesi, yedek ses ve telefon sesi denenir. Ne duyduğunu ve
            aşağıdaki sonucu bana gönder.
          </p>
          <button className="eft-btn-primary w-full" disabled={calisiyor} onClick={calistir}>
            {calisiyor ? 'Deneniyor…' : 'Ses testini başlat'}
          </button>
          {sonuc.length > 0 && (
            <div className="rounded-2xl bg-slate-50 dark:bg-[#1e3231] p-3 text-[14px] leading-relaxed text-slate-800 dark:text-[#e8f2f1] space-y-0.5">
              {sonuc.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          )}
          {log.length > 0 && (
            <div className="rounded-2xl bg-slate-50 dark:bg-[#1e3231] p-3 text-[12px] leading-snug text-slate-600 dark:text-[#b7cbc9] font-mono whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
              {log.join('\n')}
            </div>
          )}
          {sonuc.length > 0 && (
            <button className="eft-btn-soft w-full" onClick={kopyala}>
              Sonucu kopyala
            </button>
          )}
          {kopya && <p className="text-[13px] text-emerald-700">{kopya}</p>}
        </div>
      )}
    </section>
  )
}
