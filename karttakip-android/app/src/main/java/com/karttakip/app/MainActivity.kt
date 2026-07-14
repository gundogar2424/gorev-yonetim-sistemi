package com.karttakip.app

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.karttakip.app.notif.NotificationScheduler
import com.karttakip.app.ui.CardFormScreen
import com.karttakip.app.ui.CardListScreen
import com.karttakip.app.ui.theme.KartTakipTheme

class MainActivity : ComponentActivity() {

    private val requestNotifPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) {
            NotificationScheduler.scheduleAll(this)
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Android 13+ bildirim izni iste
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestNotifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            NotificationScheduler.scheduleAll(this)
        }

        // Bildirimlerin dakikasinda gelmesi icin pil optimizasyonundan muafiyet iste.
        requestBatteryExemption()

        setContent {
            KartTakipTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val nav = rememberNavController()
                    NavHost(navController = nav, startDestination = "list") {
                        composable("list") {
                            CardListScreen(
                                onAdd = { nav.navigate("form/0") },
                                onEdit = { id -> nav.navigate("form/$id") }
                            )
                        }
                        composable("form/{id}") { backStack ->
                            val id = backStack.arguments?.getString("id")?.toLongOrNull() ?: 0L
                            CardFormScreen(
                                cardId = id,
                                onBack = { nav.popBackStack() }
                            )
                        }
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Uygulama her acildiginda alarmlari tazele (saat/gun degismis olabilir).
        NotificationScheduler.scheduleAll(this)
    }

    /**
     * Pil optimizasyonundan muafiyet ister. Samsung/One UI arka plandaki
     * uygulamalari agresif oldurdugu icin, bu izin olmadan tam-zamanli alarmlar
     * gecikebilir. Zaten muafsa hicbir sey yapmaz (tekrar sormaz).
     */
    private fun requestBatteryExemption() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
        val pm = getSystemService(PowerManager::class.java) ?: return
        if (pm.isIgnoringBatteryOptimizations(packageName)) return
        try {
            startActivity(
                Intent(
                    Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    Uri.parse("package:$packageName")
                )
            )
        } catch (e: Exception) {
            // Bazi cihazlarda bu ekran yok; sessizce gec.
        }
    }
}
