// Ortak ses baglami (Web Audio). Android WebView, kullanici dokunmadan ses
// baslatmaya izin vermez ve baglam 'suspended' kalir; bu yuzden ilk dokunusta
// baglam olusturulup calistirilir ("kilit acma"), sonra her yerden kullanilir.
let ctx: AudioContext | null = null
let unlocked = false

export function audioCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

export function unlockAudio(): void {
  try {
    const c = audioCtx()
    if (!c) return
    void c.resume()
    const b = c.createBuffer(1, 1, 22050)
    const s = c.createBufferSource()
    s.buffer = b
    s.connect(c.destination)
    s.start(0)
    unlocked = true
  } catch {
    /* yok say */
  }
}

export function installAudioUnlock(): void {
  const h = () => {
    unlockAudio()
    if (unlocked) {
      window.removeEventListener('touchstart', h, true)
      window.removeEventListener('touchend', h, true)
      window.removeEventListener('pointerdown', h, true)
      window.removeEventListener('click', h, true)
      window.removeEventListener('keydown', h, true)
    }
  }
  window.addEventListener('touchstart', h, true)
  window.addEventListener('touchend', h, true)
  window.addEventListener('pointerdown', h, true)
  window.addEventListener('click', h, true)
  window.addEventListener('keydown', h, true)
}
