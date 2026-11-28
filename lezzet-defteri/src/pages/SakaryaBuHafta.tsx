import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { lzDb } from '../db'
import type { LzBilet } from '../types'
import { aiSakaryaBuHafta, apiAnahtari, saglayici } from '../lib/ai'
import { disariAc } from '../lib/disariAc'
import { fotoOku } from '../lib/image'
import { tlYaz, tutarOku } from '../lib/harcama'
import { bildirimIzniIste } from '../lib/kampanya'
import {
  ETKINLIK_TURLERI,
  etkinlikAnahtar,
  etkinlikOnbellegeYaz,
  etkinlikOnbellek,
  gectiMi,
  gunYaz,
  haftaSuz,
  hatirlatSenkron,
  kalanYazi,
  kumOrani,
  tarihYaz,
  type Etkinlik,
  type EtkinlikTur
} from '../lib/etkinlik'
import { Header, IskeletKartlar, Sheet, T_BASLIK, T_GOVDE, T_SOLUK, Toast, useToast } from '../components/ui'

// SAKARYA'DA BU HAFTA: onumuzdeki 7 gun Sakarya ve cevresi (Sinema, Tiyatro, Konser, Festival).
// Gunde 1 kez aranir, 24 saat saklanir. "Biletim var" denen etkinlikler Biletlerim'de durur.

type Cip = 'Hepsi' | EtkinlikTur
const CIPLER: Cip[] = ['Hepsi', ...ETKINLIK_TURLERI]

