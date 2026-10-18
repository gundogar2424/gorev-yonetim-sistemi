import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { lzDb } from '../db'
import { ReklamRozeti } from './Takip'
import { tlYaz, tutarOku } from '../lib/harcama'
import type { LzMekan, LzZiyaret } from '../types'
import { Header, Icon, KisiAvatar, Sheet, T_BASLIK, T_GOVDE, T_SOLUK, Thumb, Toast, useToast } from '../components/ui'
import { fiyatlariGuncelle, videodakiMekanlariBul, haritadaAcLinki, instagramLinki, mekanYeriniBul, puaniGuncelle, puanYaz, yolTarifiLinki, yorumlarLinki } from '../lib/mekan'
import { MEKAN_ETIKETLERI, aiFisTutar, aiMekanUnluler, apiAnahtari } from '../lib/ai'
import { fotoOku } from '../lib/image'
import { mekanKampanyasi } from '../lib/kampanya'
import { temelLink } from '../lib/kopya'
import { PLATFORM_AD } from '../lib/importer'
import { hesapFoto, hesapNormal, hesapTakipEt, hesaplariOku, takipEdiliyor } from '../lib/hesaplar'

// Paylasanin influencer sayfasi anahtari: takip ediliyorsa listedeki kaydi, degilse ad (+ platform)
function influencerAnahtari(m: LzMekan): string {
  const p = m.paylasan ?? ''
  const kayitli = hesaplariOku().find((x) => hesapNormal(x) === hesapNormal(p))
  if (kayitli) return kayitli
  const pl = PLATFORM_AD[m.platform]
  return p.startsWith('@') || !pl ? p : `${p} (${pl})`
}

const PLATFORM: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook', pinterest: 'Pinterest' }

const KAYNAK: Record<string, string> = {
  google: 'Google Haritalar’dan',
  harita: 'harita linkinden',
  arama: 'yapay zekanın araştırmasından',
  adres: 'adresten (OpenStreetMap)',
  elle: 'elle',
  '': 'yaklaşık olarak (semt merkezi)'
}

