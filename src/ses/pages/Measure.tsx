import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SesHeader from '../SesHeader'
import MptMeter, { type MptResult } from '../components/MptMeter'
import { addMpt, bestMpt, readMpt } from '../lib/store'
import { fmtShort } from '../lib/date'
import Icon from '../components/Icon'

export default function Measure() {
  const navigate = useNavigate()
  const [son, setSon] = useState<MptResult | null>(null)
  const [kayit, setKayit] = useState(false)
  const best = bestMpt()
  const gecmis = readMpt().slice(-5).reverse()

  function kaydet() {
    if (!son || son.sec <= 0) return
    addMpt({ sec: son.sec, db: son.db, manual: son.manual, ac: son.ac })
    setKayit(true)
  }

  return (
    <div className="flex-1 flex flex-col">
      <SesHeader title="Ses ölçümü" subtitle='En uzun "A" tutma süresi (MPT)' back={() => navigate('/')} />
      <div className="px-4 space-y-5 pb-8">
        <section className="ses-card space-y-3">
          <p className="text-[16px] text-sesui-body dark:text-sesui-dbody">
            Burnundan derin nefes al; rahat perdede, orta yükseklikte <b>"aaaa"</b> de ve sesin bitene kadar tut. Bağırma, boğazını sıkma. Sessiz bir odada,
            telefonu ağzından bir karış uzakta tut.
          </p>
          <MptMeter
            onResult={(r) => {
              setSon(r)
              setKayit(false)
            }}
          />
          {son && son.sec > 0 && !kayit && (
            <button className="ses-btn-soft w-full" onClick={kaydet}>
              💾 Bu sonucu kaydet
            </button>
          )}
          {kayit && (
            <div className="rounded-[10px] border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 text-[14px] p-2.5 flex items-center justify-center gap-2">
              <Icon name="check" size={15} />
              Kaydedildi
            </div>
          )}
        </section>

        <section className="ses-card">
          <div className="flex items-center justify-between">
            <h3 className="ses-label">Rekorun</h3>
            <span className="text-[18px] font-bold text-ses-700 tabular-nums">{best > 0 ? `${best.toFixed(1).replace('.', ',')} sn` : '—'}</span>
          </div>
          {gecmis.length > 0 ? (
            <ul className="mt-2 divide-y divide-sesui-line dark:divide-sesui-dline">
              {gecmis.map((r) => (
                <li key={r.id} className="py-2 flex items-center justify-between text-[16px]">
                  <span className="text-sesui-body dark:text-sesui-dbody">{fmtShort(r.t)}{r.manual ? ' · elle' : ''}</span>
                  <span className="text-right">
                    <span className="block font-semibold tabular-nums text-sesui-text dark:text-sesui-dtext">{r.sec.toFixed(1).replace('.', ',')} sn</span>
                    {r.ac && <span className="block text-[13px] text-sesui-body dark:text-sesui-dbody tabular-nums">HNR {String(r.ac.hnr).replace('.', ',')} dB · jitter %{String(r.ac.jitter).replace('.', ',')} · shimmer %{String(r.ac.shimmer).replace('.', ',')}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[15px] text-sesui-body dark:text-sesui-dbody mt-1">Henüz ölçüm yok. İlk ölçümünü yap ve kaydet.</p>
          )}
        </section>

        <p className="text-[14px] text-sesui-body dark:text-sesui-dbody px-1">
          Bilgi: mikrofonla ölçümde süreyle birlikte ses kalitesi de hesaplanır (perde, nefeslilik, titreme); "Ölçümü başlat" ile sessiz bir odada yap. Yetişkinlerde tipik süre kadınlarda 15-25 sn, erkeklerde 25-35 sn; 65 yaş üstünde kadın 10-21, erkek 13-23 sn. 10 sn'nin altı konuşurken nefessiz kalmayla, 12 sn'nin altı yaşa bağlı ses zayıflığı olasılığıyla ilişkilendirilmiştir.
          Ses kalitesi sayılarından perde ve jitter telefonda güvenilirdir; shimmer ve HNR telefon mikrofonundan etkilenir, yalnızca kendi geçmişinle karşılaştır. Bu ölçüm tanı koymaz; sonucu hekimin/terapistinle paylaş.
        </p>
      </div>
    </div>
  )
}
