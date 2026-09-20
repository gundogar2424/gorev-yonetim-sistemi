// "İzle" sekmesi: konulara ayrilmis, arada izlemek icin kisa YouTube videolari.
// Baglantilar telefonun tarayicisinda / YouTube uygulamasinda acilir; uygulama
// icinde gomulu oynatici yoktur (sekme hizli acilsin, veri harcanmasin).
import { useState } from 'react'
import SesHeader from '../SesHeader'
import { LIBRARY, libCount, type LibTopic, type LibVideo } from '../lib/library'

function Satir({ v }: { v: LibVideo }) {
  return (
    <a
      href={v.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 py-3 border-b border-slate-100 dark:border-[#4a3a30] last:border-0 active:opacity-70"
    >
      <span className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-[#2a1a1d] grid place-items-center text-[18px] flex-shrink-0">▶</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[16px] font-semibold text-slate-900 dark:text-[#f5ece4] leading-snug">{v.title}</span>
        <span className="block text-[13px] text-slate-600 dark:text-[#cdbdb3] mt-0.5">
          {[v.by, v.short ? 'kısa' : null, v.lang === 'en' ? 'İngilizce' : v.lang === 'fr' ? 'Fransızca' : null].filter(Boolean).join(' · ')}
        </span>
      </span>
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-400 dark:text-[#cdbdb3] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.2}>
        <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  )
}

function Konu({ t, acik, onTap }: { t: LibTopic; acik: boolean; onTap: () => void }) {
  return (
    <section className="ses-card">
      <button className="w-full flex items-center gap-3 text-left" onClick={onTap}>
        <span className="w-12 h-12 rounded-2xl bg-ses-50 dark:bg-[#352820] grid place-items-center text-[24px] flex-shrink-0">{t.emoji}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[17px] font-semibold text-slate-900 dark:text-[#f5ece4] leading-tight">{t.title}</span>
          <span className="block text-[14px] text-slate-600 dark:text-[#cdbdb3] mt-0.5">
            {t.videos.length} video · {t.note}
          </span>
        </span>
        <svg viewBox="0 0 24 24" className={`w-5 h-5 text-slate-400 dark:text-[#cdbdb3] flex-shrink-0 transition-transform ${acik ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.2}>
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {acik && (
        <div className="mt-2">
          {t.videos.map((v) => (
            <Satir key={v.url} v={v} />
          ))}
        </div>
      )}
    </section>
  )
}

export default function LibraryPage() {
  const [acik, setAcik] = useState<string | null>(LIBRARY[0]?.id ?? null)
  return (
    <div>
      <SesHeader title="İzle" subtitle={`${libCount()} video · konulara göre`} />
      <div className="px-4 space-y-3 pb-6">
        <p className="text-[15px] text-slate-700 dark:text-[#e2d5cd] px-1">
          Arada izlemek için derlenmiş videolar. Dokununca YouTube'da açılır, internet gerekir. Egzersiz ekranlarında yalnızca uygulamanın kendi kısa videoları vardır.
        </p>
        {LIBRARY.map((t) => (
          <Konu key={t.id} t={t} acik={acik === t.id} onTap={() => setAcik(acik === t.id ? null : t.id)} />
        ))}
        <p className="text-[13px] text-slate-600 dark:text-[#cdbdb3] px-1">
          Bu videolar dış kaynaklıdır; uygulamanın kendi içeriği değildir ve tıbbi tavsiye yerine geçmez.
        </p>
      </div>
    </div>
  )
}