export default function MekanDetay() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const durumu = useLocation().state as { zatenVar?: boolean; gittim?: boolean; yedim?: string; digerleri?: number } | null
  const zatenVar = durumu?.zatenVar
  // Bulunamazsa null: yuklenirken (undefined) ile karismasin, sayfa bos kalmasin
  const m = useLiveQuery(async () => (await lzDb.mekanlar.get(id)) ?? null, [id])
  // Baska bir mekana gecince (ör. ayni videodaki mekanlar) sayfa en ustten acilsin
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [id])
  // Ayni videoda gezilen diger kayitli mekanlar
  const ayniVideo =
    useLiveQuery(async () => {
      const bu = await lzDb.mekanlar.get(id)
      if (!bu?.sourceUrl) return []
      const t = temelLink(bu.sourceUrl)
      return (await lzDb.mekanlar.toArray()).filter((x) => x.id !== id && x.sourceUrl && temelLink(x.sourceUrl) === t)
    }, [id]) ?? []
  const [duzenle, setDuzenle] = useState(false)
  const [form, setForm] = useState({ ad: '', adres: '', ilce: '', sehir: '', paylasan: '', oneriler: '', notlar: '', etiketler: [] as string[] })
  const [toast, goster] = useToast()
  const [videoArama, setVideoArama] = useState('')
  const [, setTakipSayac] = useState(0) // takip edilince dugme yenilensin
  const [puanAraniyor, setPuanAraniyor] = useState(false)
  const [kampanyaAraniyor, setKampanyaAraniyor] = useState(false)

  if (m === undefined) return null
  if (!m)
    return (
      <div>
        <Header title="Mekan bulunamadı" back />
        <p className={`px-5 text-[14px] ${T_SOLUK}`}>Bu mekan silinmiş olabilir. Mekanlarım’dan arayabilirsin.</p>
      </div>
    )

  const ac = (url: string) => window.open(url, '_blank')

  const duzenlemeyiAc = () => {
    setForm({ ad: m.ad, adres: m.adres, ilce: m.ilce, sehir: m.sehir, paylasan: m.paylasan ?? '', oneriler: m.oneriler.join('\n'), notlar: m.notlar, etiketler: m.etiketler })
    setDuzenle(true)
  }
  const kaydet = async () => {
    const yerDegisti = form.adres !== m.adres || form.ilce !== m.ilce || form.sehir !== m.sehir || form.ad !== m.ad
    await lzDb.mekanlar.update(m.id!, {
      ad: form.ad.trim() || m.ad,
      adres: form.adres.trim(),
      ilce: form.ilce.trim(),
      sehir: form.sehir.trim(),
      paylasan: form.paylasan.trim() || undefined,
      oneriler: form.oneriler
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean),
      notlar: form.notlar.trim(),
      etiketler: form.etiketler
    })
    setDuzenle(false)
    // Elle yazilan paylasan da Influencer'lara eklenir
    if (form.paylasan.trim() && form.paylasan.trim() !== m.paylasan) hesapTakipEt(form.paylasan, PLATFORM_AD[m.platform] ?? '')
    if (yerDegisti) {
      const yeni = await lzDb.mekanlar.get(m.id!)
      goster((await mekanYeriniBul(yeni!)) ? 'Kaydedildi, yeri güncellendi' : 'Kaydedildi; yeni adres haritada bulunamadı')
    }
  }

  return (
    <div>
      <Header title={m.ad} subtitle={[m.tur, m.ilce, m.sehir].filter(Boolean).join(' · ')} back />
      <div className="px-4 space-y-3 pb-8">
        {zatenVar && (
          <div className="rounded-2xl bg-amber-50 dark:bg-[#2a2113] text-amber-900 dark:text-amber-200 text-[13.5px] p-3.5">
            Bu mekan zaten kayıtlıydı; ikinci kez eklenmedi.
          </div>
        )}
        {!!durumu?.digerleri && (
          <div className="rounded-2xl bg-emerald-50 dark:bg-[#15291f] text-emerald-900 dark:text-emerald-200 text-[13.5px] p-3.5">
            Bu videoda {durumu.digerleri} mekan daha vardı; onlar da Mekanlarım’a kaydedildi (aşağıda).
          </div>
        )}
        {m.sourceUrl ? (
          // Tarifteki gibi: kapaga dokununca paylasimin videosu (Instagram/TikTok/YouTube) acilir
          <button className="relative block w-full" onClick={() => ac(m.sourceUrl)} aria-label="Videoyu izle">
            {m.foto ? (
              <Thumb src={m.foto} className="w-full h-56 rounded-3xl" emoji="" />
            ) : (
              <div className="w-full h-40 rounded-3xl bg-gradient-to-br from-lz-500 to-lz-700" />
            )}
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-black/60 text-white text-2xl flex items-center justify-center pl-1">
              ▶
            </span>
            <span className="absolute left-3 bottom-3 bg-black/65 text-white rounded-full px-3 py-1.5 text-[13px] font-semibold">
              {PLATFORM[m.platform] ? `${PLATFORM[m.platform]}’da videoyu izle` : 'Paylaşımı aç'}
            </span>
          </button>
        ) : (
          m.foto && <Thumb src={m.foto} className="w-full h-56 rounded-3xl" emoji="" />
        )}
        {m.paylasan && (
          <div className="lz-card p-3 flex items-center gap-3">
            <Link to={`/influencer/${encodeURIComponent(influencerAnahtari(m))}`} className="flex items-center gap-3 flex-1 min-w-0">
            <KisiAvatar ad={hesapNormal(m.paylasan)} foto={hesapFoto(influencerAnahtari(m))} className="w-10 h-10 text-[14px]" />
            <span className="flex-1 min-w-0">
              <span className={`block text-[11.5px] ${T_SOLUK}`}>Paylaşan · profiline git ›</span>
              <span className={`block font-semibold truncate ${T_BASLIK}`}>
                {m.paylasan}
                {m.reklam && <ReklamRozeti />}
              </span>
              {m.reklam && <span className="block text-[11.5px] text-amber-700 dark:text-amber-300">Bu paylaşım reklam / iş birliği olarak işaretli</span>}
            </span>
            </Link>
            {takipEdiliyor(m.paylasan) ? (
              <span className="text-[13px] text-emerald-600 dark:text-emerald-300 font-semibold">✓ Takip ediliyor</span>
            ) : (
              <button
                className="lz-btn-primary px-4 py-2 text-[13.5px]"
                onClick={() => {
                  hesapTakipEt(m.paylasan!, PLATFORM_AD[m.platform] ?? '')
                  setTakipSayac((x) => x + 1)
                  goster(`${m.paylasan} takip ediliyor; yeni mekanları Bana mekan öner › Hesaplar’da`)
                }}
              >
                Takip et
              </button>
            )}
          </div>
        )}
        {m.sourceUrl && ['instagram', 'tiktok', 'youtube'].includes(m.platform) && apiAnahtari() && (
          <button
            className="lz-btn-soft w-full text-[13.5px]"
            disabled={!!videoArama}
            onClick={async () => {
              try {
                const n = await videodakiMekanlariBul(m, setVideoArama)
                goster(n ? `Videodan ${n} mekan daha eklendi` : 'Videoda yeni mekan bulunamadı')
              } catch (e) {
                goster((e as Error).message)
              }
              setVideoArama('')
            }}
          >
            {videoArama || 'Videodaki diğer mekanları bul'}
          </button>
        )}
        {ayniVideo.length > 0 && (
          <div className="lz-card p-4 space-y-2">
            <div className={`font-semibold ${T_BASLIK}`}>Aynı videodaki diğer mekanlar</div>
            {ayniVideo.map((x) => (
              <Link key={x.id} to={`/mekan/${x.id}`} className={`flex items-center gap-2 rounded-2xl bg-[#f3f3f1] dark:bg-[#26262a] px-3 py-2 text-[14px] ${T_GOVDE}`}>
                <span className="flex-1 min-w-0">
                  <span className="font-semibold">{x.ad}</span>
                  <span className={`block text-[12px] ${T_SOLUK}`}>{[x.tur, x.ilce].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="text-lz-600">›</span>
              </Link>
            ))}
          </div>
        )}
        {(() => {
          const son = [...(m.ziyaretler ?? [])].sort((a, b) => b.tarih.localeCompare(a.tarih)).find((z) => z.tekrar)
          return son ? (
            <div className="rounded-2xl bg-amber-50 dark:bg-[#2a2113] text-amber-900 dark:text-amber-200 text-[14px] p-3.5">
              <b>Bir dahaki sefere:</b> {son.tekrar}
              <span className="block text-[11.5px] opacity-70 mt-0.5">{tarihYaz(son.tarih)} ziyaretinde not etmiştin</span>
            </div>
          ) : null
        })()}
        <button
          className="lz-btn-soft w-full text-sm"
          disabled={kampanyaAraniyor}
          onClick={async () => {
            setKampanyaAraniyor(true)
            try {
              goster((await mekanKampanyasi(m)) ? 'Kampanya bulundu' : 'Şu an kampanya bulunamadı')
            } catch (e) {
              goster((e as Error).message.slice(0, 80))
            }
            setKampanyaAraniyor(false)
          }}
        >
          {kampanyaAraniyor ? 'Kampanyalara bakılıyor…' : 'Kampanya var mı?'}
        </button>
        <FiyatKarti m={m} goster={goster} />
        {m.kampanya && (
          <div className="rounded-2xl bg-emerald-50 dark:bg-[#10261e] text-emerald-900 dark:text-emerald-200 text-[14px] p-3.5 space-y-1">
            <div className="font-semibold">Kampanya</div>
            <div>{m.kampanya.ozet}</div>
            {m.kampanya.gecerlilik && <div className="text-[12.5px] opacity-80">Geçerli: {m.kampanya.gecerlilik}</div>}
            <div className="text-[11.5px] opacity-70">
              {m.kampanya.kaynak ? `Kaynak: ${m.kampanya.kaynak} · ` : ''}
              {new Date(m.kampanya.zaman).toLocaleDateString('tr')} — gitmeden önce mekandan teyit et.
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <button className="lz-btn-primary text-sm px-2" onClick={() => ac(yolTarifiLinki(m))}>
            Yol tarifi
          </button>
          <button className="lz-btn-soft text-sm px-2" onClick={() => ac(haritadaAcLinki(m))}>
            Haritada aç
          </button>
          <button className="lz-btn-soft text-sm px-2" onClick={() => ac(instagramLinki(m))}>
            Instagram
          </button>
        </div>

        <div className="lz-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className={`flex-1 text-[15px] font-semibold ${T_GOVDE}`}>
              {m.puan ? (
                <>
                  {puanYaz(m)} <span className={`text-[12px] font-normal ${T_SOLUK}`}>Google puanı</span>
                </>
              ) : (
                <span className={`text-[13.5px] font-normal ${T_SOLUK}`}>Google puanı bulunamadı</span>
              )}
            </div>
            <button
              className="lz-btn-soft px-3 py-1.5 text-[12.5px]"
              disabled={puanAraniyor}
              onClick={async () => {
                setPuanAraniyor(true)
                try {
                  goster((await puaniGuncelle(m)) ? 'Puan güncellendi' : 'Google puanı bulunamadı')
                } catch (e) {
                  goster((e as Error).message.slice(0, 80))
                }
                setPuanAraniyor(false)
              }}
            >
              {puanAraniyor ? 'Aranıyor…' : '↻ Güncelle'}
            </button>
          </div>
          {m.yorumOzeti && <p className={`text-[13.5px] ${T_GOVDE}`}>{m.yorumOzeti}</p>}
          <button
            className="lz-btn-soft w-full text-sm"
            onClick={() => {
              ac(yorumlarLinki(m))
              // Yorumlara bakarken puan da tazelensin (bugun zaten guncellendiyse tekrar aranmaz, token harcanmaz)
              const bugunGuncel = m.puanZamani && new Date(m.puanZamani).toDateString() === new Date().toDateString()
              if (!bugunGuncel && !puanAraniyor) {
                setPuanAraniyor(true)
                void puaniGuncelle(m)
                  .catch(() => false)
                  .finally(() => setPuanAraniyor(false))
              }
            }}
          >
            Google yorumlarını oku{puanAraniyor ? ' · puan güncelleniyor…' : ''}
          </button>
          {m.puanZamani && (
            <p className={`text-[11px] ${T_SOLUK}`}>
              {m.googleId ? 'Google Haritalar' : 'Yapay zekanın Google araması'} · {new Date(m.puanZamani).toLocaleDateString('tr')}
            </p>
          )}
        </div>

        {!duzenle ? (
          <div className="lz-card p-4 space-y-2.5">
            <div>
              <div className="lz-label mb-0.5">Adres</div>
              <p className={`text-[14.5px] ${T_GOVDE}`}>{(m.googleId ? m.adres : [m.adres, m.ilce, m.sehir].filter(Boolean).join(', ')) || 'Adres bulunamadı'}</p>
              <p className={`text-[11.5px] mt-0.5 ${T_SOLUK}`}>
                {m.lat !== undefined ? `Yeri ${KAYNAK[m.konumKaynak] || 'bulundu'} · ` : 'Haritadaki yeri bulunamadı · '}
                <button className="underline" onClick={duzenlemeyiAc}>
                  düzelt
                </button>
              </p>
            </div>
            {m.oneriler.length > 0 && (
              <div>
                <div className="lz-label mb-0.5">Ne yenir?</div>
                <ul className="space-y-0.5">
                  {m.oneriler.map((x, i) => (
                    <li key={i} className={`text-[14.5px] ${T_GOVDE}`}>
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {m.fiyat && (
              <div>
                <div className="lz-label mb-0.5">Fiyat</div>
                <p className={`text-[14px] ${T_GOVDE}`}>{m.fiyat}</p>
              </div>
            )}
            {m.notlar && (
              <div>
                <div className="lz-label mb-0.5">Notlar</div>
                <p className={`text-[14px] whitespace-pre-line ${T_GOVDE}`}>{m.notlar}</p>
              </div>
            )}
            {m.etiketler.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {m.etiketler.map((e) => (
                  <span key={e} className="lz-pill">
                    {e}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="lz-card p-4 space-y-2">
            {(
              [
                ['ad', 'Mekan adı'],
                ['adres', 'Açık adres'],
                ['ilce', 'İlçe / semt'],
                ['sehir', 'Şehir'],
                ['paylasan', 'Paylaşan influencer (@ad ya da isim)']
              ] as const
            ).map(([k, etiket]) => (
              <label key={k} className="block">
                <span className="lz-label">{etiket}</span>
                <input className="lz-input mt-1" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </label>
            ))}
            <label className="block">
              <span className="lz-label">Ne yenir? (her satıra bir tane)</span>
              <textarea
                className="lz-input mt-1 min-h-[70px]"
                value={form.oneriler}
                onChange={(e) => setForm({ ...form, oneriler: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="lz-label">Notlar</span>
              <textarea className="lz-input mt-1 min-h-[60px]" value={form.notlar} onChange={(e) => setForm({ ...form, notlar: e.target.value })} />
            </label>
            <div>
              <span className="lz-label">Etiketler</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {Array.from(new Set([...MEKAN_ETIKETLERI, ...form.etiketler])).map((e) => {
                  const secili = form.etiketler.includes(e)
                  return (
                    <button
                      key={e}
                      className={`lz-chip text-[12.5px] ${secili ? 'lz-chip-on' : ''}`}
                      onClick={() => setForm({ ...form, etiketler: secili ? form.etiketler.filter((x) => x !== e) : [...form.etiketler, e] })}
                    >
                      {e}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button className="lz-btn-soft text-sm" onClick={() => setDuzenle(false)}>
                Vazgeç
              </button>
              <button className="lz-btn-primary text-sm" onClick={() => void kaydet()}>
                Kaydet
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            className="lz-btn-soft text-[14px] px-2"
            onClick={async () => {
              await lzDb.mekanlar.update(m.id!, { gitmekIstiyorum: !m.gitmekIstiyorum })
              goster(m.gitmekIstiyorum ? 'Listeden çıkarıldı' : 'Gitmek istediğin yerlere eklendi')
            }}
          >
            <Icon name="bookmark" className={`w-[18px] h-[18px] ${m.gitmekIstiyorum ? 'text-lz-600 fill-current' : ''}`} />
            {m.gitmekIstiyorum ? 'Listemde' : 'Gitmek istiyorum'}
          </button>
          <button
            className="lz-btn-soft text-[14px] px-2"
            onClick={async () => {
              await lzDb.mekanlar.update(m.id!, { favori: !m.favori })
              goster(m.favori ? 'Favorilerden çıkarıldı' : 'Favorilere eklendi')
            }}
          >
            <Icon name="heart" className={`w-[18px] h-[18px] ${m.favori ? 'text-lz-600 fill-current' : ''}`} /> {m.favori ? 'Favorim' : 'Favorilere ekle'}
          </button>
        </div>
        {m.paylasanYorumu && (
          <div className="lz-card p-4 space-y-1.5">
            <div className={`font-semibold ${T_BASLIK}`}>{m.paylasan || 'Paylaşan'} ne dedi?</div>
            {m.paylasanYorumu.yedi && <p className={`text-[13.5px] ${T_GOVDE}`}><b>Yedi:</b> {m.paylasanYorumu.yedi}</p>}
            {m.paylasanYorumu.begendi && <p className={`text-[13.5px] ${T_GOVDE}`}>{m.paylasanYorumu.begendi}</p>}
            {m.paylasanYorumu.begenmedi && <p className={`text-[13.5px] ${T_GOVDE}`}>{m.paylasanYorumu.begenmedi}</p>}
            {m.paylasanYorumu.karar && <p className="text-[13.5px] font-semibold text-lz-600">{m.paylasanYorumu.karar}</p>}
          </div>
        )}
        <ZiyaretKarti m={m} goster={goster} otoAc={durumu?.gittim ? { yedim: durumu.yedim ?? '' } : undefined} />
        <UnluKarti m={m} goster={goster} />
        {!duzenle && (
          <button className="lz-btn-soft w-full text-sm" onClick={duzenlemeyiAc}>
            Düzenle
          </button>
        )}
        <button
          className={`text-[13px] w-full py-2 ${T_SOLUK}`}
          onClick={async () => {
            if (!confirm('Mekan silinsin mi?')) return
            await lzDb.mekanlar.delete(m.id!)
            navigate('/mekanlar', { replace: true })
          }}
        >
          Mekanı sil
        </button>
        <p className={`text-[11.5px] text-center ${T_SOLUK}`}>Adres ve öneriler yapay zekanın araştırmasıdır; gitmeden önce kontrol et.</p>
      </div>
      <Toast text={toast} />
    </div>
  )
}

// Guncel fiyatlar: dugmeye basinca arastirilir; kaynak ve tarihiyle gosterilir
function FiyatKarti({ m, goster }: { m: LzMekan; goster: (s: string) => void }) {
  const [araniyor, setAraniyor] = useState(false)
  const [acik, setAcik] = useState(false)
  const f = m.fiyatlar
  const ara = async () => {
    setAraniyor(true)
    try {
      const n = await fiyatlariGuncelle(m)
      goster(n ? `Menüden ${n} ürün ve fiyatı bulundu` : 'Güncel menü/fiyat bulunamadı')
      setAcik(true)
    } catch (e) {
      goster((e as Error).message.slice(0, 80))
    }
    setAraniyor(false)
  }
  if (!f)
    return (
      <button className="lz-btn-soft w-full text-sm" disabled={araniyor} onClick={() => void ara()}>
        {araniyor ? 'Menü ve fiyatlar aranıyor…' : 'Güncel menü ve fiyatlar'}
      </button>
    )
  const gorunen = acik ? f.kalemler : f.kalemler.slice(0, 6)
  return (
    <div className="lz-card p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className={`flex-1 font-semibold ${T_GOVDE}`}>Menü ve fiyatlar</div>
        <button className="lz-btn-soft px-3 py-1.5 text-[12.5px]" disabled={araniyor} onClick={() => void ara()}>
          {araniyor ? 'Aranıyor…' : '↻ Güncelle'}
        </button>
      </div>
      {f.kalemler.length ? (
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {gorunen.map((k, i) => (
            <li key={i} className={`flex gap-3 py-1.5 text-[14px] ${T_GOVDE}`}>
              <span className="flex-1">{k.ad}</span>
              <span className="font-semibold whitespace-nowrap">{k.fiyat}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={`text-[13px] ${T_SOLUK}`}>Son aramada güncel fiyat bulunamadı.</p>
      )}
      {f.kalemler.length > 6 && (
        <button className="text-[13px] text-lz-600 font-semibold" onClick={() => setAcik(!acik)}>
          {acik ? 'Daha az göster' : `Tümünü göster (${f.kalemler.length})`}
        </button>
      )}
      <p className={`text-[11.5px] ${T_SOLUK}`}>
        {f.kaynak ? `Kaynak: ${f.kaynak}` : ''}
        {f.tarih && f.tarih !== 'bilinmiyor' ? ` (${f.tarih})` : ''} · aranma: {new Date(f.zaman).toLocaleDateString('tr')} — fiyatlar değişmiş olabilir, mekandan teyit et.
      </p>
    </div>
  )
}

function bugun(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function tarihYaz(t: string): string {
  const [y, a, g] = t.split('-').map(Number)
  return y ? new Date(y, a - 1, g).toLocaleDateString('tr', { day: 'numeric', month: 'long', year: 'numeric' }) : t
}
function Yildiz({ puan, degis }: { puan: number; degis?: (p: number) => void }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) =>
        degis ? (
          <button key={i} type="button" className="text-[26px] leading-none" onClick={() => degis(i === puan ? 0 : i)} aria-label={`${i} yıldız`}>
            {i <= puan ? '★' : '☆'}
          </button>
        ) : (
          <span key={i} className="text-[15px] text-amber-500">
            {i <= puan ? '★' : '☆'}
          </span>
        )
      )}
    </span>
  )
}

// ZIYARET DEFTERI: gittigim tarih, verdigim puan, ne yedim, notum, "bir daha gelirsem bunu yerim"
function ZiyaretKarti({ m, goster, otoAc }: { m: LzMekan; goster: (s: string) => void; otoAc?: { yedim: string } }) {
  const [acik, setAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState(-1)
  const [z, setZ] = useState<LzZiyaret>({ tarih: bugun(), puan: 0, yedim: '', not: '', tekrar: '' })
  const liste = m.ziyaretler ?? []
  const sirali = liste.map((x, i) => ({ x, i })).sort((a, b) => b.x.tarih.localeCompare(a.x.tarih))
  const puanlilar = liste.filter((x) => x.puan)
  const odenen = liste.reduce((t, x) => t + (x.tutar || 0), 0)
  const [tutarYazi, setTutarYazi] = useState('')
  const [fisOkunuyor, setFisOkunuyor] = useState(false)
  const ortalama = puanlilar.length ? puanlilar.reduce((t, x) => t + x.puan, 0) / puanlilar.length : 0

  const yeni = () => {
    setZ({ tarih: bugun(), puan: 0, yedim: '', not: '', tekrar: '' })
    setTutarYazi('')
    setDuzenlenen(-1)
    setAcik(true)
  }
  // Oneri sayfasindaki "Gittim" ile gelindiyse form hemen acilir
  useEffect(() => {
    if (!otoAc) return
    setZ({ tarih: bugun(), puan: 0, yedim: otoAc.yedim, not: '', tekrar: '' })
    setTutarYazi('')
    setDuzenlenen(-1)
    setAcik(true)
  }, [])
  const kaydet = async () => {
    const yeniListe = duzenlenen >= 0 ? liste.map((x, i) => (i === duzenlenen ? z : x)) : [...liste, z]
    await lzDb.mekanlar.update(m.id!, { ziyaretler: yeniListe, gidildi: true, gitmekIstiyorum: false })
    setAcik(false)
    goster('Ziyaret kaydedildi')
  }
  const sil = async () => {
    if (duzenlenen < 0 || !confirm('Bu ziyaret silinsin mi?')) return
    const yeniListe = liste.filter((_, i) => i !== duzenlenen)
    await lzDb.mekanlar.update(m.id!, { ziyaretler: yeniListe, gidildi: yeniListe.length > 0 })
    setAcik(false)
  }

  return (
    <div className="lz-card p-4 space-y-2.5">
      <div className="flex items-center gap-2">
        <div className={`flex-1 font-semibold ${T_BASLIK}`}>
          Ziyaretlerim{liste.length ? ` (${liste.length})` : ''}
          {ortalama ? <span className="ml-2 text-[13px] font-normal text-amber-600 dark:text-amber-300">puanım ★ {ortalama.toFixed(1).replace('.', ',')}</span> : null}
          {odenen ? <span className={`block text-[12.5px] font-normal ${T_SOLUK}`}>Burada toplam ödediğim: {tlYaz(odenen)}</span> : null}
        </div>
      </div>
      {sirali.map(({ x, i }) => (
        <button
          key={i}
          className="w-full text-left rounded-2xl bg-[#f3f3f1] dark:bg-[#26262a] p-3 space-y-0.5"
          onClick={() => {
            setZ(x)
            setTutarYazi('')
            setDuzenlenen(i)
            setAcik(true)
          }}
        >
          <div className={`text-[13.5px] font-semibold ${T_GOVDE}`}>
            {tarihYaz(x.tarih)} {x.puan ? <Yildiz puan={x.puan} /> : null}
          </div>
          {x.yedim && <div className={`text-[13px] ${T_GOVDE}`}>{x.yedim}</div>}
          {x.not && <div className={`text-[13px] ${T_SOLUK}`}>{x.not}</div>}
          {x.tekrar && <div className="text-[13px] text-amber-700 dark:text-amber-300">Bir dahaki sefere: {x.tekrar}</div>}
          {!!x.tutar && <div className={`text-[13px] font-semibold ${T_GOVDE}`}>Ödediğim: {tlYaz(x.tutar)}</div>}
        </button>
      ))}
      <button className={`w-full text-sm ${liste.length ? 'lz-btn-soft' : 'lz-btn-primary'}`} onClick={yeni}>
        {liste.length ? '＋ Yeni ziyaret ekle' : 'Buraya gittim — not ekle'}
      </button>
      <Sheet open={acik} onClose={() => setAcik(false)} title={duzenlenen >= 0 ? 'Ziyareti düzenle' : 'Buraya gittim'}>
        <div className={`space-y-3 ${T_GOVDE}`}>
          <label className="block">
            <span className="lz-label">Ne zaman?</span>
            <input type="date" className="lz-input mt-1" value={z.tarih} onChange={(e) => setZ({ ...z, tarih: e.target.value })} />
          </label>
          <div>
            <span className="lz-label">Puanım</span>
            <div className="mt-1 text-amber-500">
              <Yildiz puan={z.puan} degis={(p) => setZ({ ...z, puan: p })} />
            </div>
          </div>
          <label className="block">
            <span className="lz-label">Ne yedim / içtim?</span>
            <input className="lz-input mt-1" placeholder="Ör. İskender, künefe, ayran" value={z.yedim} onChange={(e) => setZ({ ...z, yedim: e.target.value })} />
          </label>
          <label className="block">
            <span className="lz-label">Notum</span>
            <textarea className="lz-input mt-1 min-h-[70px]" placeholder="Ör. İskender çok iyiydi, künefe biraz şekerliydi; servis hızlı" value={z.not} onChange={(e) => setZ({ ...z, not: e.target.value })} />
          </label>
          <div className="block">
            <span className="flex items-center gap-2">
              <span className="lz-label flex-1">Hesabı ben ödediysem (TL)</span>
              <label className="text-[12.5px] font-semibold text-lz-600 cursor-pointer">
                {fisOkunuyor ? 'Fiş okunuyor…' : 'Fişten oku'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={fisOkunuyor || !apiAnahtari()}
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (!f) return
                    setFisOkunuyor(true)
                    try {
                      const n = await aiFisTutar(await fotoOku(f, 1600, 0.85))
                      if (n) {
                        setZ((v) => ({ ...v, tutar: n }))
                        setTutarYazi(String(n).replace('.', ','))
                        goster(`Fişteki toplam: ${tlYaz(n)}`)
                      } else goster('Fişteki toplam okunamadı; elle yaz')
                    } catch (er) {
                      goster((er as Error).message)
                    }
                    setFisOkunuyor(false)
                  }}
                />
              </label>
            </span>
            <input
              className="lz-input mt-1"
              inputMode="decimal"
              placeholder="Ör. 1.250 — ödemediysen boş bırak"
              value={tutarYazi || (z.tutar ? String(z.tutar).replace('.', ',') : '')}
              onChange={(e) => {
                setTutarYazi(e.target.value)
                setZ({ ...z, tutar: tutarOku(e.target.value) })
              }}
            />
          </div>
          <label className="block">
            <span className="lz-label">Bir daha gelirsem…</span>
            <input className="lz-input mt-1" placeholder="Ör. Kuzu tandır denenecek, künefe yerine sütlaç" value={z.tekrar} onChange={(e) => setZ({ ...z, tekrar: e.target.value })} />
          </label>
          <button className="lz-btn-primary w-full" onClick={() => void kaydet()}>
            Kaydet
          </button>
          {duzenlenen >= 0 && (
            <button className={`text-[13px] w-full ${T_SOLUK}`} onClick={() => void sil()}>
              Bu ziyareti sil
            </button>
          )}
        </div>
      </Sheet>
    </div>
  )
}

// UNLULER: bu mekana giden unluler, ne dedikleri ve paylasimlarinin linki
function UnluKarti({ m, goster }: { m: LzMekan; goster: (s: string) => void }) {
  const [araniyor, setAraniyor] = useState(false)
  const u = m.unluler
  const ara = async () => {
    if (!apiAnahtari()) return goster('Ayarlar’dan Gemini anahtarı gir.')
    setAraniyor(true)
    try {
      const liste = await aiMekanUnluler(m)
      await lzDb.mekanlar.update(m.id!, { unluler: { liste, zaman: Date.now() } })
      goster(liste.length ? `${liste.length} ünlü bulundu` : 'Bu mekana giden ünlü bulunamadı')
    } catch (e) {
      goster((e as Error).message.slice(0, 80))
    }
    setAraniyor(false)
  }
  const aramaLinki = (kisi: string) => `https://www.google.com/search?q=${encodeURIComponent(`${kisi} ${m.ad} ${m.sehir}`)}`
  if (!u)
    return (
      <button className="lz-btn-soft w-full text-sm" disabled={araniyor} onClick={() => void ara()}>
        {araniyor ? 'Ünlüler aranıyor…' : 'Ünlüler gitti mi?'}
      </button>
    )
  return (
    <div className="lz-card p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className={`flex-1 font-semibold ${T_BASLIK}`}>Giden ünlüler</div>
        <button className="lz-btn-soft px-3 py-1.5 text-[12.5px]" disabled={araniyor} onClick={() => void ara()}>
          {araniyor ? 'Aranıyor…' : '↻ Güncelle'}
        </button>
      </div>
      {u.liste.length ? (
        u.liste.map((x, i) => (
          <div key={i} className="rounded-2xl bg-[#f3f3f1] dark:bg-[#26262a] p-3 space-y-1">
            <div className={`font-semibold text-[14px] ${T_GOVDE}`}>
              {x.kisi}
              {x.tarih && <span className={`ml-2 text-[12px] font-normal ${T_SOLUK}`}>{x.tarih}</span>}
            </div>
            {x.yedigi && <div className={`text-[13px] ${T_GOVDE}`}>{x.yedigi}</div>}
            {x.ozet && <div className={`text-[13px] ${T_GOVDE}`}>“{x.ozet}”</div>}
            <a href={x.link || aramaLinki(x.kisi)} target="_blank" rel="noreferrer" className="text-[13px] text-lz-600 font-semibold underline">
              {x.link ? '▶ Videoyu / paylaşımı aç' : 'Videosunu ara'}
            </a>
          </div>
        ))
      ) : (
        <p className={`text-[13px] ${T_SOLUK}`}>Son aramada bu mekana giden ünlü bulunamadı.</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${m.ad} ${m.sehir}`)}`} target="_blank" rel="noreferrer" className="lz-btn-soft text-[12.5px] px-2">
          ▶ YouTube videoları
        </a>
        <a href={`https://www.tiktok.com/search?q=${encodeURIComponent(`${m.ad} ${m.sehir}`)}`} target="_blank" rel="noreferrer" className="lz-btn-soft text-[12.5px] px-2">
          ▶ TikTok videoları
        </a>
      </div>
      <p className={`text-[11.5px] ${T_SOLUK}`}>Yapay zekanın Google araması · {new Date(u.zaman).toLocaleDateString('tr')} — paylaşımı açıp kontrol et.</p>
    </div>
  )
}
