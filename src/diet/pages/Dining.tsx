import { useLiveQuery } from 'dexie-react-hooks'
import DietHeader from '../DietHeader'
import { readDietSettings } from '../db'
import { RestaurantMenu } from './Capture'

// "Dışarıda / Restoran": menü fotoğraf(lar)ını veya kare kodu (QR) yükle,
// yapay zeka diyetine uygununu önersin. Ana sayfada değil; burada.
export default function Dining() {
  const settings = useLiveQuery(() => readDietSettings(), [], undefined)
  return (
    <div>
      <DietHeader title="Dışarıda / Restoran" subtitle="Menüyü yükle, diyetine uygununu bul" />
      <div className="p-3">
        <RestaurantMenu settings={settings} />
      </div>
    </div>
  )
}
