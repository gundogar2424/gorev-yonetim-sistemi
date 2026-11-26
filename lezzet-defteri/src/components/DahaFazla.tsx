// MESAFE: Harita ve Mekanlarim ayni dugmeyi kullanir. 1 km ile baslar; her dokunusta 3, 5, 10 km.
export const MESAFE_KM = [1, 3, 5, 10]

export function sonrakiKm(km: number): number | undefined {
  const i = MESAFE_KM.indexOf(km)
  return i >= 0 ? MESAFE_KM[i + 1] : undefined
}

export function DahaFazlaGoster({ simdiKm, buyut, kapali = false }: { simdiKm: number; buyut: (km: number) => void; kapali?: boolean }) {
  const s = sonrakiKm(simdiKm)
  if (!s) return null
  return (
    <button className="lz-btn-soft w-full text-[14px]" disabled={kapali} onClick={() => buyut(s)}>
      Daha fazla göster ({s} km)
    </button>
  )
}
