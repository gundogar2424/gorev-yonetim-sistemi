import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { aiTarifBesin, apiAnahtari } from '../lib/ai'
import { addPlan, addToShopping, deleteRecipe, lzDb, toggleFavorite, updateRecipe } from '../db'
import type { LzMeal, LzTable } from '../types'
import { Icon, type IconName, PlatformLabel, Sheet, SofraRozet, T_BASLIK, T_GOVDE, T_SOLUK, Thumb, Toast, sureYaz, useToast } from '../components/ui'
import { olcekle } from '../lib/qty'
import { GUN_ADI, OGUNLER, gunAnahtari, gunEkle, haftaBasi, kisaTarih } from '../lib/dates'
import { PLATFORM_AD } from '../lib/importer'
import { BesinSatiri } from './Diyetim'
import { etkilesimEski, etkilesimGetir, kisaSayi } from '../lib/begeni'
import { dosyaPaylas, ppHtml, tarifHtml, tmHtml } from '../lib/paylas'
import { siraEkle } from '../lib/sira'
import { siteyeKoy } from '../lib/cookidoo'
import { TarifSekmeleri } from '../components/TarifSekmeleri'
import { disariAc, kaynakLinki } from '../lib/disariAc'
import { CIHAZ_AD, PisirmeNotu, SONUC_AD } from '../components/PisirmeNotu'
import type { PisirmeKaydi } from '../types'
import { isaretsiz, kaydiDuzenle, kaydiSil, pisirmeKaydet } from '../lib/gunluk'
import { pisirmeYazi } from './Recipes'

