// Stok Takip — veri tipleri (CRM ve Diyet Koçu'ndan tamamen ayrı)

// Bir ürün/aksesuar kaydı. "Elimde ne var, kaç tane var" sorusunun cevabı.
export interface Product {
  id?: number
  name: string // Ürün adı (zorunlu)
  company?: string // Hangi firmanın ürünü (marka/tedarikçi)
  category?: string // Kategori (örn. Kılıf, Şarj, Kablo)
  code?: string // Ürün/stok kodu ya da barkod
  qty: number // Eldeki adet
  unit?: string // Birim (adet, kutu, paket…) — boşsa "adet"
  buyPrice?: number // Alış fiyatı (₺) — opsiyonel
  salePrice?: number // Satış fiyatı (₺) — opsiyonel
  lowStock?: number // Kritik stok eşiği; altına düşünce uyarı (opsiyonel)
  note?: string // Serbest not
  photo?: string // Ürün fotoğrafı (küçültülmüş data URL)
  createdAt: number
  updatedAt: number
}

// Stok hareketi: giriş (alım) / çıkış (satış) / düzeltme. Geçmiş için.
export interface StockMove {
  id?: number
  productId: number
  delta: number // +giriş / -çıkış
  reason: 'giris' | 'cikis' | 'duzeltme'
  note?: string
  createdAt: number
}

// Uygulama ayarları (yalnızca cihazda saklanır)
export interface StokSettings {
  id?: number
  apiKey?: string // Anthropic API anahtarı (cihazda kalır; içe aktarma için)
  model?: string // Kullanılacak model (varsayılan: claude-opus-4-8)
  shopName?: string // İşletme adı (başlıkta gösterilir)
  currency?: string // Para birimi simgesi (varsayılan ₺)
}

// AI'ın PDF/görsel/metinden çıkardığı tek ürün (içe aktarma önizlemesi)
export interface ExtractedProduct {
  name: string
  company?: string
  category?: string
  code?: string
  salePrice?: number
  buyPrice?: number
}
