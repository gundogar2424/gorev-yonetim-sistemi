import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db'
import { parsePaste, toCustomer, type ParseResult } from '../lib/importPaste'
import Header from '../components/Header'

const FIELD_LABELS: Record<string, string> = {
  companyTitle: 'Firma',
  contactName: 'Yetkili',
  role: 'Görev',
  phone: 'Telefon',
  city: 'İl',
  district: 'İlçe',
  sector: 'Sektör',
  notes: 'Not',
  birthDate: 'Doğum T.'
}

export default function BulkImport() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [result, setResult] = useState<ParseResult | null>(null)
  const [done, setDone] = useState<number | null>(null)

  function analyze() {
    setDone(null)
    setResult(parsePaste(text))
  }

  const validRows = useMemo(
    () => result?.rows.filter((r) => r.customer.companyTitle || r.customer.contactName || r.customer.phone) ?? [],
    [result]
  )

  async function importAll() {
    const now = Date.now()
    const records = validRows.map((r) => toCustomer(r.customer, now))
    await db.customers.bulkAdd(records)
    setDone(records.length)
    setText('')
    setResult(null)
  }

  return (
    <div>
      <Header title="Toplu İçe Aktar" subtitle="Excel/tablodan yapıştır" />

      <div className="p-3 space-y-3">
        <div className="card p-3 text-sm text-slate-600 bg-brand-50 border-brand-100">
          📋 Excel veya tablodaki satırları kopyalayıp aşağıya yapıştırın. İlk satır başlık ise (Firma,
          Telefon, İl…) otomatik tanınır. Başlık yoksa sütunlar içerikten tahmin edilir.
        </div>

        <textarea
          className="field-input font-mono text-sm"
          rows={6}
          placeholder={'Firma\tYetkili\tTelefon\tİl\tİlçe\nABC Ltd\tAli Veli\t05321234567\tİstanbul\tKadıköy'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="flex gap-2">
          <button onClick={analyze} disabled={!text.trim()} className="btn-ghost flex-1">
            🔍 Analiz Et
          </button>
          {validRows.length > 0 && (
            <button onClick={importAll} className="btn-primary flex-1">
              ✅ {validRows.length} kaydı ekle
            </button>
          )}
        </div>

        {done != null && (
          <div className="card p-4 bg-green-50 border-green-200 text-green-800 text-center">
            <p className="font-semibold">✅ {done} müşteri başarıyla eklendi.</p>
            <button onClick={() => navigate('/')} className="btn-primary mt-3">
              Listeye git
            </button>
          </div>
        )}

        {result && validRows.length === 0 && (
          <p className="text-center text-slate-400 py-6 text-sm">Geçerli satır bulunamadı.</p>
        )}

        {/* Onizleme */}
        {result && validRows.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-slate-500">
              {result.headerDetected ? 'Başlık satırı algılandı.' : 'Başlık yok — sütunlar tahmin edildi.'}{' '}
              {validRows.length} geçerli satır:
            </p>
            <div className="space-y-2 max-h-80 overflow-auto">
              {validRows.slice(0, 50).map((r, i) => (
                <div key={i} className="card p-2.5 text-sm">
                  <p className="font-semibold text-slate-800">
                    {r.customer.companyTitle || r.customer.contactName || '(isimsiz)'}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                    {Object.entries(r.customer)
                      .filter(([k]) => FIELD_LABELS[k])
                      .map(([k, v]) => (
                        <span key={k}>
                          <span className="text-slate-400">{FIELD_LABELS[k]}:</span> {String(v)}
                        </span>
                      ))}
                  </div>
                </div>
              ))}
              {validRows.length > 50 && (
                <p className="text-center text-xs text-slate-400">… ve {validRows.length - 50} satır daha</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
