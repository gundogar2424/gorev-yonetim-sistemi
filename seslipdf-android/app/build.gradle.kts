plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.devtools.ksp")
}

// CI'da APP_BUILD ortam degiskeniyle her derlemede artan surum numarasi gelir;
// yerelde yoksa 1 kullanilir (guncellemeler ust uste kurulabilsin diye).
val appBuild = (System.getenv("APP_BUILD") ?: "1").toIntOrNull() ?: 1

android {
    namespace = "com.seslipdf.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.seslipdf.app"
        minSdk = 26
        targetSdk = 34
        versionCode = appBuild
        versionName = "1.0.$appBuild"
        vectorDrawables { useSupportLibrary = true }
    }

    // Sabit imza: her derlemede AYNI anahtar kullanilir; boylece guncellemeler
    // eski surumun ustune sorunsuz kurulur.
    signingConfigs {
        getByName("debug") {
            storeFile = file("debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures {
        compose = true
        // Ayarlar ekraninda surum numarasi gosterilebilsin.
        buildConfig = true
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
            // PDFBox kendi lisans/servis dosyalarini getiriyor; cakismasinlar.
            excludes += "/META-INF/DEPENDENCIES"
            excludes += "/META-INF/LICENSE*"
            excludes += "/META-INF/NOTICE*"
        }
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.09.03")
    implementation(composeBom)

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-compose:1.9.2")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.6")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.6")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.6")

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.navigation:navigation-compose:2.8.0")

    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    // PDF'in metin katmanini cikaran kutuphane (tamamen cihaz icinde calisir).
    implementation("com.tom-roush:pdfbox-android:2.0.27.0")

    // Taranmis (resim) PDF'ler icin cihaz ici OCR — internet gerektirmez.
    implementation("com.google.mlkit:text-recognition:16.0.1")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
