// "İzle" sekmesi: konulara ayrilmis, arada izlemek icin kisa YouTube videolari.
// Baglantilar telefonun tarayicisinda / YouTube uygulamasinda acilir; uygulama
// icinde gomulu oynatici yoktur (sekme hizli acilsin, veri harcanmasin).
import { useState } from 'react'
import SesHeader from '../SesHeader'
import { EXERCISES } from '../lib/content'
import VideoLinks, { VideoSatiri } from '../components/VideoLinks'
import Icon from '../components/Icon'
import { LIBRARY, libCount, shortsCount, videosFor, type LibTopic } from '../lib/library'

function Konu({ t, acik, onTap, yalnizKisa }: { t: LibTopic; acik: boolean; onTap: () => void; yalnizKisa: boolean }) {
  const videolar = yalnizKisa ? t.videos.filter((v) => v.short) : t.videos
  return (
    <section className="ses-card">
      <button className="w-full flex items-center gap-3 text-left" onClick={onTap}>
        <Icon name={t.icon} size={20} className="text-sesui-muted dark:text-sesui-dmuted" />
        <span className="flex-1 min-w-0">
          <span className="block text-[16px] font-semibold text-sesui-text dark:text-sesui-dtext leading-tight">{t.title}</span>
          <span className="block text-[13px] text-sesui-muted dark:text-sesui-dmuted mt-0.5 leading-relaxed">
            {videolar.length} video · {t.note}
          </span>
        </span>
        <Icon name="chevron" size={18} className={`text-sesui-line dark:text-sesui-dmuted transition-transform ${acik ? 'rotate-90' : ''}`} />
      </button>
      {acik && (
        <div className="mt-2">
          {videolar.length === 0 ? (
            <p className="text-[15px] text-sesui-body dark:text-sesui-dbody py-2">Bu konuda kısa video yok.</p>
          ) : (
            videolar.map((v) => <VideoSatiri key={v.url} v={v} />)
          )}
        </div>
      )}
    </section>
  )
}

function EgzersizKarti({ id, sira, ad, acik, onTap, yalnizKisa }: { id: string; sira: number; ad: string; acik: boolean; onTap: () => void; yalnizKisa: boolean }) {
  const videolar = yalnizKisa ? videosFor(id).filter((v) => v.short) : videosFor(id)
  return (
    <section className="ses-card">
      <button className="w-full flex items-center gap-3 text-left" onClick={onTap}>
        <span className="ses-index">{String(sira).padStart(2, '0')}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[16px] font-semibold text-sesui-text dark:text-sesui-dtext leading-tight">{ad}</span>
          <span className="block text-[13px] text-sesui-muted dark:text-sesui-dmuted mt-0.5">{videolar.length} video · arama bağlantısı</span>
        </span>
        <Icon name="chevron" size={18} className={`text-sesui-line dark:text-sesui-dmuted transition-transform ${acik ? 'rotate-90' : ''}`} />
      </button>
      {acik && (
        <div className="mt-2">
          <VideoLinks id={id} yalnizKisa={yalnizKisa} />
        </div>
      )}
    </section>
  )
}

export default function LibraryPage() {
  const [gorunum, setGorunum] = useState<'konu' | 'egzersiz'>('konu')
  const [acik, setAcik] = useState<string | null>(LIBRARY[0]?.id ?? null)
  const [acikEx, setAcikEx] = useState<string | null>(null)
  const [yalnizKisa, setYalnizKisa] = useState(false)
  return (
    <div>
      <SesHeader title="İzle" subtitle={`${libCount()} video · ${shortsCount()} Shorts`} />
      <div className="px-4 space-y-3 pb-6">
        <div className="ses-seg grid-cols-2">
          {([
            ['konu', 'Konulara göre'],
            ['egzersiz', 'Egzersize göre']
          ] as const).map(([v, etiket]) => (
            <button
              key={v}
              onClick={() => setGorunum(v)}
              className={`ses-seg-btn ${gorunum === v ? 'ses-seg-on' : ''}`}
            >
              {etiket}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-3 px-1">
          <input type="checkbox" className="w-5 h-5 accent-ses-600" checked={yalnizKisa} onChange={(e) => setYalnizKisa(e.target.checked)} />
          <span className="text-[14px] text-sesui-body dark:text-sesui-dbody">Sadece kısa videolar</span>
        </label>
        <p className="text-[13px] leading-relaxed text-sesui-muted dark:text-sesui-dmuted px-0.5">
          {gorunum === 'konu'
            ? "Arada izlemek için derlenmiş videolar. Dokununca YouTube'da açılır, internet gerekir. Egzersiz ekranlarında yalnızca uygulamanın kendi kısa videoları vardır."
            : "Her ses egzersizi için o egzersize ait videolar. En altta da bir arama bağlantısı var: bir video kaldırılmış olsa bile arama her zaman güncel sonuç getirir."}
        </p>
        {gorunum === 'konu' &&
          LIBRARY.map((t) => <Konu key={t.id} t={t} acik={acik === t.id} onTap={() => setAcik(acik === t.id ? null : t.id)} yalnizKisa={yalnizKisa} />)}
        {gorunum === 'egzersiz' &&
          EXERCISES.map((e, i) => (
            <EgzersizKarti key={e.id} id={e.id} sira={i + 1} ad={e.name} acik={acikEx === e.id} onTap={() => setAcikEx(acikEx === e.id ? null : e.id)} yalnizKisa={yalnizKisa} />
          ))}
        <p className="text-[12px] leading-relaxed text-sesui-muted dark:text-sesui-dmuted px-0.5">
          Bu videolar dış kaynaklıdır; uygulamanın kendi içeriği değildir ve tıbbi tavsiye yerine geçmez.
        </p>
      </div>
    </div>
  )
}
