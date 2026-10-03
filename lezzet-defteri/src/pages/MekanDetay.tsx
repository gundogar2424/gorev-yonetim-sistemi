import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { lzDb } from '../db'
import { Header, T_GOVDE, T_SOLUK, Thumb, Toast, useToast } from '../components/ui'
import { haritadaAcLinki, mekanYeriniBul, puaniGuncelle, puanYaz, yolTarifiLinki, yorumlarLinki } from '../lib/mekan'
import { MEKAN_ETIKETLERI } from '../lib/ai'

const KAYNAK: Record<string, string> = {
  harita: 'harita linkinden',
  arama: 'yapay zekanın araştırmasından',
  adres: 'adresten (OpenStreetMap)',
  elle: 'elle',
  '': 'yaklaşık olarak (semt merkezi)'
}

export default function MekanDetay() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const zatenVar = (useLocation().state as { zatenVar?: boolean } | null)?.zatenVar
  const m = useLiveQuery(() => lzDb.mekanlar.get(id), [id])
  const [duzenle, setDuzenle] = useState(false)
  const [form, setForm] = useState({ ad: '', adres: '', ilce: '', sehir: '', oneriler: '', notlar: '', etiketler: [] as string[] })
  const [toast, goster] = useToast()
  const [puanAraniyor, setPuanAraniyor] = useState(false)

  if (m === undefined) return null
  if (!m) return <Header title="Mekan bulunamadı" back />

  const ac = (url: string) => window.open(url, '_blank')

  const duzenlemeyiAc = () => {
    setForm({ ad: m.ad, adres: m.adres, ilce: m.ilce, sehir: m.sehir, oneriler: m.oneriler.join('\n'), notlar: m.notlar, etiketler: m.etiketler })
    setDuzenle(true)
  }
  const kaydet = async () => {
    const yerDegisti = form.adres !== m.adres || form.ilce !== m.ilce || form.sehir !== m.sehir || form.ad !== m.ad
    await lzDb.mekanlar.update(m.id!, {
      ad: form.ad.trim() || m.ad,
      adres: form.adres.trim(),
      ilce: form.ilce.trim(),
      sehir: form.sehir.trim(),
      oneriler: form.oneriler.split('\n').map((x) => x.trim()).filter(Boolean),
      notlar: form.notlar.trim(),
      etiketler: form.etiketler
    })
    setDuzenle(false)
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
        {m.foto && <Thumb src={m.foto} className="w-full h-56 rounded-3xl" emoji="🍽️" />}

        <div className="grid grid-cols-2 gap-2.5">
          <button className="lz-btn-primary text-sm" onClick={() => ac(yolTarifiLinki(m))}>
            🧭 Yol tarifi
          </button>
          <button className="lz-btn-soft text-sm" onClick={() => ac(haritadaAcLinki(m))}>
            🗺️ Haritada aç
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
          {m.yorumOzeti && <p className={`text-[13.5px] ${T_GOVDE}`}>💬 {m.yorumOzeti}</p>}
          <button className="lz-btn-soft w-full text-sm" onClick={() => ac(yorumlarLinki(m))}>
            Google yorumlarını oku
          </button>
          {m.puanZamani && (
            <p className={`text-[11px] ${T_SOLUK}`}>
              Yapay zekanın Google araması · {new Date(m.puanZamani).toLocaleDateString('tr')}; güncel puan için yorumları aç.
            </p>
          )}
        </div>

        {!duzenle ? (
          <div className="lz-card p-4 space-y-2.5">
            <div>
              <div className="lz-label mb-0.5">Adres</div>
              <p className={`text-[14.5px] ${T_GOVDE}`}>{[m.adres, m.ilce, m.sehir].filter(Boolean).join(', ') || 'Adres bulunamadı'}</p>
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
                      😋 {x}
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
                ['sehir', 'Şehir']
              ] as const
            ).map(([k, etiket]) => (
              <label key={k} className="block">
                <span className="lz-label">{etiket}</span>
                <input className="lz-input mt-1" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </label>
            ))}
            <label className="block">
              <span className="lz-label">Ne yenir? (her satıra bir tane)</span>
              <textarea className="lz-input mt-1 min-h-[70px]" value={form.oneriler} onChange={(e) => setForm({ ...form, oneriler: e.target.value })} />
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

        <div className="grid grid-cols-2 gap-2.5">
          <button className={`text-sm ${m.gidildi ? 'lz-btn-primary' : 'lz-btn-soft'}`} onClick={() => void lzDb.mekanlar.update(m.id!, { gidildi: !m.gidildi })}>
            {m.gidildi ? '✅ Gittim' : 'Gittim olarak işaretle'}
          </button>
          {!duzenle && (
            <button className="lz-btn-soft text-sm" onClick={duzenlemeyiAc}>
              ✏️ Düzenle
            </button>
          )}
        </div>
        {m.sourceUrl && (
          <button className="lz-btn-soft w-full text-sm" onClick={() => ac(m.sourceUrl)}>
            ▶ Paylaşımı aç
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
