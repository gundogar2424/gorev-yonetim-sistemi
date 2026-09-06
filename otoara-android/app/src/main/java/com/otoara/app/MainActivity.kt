package com.otoara.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.ContactsContract
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.otoara.app.call.RedialService
import com.otoara.app.call.RedialState
import com.otoara.app.ui.HistoryScreen
import com.otoara.app.ui.HomeScreen
import com.otoara.app.ui.PermState
import com.otoara.app.ui.RedialViewModel
import com.otoara.app.ui.theme.OtoAraTheme

class MainActivity : ComponentActivity() {

    private val vm: RedialViewModel by viewModels()

    /** Ekranda gosterilen izin durumu; her donuste tazelenir. */
    private var perms by mutableStateOf(PermState())

    private val askPermissions =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
            perms = PermState.read(this)
        }

    /** Rehberden numara secme (READ_CONTACTS izni gerektirmez). */
    private val pickContact =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == Activity.RESULT_OK) {
                result.data?.data?.let { readContact(it) }
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        perms = PermState.read(this)

        setContent {
            OtoAraTheme {
                Surface(
                    modifier = Modifier.fillMaxSize().safeDrawingPadding(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val status by RedialState.status.collectAsStateWithLifecycle()
                    val nav = rememberNavController()

                    NavHost(navController = nav, startDestination = "home") {
                        composable("home") {
                            HomeScreen(
                                vm = vm,
                                status = status,
                                perms = perms,
                                onRequestPerms = { askPermissions.launch(PermState.requestList()) },
                                onBatteryExempt = { requestBatteryExemption() },
                                onOverlaySettings = { openOverlaySettings() },
                                onPickContact = { openContactPicker() },
                                onStart = {
                                    vm.rememberTarget()
                                    RedialService.start(this@MainActivity, vm.config(), vm.label)
                                },
                                onStop = { RedialService.stop(this@MainActivity) },
                                onHistory = { nav.navigate("history") }
                            )
                        }
                        composable("history") {
                            HistoryScreen(vm = vm, onBack = { nav.popBackStack() })
                        }
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        perms = PermState.read(this)
    }

    /** "Diğer uygulamaların üzerinde göster" ayar ekranini acar. */
    private fun openOverlaySettings() {
        if (Settings.canDrawOverlays(this)) return
        try {
            startActivity(
                Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:$packageName")
                )
            )
        } catch (e: Exception) {
            // Bazi cihazlarda bu ekran yok; sessizce gec.
        }
    }

    private fun openContactPicker() {
        try {
            pickContact.launch(
                Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI)
            )
        } catch (e: Exception) {
            // Rehber uygulamasi yoksa sessizce gec; numara elle yazilabilir.
        }
    }

    private fun readContact(uri: Uri) {
        try {
            contentResolver.query(
                uri,
                arrayOf(
                    ContactsContract.CommonDataKinds.Phone.NUMBER,
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME
                ),
                null, null, null
            )?.use { c ->
                if (c.moveToFirst()) {
                    val raw = c.getString(0) ?: return
                    val name = c.getString(1).orEmpty()
                    vm.updateNumber(raw.filter { it.isDigit() || it == '+' }, name)
                }
            }
        } catch (e: Exception) {
            // Okunamadi; kullanici numarayi elle girebilir.
        }
    }

    /**
     * Pil optimizasyonundan muafiyet ister. Bu olmadan bazi cihazlar ekran
     * kapaliyken arka plandaki dongüyu durdurabiliyor.
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
