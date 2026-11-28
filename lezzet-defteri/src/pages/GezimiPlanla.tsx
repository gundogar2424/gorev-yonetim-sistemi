import { useEffect, useRef, useState } from 'react'
import { aiGeziDegistir, aiGeziPlan, apiAnahtari } from '../lib/ai'
import {
  BOS_GEZI,
  GEZI_ACILIS,
  acikYazi,
  baslangicYazi,
  cocukYazi,
  kapaliDuraklar,
  yolYazi,
  degisiklikUygula,
  durakCikar,
  durakKalsin,
  geziMesajIsle,
  geziOku,
  geziYaz,
  planKur,
  planOzeti,
  type GeziDurum
} from '../lib/geziPlan'
import { dosyaPaylas, geziHtml } from '../lib/paylas'
import { Header, T_BASLIK, T_GOVDE, T_SOLUK, Toast, useToast } from '../components/ui'

// GEZIMI PLANLA: ustte sohbet kutusu, altinda plan karti (gun sekmeleri; her durakta Kalsin ve Cikar).
// Eksik bilgi sorulari telefonda sorulur (yapay zeka harcanmaz). Plan 1 kez olusturulur ve saklanir;
// sohbetten "sunu degistir" yazilinca yalnizca o duraklar degisir, plan yeniden yazilmaz.
export default function GezimiPlanla() {
  const [d, setD] = useState<GeziDurum>(geziOku)
  const [yazi, setYazi] = useState('')
  const [mesgul, setMesgul] = useState('')
  const [hata, setHata] = useState('')
  const [gun, setGun] = useState(0)
  const [yeniSor, setYeniSor] = useState(false)
  const [toast, goster] = useToast()
  const son = useRef<HTMLDivElement>(null)
  const kaydet = (y: GeziDurum) => {
    setD(y)
    geziYaz(y)
  }
  useEffect(() => {
    son.current?.scrollIntoView({ block: 'nearest' })
  }, [d.sohbet.length, mesgul])

  const planOlustur = async (y: GeziDurum) => {
    if (!apiAnahtari()) {
      setHata('Plan için Ayarlar’dan yapay zeka anahtarı gir.')
      return
    }
    setMesgul('Plan hazırlanıyor…')
    setHata('')
    try {
      const p = await aiGeziPlan({ anlatim: y.anlatim, gun: y.gun ?? 1, kimlerle: y.kimlerle ?? '', cikis: y.cikis ?? '', cocuk: y.cocuk, cocukYas: y.cocukYas, baslangic: baslangicYazi(y.baslangic) })
      if (!p.gunler.some((g) => g.length)) throw new Error('Plan çıkarılamadı. Nereye gideceğini biraz daha açık yaz.')
      const k = planKur({ ...y, aiCagri: y.aiCagri + 1 }, p)
      // O saatte kapali kalan durak varsa sohbette yazilir
      const kapali = kapaliDuraklar(k).map((metin) => ({ kim: 'ai' as const, metin }))
      kaydet({ ...k, sohbet: [...k.sohbet, { kim: 'ai', metin: 'Planın hazır, aşağıda. Değiştirmek istediğin yeri yaz; yalnızca orası değişir.' }, ...kapali] })
      setGun(0)
    } catch (e) {
      setHata((e as Error).message)
    }
    setMesgul('')
  }

  const gonder = async () => {
    const metin = yazi.trim()
    if (!metin || mesgul) return
    setYazi('')
    setHata('')
    if (!d.plan) {
      // Plan yok: bilgi toplanir (soru telefonda sorulur), tamamsa plan TEK cagriyla olusturulur
      const { durum, sonraki } = geziMesajIsle(d, metin)
      kaydet(durum)
      if (sonraki === 'plan') await planOlustur(durum)
      return
    }
    // Plan var: yalnizca istenen kisim degisir
    const y: GeziDurum = { ...d, sohbet: [...d.sohbet, { kim: 'ben', metin }] }
    kaydet(y)
    if (!apiAnahtari()) {
      setHata('Değişiklik için Ayarlar’dan yapay zeka anahtarı gir.')
      return
    }
    setMesgul('Yalnızca istediğin kısım değiştiriliyor…')
    try {
      const r = await aiGeziDegistir(planOzeti(y), metin, `${y.anlatim} · ${y.gun ?? 1} gün · ${y.kimlerle ?? ''}`)
      const { durum, sayi } = degisiklikUygula({ ...y, aiCagri: y.aiCagri + 1 }, r.degisiklikler)
      kaydet({ ...durum, sohbet: [...durum.sohbet, { kim: 'ai', metin: sayi ? `${r.cevap || 'Değiştirdim.'} (${sayi} durak değişti, diğerleri aynı kaldı.)` : r.cevap || 'Değiştirilecek bir şey bulamadım; hangi durağı kastettiğini yazar mısın?' }] })
    } catch (e) {
      setHata((e as Error).message)
    }
    setMesgul('')
  }

  const gunler = d.plan?.gunler ?? []
  const seciliGun = Math.min(gun, Math.max(0, gunler.length - 1))

  return (
    <div>
      <Header title="Gezimi Planla" subtitle={d.plan ? d.plan.baslik || 'Planın hazır' : 'Anlat, gün gün plan çıksın'} back />
      <div className="px-4 pt-3 space-y-3">
        {/* SOHBET KUTUSU */}
        <div className="lz-card p-3 space-y-2" data-gezi-sohbet>
          <div className="space-y-1.5 max-h-56 overflow-y-auto overscroll-contain">
            <p className={`text-[14px] rounded-[10px] px-3 py-2 bg-[#EFE7D8] dark:bg-[#2C261F] ${T_BASLIK}`}>{GEZI_ACILIS}</p>
            {d.sohbet.map((m, i) => (
              <p
                key={i}
                data-mesaj={m.kim}
                className={`text-[14px] rounded-[10px] px-3 py-2 ${m.kim === 'ben' ? `ml-8 bg-[#221C15] text-white dark:bg-[#F4EFE6] dark:text-[#221C15]` : `mr-8 bg-[#EFE7D8] dark:bg-[#2C261F] ${T_BASLIK}`}`}
              >
                {m.metin}
              </p>
            ))}
            {mesgul && <p className={`text-[13px] ${T_SOLUK}`}>{mesgul}</p>}
            <div ref={son} />
          </div>
          {hata && (
            <div className="rounded-xl bg-amber-50 dark:bg-[#33270f] px-3 py-2">
              <p className="text-[13.5px] text-amber-900 dark:text-amber-200">{hata}</p>
              {!d.plan && !d.bekleyen && d.anlatim && (
                <button className="text-[13px] font-semibold text-lz-600 underline min-h-[48px]" onClick={() => void planOlustur(d)}>
                  ↻ Tekrar dene
                </button>
              )}
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              className="lz-input flex-1 min-w-0"
              rows={2}
              placeholder={d.plan ? 'Şunu değiştir: …' : d.bekleyen ? 'Cevabını yaz' : 'Cümleyle anlat'}
              value={yazi}
              onChange={(e) => setYazi(e.target.value)}
              data-gezi-yazi
            />
            <button className="lz-btn-primary !min-h-[48px] !px-4 flex-shrink-0" disabled={!yazi.trim() || !!mesgul} onClick={() => void gonder()} data-gezi-gonder>
              Gönder
            </button>
          </div>
        </div>

        {/* PLAN KARTI: sohbetin disinda, kaybolmaz */}
        {d.plan && (
          <div className="lz-card p-3.5 space-y-3" data-gezi-plan>
            <div className={`lz-baslik font-semibold text-[17px] ${T_BASLIK}`}>{d.plan.baslik || 'Gezi planım'}</div>
            {(d.kimlerle || d.cocuk) && (
              <div className={`text-[13px] ${T_GOVDE}`} data-gezi-kimlerle>
                {d.kimlerle ? `Kimlerle: ${d.kimlerle}` : ''}
                {d.kimlerle && d.cocuk ? ' · ' : ''}
                {cocukYazi(d)}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5" data-gezi-gunler>
              {gunler.map((_, i) => (
                <button key={i} className={`lz-chip !min-h-[48px] text-[13.5px] ${seciliGun === i ? 'lz-chip-on' : ''}`} onClick={() => setGun(i)}>
                  {i + 1}. Gün
                </button>
              ))}
            </div>
            {(gunler[seciliGun] ?? []).map((x, sira) => (
              <div key={x.id} className="space-y-2">
              {sira > 0 && yolYazi(x) && (
                <div className={`text-[12.5px] font-semibold pl-3 ${T_SOLUK}`} data-yol>
                  ↓ {yolYazi(x)}
                </div>
              )}
              <div className={`rounded-[10px] border p-3 space-y-2 ${x.kalsin ? 'border-emerald-600 bg-emerald-50 dark:bg-[#12261b]' : 'border-[#DDD2BF] dark:border-[#2C261F]'}`} data-durak={x.id}>
                <div className="flex items-start gap-2.5">
                  <span className="text-[14px] font-bold tabular-nums text-lz-600 w-12 flex-shrink-0 pt-0.5">{x.saat || '—'}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold text-[15px] leading-snug ${T_BASLIK}`}>{x.ad}</div>
                    <div className={`text-[12.5px] ${T_SOLUK}`}>{x.tur}</div>
                    {x.aciklama && <div className={`text-[13.5px] mt-0.5 ${T_GOVDE}`}>{x.aciklama}</div>}
                    <div className={`text-[12.5px] mt-0.5 font-semibold ${x.acik === 'acik' ? 'text-emerald-700 dark:text-emerald-400' : x.acik === 'kapali' ? 'text-amber-800 dark:text-amber-300' : T_SOLUK}`} data-acik={x.acik ?? 'bilinmiyor'}>
                      {acikYazi(x)}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button className={`lz-chip !min-h-[48px] justify-center text-[13.5px] ${x.kalsin ? 'lz-chip-on' : ''}`} onClick={() => kaydet(durakKalsin(d, x.id))} data-kalsin>
                    {x.kalsin ? '✓ Kalsın' : 'Kalsın'}
                  </button>
                  <button className="lz-btn-soft !min-h-[48px] text-[13.5px]" onClick={() => kaydet(durakCikar(d, x.id))} data-cikar>
                    Çıkar
                  </button>
                </div>
              </div>
              </div>
            ))}
            {!(gunler[seciliGun] ?? []).length && <p className={`text-[13.5px] ${T_SOLUK}`}>Bu günde durak kalmadı. Sohbetten “{seciliGun + 1}. güne … ekle” yazabilirsin.</p>}
            <p className={`text-[12px] ${T_SOLUK}`} data-gezi-not>
              Plan 1 kez oluşturuldu ve telefonda saklanıyor. Kalsın dediğin durak sohbetle değişmez. Çıkar yapay zeka harcamaz.
            </p>
            <button
              className="lz-btn-primary w-full !min-h-[48px] text-[14px]"
              onClick={() =>
                void dosyaPaylas(d.plan?.baslik || 'Gezi planım', geziHtml(d), '', 'Planı paylaş')
                  .then(() => goster('✓ Plan paylaşıma hazır'))
                  .catch(() => goster('Paylaşılamadı'))
              }
              data-gezi-paylas
            >
              Paylaş
            </button>
            {!yeniSor ? (
              <button className="lz-btn-soft w-full !min-h-[48px] text-[13.5px]" onClick={() => setYeniSor(true)} data-gezi-yeni>
                Yeni plan
              </button>
            ) : (
              <div className="rounded-xl bg-amber-50 dark:bg-[#33270f] px-3 py-2 space-y-2">
                <p className="text-[13.5px] text-amber-900 dark:text-amber-200">Bu plan ve sohbet silinsin mi?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button className="lz-btn-soft !min-h-[48px] text-[13.5px]" onClick={() => setYeniSor(false)}>
                    Vazgeç
                  </button>
                  <button
                    className="lz-btn-primary !min-h-[48px] text-[13.5px]"
                    onClick={() => {
                      kaydet({ ...BOS_GEZI })
                      setYeniSor(false)
                      setGun(0)
                    }}
                  >
                    Sil, yeni plan
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <Toast text={toast} />
    </div>
  )
}
