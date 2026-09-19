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
import { readSettings, sessionKind, type NextPlan, type Session } from './store'
import { PROGRAM_LABEL } from './content'
import { DEXERCISES } from './diksiyon'
import { EXERCISES } from './content'

export const AI_MODEL = 'claude-opus-5'

const SYSTEM = `Sen deneyimli bir Türk dil ve konuşma terapisti / diksiyon eğitmenisin. Kullanıcı evde ses egzersizi uygulamasıyla çalışıyor; sana bir seansın SAYISAL sonuçları geliyor: konuşma tanımanın yazıya çevirdiği metin ile hedef metnin karşılaştırması (% doğruluk, yutulan/yanlış sözcükler), dakikadaki sözcük hızı, kullanıcının 1-5 öz değerlendirmesi ve varsa en uzun "A" tutma süresi (MPT).

Kurallar:
- Sesi DUYMUYORSUN; yalnızca bu sayılara ve metinlere dayanarak yorum yap. Ses kalitesi hakkında yalnızca verilen AKUSTİK ÖLÇÜMLER varsa konuş: F0 (perde, Hz), jitter (% perde titremesi; ~1'in altı iyi), shimmer (% şiddet titremesi; ~4'ün altı iyi), HNR (dB harmonik/gürültü oranı; ~18-20 üstü iyi, düşükse ses nefesli/gürültülü = hava kaçağı, ses tellerinin tam kapanmadığına işaret edebilir). Bu ölçümler telefon mikrofonuyla alınmıştır: meta-analizlere göre F0 ve jitter telefonda güvenilir, shimmer ve HNR ise klinik sistemden sapabilir; bu yüzden shimmer/HNR'yi mutlak eşiklerle değil, kişinin kendi geçmişiyle karşılaştırarak ve eğilim olarak yorumla.
- Program bilgisi: "Ses teli felci / zayıf kapanma" programında öncelik kapanma teknikleri + VFE + su direnci; gür ses egzersizleri kapanma iyileşince eklenir. "Yaşa bağlı ses zayıflığı" programında öncelik PhoRTE (gür ses) + VFE + SOVT; zorlayıcı kapanma teknikleri önerilmez. Planı programa uygun ver.
- Doz bilgisi: literatürde etkili doz günde 2 kısa seans, 6-8 hafta (VFE doz çalışması). SOVT/pipet ayrıca gün içinde kısa (1-3 dk) molalar hâlinde sık yapılabilir. Kullanıcı bunun altındaysa nazikçe hatırlat; üstündeyse ses yorgunluğu uyarısı yap.
- İtme/çekme egzersizleri kapanmayı zorlar ama boğazın üst kısmını sıkma (supraglottik hiperfonksiyon) riski taşır; ses "kaba/boğuk/zorlu" tarifleniyorsa bunları azaltmayı ve yumuşak tekniklere (VFE, pipet) ağırlık vermeyi öner.
- Konuşma tanıma hata yapabilir; tek bir düşük satırı "sorun" ilan etme, tekrar eden örüntülere bak (örneğin sürekli yutulan "r", sözcük sonları, belirli ünsüz grupları).
- Türkçe, samimi ama profesyonel; "sen" diye hitap et. Kısa tut: en fazla 8-10 cümle. Somut ol: hangi ses/harf/sözcük, ne yapılmalı, bir sonraki seansta ne denenmeli.
- Yapı: (1) bir cümle genel değerlendirme, (2) 2-3 güçlü/iyi giden nokta, (3) 2-3 somut geliştirme önerisi (hangi egzersiz, hangi tempo, hangi ses), (4) geçmiş seanslarla karşılaştırarak eğilim (iyileşiyor mu, duraklıyor mu), (5) tek cümlelik cesaretlendirme.
- Ayrıca BİR SONRAKİ SEANS için somut plan ver: diksiyon temposu (yavas/orta/hizli), addüksiyon yoğunluğu (hafif/orta/yogun), odaklanılacak 2-4 egzersiz (yalnızca verilen id listesinden) ve tek cümlelik hedef.
- Tıbbi tanı koyma. Ağrı, ses kısıklığında artış, uzun süreli çok düşük MPT gibi durumlarda hekim/terapiste yönlendir.
- Markdown başlık kullanma; düz paragraf ya da kısa madde işaretleri.

KULLANILABİLİR EGZERSİZ ID'LERİ:
Diksiyon: ${DEXERCISES.map((e) => `${e.id} (${e.name})`).join(', ')}
Addüksiyon: ${EXERCISES.map((e) => `${e.id} (${e.name})`).join(', ')}`

export function hasApiKey(): boolean {
  return readSettings().apiKey.trim().length > 10
}

