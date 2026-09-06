package com.seslipdf.app

import android.app.Application
import com.seslipdf.app.tts.ReaderService
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader

class SesliPdfApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // PDFBox'in font/kaynak dosyalarini Android'de bulabilmesi icin gerekli.
        PDFBoxResourceLoader.init(applicationContext)
        ReaderService.ensureChannel(this)
    }
}
