import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { readDietSettings, saveDietSettings } from '../db'
import { buildHealthContext } from '../lib/context'
import { buildPersonalProfile, weeklyInsights } from '../ai'

// "Beni Tanı & İçgörüler": AI, tüm verilerinden seni tanıyan kalıcı bir profil
// çıkarır ve haftalık kişisel içgörü verir. İkisi de ortak akıl (buildHealthContext)
// üstünde çalışır ve sonuç ayarlarda saklanır (tüm modüllere temel olur).
export default function BeniTani() {
  const settings = useLiveQuery(() => readDietSettings(), [], undefined)
  const [busyProfile, setBusyProfile] = useState(false)
  const [busyInsight, setBusyInsight] = useState(false)
  const [error, setError] = useState('')

  const hasKey = !!settings?.apiKey

  async function makeProfile() {
    if (!hasKey) return
    setError('')
    setBusyProfile(true)
    try {
      const s = await readDietSettings()
      const health = await buildHealthContext(s)
      const text = await buildPersonalProfile({
        apiKey: s.apiKey!,
        health,
        model: s.model,
        userName: s.userName,
        goal: s.goal,
        dietitianNotes: s.dietitianNotes
      })
      await saveDietSettings({ personalProfile: text, personalProfileAt: Date.now() })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu.')
    } finally {
      setBusyProfile(false)
    }
  }

  async function makeInsight() {
    if (!hasKey) return
    setError('')
    setBusyInsight(true)
    try {
      const s = await readDietSettings()
      const health = await buildHealthContext(s)
      const text = await weeklyInsights({
        apiKey: s.apiKey!,
        health,
        model: s.model,
        userName: s.userName,
        goal: s.goal,
        dietitianNotes: s.dietitianNotes
      })
      await saveDietSettings({ weeklyInsights: text, weeklyInsightsAt: Date.now() })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu.')
    } finally {
      setBusyInsight(false)
    }
  }

  const fmtDate = (ms?: number) =>
    ms ? new Date(ms).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <div>
      <DietHeader title="Beni Tanı" subtitle="Yapay zeka seni tanıdıkça kişisel profil + haftalık içgörü" />

      <div className="p-3 space-y-4">
        {!hasKey && (
          <div className="card p-4 bg-amber-50 border-amber-200 text-amber-800 text-sm">
            <p className="font-semibold mb-1">⚙️ Kurulum gerekli</p>
            <p>
              Bu özellik yapay zeka kullanır.{' '}
              <Link to="/ayarlar" className="underline font-semibold">
                Ayarlar
              </Link>{' '}
              bölümünden API anahtarını ekle.
            </p>
          </div>
        )}

        {error && <div className="card p-3 bg-rose-50 border-rose-200 text-rose-700 text-sm">{error}</div>}

        {/* 1) BENI TANI PROFILI */}
        <section className="card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="section-title">🧠 Beni Tanı Profili</span>
            {settings?.personalProfileAt && (
              <span className="text-[11px] text-slate-400">{fmtDate(settings.personalProfileAt)}</span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Yapay zeka tüm verilerinden (açlık, moral, şeker, ilaç, kriz saatleri, tercihler…) seni tanıyan kalıcı bir
            özet çıkarır. Bu özet <b>tüm modüllere</b> temel olur — koç seni buradan tanır.
          </p>

          {settings?.personalProfile ? (
            <div className="rounded-xl bg-slate-50 dark:bg-white/5 p-3 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {settings.personalProfile}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Henüz profil çıkarılmadı. Aşağıdaki butona bas.</p>
          )}

          <button onClick={makeProfile} disabled={!hasKey || busyProfile} className="btn-primary w-full disabled:opacity-50">
            {busyProfile ? 'Çıkarılıyor…' : settings?.personalProfile ? '🔄 Profilimi güncelle' : '✨ Profilimi çıkar'}
          </button>
          <p className="text-[11px] text-slate-400">Yeni veri girdikçe ara sıra güncellemen yeterli.</p>
        </section>

        {/* 2) HAFTALIK ICGORU */}
        <section className="card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="section-title">📊 Haftalık İçgörü</span>
            {settings?.weeklyInsightsAt && (
              <span className="text-[11px] text-slate-400">{fmtDate(settings.weeklyInsightsAt)}</span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Verilerinden bu haftaya özel 3-5 kişisel çıkarım + bu haftanın odağını verir. Sen sormadan koçluk.
          </p>

          {settings?.weeklyInsights ? (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
              {settings.weeklyInsights}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Henüz içgörü çıkarılmadı.</p>
          )}

          <button onClick={makeInsight} disabled={!hasKey || busyInsight} className="btn-primary w-full disabled:opacity-50">
            {busyInsight ? 'Analiz ediliyor…' : settings?.weeklyInsights ? '🔄 Bu haftayı yeniden analiz et' : '✨ Bu haftayı analiz et'}
          </button>
        </section>

        <p className="text-center text-[11px] text-slate-400">
          İkisi de tüm verilerini bilerek çalışır; ne kadar çok veri girersen o kadar isabetli olur.
        </p>
      </div>
    </div>
  )
}
