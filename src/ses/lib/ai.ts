// Yapay zeka (Claude) geri bildirimi: seansin sayisal sonuclari (satir satir
// dogruluk, yutulan sozcukler, hiz, oz degerlendirme, MPT) Claude'a gonderilir,
// kisa ve somut bir Turkce geri bildirim metni alinir.
//
// Tarayicidan/APK'dan dogrudan cagrilir; kullanici kendi API anahtarini
// Ayarlar'a girer (yalnizca cihazda saklanir, yedege yazilmaz). SDK gec
// (dinamik) yuklenir: sayfa acilisinda SDK yuzunden hata olsa bile uygulama
// acilir. NOT: yapay zeka SESI DUYMAZ; yalnizca tanima metnini ve sayilari
// degerlendirir. Bu sinir kullaniciya da yazilir.
import { findDExercise } from './diksiyon'
import { findExercise } from './content'
import { readSettings, sessionKind, type Session } from './store'

export const AI_MODEL = 'claude-opus-5'

const SYSTEM = `Sen deneyimli bir Türk dil ve konuşma terapisti / diksiyon eğitmenisin. Kullanıcı evde ses egzersizi uygulamasıyla çalışıyor; sana bir seansın SAYISAL sonuçları geliyor: konuşma tanımanın yazıya çevirdiği metin ile hedef metnin karşılaştırması (% doğruluk, yutulan/yanlış sözcükler), dakikadaki sözcük hızı, kullanıcının 1-5 öz değerlendirmesi ve varsa en uzun "A" tutma süresi (MPT).

Kurallar:
- Sesi DUYMUYORSUN; yalnızca bu sayılara ve metinlere dayanarak yorum yap. Ses kalitesi, tını, nefes gibi duyulmadan bilinemeyecek şeyler hakkında iddia kurma.
- Konuşma tanıma hata yapabilir; tek bir düşük satırı "sorun" ilan etme, tekrar eden örüntülere bak (örneğin sürekli yutulan "r", sözcük sonları, belirli ünsüz grupları).
- Türkçe, samimi ama profesyonel; "sen" diye hitap et. Kısa tut: en fazla 8-10 cümle. Somut ol: hangi ses/harf/sözcük, ne yapılmalı, bir sonraki seansta ne denenmeli.
- Yapı: (1) bir cümle genel değerlendirme, (2) 2-3 güçlü/iyi giden nokta, (3) 2-3 somut geliştirme önerisi (hangi egzersiz, hangi tempo), (4) tek cümlelik cesaretlendirme.
- Tıbbi tanı koyma. Ağrı, ses kısıklığında artış, uzun süreli çok düşük MPT gibi durumlarda hekim/terapiste yönlendir.
- Markdown başlık kullanma; düz paragraf ya da kısa madde işaretleri.`

export function hasApiKey(): boolean {
  return readSettings().apiKey.trim().length > 10
}

// Seansi ozetleyen metin (model girdisi). Ham ses yok, yalnizca metin/sayi.
export function sessionSummaryText(s: Session): string {
  const kind = sessionKind(s)
  const out: string[] = []
  out.push(`Seans türü: ${kind === 'diksiyon' ? 'diksiyon' : 'vokal kord addüksiyon'} · süre ${Math.round(s.ms / 60000)} dk · tarih ${s.t.slice(0, 16).replace('T', ' ')}`)
  if (typeof s.rating === 'number') out.push(`Seans geneli öz değerlendirme: ${s.rating}/5`)
  for (const d of s.done) {
    const e = kind === 'diksiyon' ? findDExercise(d.id) : findExercise(d.id)
    const parts: string[] = [`- ${e?.name ?? d.id}: ${d.reps} tekrar`]
    if (typeof d.rating === 'number') parts.push(`öz değerlendirme ${d.rating}/5`)
    if (typeof d.mpt === 'number') parts.push(`en uzun "A" ${d.mpt} sn`)
    if (typeof d.acc === 'number') parts.push(`doğruluk %${d.acc}`)
    if (typeof d.wpm === 'number') parts.push(`${d.wpm} sözcük/dk`)
    out.push(parts.join(' · '))
    if (d.lines?.length) {
      for (const l of d.lines) {
        out.push(`    hedef: "${l.target}"`)
        out.push(`    duyulan: "${l.heard || '(boş)'}" → %${l.acc}${l.missed.length ? `, yutulan/yanlış: ${l.missed.join(', ')}` : ''}`)
      }
    }
  }
  if (s.note) out.push(`Kullanıcı notu: "${s.note}"`)
  return out.join('\n')
}

export async function getFeedback(s: Session, history: Session[]): Promise<string> {
  const apiKey = readSettings().apiKey.trim()
  if (!apiKey) throw new Error('Ayarlar > Yapay zeka bölümüne Claude API anahtarını gir.')
  const mod = await import('@anthropic-ai/sdk')
  const Anthropic = mod.default
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  // Son 5 seansin kisa ozeti: egilim gorulsun
  const prev = history
    .filter((h) => h.id !== s.id && sessionKind(h) === sessionKind(s))
    .slice(-5)
    .map((h) => {
      const accs = h.done.map((d) => d.acc).filter((x): x is number => typeof x === 'number')
      const acc = accs.length ? Math.round(accs.reduce((a, b) => a + b, 0) / accs.length) : null
      const mpt = h.done.reduce((m, d) => Math.max(m, d.mpt ?? 0), 0)
      return `${h.t.slice(0, 10)}: ${h.done.length} egzersiz${acc != null ? `, doğruluk %${acc}` : ''}${mpt ? `, MPT ${mpt} sn` : ''}${typeof h.rating === 'number' ? `, öz değ. ${h.rating}/5` : ''}`
    })

  const user = `BU SEANS:\n${sessionSummaryText(s)}\n\nÖNCEKİ SEANSLAR (eski→yeni):\n${prev.length ? prev.join('\n') : '(ilk seans)'}\n\nLütfen geri bildirimini yaz.`

  try {
    const res = await client.beta.messages.create({
      model: AI_MODEL,
      max_tokens: 1500,
      betas: ['server-side-fallback-2026-06-01'],
      fallbacks: [{ model: 'claude-opus-4-8' }],
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }]
    })
    if (res.stop_reason === 'refusal') throw new Error('İstek reddedildi; lütfen tekrar deneyin.')
    const text = res.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()
    if (!text) throw new Error('Boş yanıt geldi.')
    return text
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('API anahtarı geçersiz (401). Ayarlar\'dan anahtarı kontrol et.')
    if (e instanceof Anthropic.RateLimitError) throw new Error('Çok sık istek (429). Biraz bekleyip tekrar dene.')
    if (e instanceof Anthropic.APIConnectionError) throw new Error('Bağlantı kurulamadı. İnternet var mı?')
    if (e instanceof Anthropic.APIError) throw new Error(`API hatası ${e.status}: ${e.message}`)
    throw e
  }
}