export default function RecipeDetail() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const r = useLiveQuery(() => lzDb.recipes.get(id), [id])
  const sofralar = useLiveQuery(() => lzDb.sofralar.orderBy('name').toArray(), [], [] as LzTable[]) ?? []
  const [kisi, setKisi] = useState(0) // 0 = tarifteki porsiyon
  const [isaretli, setIsaretli] = useState<Set<number>>(new Set())
  const [planAc, setPlanAc] = useState(false)
  const [paylasAc, setPaylasAc] = useState(false)
  const [pisirdimBekle, setPisirdimBekle] = useState(false)
  const [notAc, setNotAc] = useState(false)
  const [duzenKayit, setDuzenKayit] = useState<PisirmeKaydi | null>(null) // gunluk satiri duzenleme // Pisirdim sonrasi "Nasil oldu?"
  const [acilamadi, setAcilamadi] = useState(false) // kaynak link acilamadi: link kopyalandi ve gosterilir
  const [toast, goster] = useToast()
  const [besinHesap, setBesinHesap] = useState(false)
  // Begeni puani: okunmamissa sayfadan bir kez okunur (yapay zeka yok, yalnizca internet)
  useEffect(() => {
    if (r && etkilesimEski(r)) void etkilesimGetir(r)
  }, [r?.id])

  if (r === undefined) return null
  if (!r) {
    return (
      <div className="p-6 text-center">
        <p className={T_SOLUK}>Tarif bulunamadı.</p>
        <Link to="/" className="lz-btn-soft mt-4">
          Tariflere dön
        </Link>
      </div>
    )
  }

  const temel = r.servings || 0
  const hedef = kisi || temel
  const carpan = temel && hedef ? hedef / temel : 1
  const malzemeler = r.ingredients.map((m) => olcekle(m, carpan))

  const alisveriseEkle = async () => {
    const secim = isaretli.size ? malzemeler.filter((_, i) => !isaretli.has(i)) : malzemeler
    const n = await addToShopping(secim.map(isaretsiz), r.id!, r.title) // ✎ isareti alisverise gitmez
    goster(n ? `${n} malzeme alışveriş listesine eklendi` : 'Hepsi zaten listede')
  }

  const paylasYap = async (tur: 'html' | 'tm' | 'pp') => {
    setPaylasAc(false)
    if (tur === 'tm' && !r.tm) {
      // Once Thermomix onizlemesi (uyarlama) yapilir, oradan paylasilir
      navigate(`/thermomix/${r.id}`)
      return
    }
    if (tur === 'pp' && !r.pp) {
      navigate(`/pisirici/${r.id}`)
      return
    }
    try {
      if (tur === 'html') {
        goster('Tarif sayfası hazırlanıyor…')
        await dosyaPaylas(r.title, await tarifHtml(r))
      } else if (tur === 'pp') {
        goster('Pilav pişirici pişirme modu hazırlanıyor…')
        await dosyaPaylas(r.title, await ppHtml(r), '-pilav-pisirici')
      } else {
        goster('Pişirme modu hazırlanıyor…')
        await dosyaPaylas(r.title, await tmHtml(r), '-thermomix')
      }
    } catch (e) {
      const m = (e as Error).message || ''
      if (!/cancel|abort|iptal/i.test(m)) goster('Paylaşılamadı: ' + m.slice(0, 60))
    }
  }

  // Kaynak video disarida (YouTube uygulamasi ya da tarayici); acilamazsa link kopyalanir ve gosterilir
  const kaynak = kaynakLinki(r)
  const videoMu = ['youtube', 'instagram', 'tiktok', 'facebook'].includes(r.platform)
  const platformAd = PLATFORM_AD[r.platform] === 'Web' ? '' : PLATFORM_AD[r.platform]
  const kaynagiAc = async () => {
    if (!kaynak) return
    const ok = await disariAc(kaynak, r.platform)
    if (!ok) {
      setAcilamadi(true)
      goster(`${platformAd || 'Kaynak'} açılamadı, link kopyalandı`)
    }
  }

  const sofraDegis = (tid: number) =>
    updateRecipe(r.id!, { tableIds: r.tableIds.includes(tid) ? r.tableIds.filter((x) => x !== tid) : [...r.tableIds, tid] })

  return (
    <div>
      {/* Kapak */}
      <div className="relative">
        {kaynak && videoMu ? (
          // Kapaga dokununca kaynak video disarida acilir; ortada 48 px yari saydam oynat isareti
          <button onClick={() => void kaynagiAc()} className="block w-full relative" aria-label={`${platformAd}’da izle`} data-kapak-oynat>
            <Thumb src={r.photo} className="w-full h-72 rounded-b-[32px] text-7xl" />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="w-12 h-12 rounded-full bg-black/45 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5 ml-0.5 text-white" fill="currentColor" aria-hidden="true">
                  <path d="M8 5.5v13l11-6.5z" />
                </svg>
              </span>
            </span>
          </button>
        ) : (
          <Thumb src={r.photo} className="w-full h-72 rounded-b-[32px] text-7xl" />
        )}
        <div className="absolute inset-x-0 top-0 flex justify-between p-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
          <RoundBtn onClick={() => navigate(-1)} label="Geri">
            <Icon name="back" />
          </RoundBtn>
          <div className="flex gap-2">
            <RoundBtn onClick={() => setPaylasAc(true)} label="Paylaş">
              <Icon name="share" />
            </RoundBtn>
            <RoundBtn onClick={() => void toggleFavorite(r.id!)} label="Favori">
              <svg viewBox="0 0 24 24" className={`w-5 h-5 ${r.favorite ? 'text-amber-400' : ''}`} fill={r.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z" strokeLinejoin="round" />
              </svg>
            </RoundBtn>
            <RoundBtn onClick={() => navigate(`/duzenle/${r.id}`)} label="Düzenle">
              <Icon name="edit" />
            </RoundBtn>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-6 relative space-y-3 pb-[100px]">
        <TarifSekmeleri id={r.id!} aktif="normal" />
        {r.kontrol && (
          <div
            className={`rounded-2xl text-[13px] p-3.5 relative z-10 ${
              r.kontrol.startsWith('⚠️')
                ? 'bg-rose-50 dark:bg-[#2a1a1d] text-rose-700 dark:text-rose-300'
                : 'bg-amber-50 dark:bg-[#2a2113] text-amber-800 dark:text-amber-200'
            }`}
          >
            <div className="font-semibold mb-0.5">Otomatik eklendi</div>
            {r.kontrol}
            <div className="flex gap-2 mt-2.5">
              <button className="lz-btn-soft px-3 py-1.5 text-[12.5px]" onClick={() => void updateRecipe(r.id!, { kontrol: undefined })}>
                ✓ Kontrol ettim
              </button>
              <Link to={`/duzenle/${r.id}`} className="lz-btn-soft px-3 py-1.5 text-[12.5px]">
                Düzenle
              </Link>
            </div>
          </div>
        )}
        <div className="lz-card p-4">
          <h1 className={`text-[23px] font-bold leading-tight ${T_BASLIK}`}>{r.title}</h1>
          {r.cookCount > 0 && (
            // Basligin hemen altinda buyuk ve gorunur (Yaptiklarim kartindaki yaziyla ayni)
            <p className="mt-1.5 text-[16px] font-bold text-lz-700 dark:text-[#ff9f88]" data-pisirme-sayisi>
              {pisirmeYazi(r)}
            </p>
          )}
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <PlatformLabel r={r} tam />
            {r.minutes > 0 && (
              <span className={`inline-flex items-center gap-1 text-[12px] ${T_SOLUK}`}>
                <Icon name="clock" className="w-3.5 h-3.5" /> {sureYaz(r.minutes)}
              </span>
            )}
          </div>
          {r.etkilesim && r.etkilesim.puan > 0 && (
            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
              <span className="rounded-full bg-amber-50 dark:bg-[#2a2113] text-amber-800 dark:text-amber-300 text-[12.5px] font-bold px-2.5 py-1">
                Beğeni {r.etkilesim.puan}/10
              </span>
              <span className={`text-[12px] ${T_SOLUK}`}>
                {[
                  r.etkilesim.begeni ? `${kisaSayi(r.etkilesim.begeni)} beğeni` : '',
                  r.etkilesim.yorum ? `${kisaSayi(r.etkilesim.yorum)} yorum` : '',
                  r.etkilesim.izlenme ? `${kisaSayi(r.etkilesim.izlenme)} izlenme` : ''
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
          )}
          {r.besin ? (
            <div className="mt-3">
              <div className={`text-[11.5px] mb-1 ${T_SOLUK}`}>1 porsiyon (tahmini)</div>
              <BesinSatiri b={r.besin} kucuk />
            </div>
          ) : (
            r.ingredients.length > 0 &&
            apiAnahtari() && (
              <button
                className="mt-3 lz-chip text-[12.5px]"
                disabled={besinHesap}
                onClick={async () => {
                  setBesinHesap(true)
                  try {
                    await updateRecipe(r.id!, { besin: await aiTarifBesin(r) })
                  } catch (e) {
                    goster((e as Error).message)
                  }
                  setBesinHesap(false)
                }}
              >
                {besinHesap ? 'Hesaplanıyor…' : 'Kalori ve makroları hesapla'}
              </button>
            )
          )}
          {r.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {r.tags.map((t) => (
                <span key={t} className="lz-pill">
                  {t}
                </span>
              ))}
            </div>
          )}
          {kaynak && (
            <button onClick={() => void kaynagiAc()} className="mt-3 inline-flex items-center gap-1.5 min-h-[48px] text-[13px] font-semibold text-lz-600" data-kaynak-ac>
              <Icon name="link" className="w-4 h-4" /> {platformAd ? `${platformAd}’da aç` : 'Kaynağı aç'}
            </button>
          )}
          {kaynak && acilamadi && (
            <div className="mt-2 rounded-xl bg-amber-50 dark:bg-[#33270f] p-3 text-[12.5px] text-amber-900 dark:text-amber-200" data-kaynak-link>
              {platformAd || 'Kaynak'} açılamadı, link kopyalandı. Linkin tamamı:
              <div className="mt-1 font-mono text-[12px] break-all select-all">{kaynak}</div>
            </div>
          )}
        </div>

        {/* PISIRME GUNLUGU: yeniden eskiye; "3. pişirme · 27 Kas 2026 · Sonuç: Daha iyi" + Ne degistirdim + Nasil oldu */}
        {(r.cookCount > 0 || (r.pisirmeler?.length ?? 0) > 0) && (
          <div className="lz-card p-4" data-pisirme-gecmisi>
            <h2 className={`font-bold text-[17px] mb-2 ${T_BASLIK}`}>Pişirme Günlüğü</h2>
            {r.pisirmeler?.length ? (
              <ul className="divide-y divide-[#E9E0CF] dark:divide-[#2C261F]">
                {[...r.pisirmeler]
                  .sort((a, b) => b.zaman - a.zaman)
                  .map((p) => (
                    <li key={`${p.zaman}-${p.no}`} className={`py-2.5 text-[14px] leading-snug ${T_GOVDE}`} data-gunluk-satir>
                      <div className="flex items-start gap-2">
                        <div className={`flex-1 min-w-0 font-semibold ${T_BASLIK}`}>
                          {p.no}. pişirme · {new Date(p.zaman).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {p.cihaz ? ` · ${CIHAZ_AD[p.cihaz]}` : ''}
                          {p.sonuc ? ` · Sonuç: ${SONUC_AD[p.sonuc]}` : ''}
                        </div>
                        <button className="lz-chip !min-h-[48px] !px-2.5 text-[12.5px]" onClick={() => setDuzenKayit(p)} data-gunluk-duzenle>
                          Düzenle
                        </button>
                        <button
                          className="lz-chip !min-h-[48px] !px-2.5 text-[12.5px] !text-rose-700 !border-rose-300 dark:!text-rose-300"
                          onClick={() => {
                            if (confirm(`${p.no}. pişirme kaydı silinsin mi? Pişirme sayısı 1 azalır.`)) void kaydiSil(r.id!, p.zaman)
                          }}
                          data-gunluk-sil
                        >
                          Sil
                        </button>
                      </div>
                      {/* Notlar defterin kenarina el yazisiyla dusulmus gibi (koyu murekkep, silik degil) */}
                      {(p.degisiklik || p.deneyim || p.not) && (
                        <div className="lz-kenar mt-1.5 space-y-0.5">
                          {p.degisiklik && (
                            <div>
                              <span className={`text-[12px] font-semibold ${T_SOLUK}`}>Ne değiştirdim:</span> <span className="lz-not">{p.degisiklik}</span>
                              {p.uygulandi ? <span className="block text-[12px] font-bold text-lz-700 dark:text-[#ff9f88]">✎ tarife uygulandı</span> : null}
                            </div>
                          )}
                          {p.deneyim && (
                            <div>
                              <span className={`text-[12px] font-semibold ${T_SOLUK}`}>Nasıl oldu:</span> <span className="lz-not">{p.deneyim}</span>
                            </div>
                          )}
                          {p.not && (
                            <div>
                              <span className={`text-[12px] font-semibold ${T_SOLUK}`}>Not:</span> <span className="lz-not">{p.not}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
              </ul>
            ) : null}
            {r.cookCount > (r.pisirmeler?.length ?? 0) && (
              <p className={`text-[12.5px] ${r.pisirmeler?.length ? 'mt-2' : ''} ${T_SOLUK}`}>
                {r.cookCount - (r.pisirmeler?.length ?? 0)} pişirme bu özellikten önceydi; tarihleri bilinmediği için listede yok.
              </p>
            )}
          </div>
        )}

        <Link to={`/tarif/${r.id}/degistir`} className="lz-card p-3 flex items-center gap-3 active:scale-[0.99] transition">
          <span className="w-10 h-10 rounded-2xl bg-lz-50 dark:bg-[#3a1d16] text-lz-600 dark:text-lz-300 flex items-center justify-center"><Icon name="sparkle" className="w-5 h-5" /></span>
          <span className="flex-1">
            <span className={`block font-semibold text-[15px] ${T_BASLIK}`}>Yapay zekayla değiştir</span>
            <span className={`block text-[12px] ${T_SOLUK}`}>Stevia, glutensiz, daha az kalori, airfryer…</span>
          </span>
          <Icon name="back" className={`w-5 h-5 rotate-180 ${T_SOLUK}`} />
        </Link>

        <Link
          to={`/thermomix/${r.id}`}
          className="lz-card p-3 flex items-center gap-3 active:scale-[0.99] transition"
        >
          <span className="w-10 h-10 rounded-2xl bg-lz-50 dark:bg-[#3a1d16] text-lz-600 flex items-center justify-center">
            <Icon name="pot" />
          </span>
          <span className="flex-1">
            <span className={`block font-semibold text-[15px] ${T_BASLIK}`}>{r.tm ? 'Thermomix sürümü' : 'Thermomix’e uyarla'}</span>
            <span className={`block text-[12px] ${T_SOLUK}`}>
              {r.tm ? `${r.tm.steps.length} TM7 adımı · devir, sıcaklık, süre` : 'TM7 adımlarına çevir (yapay zeka)'}
            </span>
          </span>
          <Icon name="back" className={`w-5 h-5 rotate-180 ${T_SOLUK}`} />
        </Link>

        {/* Pisir adim adim modu acar; kucuk "✓ Pisirdim" modu acmadan isaretler (Afiyet olsun ile ayni is: sayi +1, son pisirme tarihi) */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
          <Link to={`/pisir/${r.id}`} className="lz-btn-primary !px-3">
            <Icon name="play" className="w-4 h-4" /> Pişir
          </Link>
          <button
            className="lz-btn-soft !px-3 !gap-1 text-[14px] whitespace-nowrap"
            disabled={pisirdimBekle}
            data-pisirdim
            onClick={() => {
              setPisirdimBekle(true)
              setNotAc(true) // "Nasil oldu?" — kaydedince isaretlenir
            }}
          >
            ✓ Pişirdim
          </button>
          <button className="lz-btn-soft !px-3 whitespace-nowrap" onClick={() => setPlanAc(true)}>
            <Icon name="calendar" className="w-4 h-4 max-[359px]:hidden" /> Haftaya ekle
          </button>
        </div>

        {/* Malzemeler */}
        <div className="lz-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className={`font-bold text-[17px] ${T_BASLIK}`}>Malzemeler</h2>
            {temel > 0 && (
              <div className="flex items-center gap-1 bg-[#E9E0CF] dark:bg-[#2C261F] rounded-full p-1">
                <button className="w-8 h-8 rounded-full bg-white dark:bg-[#231E18] font-bold" onClick={() => setKisi(Math.max(1, hedef - 1))} aria-label="Azalt">
                  −
                </button>
                <span className={`text-[13px] font-semibold px-1.5 tabular-nums ${T_BASLIK}`}>{hedef} kişilik</span>
                <button className="w-8 h-8 rounded-full bg-white dark:bg-[#231E18] font-bold" onClick={() => setKisi(hedef + 1)} aria-label="Artır">
                  +
                </button>
              </div>
            )}
          </div>
          {malzemeler.length === 0 ? (
            <div className="space-y-2">
              <p className={`text-sm ${T_SOLUK}`}>Malzeme yazılmamış.</p>
              {r.sourceUrl && (
                <button
                  className="lz-btn-soft w-full text-sm"
                  onClick={async () => {
                    if (!confirm('Tarif kaynaktan (açıklama ve video) yeniden çıkarılsın mı? Bu kayıt silinip yenisi eklenecek.')) return
                    const url = r.sourceUrl
                    await deleteRecipe(r.id!)
                    await siraEkle(url, 'tarif', true)
                    navigate('/sira', { replace: true })
                  }}
                >
                  ↻ Kaynaktan yeniden çıkar
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-[#E9E0CF] dark:divide-[#2C261F]">
              {malzemeler.map((m, i) => (
                <li key={i}>
                  <label className="flex items-start gap-3 py-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1 w-[18px] h-[18px] flex-shrink-0"
                      checked={isaretli.has(i)}
                      onChange={() => {
                        const s = new Set(isaretli)
                        if (s.has(i)) s.delete(i)
                        else s.add(i)
                        setIsaretli(s)
                      }}
                    />
                    <span className={`text-[15px] leading-snug ${isaretli.has(i) ? 'line-through opacity-50' : ''} ${T_GOVDE}`}>
                      <Kalemli metin={m} />
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {malzemeler.length > 0 && (
            <button className="lz-btn-soft w-full mt-3 text-sm" onClick={() => void alisveriseEkle()}>
              <Icon name="cart" className="w-4 h-4" />
              {isaretli.size ? 'Evde olmayanları listeye ekle' : 'Alışveriş listesine ekle'}
            </button>
          )}
          {malzemeler.length > 0 && <p className={`text-[11.5px] mt-2 text-center ${T_SOLUK}`}>Evde olanları işaretle; yalnızca eksikler eklenir.</p>}
        </div>

        {/* Yapilis */}
        <div className="lz-card p-4">
          <h2 className={`font-bold text-[17px] mb-2 ${T_BASLIK}`}>Yapılışı</h2>
          {r.steps.length === 0 ? (
            <p className={`text-sm ${T_SOLUK}`}>Adım yazılmamış.</p>
          ) : (
            <ol className="space-y-3">
              {r.steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-7 h-7 rounded-full bg-lz-50 dark:bg-[#3a1d16] text-lz-600 dark:text-lz-300 text-[13px] font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <p className={`text-[15px] leading-relaxed pt-0.5 ${T_GOVDE}`}>
                    <Kalemli metin={s} />
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>

        {r.notes && (
          <div className="lz-card p-4">
            <h2 className={`font-bold text-[17px] mb-2 ${T_BASLIK}`}>Notlar</h2>
            <p className={`text-[14.5px] leading-relaxed whitespace-pre-line ${T_GOVDE}`}>{r.notes}</p>
          </div>
        )}

        <div className="lz-card p-4">
          <h2 className={`font-bold text-[17px] mb-2 ${T_BASLIK}`}>Sofralar</h2>
          {sofralar.length === 0 ? (
            <p className={`text-sm ${T_SOLUK}`}>Henüz sofra yok. Tariflerim › Sofralarım’dan oluşturabilirsin.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sofralar.map((t) => (
                <button key={t.id} onClick={() => void sofraDegis(t.id!)} className={`lz-chip ${r.tableIds.includes(t.id!) ? 'lz-chip-on' : ''}`}>
                  <SofraRozet ad={t.name} className="w-5 h-5 text-[9px]" /> {t.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {r.sourceUrl && (
          <button
            className="lz-btn-soft w-full text-sm"
            onClick={async () => {
              if (!confirm('Bu paylaşım bir tarif değil, mekan mı? Tarif silinip Mekanlarım’a mekan olarak kaydedilecek.')) return
              const url = r.sourceUrl
              await deleteRecipe(r.id!)
              await siraEkle(url, 'mekan')
              navigate('/sira', { replace: true })
            }}
          >
            Bu tarif değil, mekan — Mekanlarım’a taşı
          </button>
        )}
        <button
          className="lz-btn-danger w-full"
          onClick={async () => {
            if (!confirm('Bu tarif silinsin mi?')) return
            await deleteRecipe(r.id!)
            navigate('/', { replace: true })
          }}
        >
          <Icon name="trash" className="w-4 h-4" /> Tarifi sil
        </button>
      </div>

      <PisirmeNotu
        open={!!duzenKayit}
        duzenle={duzenKayit ?? undefined}
        onVazgec={() => setDuzenKayit(null)}
        onKaydet={async (g) => {
          const k = duzenKayit
          setDuzenKayit(null)
          if (k) await kaydiDuzenle(r.id!, k.zaman, g)
          goster('Günlük kaydı güncellendi')
        }}
      />
      <PisirmeNotu
        open={notAc}
        onVazgec={() => {
          setNotAc(false) // hicbir sey kaydedilmez
          setPisirdimBekle(false)
        }}
        onKaydet={async (g) => {
          setNotAc(false)
          const { uygulama } = await pisirmeKaydet(r.id!, g, 'normal')
          goster(uygulama ? 'Günlüğe yazıldı; değişiklik tarife uygulanıyor…' : `Pişirdim olarak işaretlendi (${(r.cookCount ?? 0) + 1}. kez) · Yaptıklarım’da`)
          setTimeout(() => setPisirdimBekle(false), 1000) // yanlislikla cift dokunma sayilmasin
          if (uygulama) goster(await uygulama)
        }}
      />
      <Sheet open={paylasAc} onClose={() => setPaylasAc(false)} title="Tarifi paylaş">
        <div className="space-y-2">
          <PaylasSecenek
            baslik="Tarif sayfası (dosya)"
            alt="Fotoğraflı sayfa; videoya tıklayınca kaynak video açılır. Uygulama gerekmez"
            onClick={() => void paylasYap('html')}
            ikon="file"
          />
          <PaylasSecenek
            baslik="Thermomix pişirme modu (dosya)"
            alt={
              r.tm
                ? 'Önizleme + adım adım, sayaçlı TM7 pişirme ekranı'
                : 'Önce Thermomix önizlemesi hazırlanır, oradan paylaşırsın'
            }
            onClick={() => void paylasYap('tm')}
            ikon="pot"
          />
          <PaylasSecenek
            baslik="Pilav Pişirici Pişirme Modu (dosya)"
            alt={r.pp ? 'Instant Pot adımları: düğme sırası, Cancel uyarıları, sayaç' : 'Önce pilav pişirici uyarlaması hazırlanır, oradan paylaşırsın'}
            onClick={() => void paylasYap('pp')}
            ikon="pot"
          />
          <PaylasSecenek
            baslik="Siteye koy (herkese açık link)"
            alt="Tarif sitende sayfa olur; Google’da bulunur, Cookidoo’ya linkle aktarılır. GitHub’da “Commit”e basman yeter"
            onClick={async () => {
              setPaylasAc(false)
              goster((await siteyeKoy(r)).mesaj)
            }}
            ikon="link"
          />
          <p className={`text-[11.5px] px-1 pt-1 ${T_SOLUK}`}>
            Karşı tarafta My Life varsa dosyayı “Tarif ekle → Dosyadan” ile defterine alabilir.
          </p>
        </div>
      </Sheet>

      <PlanSec
        open={planAc}
        onClose={() => setPlanAc(false)}
        onSec={async (tarih, ogun) => {
          await addPlan(tarih, ogun, r.id!)
          setPlanAc(false)
          goster('Haftalık plana eklendi')
        }}
      />
      <Toast text={toast} />
    </div>
  )
}

function PaylasSecenek({ baslik, alt, ikon, onClick }: { baslik: string; alt: string; ikon: IconName; onClick: () => void }) {
  return (
    <button onClick={onClick} className="lz-card p-3.5 w-full flex items-center gap-3 text-left active:scale-[0.99] transition">
      <span className="w-10 h-10 rounded-xl bg-lz-50 dark:bg-[#3a1d16] text-lz-600 dark:text-lz-300 flex items-center justify-center flex-shrink-0">
        <Icon name={ikon} className="w-5 h-5" />
      </span>
      <span className="flex-1">
        <span className={`block font-semibold ${T_BASLIK}`}>{baslik}</span>
        <span className={`block text-[12.5px] ${T_SOLUK}`}>{alt}</span>
      </span>
    </button>
  )
}

function RoundBtn({ onClick, label, children }: { onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="w-10 h-10 rounded-full bg-white/90 dark:bg-[#16130F]/80 backdrop-blur text-[#221C15] dark:text-[#F4EFE6] flex items-center justify-center shadow-sm active:scale-95 transition"
    >
      {children}
    </button>
  )
}

// Gun + ogun secimi (bu hafta ve gelecek hafta)
export function PlanSec({ open, onClose, onSec }: { open: boolean; onClose: () => void; onSec: (tarih: string, ogun: LzMeal) => void }) {
  const [ogun, setOgun] = useState<LzMeal>('aksam')
  const bugun = new Date()
  const bas = haftaBasi(bugun)
  const gunler = Array.from({ length: 14 }, (_, i) => gunEkle(bas, i)).filter((g) => gunAnahtari(g) >= gunAnahtari(bugun))
  return (
    <Sheet open={open} onClose={onClose} title="Hangi gün?">
      <div className="flex gap-2 mb-4">
        {OGUNLER.map((o) => (
          <button key={o.id} onClick={() => setOgun(o.id)} className={`lz-chip flex-1 justify-center ${ogun === o.id ? 'lz-chip-on' : ''}`}>
            {o.ad}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {gunler.map((g) => {
          const bugunMu = gunAnahtari(g) === gunAnahtari(bugun)
          return (
            <button key={gunAnahtari(g)} onClick={() => onSec(gunAnahtari(g), ogun)} className="lz-card p-3 text-left active:scale-[0.98] transition">
              <div className={`font-semibold ${T_BASLIK}`}>{bugunMu ? 'Bugün' : GUN_ADI[(g.getDay() + 6) % 7]}</div>
              <div className={`text-[12px] ${T_SOLUK}`}>{kisaTarih(g)}</div>
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

// ✎ ile biten satir (Pisirme Gunlugu'nden tarife uygulanan degisiklik): kalemle alti cizilmis gibi, sonunda kalem izi
function Kalemli({ metin }: { metin: string }) {
  if (!/✎\s*$/.test(metin)) return <>{metin}</>
  return (
    <>
      <span className="lz-kalem">{isaretsiz(metin)}</span>
      <span className="lz-kalem-iz" aria-label="değiştirildi">
        ✎
      </span>
    </>
  )
}
