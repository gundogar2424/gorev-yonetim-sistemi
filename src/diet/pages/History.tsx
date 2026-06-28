import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { dietDb, readDietSettings, listExercises } from '../db'
import { computeStats, todayStr, dayAdherence } from '../streak'
import { buildDailyReport, shareText, whatsappLink } from '../lib/report'
import { buildDailyImage, shareImage } from '../lib/reportImage'
import type { DietEntry } from '../types'

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

  // Secilen gunun raporunu diyetisyene gonder (yazili)
  async function sendReport() {
    const settings = await readDietSettings()
    const text = await buildDailyReport(reportDate, settings.userName)
    const res = await shareText(text)
    if (res === 'shared') setMsg('Rapor paylaşıldı.')
    else if (res === 'copied') setMsg('Rapor panoya kopyalandı, istediğin yere yapıştır.')
    else {
      // Son care: WhatsApp baglantisini ac
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
      const res = await shareImage(blob, `diyet-rapor-${reportDate}.png`)
      setMsg(res === 'shared' ? 'Görsel rapor paylaşıldı.' : 'Görsel rapor indirildi, diyetisyenine gönderebilirsin.')
    } catch {
      setMsg('Görsel rapor oluşturulamadı.')
    }
    setTimeout(() => setMsg(''), 4000)
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
            Seçtiğin günün öğünleri, ölçüleri, sağlık verileri ve diyet başarısı gönderilir. Görsel rapor; yemek
            fotoğraflarını ve başarı grafiğini de içerir.
          </p>
          <input type="date" className="field-input" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={sendReport} className="btn bg-slate-200 text-slate-700 hover:bg-slate-300 whitespace-nowrap">
              ✍️ Yazılı Gönder
            </button>
            <button onClick={sendImage} className="btn-primary whitespace-nowrap">
              📸 Resimli Gönder
            </button>
          </div>
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
                      ~{e.estimatedCalories} kcal · {new Date(e.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
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
                  </div>
                  <button onClick={() => remove(e.id!)} className="text-slate-300 hover:text-rose-500 text-sm px-1">
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
