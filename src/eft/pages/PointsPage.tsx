import { useState } from 'react'
import EftHeader from '../EftHeader'
import BodyMap from '../components/BodyMap'
import HandMap from '../components/HandMap'
import { KARATE, POINTS, pointById } from '../lib/content'

const ADIMLAR: { baslik: string; metin: string }[] = [
  { baslik: '1 · Konuyu seç', metin: 'Seni rahatsız eden duyguyu ya da durumu olabildiğince somut belirle. "Kaygı" yerine "yarınki toplantı" gibi.' },
  { baslik: '2 · Puan ver (0-10)', metin: 'Şu an bu duyguyu düşününce ne kadar rahatsız oluyorsun? 0 hiç, 10 dayanılmaz. Bu sayı ilerlemeni ölçer.' },
  { baslik: '3 · Kurulum cümlesi', metin: 'Karate noktasına vururken 3 kez yüksek sesle söyle: "Her ne kadar … olsa da, kendimi derinden ve tamamen kabul ediyorum."' },
  { baslik: '4 · Tur: 8 noktaya vur', metin: 'Kaş başından başlayıp baş üstünde bitir. Her noktaya yaklaşık 7 kez hafifçe vururken kısa hatırlatma ifadesini söyle.' },
  { baslik: '5 · Nefes al, yeniden puanla', metin: 'Derin bir nefes al; duyguyu yeniden 0-10 puanla. Düştüyse harika. 2-3\'ün üstündeyse bir tur daha yap.' },
  { baslik: '6 · Olumlu tur', metin: 'Yoğunluk iyice azalınca son turu olumlu ifadelerle yap: "Sakin olmayı seçiyorum" gibi.' }
]

export default function PointsPage() {
  const [sec, setSec] = useState<string>('eb')
  const p = pointById(sec) ?? POINTS[0]
  const idx = POINTS.findIndex((x) => x.id === p.id)

  return (
    <div>
      <EftHeader title="Noktalar" subtitle="Nasıl yapılır ve nereye vurulur" />
      <div className="px-4 space-y-4">
        <section className="eft-card">
          <h2 className="text-[19px] font-bold text-slate-900 dark:text-[#e8f2f1] mb-1">EFT nedir?</h2>
          <p className="text-[15px] leading-relaxed text-slate-700 dark:text-[#d5e6e4]">
            EFT (Emotional Freedom Techniques, Duygusal Özgürleşme Tekniği), rahatsız edici bir duyguya odaklanırken
            yüz ve üst gövdedeki belirli noktalara parmak uçlarıyla hafifçe vurmaya dayanan bir gevşeme tekniğidir.
            Çoğu kişi birkaç dakikada yoğunluğun düştüğünü fark eder. Uygulaması kolaydır, her yerde yapılabilir.
          </p>
        </section>

        <section className="eft-card">
          <h3 className="eft-label mb-2">Noktaya dokun, açıklamayı gör</h3>
          <BodyMap active={p.id} onSelect={setSec} className="w-full max-w-[280px] mx-auto" />
          <div className="mt-2 rounded-2xl bg-eft-50 dark:bg-[#1e3231] p-4 eft-pop" key={p.id}>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-eft-600 text-white grid place-items-center text-[15px] font-bold">{idx + 1}</span>
              <span className="text-[18px] font-bold text-slate-900 dark:text-[#e8f2f1]">{p.name}</span>
            </div>
            <p className="mt-1.5 text-[15px] text-slate-700 dark:text-[#d5e6e4]">
              <b>Nerede:</b> {p.where}
            </p>
            <p className="text-[15px] text-slate-700 dark:text-[#d5e6e4]">
              <b>Nasıl:</b> {p.how}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button className="eft-btn-ghost min-h-[48px] text-[15px]" disabled={idx <= 0} onClick={() => setSec(POINTS[idx - 1].id)}>
              ‹ Önceki
            </button>
            <button className="eft-btn-soft min-h-[48px] text-[15px]" disabled={idx >= POINTS.length - 1} onClick={() => setSec(POINTS[idx + 1].id)}>
              Sonraki ›
            </button>
          </div>
        </section>

        <section className="eft-card">
          <h3 className="eft-label mb-2">Kurulum noktası</h3>
          <div className="flex items-center gap-3">
            <HandMap className="w-32 h-32 flex-shrink-0" />
            <div>
              <div className="text-[18px] font-bold text-slate-900 dark:text-[#e8f2f1]">{KARATE.name}</div>
              <p className="text-[15px] text-slate-700 dark:text-[#d5e6e4] mt-1">
                <b>Nerede:</b> {KARATE.where}
              </p>
              <p className="text-[15px] text-slate-700 dark:text-[#d5e6e4]">
                <b>Nasıl:</b> {KARATE.how}
              </p>
            </div>
          </div>
        </section>

        <section className="eft-card">
          <h3 className="eft-label mb-2">Adım adım</h3>
          <ol className="space-y-3">
            {ADIMLAR.map((a) => (
              <li key={a.baslik}>
                <div className="text-[16px] font-bold text-slate-900 dark:text-[#e8f2f1]">{a.baslik}</div>
                <p className="text-[15px] leading-relaxed text-slate-700 dark:text-[#d5e6e4]">{a.metin}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="eft-card">
          <h3 className="eft-label mb-2">Sıra</h3>
          <ol className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {POINTS.map((x, i) => (
              <li key={x.id} className="flex items-center gap-2 text-[15px] text-slate-800 dark:text-[#e8f2f1]">
                <span className="w-6 h-6 rounded-full bg-eft-50 dark:bg-[#1e3231] text-eft-700 dark:text-eft-300 grid place-items-center text-[12px] font-bold">
                  {i + 1}
                </span>
                {x.name}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}
