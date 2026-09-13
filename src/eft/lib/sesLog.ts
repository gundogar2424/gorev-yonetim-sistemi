// Ses gunlugu: her ses girisiminin hangi adimda ne yaptigi (teshis icin).
// Ayarlar / Ses testi ekraninda gosterilir ve kopyalanabilir.
const MAX = 80
const lines: string[] = []

function ts(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

export function sesLog(msg: string): void {
  lines.push(`${ts()} ${msg}`)
  if (lines.length > MAX) lines.splice(0, lines.length - MAX)
}

export function getSesLog(): string[] {
  return lines.slice()
}

export function clearSesLog(): void {
  lines.length = 0
}
