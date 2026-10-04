// TARIF SIRASI: Instagram/TikTok'tan arka arkaya paylasilan linkler siraya
// girer ve TEK TEK islenir (yapay zeka istek siniri asilmasin, telefon
// yorulmasin). Her biri bitince tarif deftere kendiliginden kaydedilir ve
// ustune "kontrol et" notu dusulur. Sira veritabaninda durdugu icin uygulama
// kapansa da kaybolmaz; acilinca kaldigi yerden devam eder.
import { Capacitor, registerPlugin } from '@capacitor/core'
import { addRecipe, deleteRecipe, lzDb, updateRecipe } from '../db'
import type { LzDraft, LzSira } from '../types'
import { linkAyikla, platformBul } from './importer'
import { ayniLinkliTarif, benzerTarif } from './kopya'
import { TarifYokHatasi } from './ai'
import { mekanLinktenEkle } from './mekan'
import { linktenTaslak, taslakHazirla, yapilandir } from './pipeline'


export async function siraEkle(girdi: string, tur?: 'tarif' | 'mekan'): Promise<void> {
  const metin = girdi.trim()
  if (!metin) return
  const url = linkAyikla(metin)
  const anahtar = url || metin
  // Ayni link zaten sirada bekliyorsa ikinci kez ekleme
  const ayni = await lzDb.sira.filter((x) => (linkAyikla(x.girdi) || x.girdi) === anahtar && (x.durum === 'bekliyor' || x.durum === 'isleniyor')).count()
  if (ayni) return
  const now = Date.now()
  await lzDb.sira.add({ girdi: metin, tur, durum: 'bekliyor', mesaj: tur === 'mekan' ? 'Sırada (mekan)' : 'Sırada', recipeId: 0, baslik: url ? kisaLink(url) : metin.slice(0, 50), createdAt: now, updatedAt: now })
  void siraIsle()
}

function kisaLink(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\?.*$/, '').slice(0, 60)
}

// Sira isleyici: ayni anda yalnizca bir tane calisir.
const AYNI_ANDA = 2 // ayni anda islenen paylasim
const EN_UZUN_DK = 8 // tek bir paylasim en fazla bu kadar surer; takilirsa siradakine gecilir

let aktif = 0

// Android: sira islenirken uygulama arka planda/ekran kapaliyken dondurulmasin diye
// bildirimli on plan servisi calistirilir (yerel eklenti yoksa — tarayicida — hicbir sey yapmaz)
type SiraEklentisi = { basla(o: { metin: string }): Promise<void>; guncelle(o: { metin: string }): Promise<void>; bitir(): Promise<void> }
const yerel = registerPlugin<SiraEklentisi>('LzSira')
function servis(is: (e: SiraEklentisi) => Promise<void>): void {
  if (!Capacitor.isNativePlatform()) return
  is(yerel).catch(() => {
    /* eski surum / izin yok: sira yine calisir */
  })
}
async function bildirimMetni(): Promise<string> {
  const n = await lzDb.sira.where('durum').anyOf('bekliyor', 'isleniyor').count()
  return n ? `${n} paylaşım işleniyor…` : 'Tamamlanıyor…'
}

// Siradaki bekleyen isi alir (iki isci ayni isi almasin diye islem icinde)
async function siradakiniAl(): Promise<LzSira | undefined> {
  return lzDb.transaction('rw', lzDb.sira, async () => {
    const is = (await lzDb.sira.where('durum').equals('bekliyor').sortBy('createdAt'))[0]
    if (is) await lzDb.sira.update(is.id!, { durum: 'isleniyor', mesaj: 'Başlıyor…', updatedAt: Date.now() })
    return is
  })
}

// Sira isleyici: en fazla AYNI_ANDA is paralel islenir.
export async function siraIsle(): Promise<void> {
  if (aktif >= AYNI_ANDA) return
  const bekleyen = await lzDb.sira.where('durum').equals('bekliyor').count()
  const baslat = Math.min(AYNI_ANDA - aktif, bekleyen)
  if (baslat <= 0) return
  const ilk = aktif === 0
  // Isciler hemen (await'ten once) baslatilir ki ayni anda gelen cagrilar fazladan isci acmasin
  for (let i = 0; i < baslat; i++) void isci()
  if (ilk) {
    const metin = await bildirimMetni()
    servis((e) => e.basla({ metin }))
  }
}

async function isci(): Promise<void> {
  aktif++
  try {
    for (;;) {
      const is = await siradakiniAl()
      if (!is) break
      const metin = await bildirimMetni()
      servis((e) => e.guncelle({ metin }))
      const iptal = { v: false }
      const g = async (patch: Partial<LzSira>) => {
        if (!iptal.v) await lzDb.sira.update(is.id!, { ...patch, updatedAt: Date.now() })
      }
      let zaman: number | undefined
      const sure = new Promise<'sure'>((res) => {
        zaman = window.setTimeout(() => res('sure'), EN_UZUN_DK * 60 * 1000)
      })
      const sonuc = await Promise.race([birIsle(is, g, iptal).then(() => 'tamam' as const), sure])
      window.clearTimeout(zaman)
      if (sonuc === 'sure') {
        await g({ durum: 'hata', mesaj: `${EN_UZUN_DK} dakikada bitmedi (bağlantı yavaş ya da video çok büyük). Tekrar dene.` })
        iptal.v = true
      }
    }
  } finally {
    aktif--
    if (aktif === 0) {
      servis((e) => e.bitir())
    }
  }
}

