import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { dietDb, readDietSettings, listExercises } from '../db'
import { computeStats, todayStr, dayAdherence } from '../streak'
import { mealEmoji, mealLabel, MEAL_OPTIONS } from '../lib/meals'
import { buildDailyReport, buildMealText, whatsappLink } from '../lib/report'
import { buildDailyImage, buildDailyImageSet, buildMealImage } from '../lib/reportImage'
import { shareTextSmart, shareImageSmart, shareImagesSmart } from '../lib/share'
import type { DietEntry, MealType } from '../types'

const DECISION_LABEL: Record<string, { text: string; cls: string }> = {
  resisted: { text: '💪 Vazgeçti', cls: 'bg-emerald-100 text-emerald-800' },
  ate: { text: '😋 Yedi', cls: 'bg-rose-100 text-rose-800' },
  none: { text: '— Karar yok', cls: 'bg-slate-100 text-slate-500' }
}

export default function History() {
  // En yeni en ustte
  const entries = useLiveQuery(() => dietDb.entries.orderBy('createdAt').reverse().toArray(), [], [])
  const exercises = useLiveQuery(() => listExercises(), [], [])
  const stats = computeStats(entries ?? [], exercises ?? [])
  const [reportDate, setReportDate] = useState(todayStr())
  const [msg, setMsg] = useState('')

  async function remove(id: number) {
    if (!confirm('Bu kaydı silmek istiyor musunuz?')) return
    await dietDb.entries.delete(id)
  }

  // Secilen gunun raporunu diyetisyene gonder (yazili) — APK'da WhatsApp menusu acilir
  async function sendReport() {
    const settings = await readDietSettings()
    const text = await buildDailyReport(reportDate, settings.userName)
    const res = await shareTextSmart(text)
    if (res === 'shared') setMsg('Paylaşım menüsü açıldı — WhatsApp’ı seç.')
    else if (res === 'copied') setMsg('Rapor panoya kopyalandı, WhatsApp’a yapıştır.')
    else if (res === 'cancelled') setMsg('')
    else {
      window.open(whatsappLink(text), '_blank')
      setMsg('WhatsApp açılıyor…')
    }
    setTimeout(() => setMsg(''), 4000)
  }

  // Secilen gunun GORSEL raporunu (fotograf + basari grafigi) gonder
  async function sendImage() {
    setMsg('Görsel rapor hazırlanıyor…')
    try {
      const settings = await readDietSettings()
      const blob = await buildDailyImage(reportDate, settings.userName)
      const res = await shareImageSmart(blob, `diyet-rapor-${reportDate}.png`)
      if (res === 'shared') setMsg('Paylaşım menüsü açıldı — WhatsApp’ı seç.')
      else if (res === 'copied') setMsg('Görsel indirildi, diyetisyenine gönderebilirsin.')
      else if (res === 'cancelled') setMsg('')
      else setMsg('Görsel gönderilemedi.')
    } catch {
      setMsg('Görsel rapor oluşturulamadı.')
    }
    setTimeout(() => setMsg(''), 4000)
  }

  // Secilen gunu AYRI AYRI gorsellerle gonder (her ogun + spor/saglik ayri foto)
  async function sendImageSet() {
    setMsg('Görseller hazırlanıyor…')
    try {
      const settings = await readDietSettings()
      const imgs = await buildDailyImageSet(reportDate, settings.userName)
      if (!imgs.length) {
        setMsg('Bu güne ait kayıt yok.')
        setTimeout(() => setMsg(''), 4000)
        return
      }
      const res = await shareImagesSmart(imgs)
      if (res === 'shared') setMsg(`${imgs.length} görsel — paylaşım menüsü açıldı.`)
      else if (res === 'copied') setMsg(`${imgs.length} görsel indirildi, diyetisyenine gönderebilirsin.`)
      else if (res === 'cancelled') setMsg('')
      else setMsg('Görseller gönderilemedi.')
    } catch {
      setMsg('Görseller oluşturulamadı.')
    }
    setTimeout(() => setMsg(''), 5000)
  }

  // Tarihe gore grupla
  const groups = groupByDate(entries ?? [])

  return (
    <div>
      <DietHeader title="Geçmiş" subtitle="Kararlarının kaydı" />

      <div className="p-3 space-y-4">
        {/* Diyetisyene rapor gonder */}
        <section className="card p-3 space-y-2">
          <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">📤 Diyetisyene Gönder</h3>
          <p className="text-xs text-slate-500">
            Seçtiğin günün öğün, ölçü, sağlık verisi ve diyet başarısı gönderilir. Görsel rapor yemek fotoğraflarını da içerir.
          </p>
          <input type="date" className="field-input" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={sendReport} className="btn bg-slate-200 text-slate-700 hover:bg-slate-300 whitespace-nowrap">
              ✍️ Yazılı Gönder
            </button>
            <button onClick={sendImage} className="btn-primary whitespace-nowrap">
              📸 Tek Görsel
            </button>
          </div>
          <button onClick={sendImageSet} className="btn bg-brand-600 text-white w-full whitespace-nowrap">
            🖼️ Ayrı Gönder
          </button>
          <p className="text-[11px] text-slate-400">
            Her öğün ve sağlık verisi için ayrı, büyük fotoğraflı görsel gönderir.
          </p>
          {msg && <p className="text-xs text-emerald-700 font-semibold">{msg}</p>}
        </section>

        {/* Ozet istatistikler */}
        <div className="grid grid-cols-3 gap-2">
          <Stat value={stats.points} label="Puan ⭐" accent="text-amber-500" />
          <Stat value={stats.totalResisted} label="Vazgeçiş" accent="text-emerald-600" />
          <Stat value={stats.totalAte} label="Yedim" accent="text-rose-500" />
        </div>

        {(entries?.length ?? 0) === 0 && (
          <div className="card p-6 text-center text-slate-500 text-sm">
            <div className="text-5xl mb-2">🍽️</div>
            Henüz kayıt yok. İlk yemeğinin fotoğrafını çekerek başla.
          </div>
        )}

        {groups.map(([date, items]) => (
          <section key={date} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">{formatDate(date)}</h3>
              <DayScoreBadge entries={items} date={date} />
            </div>
            {items.map((e) => {
              const d = DECISION_LABEL[e.decision] ?? DECISION_LABEL.none
              return (
                <div key={e.id} className="card p-3 flex gap-3 items-center">
                  {e.photo ? (
                    <img src={e.photo} alt={e.foodName} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center text-2xl">🍽️</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800 truncate">{e.foodName}</p>
                    </div>
                    <p className="text-xs text-slate-500">
                      {e.mealType ? `${mealEmoji(e.mealType)} ${mealLabel(e.mealType)} · ` : ''}
                      {new Date(e.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} · ~
                      {e.estimatedCalories} kcal
                    </p>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${d.cls}`}>
                        {d.text}
                      </span>
                      {e.compliancePercent >= 0 && (
                        <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${complianceCls(e.compliancePercent)}`}>
                          %{e.compliancePercent} uyum
                        </span>
                      )}
                    </div>
                    <MealEdit e={e} />
                    <MealTimeEdit e={e} />
                    <MealShare e={e} />
                  </div>
                  <button onClick={() => remove(e.id!)} className="text-slate-300 hover:text-rose-500 text-sm px-1 self-start">
                    🗑️
                  </button>
                </div>
              )
            })}
          </section>
        ))}
      </div>
    </div>
  )
}


