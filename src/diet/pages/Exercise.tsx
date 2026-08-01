import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { listExercises, deleteExercise, readDietSettings } from '../db'
import {
  healthAvailable,
  requestHealthPerms,
  importHealthDay,
  openHealthConnectStore,
  openHealthConnect,
  saveHealthDay,
  sleepPermGranted
} from '../lib/health'
import { exercisePoints, exerciseBadges, todayStr } from '../streak'
import { movementKcal, plausibleDistanceKm } from '../lib/movement'

export default function ExercisePage() {
  const exercises = useLiveQuery(() => listExercises(), [], [])
  const settings = useLiveQuery(() => readDietSettings(), [], undefined)
  // Verinin ekleneceği gün (unutup ertesi gün alınabilsin diye). Varsayılan bugün.
  const [day, setDay] = useState(todayStr())

  const list = exercises ?? []
  const totalPoints = list.reduce((sum, e) => sum + exercisePoints(e), 0)
  const totalMinutes = list.reduce((sum, e) => sum + (e.minutes ?? 0), 0)
  const { earned, locked } = exerciseBadges(list.length)

  // Haftalik hedef (son 7 gun, bugun dahil)
  const weekStart = todayStr(new Date(Date.now() - 6 * 86_400_000))
  const weekCount = list.filter((e) => e.dateStr >= weekStart).length
  const weekGoal = settings?.weeklyExerciseGoal && settings.weeklyExerciseGoal > 0 ? settings.weeklyExerciseGoal : 0
  const weekPct = weekGoal ? Math.min(100, Math.round((weekCount / weekGoal) * 100)) : 0

  async function remove(id: number) {
    if (!confirm('Bu egzersizi silmek istiyor musunuz?')) return
    await deleteExercise(id)
  }

  return (
    <div>
      <DietHeader title="Egzersiz" subtitle="Samsung Health verilerin otomatik gelir" />

      <div className="px-4 py-3 space-y-3">
        {/* Ozet kart */}
        <div className="card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="stat-label">Egzersiz puanı</p>
              <p className="stat-num text-[38px] leading-none mt-1">{totalPoints.toLocaleString('tr-TR')}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="stat-label">Toplam</p>
              <p className="stat-num text-[20px] leading-none mt-1.5">{list.length}</p>
              <p className="text-[12px] text-slate-500 mt-1">egzersiz · {totalMinutes} dk</p>
            </div>
          </div>
        </div>

        {/* Haftalik hedef (Ayarlar'dan girilirse gosterilir) */}
        {weekGoal > 0 && (
          <section className="card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="section-title">Haftalık hedef</h3>
              <span
                className={`text-[15px] font-semibold tabular-nums ${
                  weekCount >= weekGoal ? 'text-emerald-600' : 'text-slate-900'
                }`}
              >
                {weekCount}/{weekGoal}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${weekCount >= weekGoal ? 'bg-emerald-500' : 'bg-brand-600'}`}
                style={{ width: `${weekPct}%` }}
              />
            </div>
            <p className="text-[13px] text-slate-500">
              {weekCount >= weekGoal
                ? 'Bu haftanın hedefini tamamladın.'
                : `Bu hafta hedefe ${weekGoal - weekCount} egzersiz kaldı.`}
            </p>
          </section>
        )}

        {/* Hangi güne? — Health Connect'ten çekilen veri bu güne yazılır */}
        <section className="card p-4">
          <label className="block">
            <span className="section-title">Hangi güne ekleniyor?</span>
            <input
              type="date"
              className="field-input mt-1"
              value={day}
              max={todayStr()}
              onChange={(e) => setDay(e.target.value || todayStr())}
            />
          </label>
          {day !== todayStr() && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 mt-2">
              Bu veriler <b>{formatDate(day)}</b> gününe kaydedilecek (bugün değil).
            </p>
          )}
        </section>

        {/* Health Connect'ten OTOMATIK al (Samsung Health verisi) */}
        <HealthConnectCard day={day} />

        {/* Egzersiz rozetleri */}
        <section className="card p-4 space-y-3">
          <h3 className="section-title">Rozetler</h3>
          {earned.length === 0 && <p className="text-[13px] text-slate-500">Henüz rozet yok. İlk egzersizini ekle.</p>}
          {earned.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {earned.map((b) => (
                <div key={b.count} className="bg-brand-50 border border-brand-100 rounded-xl p-2.5 text-center">
                  <div className="text-2xl">{b.emoji}</div>
                  <p className="text-[12px] font-semibold text-brand-700 mt-0.5">{b.name}</p>
                  <p className="text-[10px] text-slate-500 leading-tight">{b.desc}</p>
                </div>
              ))}
            </div>
          )}
          {locked.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {locked.map((b) => (
                <div key={b.count} className="bg-slate-50 border border-slate-200/70 rounded-xl p-2.5 text-center">
                  <div className="text-2xl grayscale opacity-40">{b.emoji}</div>
                  <p className="text-[12px] font-semibold text-slate-500 mt-0.5">{b.name}</p>
                  <p className="text-[10px] text-slate-400 leading-tight">{b.count} egzersiz</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Egzersiz gecmisi */}
        <section className="space-y-2">
          <h3 className="section-title px-1">Geçmiş</h3>
          {list.length === 0 && (
            <div className="card p-6 text-center text-[13px] text-slate-500">
              Henüz egzersiz yok. Health Connect’ten çektiğinde burada listelenir.
            </div>
          )}
          {list.map((ex) => (
            <div key={ex.id} className="card p-3 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-center text-xl flex-shrink-0">
                💪
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-slate-900 break-words">{ex.text}</p>
                <p className="text-xs text-slate-500">
                  {formatDate(ex.dateStr)}
                  {ex.minutes ? ` · ${ex.minutes} dk` : ''}
                  {ex.kcal ? ` · 🔥 ${ex.kcal} kcal` : ''} · +{exercisePoints(ex)} puan
                </p>
                {(ex.steps || ex.avgHr || ex.cadence || ex.distanceKm) && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {[
                      ex.distanceKm ? `📏 ${ex.distanceKm} km` : '',
                      ex.steps ? `👟 ${ex.steps.toLocaleString('tr-TR')} adım` : '',
                      ex.avgHr ? `❤️ ${ex.avgHr} bpm` : '',
                      ex.cadence ? `🦶 ${ex.cadence} adım/dk` : ''
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
              <button onClick={() => remove(ex.id!)} className="text-slate-300 hover:text-rose-500 text-sm px-1">
                🗑️
              </button>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}

function formatDate(dateStr: string): string {
  const today = todayStr()
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA')
  if (dateStr === today) return 'Bugün'
  if (dateStr === yesterday) return 'Dün'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long'
  })
}


// HEALTH CONNECT: Samsung Health verisini OTOMATIK okur (adım/mesafe/kalori +
// antrenmanlar, nabızla). Samsung Health → Health Connect'e yazar, biz oradan
// okuruz. Yalnızca APK'da çalışır; web'de kart gizlenir.
function HealthConnectCard({ day }: { day: string }) {
  const [state, setState] = useState<'checking' | 'ready' | 'unavailable' | 'web'>('checking')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  // Uyku ozel durum: izin yoksa eklenti hata atmiyor, 0 donuyor. Ayirt edip soyluyoruz.
  const [sleepWarn, setSleepWarn] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { Capacitor } = await import('@capacitor/core')
      if (!Capacitor.isNativePlatform()) {
        if (alive) setState('web')
        return
      }
      const ok = await healthAvailable()
      if (alive) setState(ok ? 'ready' : 'unavailable')
    })()
    return () => {
      alive = false
    }
  }, [])

  // Web'de hiç gösterme (özellik sadece uygulamada var).
  if (state === 'web') return null

  async function pull() {
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      await requestHealthPerms() // izin ekranını açar (ilk sefer)
      const data = await importHealthDay(day)
      if (!data) {
        setErr('Veri okunamadı. Health Connect izinlerini kontrol et.')
        return
      }
      // Günlük toplamlar + antrenmanlar (aynı günün eski Health kayıtları tazelenir)
      await saveHealthDay(day, data)

      const parts: string[] = []
      const actRow = { count: data.steps, activeKcal: data.activeKcal, distanceKm: data.distanceKm }
      if (data.steps) parts.push(`${data.steps.toLocaleString('tr-TR')} adım`)
      const dk = plausibleDistanceKm(actRow)
      if (dk) parts.push(`${dk} km`)
      // Hareketten yakilan kalori. totalKcal bazal metabolizmayi da icerdiginden
      // gosterilmez — "4581 kcal yaktin" gibi yaniltici olur (bkz. lib/movement.ts).
      const mk = movementKcal(actRow)
      if (mk) parts.push(`~${mk} kcal hareket`)
      if (data.workouts.length) parts.push(`${data.workouts.length} antrenman`)
      if (data.sleepHours) parts.push(`${data.sleepHours} sa uyku`)
      setMsg(parts.length ? `Alındı: ${parts.join(' · ')}.` : 'Bu gün için Health Connect’te veri bulunamadı.')

      // UYKU 0 geldiyse sebebini ayirt et: izin mi yok, veri mi yok?
      // (Eklenti izin yokken hata atmadigi icin ikisi ayni gorunuyordu.)
      if (data.sleepHours) setSleepWarn('')
      else if (await sleepPermGranted()) {
        setSleepWarn(
          'Uyku izni var ama bu gece için veri gelmedi. Samsung Health → Ayarlar → Health Connect’ten “Uyku”nun paylaşıldığını kontrol et; saatin gece takılı olmalı.'
        )
      } else {
        setSleepWarn('Uyku izni verilmemiş. Health Connect ayarlarından uygulamaya “Uyku” okuma iznini ver.')
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'İçe aktarma başarısız.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-5 space-y-3">
      <div>
        <p className="text-[15px] font-semibold text-slate-900">Samsung Health’ten otomatik al</p>
        <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
          Adım, mesafe, kalori, uyku ve antrenmanları (nabızla) Health Connect üzerinden {formatDate(day)} gününe çeker.
        </p>
      </div>

      {state === 'unavailable' ? (
        <div className="text-xs text-slate-600 space-y-2">
          <p>
            Telefonunda <b>Health Connect</b> bulunamadı. Samsung Health verisi buradan gelir; önce Health Connect’i
            kurup Samsung Health’i ona bağlaman gerekir.
          </p>
          <button onClick={() => openHealthConnectStore()} className="btn-secondary w-full">
            Health Connect’i Play Store’da aç
          </button>
        </div>
      ) : (
        <button onClick={pull} disabled={busy || state === 'checking'} className="btn-primary w-full">
          {busy ? 'Alınıyor…' : state === 'checking' ? 'Kontrol ediliyor…' : '⌚ Health Connect’ten al'}
        </button>
      )}

      {msg && <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg p-2">{msg}</p>}
      {err && <p className="text-xs text-rose-700 bg-rose-50 rounded-lg p-2">{err}</p>}
      {sleepWarn && (
        <div className="text-xs text-amber-800 bg-amber-50 rounded-lg p-2 space-y-2">
          <p className="leading-relaxed">😴 {sleepWarn}</p>
          <button onClick={() => openHealthConnect()} className="btn-secondary w-full">
            Health Connect ayarlarını aç
          </button>
        </div>
      )}
      <p className="text-[11px] text-slate-400 leading-tight">
        İlk seferde Health Connect izin ekranı açılır; <b>Etkinlik</b> (adım/antrenman), <b>Uyku</b> ve{' '}
        <b>Hayati bulgular</b> (nabız) izinlerini ver. Veri Samsung Health’in Health Connect’e yazdığı kadarıyla gelir.
      </p>
    </section>
  )
}