async function birIsle(is: LzSira, g: (patch: Partial<LzSira>) => Promise<void>, iptal: { v: boolean }): Promise<void> {
  try {
    // Kullanici "Mekan" olarak paylastiysa tarif hic denenmez
    if (is.tur === 'mekan') {
      if (iptal.v) return
      const sonuc = await mekanLinktenEkle(is.girdi, (m) => void g({ mesaj: m }))
      const mk = await lzDb.mekanlar.get(sonuc.id)
      await g({
        durum: 'bitti',
        mesaj: sonuc.yeni ? '📍 Mekanlarım’a kaydedildi.' : '📍 Bu mekan zaten kayıtlı.',
        recipeId: 0,
        mekanId: sonuc.id,
        baslik: mk?.ad ?? is.baslik
      })
      return
    }
    const url = linkAyikla(is.girdi)
    // Bu link zaten defterdeyse tekrar ekleme
    if (url && !is.zorla) {
      const var_ = await ayniLinkliTarif(url)
      if (var_) {
        await g({ durum: 'bitti', mesaj: 'Bu tarif zaten defterde.', recipeId: var_.id!, baslik: var_.title })
        return
      }
    }
    const ilerleme = (m: string) => void g({ mesaj: m })
    let t: { draft: LzDraft; not: string }
    if (url) {
      t = await linktenTaslak(is.girdi, ilerleme)
    } else {
      // Linksiz paylasim (aciklama metni)
      const bos: LzDraft = { title: '', photo: '', sourceUrl: '', platform: 'manual', author: '', servings: 0, minutes: 0, ingredients: [], steps: [], notes: '', tags: [] }
      const y = await yapilandir(is.girdi, bos, ilerleme)
      t = await taslakHazirla(y.d, y.not, '', ilerleme)
    }
    if (!t.draft.sourceUrl && url) t.draft.sourceUrl = url
    if (url && t.draft.platform === 'manual') t.draft.platform = platformBul(url)
    // Ayni tarif baska platformdan daha once eklenmisse ikinci kez ekleme
    if (!is.zorla) {
      const b = await benzerTarif({ title: t.draft.title, ingredients: t.draft.ingredients })
      if (b) {
        await g({ durum: 'bitti', mesaj: `Bu tarif zaten defterde (${b.neden}).`, recipeId: b.tarif.id!, baslik: b.tarif.title })
        return
      }
    }
    if (iptal.v) return // sure doldu: gec gelen sonuc eklenmez
    const id = await addRecipe(t.draft)
    await updateRecipe(id, { kontrol: t.not || 'Otomatik eklendi; kontrol et.' })
    const uyari = t.not.startsWith('⚠️')
    await g({ durum: 'bitti', mesaj: uyari ? t.not : 'Deftere eklendi.', recipeId: id, baslik: t.draft.title || is.baslik })
  } catch (e) {
    // Tarif degil de bir yeme-icme mekani paylasildiysa Mekanlarim'a kaydedilir
    if (e instanceof TarifYokHatasi) {
      try {
        if (iptal.v) return
        const sonuc = await mekanLinktenEkle(is.girdi, (m) => void g({ mesaj: m }), { parca: e.parca, kapak: e.kapak })
        const mk = await lzDb.mekanlar.get(sonuc.id)
        await g({
          durum: 'bitti',
          mesaj: sonuc.yeni ? '📍 Mekan olarak Mekanlarım’a kaydedildi.' : '📍 Bu mekan zaten kayıtlı.',
          recipeId: 0,
          mekanId: sonuc.id,
          baslik: mk?.ad ?? is.baslik
        })
        return
      } catch (e2) {
        await g({ durum: 'hata', mesaj: (e2 as Error).message || 'İşlenemedi.' })
        return
      }
    }
    await g({ durum: 'hata', mesaj: (e as Error).message || 'İşlenemedi.' })
  }
}

// Uygulama acilisinda: yarim kalan (isleniyor) isleri tekrar siraya al ve baslat
export async function siraBaslat(): Promise<void> {
  const yarim = await lzDb.sira.where('durum').equals('isleniyor').toArray()
  for (const x of yarim) await lzDb.sira.update(x.id!, { durum: 'bekliyor', mesaj: 'Sırada (yeniden)' })
  void siraIsle()
}

// zorla: "zaten defterde" denen linki yine de bastan cikar (yeni tarif olarak)
export async function siraTekrar(id: number, zorla = false): Promise<void> {
  await lzDb.sira.update(id, { durum: 'bekliyor', mesaj: 'Sırada', zorla, updatedAt: Date.now() })
  void siraIsle()
}

// Yanlislikla tarif olarak eklendiyse: (bu siradan eklenen) tarifi sil, mekan olarak yeniden isle
export async function mekanOlarakTekrar(id: number): Promise<void> {
  const x = await lzDb.sira.get(id)
  if (!x) return
  // Bu siranin ekledigi tarif silinir ("zaten defterde" denen eski tarife dokunulmaz)
  if (x.recipeId && !x.mesaj.startsWith('Bu tarif zaten')) await deleteRecipe(x.recipeId)
  await lzDb.sira.update(id, { tur: 'mekan', durum: 'bekliyor', mesaj: 'Sırada (mekan)', recipeId: 0, updatedAt: Date.now() })
  void siraIsle()
}
