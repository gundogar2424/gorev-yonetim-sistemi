package com.seslipdf.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.core.content.IntentCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.seslipdf.app.tts.ReaderService
import com.seslipdf.app.tts.ReaderState
import com.seslipdf.app.ui.BottomBar
import com.seslipdf.app.ui.LibraryScreen
import com.seslipdf.app.ui.LibraryViewModel
import com.seslipdf.app.ui.ReaderScreen
import com.seslipdf.app.ui.Section
import com.seslipdf.app.ui.SettingsScreen
import com.seslipdf.app.ui.theme.SesliPdfTheme

class MainActivity : ComponentActivity() {

    private val vm: LibraryViewModel by viewModels()

    /** Hazir olunca acilacak belge (yeni eklenen ya da bildirimden gelen). */
    private var pendingOpen by mutableStateOf(0L)

    /** Sistem dosya seciciden PDF secme. */
    private val pickPdf =
        registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
            uri?.let { addUri(it) }
        }

    private val askNotifications =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        requestNotificationPermission()
        handleIntent(intent)

        setContent {
            SesliPdfTheme {
                Surface(
                    modifier = Modifier.fillMaxSize().safeDrawingPadding(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val nav = rememberNavController()
                    val docs by vm.docs.collectAsStateWithLifecycle()
                    val status by ReaderState.status.collectAsStateWithLifecycle()

                    // Yeni eklenen belge hazir olur olmaz okuma ekranina gecilir.
                    LaunchedEffect(docs, pendingOpen) {
                        val id = pendingOpen
                        if (id == 0L) return@LaunchedEffect
                        val doc = docs.firstOrNull { it.id == id } ?: return@LaunchedEffect
                        if (doc.ready) {
                            pendingOpen = 0L
                            openDoc(id, nav)
                        }
                    }

                    // "Ekran açık kalsın" ayari yalnizca okuma surerken islesin.
                    val keepAwake = vm.keepAwake && status.playing
                    DisposableEffect(keepAwake) {
                        if (keepAwake) {
                            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                        } else {
                            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                        }
                        onDispose {
                            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                        }
                    }

                    Scaffold(
                        containerColor = MaterialTheme.colorScheme.background,
                        bottomBar = { BottomBar(nav) }
                    ) { inner ->
                        NavHost(
                            navController = nav,
                            startDestination = Section.LIBRARY.route,
                            modifier = Modifier.padding(inner)
                        ) {
                            composable(Section.LIBRARY.route) {
                                LibraryScreen(
                                    vm = vm,
                                    onPickPdf = { openPicker() },
                                    onOpen = { doc -> openDoc(doc.id, nav) }
                                )
                            }
                            composable(Section.READER.route) {
                                ReaderScreen(
                                    vm = vm,
                                    onGoLibrary = { nav.navigate(Section.LIBRARY.route) }
                                )
                            }
                            composable(Section.SETTINGS.route) {
                                SettingsScreen(vm = vm)
                            }
                        }
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    /** Okumayi baslatir ve okuma sekmesine gecer. */
    private fun openDoc(docId: Long, nav: NavHostController) {
        ReaderService.open(this, docId, autoPlay = true)
        nav.navigate(Section.READER.route) {
            popUpTo(Section.LIBRARY.route) { saveState = true }
            launchSingleTop = true
        }
    }

    private fun openPicker() {
        try {
            pickPdf.launch(arrayOf("application/pdf"))
        } catch (e: Exception) {
            // Dosya secici yoksa (cok nadir) sessizce gec.
        }
    }

    /**
     * Baska uygulamadan gelen ("PDF ile ac" / "Paylas") ya da secilen dosyayi
     * kutuphaneye ekler. Mumkunse kalici okuma izni alinir; boylece belge
     * sonradan yeniden islenebilir.
     */
    private fun addUri(uri: Uri) {
        try {
            contentResolver.takePersistableUriPermission(
                uri, Intent.FLAG_GRANT_READ_URI_PERMISSION
            )
        } catch (e: Exception) {
            // Kalici izin verilmeyen adresler de calisir: metin zaten hemen cikarilir.
        }
        vm.addPdf(uri) { id -> pendingOpen = id }
    }

    private fun handleIntent(intent: Intent?) {
        intent ?: return

        val fromNotification = intent.getLongExtra(EXTRA_OPEN_DOC, 0L)
        if (fromNotification > 0L) {
            pendingOpen = fromNotification
            intent.removeExtra(EXTRA_OPEN_DOC)
            return
        }

        val uri = when (intent.action) {
            Intent.ACTION_VIEW -> intent.data
            Intent.ACTION_SEND ->
                IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java)
            else -> null
        } ?: return

        intent.action = null
        intent.data = null
        addUri(uri)
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        val granted = ContextCompat.checkSelfPermission(
            this, Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
        if (!granted) askNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    companion object {
        /** Bildirimden acilirken hangi belgenin gosterilecegi. */
        const val EXTRA_OPEN_DOC = "openDoc"
    }
}