// Seansi ozetleyen metin (model girdisi). Ham ses yok, yalnizca metin/sayi.
export function sessionSummaryText(s: Session): string {
  const kind = sessionKind(s)
  const out: string[] = []
  const prog = readSettings().program
  out.push(`Seans türü: ${kind === 'diksiyon' ? 'diksiyon' : 'vokal kord addüksiyon'} · süre ${Math.round(s.ms / 60000)} dk · tarih ${s.t.slice(0, 16).replace('T', ' ')}${prog ? ` · program: ${PROGRAM_LABEL[prog]}` : ''}`)
  if (typeof s.rating === 'number') out.push(`Seans geneli öz değerlendirme: ${s.rating}/5`)
  for (const d of s.done) {
    const e = kind === 'diksiyon' ? findDExercise(d.id) : findExercise(d.id)
    const parts: string[] = [`- ${e?.name ?? d.id}: ${d.reps} tekrar`]
    if (typeof d.rating === 'number') parts.push(`öz değerlendirme ${d.rating}/5`)
    if (typeof d.mpt === 'number') parts.push(`en uzun "A" ${d.mpt} sn`)
    if (d.ac) parts.push(`akustik: F0 ${d.ac.f0} Hz, jitter %${d.ac.jitter}, shimmer %${d.ac.shimmer}, HNR ${d.ac.hnr} dB`)
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

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    feedback: { type: 'string', description: 'Kullanıcıya gösterilecek geri bildirim metni (Türkçe, 8-12 cümle, düz metin)' },
    plan: {
      type: 'object',
      properties: {
        tempo: { type: 'string', enum: ['yavas', 'orta', 'hizli'] },
        level: { type: 'string', enum: ['hafif', 'orta', 'yogun'] },
        focus: { type: 'array', items: { type: 'string' }, description: 'Odaklanılacak egzersiz id\'leri (2-4 adet, verilen listeden)' },
        goal: { type: 'string', description: 'Sonraki seans için tek cümlelik hedef' }
      },
      required: ['tempo', 'level', 'focus', 'goal'],
      additionalProperties: false
    }
  },
  required: ['feedback', 'plan'],
  additionalProperties: false
} as const

export interface Feedback {
  text: string
  plan: NextPlan
}

export async function getFeedback(s: Session, history: Session[]): Promise<Feedback> {
  const apiKey = readSettings().apiKey.trim()
  if (!apiKey) throw new Error('Ayarlar > Yapay zeka bölümüne Claude API anahtarını gir.')
  const mod = await import('@anthropic-ai/sdk')
  const Anthropic = mod.default
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  // Son 15 seansin ozeti (her iki tur): egilim ve tekrar eden hatalar gorulsun
  const prev = history
    .filter((h) => h.id !== s.id)
    .slice(-15)
    .map((h) => {
      const accs = h.done.map((d) => d.acc).filter((x): x is number => typeof x === 'number')
      const acc = accs.length ? Math.round(accs.reduce((a, b) => a + b, 0) / accs.length) : null
      const mpt = h.done.reduce((m, d) => Math.max(m, d.mpt ?? 0), 0)
      const ac = h.done.find((d) => d.ac)?.ac
      const missed = h.done.flatMap((d) => d.lines?.flatMap((l) => l.missed) ?? [])
      const top = [...new Set(missed)].slice(0, 8)
      return `${h.t.slice(0, 10)} ${sessionKind(h) === 'diksiyon' ? 'diksiyon' : 'addüksiyon'}: ${h.done.length} egzersiz${acc != null ? `, doğruluk %${acc}` : ''}${mpt ? `, MPT ${mpt} sn` : ''}${ac ? `, HNR ${ac.hnr} dB, jitter %${ac.jitter}, shimmer %${ac.shimmer}` : ''}${typeof h.rating === 'number' ? `, öz değ. ${h.rating}/5` : ''}${top.length ? `, yutulan: ${top.join(', ')}` : ''}`
    })

  const user = `BU SEANS:\n${sessionSummaryText(s)}\n\nÖNCEKİ SEANSLAR (eski→yeni):\n${prev.length ? prev.join('\n') : '(ilk seans)'}\n\nLütfen geri bildirimini ve sonraki seans planını ver.`

  try {
    const res = await client.beta.messages.create({
      model: AI_MODEL,
      max_tokens: 6000,
      betas: ['server-side-fallback-2026-06-01'],
      fallbacks: [{ model: 'claude-opus-4-8' }],
      // Yuksek efor: daha derin analiz (kullanici "faydali olsun" dedi; seans
      // basina birkac sent). Yapilandirilmis cikti: metin + uygulanabilir plan.
      output_config: { effort: 'high', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }]
    })
    if (res.stop_reason === 'refusal') throw new Error('İstek reddedildi; lütfen tekrar deneyin.')
    if (res.stop_reason === 'max_tokens') throw new Error('Yanıt yarıda kesildi; lütfen tekrar deneyin.')
    const raw = res.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()
    if (!raw) throw new Error('Boş yanıt geldi.')
    let parsed: { feedback?: string; plan?: Partial<NextPlan> }
    try {
      parsed = JSON.parse(raw.replace(/^```json\s*|```$/g, '')) as typeof parsed
    } catch {
      return { text: raw, plan: { tempo: readSettings().dTempo, level: readSettings().level, focus: [], goal: '' } }
    }
    const p = parsed.plan ?? {}
    const known = new Set([...DEXERCISES.map((e) => e.id), ...EXERCISES.map((e) => e.id)])
    const plan: NextPlan = {
      tempo: p.tempo === 'yavas' || p.tempo === 'hizli' ? p.tempo : 'orta',
      level: p.level === 'hafif' || p.level === 'yogun' ? p.level : 'orta',
      focus: Array.isArray(p.focus) ? p.focus.filter((x): x is string => typeof x === 'string' && known.has(x)).slice(0, 4) : [],
      goal: typeof p.goal === 'string' ? p.goal.slice(0, 200) : ''
    }
    return { text: (parsed.feedback ?? raw).trim(), plan }
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('API anahtarı geçersiz (401). Ayarlar\'dan anahtarı kontrol et.')
    if (e instanceof Anthropic.RateLimitError) throw new Error('Çok sık istek (429). Biraz bekleyip tekrar dene.')
    if (e instanceof Anthropic.APIConnectionError) throw new Error('Bağlantı kurulamadı. İnternet var mı?')
    if (e instanceof Anthropic.APIError) throw new Error(`API hatası ${e.status}: ${e.message}`)
    throw e
  }
}