// Bir Date'i <input type="datetime-local"> degerine cevir (YYYY-MM-DDTHH:mm)
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

// Kaydedilmis bir ogunu DUZENLE: ad, ogun, kalori, makrolar (gozden kacani duzelt).
function MealEdit({ e }: { e: DietEntry }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(e.foodName)
  const [meal, setMeal] = useState<MealType>(e.mealType ?? 'serbest')
  const [kcal, setKcal] = useState(String(e.estimatedCalories ?? 0))
  const [p, setP] = useState(String(e.protein ?? 0))
  const [c, setC] = useState(String(e.carb ?? 0))
  const [f, setF] = useState(String(e.fat ?? 0))

  function num(v: string): number {
    const n = Number(v.trim().replace(',', '.'))
    return isNaN(n) ? 0 : Math.round(n)
  }

  async function save() {
    await dietDb.entries.update(e.id!, {
      foodName: name.trim() || e.foodName,
      mealType: meal,
      estimatedCalories: num(kcal),
      protein: num(p),
      carb: num(c),
      fat: num(f)
    })
    setOpen(false)
  }

  return (
    <div className="mt-1">
      {!open ? (
        <button onClick={() => setOpen(true)} className="text-[11px] text-slate-400 underline">
          ✏️ Öğünü düzenle
        </button>
      ) : (
        <div className="space-y-1.5 bg-slate-50 rounded-xl p-2 mt-1">
          <input
            className="field-input py-1 text-sm"
            placeholder="Yemek adı"
            value={name}
            onChange={(ev) => setName(ev.target.value)}
          />
          <div className="flex flex-wrap gap-1">
            {MEAL_OPTIONS.map((m) => (
              <button
                key={m.value}
                onClick={() => setMeal(m.value)}
                className={`text-[11px] font-semibold rounded-full px-2 py-1 ${
                  meal === m.value ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
                }`}
              >
                {m.emoji} {m.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            <label className="text-[10px] text-slate-500">
              Kalori
              <input type="number" inputMode="numeric" className="num-input" value={kcal} onChange={(ev) => setKcal(ev.target.value)} />
            </label>
            <label className="text-[10px] text-slate-500">
              Prot.
              <input type="number" inputMode="numeric" className="num-input" value={p} onChange={(ev) => setP(ev.target.value)} />
            </label>
            <label className="text-[10px] text-slate-500">
              Karb.
              <input type="number" inputMode="numeric" className="num-input" value={c} onChange={(ev) => setC(ev.target.value)} />
            </label>
            <label className="text-[10px] text-slate-500">
              Yağ
              <input type="number" inputMode="numeric" className="num-input" value={f} onChange={(ev) => setF(ev.target.value)} />
            </label>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={save} className="text-xs font-bold bg-brand-600 text-white rounded-full px-3 py-1">
              Kaydet
            </button>
            <button onClick={() => setOpen(false)} className="text-[11px] text-slate-400 px-1">
              kapat
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Kaydedilmis bir ogunun TARIH/SAATini sonradan duzenle (gec girilen ogun icin)
function MealTimeEdit({ e }: { e: DietEntry }) {
  const [open, setOpen] = useState(false)
  const [val, setVal] = useState(() => toLocalInput(new Date(e.createdAt)))

  async function save() {
    const d = new Date(val)
    if (isNaN(d.getTime())) return
    await dietDb.entries.update(e.id!, { createdAt: d.getTime(), dateStr: todayStr(d) })
    setOpen(false)
  }

  return (
    <div className="mt-1">
      {!open ? (
        <button onClick={() => setOpen(true)} className="text-[11px] text-slate-400 underline">
          🕐 Saati düzenle
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 rounded-xl p-1.5 mt-1">
          <input
            type="datetime-local"
            className="field-input w-auto py-1 text-xs flex-1 min-w-0"
            value={val}
            onChange={(ev) => setVal(ev.target.value)}
          />
          <button onClick={save} className="text-xs font-bold bg-brand-600 text-white rounded-full px-2.5 py-1">
            Kaydet
          </button>
          <button onClick={() => setOpen(false)} className="text-[11px] text-slate-400 px-1">
            kapat
          </button>
        </div>
      )}
    </div>
  )
}

// Tek bir öğünü diyetisyene tek tek gönder (görsel veya yazılı)
function MealShare({ e }: { e: DietEntry }) {
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  function flash(m: string) {
    setMsg(m)
    setTimeout(() => setMsg(''), 3500)
  }

  // Paylasim baslatilinca o ogunu "gonderildi" olarak isaretle (kalici)
  async function markShared() {
    if (e.id != null) await dietDb.entries.update(e.id, { sharedAt: Date.now() })
  }

  async function sendImage() {
    setBusy(true)
    setMsg('Görsel hazırlanıyor…')
    try {
      const settings = await readDietSettings()
      const blob = await buildMealImage(e, settings.userName)
      const res = await shareImageSmart(blob, `ogun-${e.dateStr}-${e.id}.png`)
      if (res === 'shared') {
        await markShared()
        flash('Paylaşım menüsü açıldı — WhatsApp’ı seç.')
      } else if (res === 'copied') {
        await markShared()
        flash('Görsel indirildi, diyetisyenine gönderebilirsin.')
      } else if (res === 'cancelled') setMsg('')
      else flash('Görsel gönderilemedi.')
    } catch {
      flash('Görsel oluşturulamadı.')
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  async function sendText() {
    setBusy(true)
    try {
      const settings = await readDietSettings()
      const res = await shareTextSmart(buildMealText(e, settings.userName))
      if (res === 'shared') {
        await markShared()
        flash('Paylaşım menüsü açıldı.')
      } else if (res === 'copied') {
        await markShared()
        flash('Panoya kopyalandı.')
      } else if (res === 'cancelled') setMsg('')
      else flash('Gönderilemedi.')
    } catch {
      flash('Gönderilemedi.')
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  return (
    <div className="mt-1.5">
      {e.sharedAt && (
        <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 mb-1">
          ✓ Diyetisyene gönderildi ·{' '}
          {new Date(e.sharedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
        </p>
      )}
      {!open ? (
        <button onClick={() => setOpen(true)} className="text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-100 rounded-full px-2.5 py-1">
          {e.sharedAt ? '📤 Tekrar gönder' : '📤 Diyetisyene gönder'}
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 rounded-xl p-1.5">
          <button onClick={sendImage} disabled={busy} className="text-xs font-bold bg-brand-600 text-white rounded-full px-2.5 py-1 disabled:opacity-60">
            📸 Görsel
          </button>
          <button onClick={sendText} disabled={busy} className="text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-full px-2.5 py-1 disabled:opacity-60">
            ✍️ Yazılı
          </button>
          <button onClick={() => setOpen(false)} className="text-[11px] text-slate-400 px-1">
            kapat
          </button>
        </div>
      )}
      {msg && <p className="text-[11px] text-brand-700 font-semibold mt-1">{msg}</p>}
    </div>
  )
}

// Bir gunun diyet basari yuzdesi rozeti (gun basligi yaninda)
function DayScoreBadge({ entries, date }: { entries: DietEntry[]; date: string }) {
  const pct = dayAdherence(entries, date)
  if (pct == null) return null
  const cls = pct >= 80 ? 'bg-emerald-100 text-emerald-800' : pct >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>Başarı %{pct}</span>
}

function Stat({ value, label, accent }: { value: number; label: string; accent: string }) {
  return (
    <div className="card p-3 text-center">
      <p className={`text-2xl font-extrabold ${accent}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}

// Uyum yuzdesine gore rozet rengi
function complianceCls(pct: number): string {
  if (pct >= 80) return 'bg-emerald-100 text-emerald-800'
  if (pct >= 50) return 'bg-amber-100 text-amber-800'
  return 'bg-rose-100 text-rose-800'
}

function groupByDate(entries: DietEntry[]): [string, DietEntry[]][] {
  const map = new Map<string, DietEntry[]>()
  for (const e of entries) {
    const arr = map.get(e.dateStr) ?? []
    arr.push(e)
    map.set(e.dateStr, arr)
  }
  // entries zaten createdAt'e gore tersten geldigi icin tarihler de dogru sirada
  return Array.from(map.entries())
}

function formatDate(dateStr: string): string {
  const today = new Date().toLocaleDateString('en-CA')
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA')
  if (dateStr === today) return 'Bugün'
  if (dateStr === yesterday) return 'Dün'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}
