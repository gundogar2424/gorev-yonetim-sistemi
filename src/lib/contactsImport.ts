// Telefon rehberinden kisi okuma (yalnizca APK/native).
// Web tarayicida calismaz; o durumda isContactsAvailable() false doner.
import { Capacitor } from '@capacitor/core'
import { cleanPhone } from './importPaste'

export interface PhoneContact {
  id: string
  name: string
  phone: string
}

// Rehber ozelligi yalnizca gercek uygulamada (APK) vardir
export function isContactsAvailable(): boolean {
  return Capacitor.isNativePlatform()
}

// Rehberdeki kisileri (isim + ilk telefon) getirir
export async function fetchPhoneContacts(): Promise<PhoneContact[]> {
  const { Contacts } = await import('@capacitor-community/contacts')

  const perm = await Contacts.requestPermissions()
  if (perm.contacts !== 'granted') {
    throw new Error('Rehber izni verilmedi. Uygulama ayarlarindan Kisiler iznini acin.')
  }

  const res = await Contacts.getContacts({
    projection: { name: true, phones: true }
  })

  const seen = new Set<string>()
  const out: PhoneContact[] = []
  for (const c of res.contacts) {
    const phones = c.phones ?? []
    if (phones.length === 0) continue
    const rawNumber = phones.find((p) => p.number)?.number
    if (!rawNumber) continue
    const phone = cleanPhone(rawNumber)
    if (!phone || seen.has(phone)) continue // ayni numarayi tekrar ekleme
    seen.add(phone)
    const name = (c.name?.display ?? '').trim()
    out.push({ id: c.contactId, name: name || rawNumber, phone })
  }

  return out.sort((a, b) => a.name.localeCompare(b.name, 'tr'))
}
