// Oto Ara — native Android (Kotlin + Jetpack Compose) projesi.
// Bu klasor, depodaki diger uygulamalardan (Saha CRM, Diyet Kocu, Kart Takip)
// TAMAMEN AYRIDIR; hicbir dosyalarini paylasmaz.
plugins {
    id("com.android.application") version "8.6.1" apply false
    id("org.jetbrains.kotlin.android") version "2.0.20" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.20" apply false
    id("com.google.devtools.ksp") version "2.0.20-1.0.25" apply false
}
