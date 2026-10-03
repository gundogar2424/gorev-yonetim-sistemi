// TARIF SIRASI: Instagram/TikTok'tan arka arkaya paylasilan linkler siraya
// girer ve TEK TEK islenir (yapay zeka istek siniri asilmasin, telefon
// yorulmasin). Her biri bitince tarif deftere kendiliginden kaydedilir ve
// ustune "kontrol et" notu dusulur. Sira veritabaninda durdugu icin uygulama
// kapansa da kaybolmaz; acilinca kaldigi yerden devam eder.
import { addRecipe, deleteRecipe, lzDb, updateRecipe } from '../db'
import type { LzDraft } from '../types'
import { linkAyikla, platformBul } from './importer'
import { ayniLinkliTarif, benzerTarif } from './kopya'
import { TarifYokHatasi } from './ai'
import { mekanLinktenEkle } from './mekan'
import { linktenTaslak, taslakHazirla, yapilandir } from './pipeline'

let calisiyor = false

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
export async function siraIsle(): Promise<void> {
  if (calisiyor) return
  calisiyor = true
  try {
    for (;;) {
      const is = (await lzDb.sira.where('durum').equals('bekliyor').sortBy('createdAt'))[0]
      if (!is) break
      const g = async (patch: Partial<typeof is>) => lzDb.sira.update(is.id!, { ...patch, updatedAt: Date.now() })
      await g({ durum: 'isleniyor', mesaj: 'Başlıyor…' })
      try {
        // Kullanici "Mekan" olarak paylastiysa tarif hic denenmez
        if (is.tur === 'mekan') {
          const sonuc = await mekanLinktenEkle(is.girdi, (m) => void g({ mesaj: m }))
          const mk = await lzDb.mekanlar.get(sonuc.id)
          await g({
            durum: 'bitti',
            mesaj: sonuc.yeni ? '📍 Mekanlarım’a kaydedildi.' : '📍 Bu mekan zaten kayıtlı.',
            recipeId: 0,
            mekanId: sonuc.id,
            baslik: mk?.ad ?? is.baslik
          })
          continue
        }
        const url = linkAyikla(is.girdi)
        // Bu link zaten defterdeyse tekrar ekleme
        if (url && !is.zorla) {
          const var_ = await ayniLinkliTarif(url)
          if (var_) {
            await g({ durum: 'bitti', mesaj: 'Bu tarif zaten defterde.', recipeId: var_.id!, baslik: var_.title })
            continue
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
            continue
          }
        }
        const id = await addRecipe(t.draft)
        await updateRecipe(id, { kontrol: t.not || 'Otomatik eklendi; kontrol et.' })
        const uyari = t.not.startsWith('⚠️')
        await g({ durum: 'bitti', mesaj: uyari ? t.not : 'Deftere eklendi.', recipeId: id, baslik: t.draft.title || is.baslik })
      } catch (e) {
        // Tarif degil de bir yeme-icme mekani paylasildiysa Mekanlarim'a kaydedilir
        if (e instanceof TarifYokHatasi) {
          try {
            const sonuc = await mekanLinktenEkle(is.girdi, (m) => void g({ mesaj: m }), { parca: e.parca, kapak: e.kapak })
            const mk = await lzDb.mekanlar.get(sonuc.id)
            await g({
              durum: 'bitti',
              mesaj: sonuc.yeni ? '📍 Mekan olarak Mekanlarım’a kaydedildi.' : '📍 Bu mekan zaten kayıtlı.',
              recipeId: 0,
              mekanId: sonuc.id,
              baslik: mk?.ad ?? is.baslik
            })
            continue
          } catch (e2) {
            await g({ durum: 'hata', mesaj: (e2 as Error).message || 'İşlenemedi.' })
            continue
          }
        }
        await g({ durum: 'hata', mesaj: (e as Error).message || 'İşlenemedi.' })
      }
    }
  } finally {
    calisiyor = false
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
