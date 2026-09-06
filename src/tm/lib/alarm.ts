// SURE BITTI ALARMI.
//
// Sorun: uygulama icindeki bip yalnizca ekran acikken ve uygulama ondeyken
// calisir. Mutfakta telefonu birakip isine bakinca sure dolduguu duyulmaz.
// Cozum: sure baslarken isletim sistemine ZAMANLI BILDIRIM kurulur; ekran
// kapali olsa da, baska uygulamadayken de calar (cihazin kendi alarmi gibi).
//
// Web'de (tarayicida) sessizce atlanir; orada yalnizca uygulama ici bip calisir.
const CHANNEL_ID = 'tm-alarm'
const ALARM_ID = 9101 // Tek bir sayac var; ayni kimlik surekli yeniden kullanilir

async function native(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core')
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

async function eklenti() {
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  return LocalNotifications
}

// Bildirim kanali: ses + titresim, ekranin ustunde belirsin (importance 5).
async function kanaliKur(): Promise<void> {
  try {
    const LN = await eklenti()
    await LN.createChannel({
      id: CHANNEL_ID,
      name: 'Pişirme sayacı',
      description: 'Adımın süresi dolunca çalan alarm',
      importance: 5,
      visibility: 1,
      vibration: true
    })
  } catch {
    /* kanal zaten var ya da desteklenmiyor */
  }
}

// Izin iste. Android 12+'da "tam zamanli alarm" izni yoksa bildirim gecikebilir;
// eklenti destekliyorsa kullaniciyi o ayara yonlendirir.
export async function alarmIzniAl(): Promise<boolean> {
  if (!(await native())) return false
  try {
    const LN = await eklenti()
    const izin = await LN.requestPermissions()
    await kanaliKur()
    const api = LN as unknown as {
      checkExactNotificationSetting?: () => Promise<{ exact_alarm: string }>
      changeExactNotificationSetting?: () => Promise<{ exact_alarm: string }>
    }
    if (api.checkExactNotificationSetting && api.changeExactNotificationSetting) {
      const cur = await api.checkExactNotificationSetting()
      if (cur.exact_alarm !== 'granted') await api.changeExactNotificationSetting()
    }
    return izin.display === 'granted'
  } catch {
    return false
  }
}

// Sayaci baslatirken cagrilir: saniye sonra calacak bildirimi kurar.
export async function alarmKur(saniye: number, baslik: string, govde: string): Promise<void> {
  if (saniye <= 0 || !(await native())) return
  try {
    const LN = await eklenti()
    await kanaliKur()
    await LN.cancel({ notifications: [{ id: ALARM_ID }] }).catch(() => {})
    await LN.schedule({
      notifications: [
        {
          id: ALARM_ID,
          channelId: CHANNEL_ID,
          title: baslik,
          body: govde,
          // allowWhileIdle: telefon uyku modundayken de zamaninda calsin
          schedule: { at: new Date(Date.now() + saniye * 1000), allowWhileIdle: true },
          ongoing: false
        }
      ]
    })
  } catch {
    /* izin yok / eklenti yok — uygulama ici bip yine calisir */
  }
}

// Duraklatinca, sifirlayinca, adim degisince ve ekrandan cikarken cagrilir.
export async function alarmIptal(): Promise<void> {
  if (!(await native())) return
  try {
    const LN = await eklenti()
    await LN.cancel({ notifications: [{ id: ALARM_ID }] })
  } catch {
    /* zaten yok */
  }
}
