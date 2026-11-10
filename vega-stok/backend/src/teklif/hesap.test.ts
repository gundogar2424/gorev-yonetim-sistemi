import assert from 'node:assert/strict'
import { test } from 'node:test'
import { iskontoCoz, teklifHesapla } from '../../../ortak/teklif-hesap'

test('iskonto metni çözülür', () => {
  assert.deepEqual(iskontoCoz(''), [])
  assert.deepEqual(iskontoCoz('10+5'), [10, 5])
  assert.deepEqual(iskontoCoz(' %10 + 7,5 '), [10, 7.5])
  assert.equal(iskontoCoz('10+abc'), null)
  assert.equal(iskontoCoz('120'), null)
  assert.equal(iskontoCoz('10++5'), null)
})

test('kademeli iskonto toplanmaz, sırayla uygulanır', () => {
  // 10 × 100 = 1000; %10 → 900; %5 → 855; KDV %20 → 171
  const s = teklifHesapla([{ miktar: 10, birimFiyat: 100, iskonto: '10+5', kdv: 20 }], '', false)
  assert.deepEqual(s.kalemler[0], { brut: 1000, net: 855 })
  assert.equal(s.araToplam, 1000)
  assert.equal(s.iskontoToplam, 145)
  assert.equal(s.matrah, 855)
  assert.equal(s.kdvToplam, 171)
  assert.equal(s.genelToplam, 1026)
})

test('genel iskonto ve farklı KDV oranları', () => {
  const s = teklifHesapla(
    [
      { miktar: 2, birimFiyat: 50, iskonto: '', kdv: 20 }, // 100
      { miktar: 1, birimFiyat: 200, iskonto: '50', kdv: 10 }, // 100
    ],
    '10',
    false,
  )
  assert.equal(s.matrah, 180)
  assert.deepEqual(s.kdvler, [{ oran: 10, tutar: 9 }, { oran: 20, tutar: 18 }])
  assert.equal(s.genelToplam, 207)
  assert.equal(s.iskontoToplam, 120)
})

test('KDV dahil fiyatlarda genel toplam fiyatın kendisidir', () => {
  const s = teklifHesapla([{ miktar: 1, birimFiyat: 120, iskonto: '', kdv: 20 }], '', true)
  assert.equal(s.matrah, 100)
  assert.equal(s.kdvToplam, 20)
  assert.equal(s.genelToplam, 120)
})

test('kuruş yuvarlaması: matrah + KDV = genel toplam', () => {
  const s = teklifHesapla([{ miktar: 3, birimFiyat: 0.45, iskonto: '7,5', kdv: 20 }, { miktar: 7, birimFiyat: 6.9, iskonto: '12+3', kdv: 20 }], '2', false)
  assert.equal(Math.round((s.matrah + s.kdvToplam) * 100), Math.round(s.genelToplam * 100))
  assert.equal(Math.round((s.araToplam - s.iskontoToplam) * 100), Math.round(s.matrah * 100))
})
