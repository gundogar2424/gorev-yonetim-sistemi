package com.karttakip.app

import android.Manifest
import android.os.Build
import android.os.Bundle
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
}
