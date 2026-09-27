import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { lzDb } from '../db'
import type { LzDraft, LzTable } from '../types'
import { Header, T_BASLIK, T_GOVDE, T_SOLUK } from '../components/ui'
import { aiTarifUret, apiAnahtari, profilMetni } from '../lib/ai'

const ORNEKLER = [
  'Akşama tavuklu, pratik bir şey',
  'Dolapta kabak, yumurta ve beyaz peynir var',
  '30 dakikada doyurucu vejetaryen yemek',
  'Çocuklar için sebzeli ama sevecekleri bir yemek',
  'Misafire şık ama kolay bir tatlı',
  'Hafif, düşük kalorili bir akşam yemeği'
]

// NE PISIRSEM: istek ya da dolaptaki malzemeler -> aileye uygun yeni tarif.
// Secilen sofralarin notlari (sevmedikleri, alerjileri) yapay zekaya iletilir.
export default function NePisirsem() {
  const navigate = useNavigate()
  const sofralar = useLiveQuery(() => lzDb.sofralar.orderBy('name').toArray(), [], [] as LzTable[]) ?? []
  const [istek, setIstek] = useState('')
  const [kimler, setKimler] = useState<number[] | null>(null) // null = hepsi
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState('')
  const aiVar = !!apiAnahtari()

  const secili = kimler ?? sofralar.map((s) => s.id!)
  const profil = profilMetni(sofralar.filter((s) => secili.includes(s.id!)))

  const uret = async () => {
    setHata('')
    setYukleniyor(true)
    try {
      const t = await aiTarifUret(istek.trim(), profil)
      const d: LzDraft = {
        title: t.title ?? '',
        photo: '',
        sourceUrl: '',
        platform: 'manual',
        author: '✨ Yapay zeka',
        servings: t.servings ?? 0,
        minutes: t.minutes ?? 0,
        ingredients: t.ingredients ?? [],
        steps: t.steps ?? [],
        notes: t.notes ?? '',
        tags: t.tags ?? []
      }
      navigate('/yeni', { state: { draft: d, not: 'Yapay zekanın önerisi. Beğendiysen düzenleyip deftere kaydet; istersen fotoğraf ekle.' } })
    } catch (e) {
      setHata((e as Error).message)
      setYukleniyor(false)
    }
  }

  return (
    <div>
      <Header title="Ne pişirsem?" back />
      <div className="px-4 space-y-4 pb-8">
        {!aiVar && (
          <div className="rounded-2xl bg-amber-50 dark:bg-[#2a2113] text-amber-800 dark:text-amber-200 text-[13px] p-3.5">
            Bu özellik yapay zeka ile çalışır.{' '}
            <Link to="/ayarlar" className="font-semibold underline">
              Ayarlar
            </Link>
            ’dan ücretsiz Gemini (ya da Claude) anahtarını gir.
          </div>
        )}

        <div className="lz-card p-4 space-y-3">
          <div className={`font-semibold ${T_BASLIK}`}>Aklındakini ya da dolabında olanları yaz</div>
          <textarea
            className="lz-input min-h-[110px] text-[15px]"
            placeholder="Örn. Akşama tavuklu, pratik bir şey"
            value={istek}
            onChange={(e) => setIstek(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {ORNEKLER.map((o) => (
              <button key={o} onClick={() => setIstek(o)} className="lz-chip text-[12.5px]">
                {o}
              </button>
            ))}
          </div>
        </div>

        {sofralar.length > 0 && (
          <div className="lz-card p-4 space-y-2">
            <div className={`font-semibold ${T_BASLIK}`}>Kimler için?</div>
            <div className="flex flex-wrap gap-2">
              {sofralar.map((s) => {
                const on = secili.includes(s.id!)
                return (
                  <button
                    key={s.id}
                    onClick={() => setKimler(on ? secili.filter((x) => x !== s.id) : [...secili, s.id!])}
                    className={`lz-chip ${on ? 'lz-chip-on' : ''}`}
                  >
                    {s.emoji} {s.name}
                  </button>
                )
              })}
            </div>
            {profil ? (
              <p className={`text-[12.5px] whitespace-pre-line ${T_GOVDE}`}>Dikkate alınacaklar:{'\n'}{profil}</p>
            ) : (
              <p className={`text-[12.5px] ${T_SOLUK}`}>Sofralara sevmediklerini ve alerjilerini yazarsan öneriler bunlara uyar.</p>
            )}
          </div>
        )}

        {hata && <div className="rounded-2xl bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300 text-sm p-3.5">{hata}</div>}

        <button className="lz-btn-primary w-full text-[16px]" disabled={!aiVar || !istek.trim() || yukleniyor} onClick={() => void uret()}>
          {yukleniyor ? 'Tarif hazırlanıyor…' : '✨ Tarifi hazırla'}
        </button>
      </div>
    </div>
  )
}
