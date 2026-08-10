// HATA METNI. Amac: ekran goruntusunden teshis edilebilir hata mesaji.
//
// Neden gerekti: "Maximum call stack size exceeded" gibi hatalar kullaniciya
// ham İngilizce tek satir olarak gosteriliyordu. Nereden geldigi hicbir yerde
// yazmiyordu; ne kullanici ne de ben ekran goruntusune bakip kaynagi
// bulabiliyorduk. Uretim derlemesi kucultuldugu icin yigin izindeki fonksiyon
// adlari da okunmaz (xR, Ay gibi) — bu yuzden asil ise yarayan sey, cagrinin
// HANGI ADIMDA patladigini kodun kendisinin soylemesidir (`step`).
export function describeError(err: unknown, step?: string): string {
  if (!(err instanceof Error)) return step ? `Bir hata oluştu (${step}).` : 'Bir hata oluştu.'

  const head = err.name && err.name !== 'Error' ? `${err.name}: ${err.message}` : err.message

  // Yiginin ilk iki satiri: kucultulmus de olsa dosya/satir bilgisi kalir.
  //
  // DIKKAT: `stack` MESAJLA BASLAR. Mesaj cok satirliysa (bizim uzun Turkce
  // hata metinlerimiz gibi) `slice(1)` yalnizca ilk satiri atar; geri kalan
  // mesaj satirlari "Konum:" altinda TEKRAR gosteriliyordu. Gercek yigin
  // satirlari "at " ile basladigi icin yalnizca onlari aliyoruz.
  const frames = (err.stack || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('at '))
    .slice(0, 2)
    .join('  ←  ')

  return [head, step ? `Adım: ${step}` : '', frames ? `Konum: ${frames}` : '']
    .filter(Boolean)
    .join('\n')
}
