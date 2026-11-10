// pdfmake 0.3 kendi tiplerini yayımlamıyor; kullandığımız kadarı
declare module 'pdfmake' {
  const pdfmake: {
    setFonts(fonts: Record<string, Record<'normal' | 'bold' | 'italics' | 'bolditalics', string>>): void
    createPdf(belge: Record<string, unknown>): { getBuffer(): Promise<Buffer> }
  }
  export default pdfmake
}