// Kum saati: ust haznede kalan kum (oran 1 = dolu, 0 = bos), altta biriken kum
export function KumSaati({ oran, className = 'w-9 h-12' }: { oran: number; className?: string }) {
  const o = Math.max(0, Math.min(1, oran))
  const ustY = 4 + 18 * (1 - o) // ust haznedeki kumun ust kenari (4..22)
  const altY = 44 - 18 * (1 - o) // alt haznede biriken kumun ust kenari (44..26)
  return (
    <svg viewBox="0 0 36 48" className={className} role="img" aria-label={`Kum saati: kumun yüzde ${Math.round(o * 100)}’i duruyor`} data-kum={o.toFixed(2)}>
      <defs>
        <clipPath id="lz-kum-ust">
          <path d="M7 4h22v3c0 7-8 11-11 15C15 18 7 14 7 7z" />
        </clipPath>
        <clipPath id="lz-kum-alt">
          <path d="M18 26c3 4 11 8 11 15v3H7v-3c0-7 8-11 11-15z" />
        </clipPath>
      </defs>
      <rect x="7" y={ustY} width="22" height={22 - ustY} fill="#C98A2B" clipPath="url(#lz-kum-ust)" />
      <rect x="7" y={altY} width="22" height={44 - altY} fill="#C98A2B" clipPath="url(#lz-kum-alt)" />
      {o > 0 && o < 1 && <rect x="17.4" y="22" width="1.2" height="22" fill="#C98A2B" />}
      <path d="M7 4h22v3c0 7-8 11-11 17 3 6 11 10 11 17v3H7v-3c0-7 8-11 11-17C15 18 7 14 7 7z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M5 3.5h26M5 44.5h26" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

interface Form {
  id?: number
  ad: string
  tur: string
  tarih: string
  saat: string
  yer: string
  link: string
  fiyat: string
  koltuk: string
  not: string
  foto: string
}

export default function SakaryaBuHafta() {
  const [sp, setSp] = useSearchParams()
  const sekme: 'hafta' | 'bilet' = sp.get('sekme') === 'bilet' ? 'bilet' : 'hafta'
  const sekmeSec = (s: 'hafta' | 'bilet') => setSp(s === 'bilet' ? { sekme: 'bilet' } : {}, { replace: true })
  const biletler = useLiveQuery(() => lzDb.biletler.toArray(), [], [] as LzBilet[]) ?? []
  const [liste, setListe] = useState<Etkinlik[] | null>(null)
  const [zaman, setZaman] = useState(0)
  const [durum, setDurum] = useState('')
  const [hata, setHata] = useState('')
  const [cip, setCip] = useState<Cip>('Hepsi')
  const [form, setForm] = useState<Form | null>(null)
  const [fotoYukleniyor, setFotoYukleniyor] = useState(false)
  const [tamEkran, setTamEkran] = useState('')
  const [toast, goster] = useToast()

  // Gunde 1 kez aranir; 24 saat icinde onbellekten gosterilir
  const yukle = async () => {
    setHata('')
    const eski = etkinlikOnbellek()
    if (eski) {
      setListe(haftaSuz(eski.liste))
      setZaman(eski.zaman)
      return
    }
    if (!apiAnahtari() || saglayici() !== 'gemini') {
      setListe([])
      setHata('Sakarya’da Bu Hafta Google araması gerektirir; yalnızca Gemini anahtarıyla çalışır (Ayarlar › Yapay zeka).')
      return
    }
    setDurum('Önümüzdeki 7 günün etkinlikleri aranıyor…')
    try {
      const simdi = new Date()
      const ham = (await aiSakaryaBuHafta(gunYaz(simdi), gunYaz(new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate() + 7)))) as Etkinlik[]
      const temiz = haftaSuz(ham)
      etkinlikOnbellegeYaz(temiz)
      setListe(temiz)
      setZaman(Date.now())
    } catch (e) {
      setHata((e as Error).message)
      setListe((l) => l ?? [])
    }
    setDurum('')
  }
  useEffect(() => {
    void yukle()
  }, [])

  const biletBul = (e: Etkinlik) => biletler.find((b) => etkinlikAnahtar(b) === etkinlikAnahtar(e))
  const gorunen = (liste ?? []).filter((e) => cip === 'Hepsi' || e.tur === cip)

  const fotoSec = async (dosya: File | undefined) => {
    if (!dosya || !form) return
    setFotoYukleniyor(true)
    try {
      const foto = await fotoOku(dosya, 1600, 0.85)
      setForm((f) => (f ? { ...f, foto } : f))
    } catch {
      goster('Fotoğraf okunamadı')
    }
    setFotoYukleniyor(false)
  }
  const biletKaydet = async () => {
    if (!form || !form.tarih) return
    const alanlar = {
      ad: form.ad,
      tur: form.tur,
      tarih: form.tarih,
      saat: form.saat,
      yer: form.yer,
      link: form.link,
      fiyat: form.fiyat.trim(),
      koltuk: form.koltuk.trim(),
      not: form.not.trim(),
      foto: form.foto
    }
    if (form.id) await lzDb.biletler.update(form.id, alanlar)
    else await lzDb.biletler.add({ ...alanlar, createdAt: Date.now() })
    setForm(null)
    goster(form.id ? '✓ Bilet güncellendi' : '✓ Biletlerim’e eklendi')
    void bildirimIzniIste()
    void hatirlatSenkron()
  }

  const sirali = [...biletler].sort((a, b) => {
    const ga = gectiMi(a)
    const gb = gectiMi(b)
    if (ga !== gb) return ga ? 1 : -1 // once yaklasanlar, sonra gecenler
    return ga ? b.tarih.localeCompare(a.tarih) : (a.tarih + a.saat).localeCompare(b.tarih + b.saat)
  })

  return (
    <div>
      <Header title="Sakarya’da Bu Hafta" subtitle="Önümüzdeki 7 gün · Sakarya ve çevresi" back />
      <div className="px-4 pt-3 space-y-3">
        <div className="grid grid-cols-2 gap-2" data-etk-sekmeler>
          <button className={`lz-chip !min-h-[48px] justify-center text-[14px] ${sekme === 'hafta' ? 'lz-chip-on' : ''}`} onClick={() => sekmeSec('hafta')}>
            Etkinlikler
          </button>
          <button className={`lz-chip !min-h-[48px] justify-center text-[14px] ${sekme === 'bilet' ? 'lz-chip-on' : ''}`} onClick={() => sekmeSec('bilet')} data-biletlerim>
            Biletlerim{biletler.length ? ` · ${biletler.length}` : ''}
          </button>
        </div>

        {sekme === 'hafta' && (
          <>
            <div className="flex flex-wrap gap-1.5" data-etk-cipler>
              {CIPLER.map((c) => (
                <button key={c} className={`lz-chip !min-h-[48px] text-[13px] ${cip === c ? 'lz-chip-on' : ''}`} onClick={() => setCip(c)}>
                  {c}
                </button>
              ))}
            </div>
            {durum && <p className={`text-[13.5px] ${T_SOLUK}`}>{durum}</p>}
            {hata && (
              <div className="rounded-xl bg-amber-50 dark:bg-[#33270f] px-3 py-2">
                <p className="text-[13.5px] text-amber-900 dark:text-amber-200">{hata}</p>
                {apiAnahtari() && saglayici() === 'gemini' && (
                  <button className="text-[13px] font-semibold text-lz-600 underline min-h-[48px]" onClick={() => void yukle()}>
                    ↻ Tekrar dene
                  </button>
                )}
              </div>
            )}
            {zaman > 0 && !durum && (
              <p className={`text-[12px] ${T_SOLUK}`} data-etk-onbellek>
                Günde 1 kez aranır, 24 saat saklanır. Son arama: {new Date(zaman).toLocaleString('tr', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            {durum && !liste && <IskeletKartlar adet={4} />}
            {liste && !durum && !hata && gorunen.length === 0 && (
              <div className={`lz-card p-6 text-center text-sm ${T_GOVDE}`} data-etk-bos>
                {cip === 'Hepsi' ? 'Önümüzdeki 7 gün için etkinlik bulunamadı.' : `Önümüzdeki 7 gün için ${cip.toLocaleLowerCase('tr')} bulunamadı.`}
              </div>
            )}
            {gorunen.map((e) => {
              const b = biletBul(e)
              return (
                <div key={etkinlikAnahtar(e) + e.saat + e.yer} className="lz-card p-3.5 space-y-2" data-etkinlik>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="inline-block text-[11.5px] font-bold px-2 py-0.5 rounded-md bg-[#EFE7D8] dark:bg-[#2C261F] text-[#3A3228] dark:text-[#DDD5C8]">{e.tur}</span>
                      <div className={`lz-baslik font-semibold text-[16px] leading-snug mt-1 ${T_BASLIK}`}>{e.ad}</div>
                    </div>
                    {b && <KumSaati oran={kumOrani(b)} className={`w-7 h-10 flex-shrink-0 ${T_BASLIK}`} />}
                  </div>
                  <div className={`text-[13.5px] space-y-0.5 ${T_GOVDE}`}>
                    <div>
                      <b>Tarih:</b> {tarihYaz(e.tarih, e.saat)}
                    </div>
                    <div>
                      <b>Yer:</b> {e.yer || 'Belirtilmemiş'}
                    </div>
                    <div>
                      <b>Fiyat:</b> {e.fiyat || 'Belirtilmemiş'}
                    </div>
                    {b && <div className="font-semibold text-lz-600">{kalanYazi(b)}</div>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {e.link ? (
                      <button className="lz-btn-soft !min-h-[48px] text-[13.5px]" onClick={() => void disariAc(e.link)} data-etk-link>
                        Linki aç ↗
                      </button>
                    ) : (
                      <span className={`flex items-center justify-center text-[12.5px] ${T_SOLUK}`}>Link yok</span>
                    )}
                    {b ? (
                      <button className="lz-btn-soft !min-h-[48px] text-[13.5px]" onClick={() => sekmeSec('bilet')}>
                        ✓ Biletim var
                      </button>
                    ) : (
                      <button
                        className="lz-btn-primary !min-h-[48px] text-[13.5px]"
                        onClick={() => setForm({ ad: e.ad, tur: e.tur, tarih: e.tarih, saat: e.saat, yer: e.yer, link: e.link, fiyat: e.fiyat === 'Ücretsiz' ? '' : e.fiyat, koltuk: '', not: '', foto: '' })}
                        data-biletim-var
                      >
                        Biletim var
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {sekme === 'bilet' && (
          <>
            {!sirali.length && (
              <div className={`lz-card p-6 text-center text-sm ${T_GOVDE}`} data-bilet-bos>
                Henüz biletin yok. Etkinlikler’de bir etkinlikte <b>Biletim var</b>’a dokun; burada toplanır.
              </div>
            )}
            {sirali.map((b) => (
              <BiletKarti
                key={b.id}
                b={b}
                fotoAc={() => setTamEkran(b.foto)}
                duzenle={() => setForm({ id: b.id, ad: b.ad, tur: b.tur, tarih: b.tarih, saat: b.saat, yer: b.yer, link: b.link, fiyat: b.fiyat, koltuk: b.koltuk, not: b.not, foto: b.foto })}
                bildir={goster}
              />
            ))}
          </>
        )}
      </div>

      {/* Biletim var: fiyat, koltuk, not, bilet fotografi */}
      <Sheet open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Bileti düzenle' : 'Biletim var'}>
        {form && (
          <div className="space-y-3" data-bilet-form>
            <p className={`text-[14px] font-semibold ${T_BASLIK}`}>{form.ad}</p>
            <div className="grid grid-cols-2 gap-2">
              <label className={`text-[12.5px] ${T_SOLUK}`}>
                Tarih
                <input type="date" className="lz-input mt-1" value={form.tarih} onChange={(e) => setForm({ ...form, tarih: e.target.value })} />
              </label>
              <label className={`text-[12.5px] ${T_SOLUK}`}>
                Saat
                <input type="time" className="lz-input mt-1" value={form.saat} onChange={(e) => setForm({ ...form, saat: e.target.value })} />
              </label>
            </div>
            {!form.saat && <p className={`text-[12px] ${T_SOLUK}`}>Saat yazılmazsa “Yola çık” hatırlatması gelmez.</p>}
            <label className={`block text-[12.5px] ${T_SOLUK}`}>
              Fiyat
              <input className="lz-input mt-1" inputMode="decimal" placeholder="örnek: 250 TL" value={form.fiyat} onChange={(e) => setForm({ ...form, fiyat: e.target.value })} data-bilet-fiyat />
            </label>
            <label className={`block text-[12.5px] ${T_SOLUK}`}>
              Koltuk
              <input className="lz-input mt-1" placeholder="örnek: C sırası 12" value={form.koltuk} onChange={(e) => setForm({ ...form, koltuk: e.target.value })} data-bilet-koltuk />
            </label>
            <label className={`block text-[12.5px] ${T_SOLUK}`}>
              Not
              <textarea className="lz-input mt-1" rows={2} value={form.not} onChange={(e) => setForm({ ...form, not: e.target.value })} data-bilet-not />
            </label>
            <div>
              <div className={`text-[12.5px] mb-1 ${T_SOLUK}`}>Bilet fotoğrafı</div>
              {form.foto && <img src={form.foto} alt="Bilet fotoğrafı" className="w-full max-h-48 object-contain rounded-[10px] bg-[#EFE7D8] dark:bg-[#2C261F] mb-2" />}
              <div className="grid grid-cols-2 gap-2">
                <label className="lz-btn-soft !min-h-[48px] text-[13.5px] cursor-pointer">
                  {fotoYukleniyor ? 'Yükleniyor…' : form.foto ? 'Fotoğrafı değiştir' : 'Fotoğraf yükle'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => void fotoSec(e.target.files?.[0])} data-bilet-foto />
                </label>
                {form.foto && (
                  <button className="lz-btn-soft !min-h-[48px] text-[13.5px]" onClick={() => setForm({ ...form, foto: '' })}>
                    Fotoğrafı kaldır
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button className="lz-btn-soft !min-h-[48px]" onClick={() => setForm(null)}>
                Vazgeç
              </button>
              <button className="lz-btn-primary !min-h-[48px]" disabled={!form.tarih || fotoYukleniyor} onClick={() => void biletKaydet()} data-bilet-kaydet>
                Kaydet
              </button>
            </div>
          </div>
        )}
      </Sheet>

      {/* Bilet fotografi tam ekran */}
      {tamEkran && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" onClick={() => setTamEkran('')} role="dialog" aria-modal data-bilet-tam-ekran>
          <img src={tamEkran} alt="Bilet fotoğrafı" className="max-w-full max-h-full object-contain" />
          <button className="absolute top-3 right-3 w-12 h-12 rounded-full bg-white/15 text-white text-[22px]" aria-label="Kapat" style={{ marginTop: 'env(safe-area-inset-top)' }}>
            ✕
          </button>
        </div>
      )}
      <Toast text={toast} />
    </div>
  )
}

function BiletKarti({ b, fotoAc, duzenle, bildir }: { b: LzBilet; fotoAc: () => void; duzenle: () => void; bildir: (s: string) => void }) {
  const gecti = gectiMi(b)
  const [nasil, setNasil] = useState(b.nasilGecti ?? '')
  const [kimler, setKimler] = useState(b.kimlerle ?? '')
  const sayiYaz = (n: number | undefined) => (n ? String(n).replace('.', ',') : '')
  const [bilet, setBilet] = useState(b.harcama ? sayiYaz(b.harcama.bilet) : sayiYaz(tutarOku(b.fiyat)))
  const [yol, setYol] = useState(sayiYaz(b.harcama?.yol))
  const [yemek, setYemek] = useState(sayiYaz(b.harcama?.yemek))
  const [silSor, setSilSor] = useState(false)
  const toplam = (tutarOku(bilet) ?? 0) + (tutarOku(yol) ?? 0) + (tutarOku(yemek) ?? 0)

  const sonrasiKaydet = async () => {
    await lzDb.biletler.update(b.id!, {
      nasilGecti: nasil.trim().slice(0, 600),
      kimlerle: kimler.trim().slice(0, 200),
      harcama: { bilet: tutarOku(bilet), yol: tutarOku(yol), yemek: tutarOku(yemek) }
    })
    bildir(toplam > 0 ? `✓ Kaydedildi · ${tlYaz(toplam)} Harcamalarım’a eklendi` : '✓ Kaydedildi')
  }
  const sil = async () => {
    await lzDb.biletler.delete(b.id!)
    void hatirlatSenkron()
    bildir('Bilet silindi')
  }

  return (
    <div className="lz-card p-3.5 space-y-2.5" data-bilet>
      <div className="flex items-center gap-3">
        <div className={`flex flex-col items-center flex-shrink-0 ${T_BASLIK}`}>
          <KumSaati oran={kumOrani(b)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold text-lz-600" data-kalan>
            {kalanYazi(b)}
          </div>
          <div className={`lz-baslik font-semibold text-[16px] leading-snug ${T_BASLIK}`}>{b.ad}</div>
          <div className={`text-[12.5px] ${T_SOLUK}`}>
            {b.tur} · {tarihYaz(b.tarih, b.saat)}
          </div>
        </div>
      </div>
      <div className={`text-[13.5px] space-y-0.5 ${T_GOVDE}`}>
        {b.yer && (
          <div>
            <b>Yer:</b> {b.yer}
          </div>
        )}
        {b.fiyat && (
          <div>
            <b>Fiyat:</b> {b.fiyat}
          </div>
        )}
        {b.koltuk && (
          <div>
            <b>Koltuk:</b> {b.koltuk}
          </div>
        )}
        {b.not && <div className="lz-not">{b.not}</div>}
      </div>
      {b.foto && (
        <button className="block w-full" onClick={fotoAc} aria-label="Bilet fotoğrafını tam ekran aç" data-bilet-foto-ac>
          <img src={b.foto} alt="Bilet fotoğrafı" className="w-full max-h-40 object-cover rounded-[10px]" />
          <span className={`block text-[12px] mt-1 ${T_SOLUK}`}>Tam ekran için dokun</span>
        </button>
      )}

      {/* Etkinlik gecince: Nasil gecti, Kimlerle gittim, Toplam harcama */}
      {gecti && (
        <div className="lz-kenar space-y-2 pt-1" data-bilet-sonrasi>
          <label className={`block text-[13px] font-semibold ${T_BASLIK}`}>
            Nasıl geçti?
            <textarea className="lz-input mt-1 font-normal" rows={2} value={nasil} onChange={(e) => setNasil(e.target.value)} data-nasil />
          </label>
          <label className={`block text-[13px] font-semibold ${T_BASLIK}`}>
            Kimlerle gittim
            <input className="lz-input mt-1 font-normal" placeholder="İsimleri yaz" value={kimler} onChange={(e) => setKimler(e.target.value)} data-kimlerle />
          </label>
          <div className={`text-[13px] font-semibold ${T_BASLIK}`}>Toplam harcama</div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['Bilet', bilet, setBilet, 'bilet'],
                ['Yol', yol, setYol, 'yol'],
                ['Yemek', yemek, setYemek, 'yemek']
              ] as const
            ).map(([ad, deger, yaz, anahtar]) => (
              <label key={ad} className={`text-[12.5px] ${T_SOLUK}`}>
                {ad}
                <input className="lz-input mt-1" inputMode="decimal" placeholder="TL" value={deger} onChange={(e) => yaz(e.target.value)} data-harcama={anahtar} />
              </label>
            ))}
          </div>
          <div className={`flex items-center justify-between text-[14px] ${T_GOVDE}`}>
            <span>Toplam</span>
            <b className={`tabular-nums text-[16px] ${T_BASLIK}`} data-toplam>
              {tlYaz(toplam)}
            </b>
          </div>
          <button className="lz-btn-primary w-full !min-h-[48px] text-[14px]" onClick={() => void sonrasiKaydet()} data-sonrasi-kaydet>
            Kaydet
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {b.link ? (
          <button className="lz-btn-soft !min-h-[48px] text-[13px]" onClick={() => void disariAc(b.link)}>
            Linki aç
          </button>
        ) : (
          <span />
        )}
        <button className="lz-btn-soft !min-h-[48px] text-[13px]" onClick={duzenle} data-bilet-duzenle>
          Düzenle
        </button>
        <button className="lz-btn-soft !min-h-[48px] text-[13px]" onClick={() => setSilSor(true)} data-bilet-sil>
          Sil
        </button>
      </div>
      {silSor && (
        <div className="rounded-xl bg-amber-50 dark:bg-[#33270f] px-3 py-2 space-y-2">
          <p className="text-[13.5px] text-amber-900 dark:text-amber-200">Bu bilet silinsin mi? Notlar ve fotoğraf da silinir.</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="lz-btn-soft !min-h-[48px] text-[13.5px]" onClick={() => setSilSor(false)}>
              Vazgeç
            </button>
            <button className="lz-btn-primary !min-h-[48px] text-[13.5px]" onClick={() => void sil()}>
              Sil
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
