import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { GirdiHatasi } from '../girdi'
import {
  cikisYap, girisYap, kullaniciEkle, kullaniciGuncelle, kullaniciSayisi, kullanicilar, OTURUM_SURESI_SN, oturumKullanicisi, sifreDegistir,
  type Kullanici, type Rol,
} from './db'

declare module 'fastify' {
  interface FastifyRequest {
    /** Giriş yapmış kullanıcı (korumalı tüm uçlarda dolu) */
    kullanici: Kullanici | null
  }
}

const CEREZ = 'oturum'

function cerezOku(istek: FastifyRequest): string | undefined {
  for (const parca of (istek.headers.cookie ?? '').split(';')) {
    const [ad, ...deger] = parca.trim().split('=')
    if (ad === CEREZ) return deger.join('=')
  }
}

// HttpOnly: sayfadaki betikler anahtarı okuyamaz. SameSite=Lax: başka sitelerden gelen istekler oturumu kullanamaz.
const cerezYaz = (yanit: FastifyReply, anahtar: string, omurSn: number) =>
  yanit.header('Set-Cookie', `${CEREZ}=${anahtar}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${omurSn}`)

/**
 * Yetki tablosu: adres önekine göre gereken roller. Listede olmayan her
 * /api, /gorseller ve /logo adresi için giriş yapmış olmak yeterlidir.
 */
const SATIS: Rol[] = ['yonetici', 'satis']
const YONETICI: Rol[] = ['yonetici']
function gerekenRoller(yontem: string, yol: string): Rol[] | null {
  if (yol.startsWith('/api/kullanicilar')) return YONETICI
  if (yol.startsWith('/api/ayarlar')) return yontem === 'GET' ? SATIS : YONETICI
  if (yol.startsWith('/api/teklifler') || yol.startsWith('/api/musteriler')) return SATIS
  return null
}

// Giriş gerektirmeyen adresler (giriş ekranının kendisi ve izleme)
const ACIK = new Set(['/api/oturum', '/api/kurulum', '/api/saglik'])

export function kimlikKur(app: FastifyInstance) {
  app.decorateRequest('kullanici', null)

  app.addHook('onRequest', async (istek, yanit) => {
    const yol = istek.url.split('?')[0]!
    if (!/^\/(api|gorseller|logo)(\/|$)/.test(yol)) return // arayüz dosyaları herkese açık
    istek.kullanici = oturumKullanicisi(cerezOku(istek))
    if (ACIK.has(yol)) return
    if (!istek.kullanici) return yanit.code(401).send({ hata: 'Giriş yapmanız gerekiyor' })
    const roller = gerekenRoller(istek.method, yol)
    if (roller && !roller.includes(istek.kullanici.rol)) return yanit.code(403).send({ hata: 'Bu işlem için yetkiniz yok' })
  })

  // Giriş durumu: arayüz açılırken sorar
  app.get('/api/oturum', (istek) => ({ kullanici: istek.kullanici, kurulumGerekli: kullaniciSayisi() === 0 }))

  app.post('/api/oturum', (istek, yanit) => {
    const { anahtar, kullanici } = girisYap(istek.body)
    cerezYaz(yanit, anahtar, OTURUM_SURESI_SN)
    return { kullanici }
  })

  app.delete('/api/oturum', (istek, yanit) => {
    cikisYap(cerezOku(istek))
    cerezYaz(yanit, '', 0)
    return { tamam: true }
  })

  app.put('/api/oturum/sifre', (istek, yanit) => {
    if (!istek.kullanici) return yanit.code(401).send({ hata: 'Giriş yapmanız gerekiyor' })
    sifreDegistir(istek.kullanici.id, cerezOku(istek)!, istek.body)
    return { tamam: true }
  })

  // İlk kurulum: yalnızca hiç kullanıcı yokken çalışır ve ilk yöneticiyi oluşturur
  app.post('/api/kurulum', (istek, yanit) => {
    if (kullaniciSayisi() > 0) return yanit.code(403).send({ hata: 'Kurulum zaten yapılmış' })
    kullaniciEkle({ ...(istek.body as object), rol: 'yonetici' })
    const { anahtar, kullanici } = girisYap(istek.body)
    cerezYaz(yanit, anahtar, OTURUM_SURESI_SN)
    return { kullanici }
  })

  // --- Kullanıcı yönetimi (yalnızca yönetici) ---
  app.get('/api/kullanicilar', () => kullanicilar())
  app.post('/api/kullanicilar', (istek) => ({ id: kullaniciEkle(istek.body) }))
  app.put<{ Params: { id: string } }>('/api/kullanicilar/:id', (istek, yanit) => {
    const id = Number(istek.params.id)
    const g = (istek.body ?? {}) as { rol?: unknown; aktif?: unknown }
    if (id === istek.kullanici!.id && (g.rol !== 'yonetici' || g.aktif === false)) throw new GirdiHatasi('Kendi yönetici yetkinizi kaldıramazsınız')
    return kullaniciGuncelle(id, istek.body) ? { tamam: true } : yanit.code(404).send({ hata: 'Kullanıcı bulunamadı' })
  })
}
