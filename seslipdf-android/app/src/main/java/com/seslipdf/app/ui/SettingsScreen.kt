package com.seslipdf.app.ui

import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.seslipdf.app.BuildConfig
import com.seslipdf.app.data.Prefs
import com.seslipdf.app.tts.VoiceInfo

/**
 * Ayarlar: ses secimi, hiz/ton, metin cikarma secenekleri ve kisa yardim.
 */
@Composable
fun SettingsScreen(vm: LibraryViewModel) {
    val context = LocalContext.current

    LaunchedEffect(Unit) { vm.loadVoices() }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("Ayarlar", style = MaterialTheme.typography.displaySmall)
        }

        item {
            Panel("Ses") {
                Spacer(Modifier.height(10.dp))
                VoicePicker(
                    voices = vm.voices,
                    loading = vm.voicesLoading,
                    selected = vm.voice,
                    language = vm.language,
                    onPick = { vm.updateVoice(it) }
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    "Türkçe ses görünmüyorsa telefon ayarlarından indirmeniz gerekir.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(10.dp))
                OutlinedButton(
                    onClick = {
                        try {
                            context.startActivity(
                                Intent("com.android.settings.TTS_SETTINGS")
                                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            )
                        } catch (e: Exception) {
                            // Bazi cihazlarda bu ekran yok.
                        }
                    }
                ) { Text("Telefonun metin okuma ayarları") }
            }
        }

        item {
            Panel("Okuma") {
                Spacer(Modifier.height(8.dp))
                SliderRow(
                    label = "Hız",
                    value = vm.rate,
                    range = Prefs.MIN_RATE..Prefs.MAX_RATE,
                    format = { "%.1f×".format(it) },
                    onChange = { vm.updateRate(it) }
                )
                SliderRow(
                    label = "Ses tonu",
                    value = vm.pitch,
                    range = Prefs.MIN_PITCH..Prefs.MAX_PITCH,
                    format = { "%.1f".format(it) },
                    onChange = { vm.updatePitch(it) }
                )
                SwitchRow(
                    title = "Okunan cümleyi takip et",
                    description = "Liste kendiliğinden kayar, okunan cümle ekranda kalır.",
                    checked = vm.autoScroll,
                    onChange = { vm.updateAutoScroll(it) }
                )
                if (vm.autoScroll) {
                    SliderRow(
                        label = "Akış",
                        value = vm.scrollSpeed,
                        range = 0f..1f,
                        format = { speed ->
                            when {
                                speed < 0.25f -> "çok yumuşak"
                                speed < 0.5f -> "yumuşak"
                                speed < 0.75f -> "orta"
                                speed < 0.95f -> "çabuk"
                                else -> "anında"
                            }
                        },
                        onChange = { vm.updateScrollSpeed(it) }
                    )
                    Text(
                        "Yazı, film jeneriği gibi durmadan yukarı akar. Bu ayar akışın " +
                            "ne kadar ağır ağır süzüleceğini belirler; akışın genel hızı " +
                            "sesin temposuna göre kendiliğinden ayarlanır.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        item {
            Panel("Ekran") {
                SwitchRow(
                    title = "Okurken ekran kararmasın",
                    description = "Açıkken okuma ekranı boyunca telefon ekranı kendiliğinden " +
                        "kapanmaz. Kapatırsan telefon her zamanki gibi uyur (uyku modu) — " +
                        "dinlerken ekranın kapanması pil için daha iyidir, okuma yine sürer.",
                    checked = vm.keepAwake,
                    onChange = { vm.updateKeepAwake(it) }
                )
            }
        }

        item {
            Panel("Metin çıkarma") {
                Spacer(Modifier.height(8.dp))
                SwitchRow(
                    title = "Taranmış sayfalarda OCR",
                    description = "Metin katmanı olmayan (fotoğraf/tarama) sayfalar " +
                        "görüntüden okunur. Daha yavaştır ama taranmış kitapları da açar.",
                    checked = vm.ocrFallback,
                    onChange = { vm.updateOcrFallback(it) }
                )
                SwitchRow(
                    title = "Sayfa başlık ve numaralarını atla",
                    description = "Her sayfada tekrar eden kitap adı ve sayfa numarası okunmaz.",
                    checked = vm.stripHeads,
                    onChange = { vm.updateStripHeads(it) }
                )
                Text(
                    "Bu ayarlar yeni eklenen belgeler için geçerlidir. Eklenmiş bir " +
                        "belgeye uygulamak için kitaplıktan \"Metni yeniden çıkar\" deyin.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        item {
            Panel("Hakkında") {
                Spacer(Modifier.height(8.dp))
                Text(
                    "Sürüm ${BuildConfig.VERSION_NAME}",
                    style = MaterialTheme.typography.titleSmall
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    "Sesli PDF, seçtiğiniz PDF'in metnini telefonun içinde çıkarır ve " +
                        "Android'in kendi seslendirme motoruyla okur. Belgeleriniz hiçbir " +
                        "sunucuya gönderilmez, internet gerekmez.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        item { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable
private fun SliderRow(
    label: String,
    value: Float,
    range: ClosedFloatingPointRange<Float>,
    format: (Float) -> String,
    onChange: (Float) -> Unit
) {
    var live by remember(value) { mutableStateOf(value) }
    Column(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(label, style = MaterialTheme.typography.titleSmall)
            Text(format(live), style = MaterialTheme.typography.labelLarge)
        }
        Slider(
            value = live,
            onValueChange = { live = it },
            onValueChangeFinished = { onChange(live) },
            valueRange = range
        )
    }
}

@Composable
private fun VoicePicker(
    voices: List<VoiceInfo>,
    loading: Boolean,
    selected: String,
    language: String,
    onPick: (VoiceInfo?) -> Unit
) {
    var open by remember { mutableStateOf(false) }
    val current = voices.firstOrNull { it.name == selected }

    Column(Modifier.fillMaxWidth()) {
        OutlinedButton(
            onClick = { open = true },
            modifier = Modifier.fillMaxWidth()
        ) {
            when {
                loading -> {
                    CircularProgressIndicator(
                        modifier = Modifier.height(18.dp),
                        strokeWidth = 2.dp
                    )
                    Spacer(Modifier.height(8.dp))
                    Text("  Sesler yükleniyor…")
                }
                current != null -> Text(current.label)
                else -> Text("Sistem varsayılanı ($language)")
            }
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(
                text = { Text("Sistem varsayılanı") },
                onClick = { open = false; onPick(null) }
            )
            voices.forEach { voice ->
                DropdownMenuItem(
                    text = {
                        Column {
                            Text(voice.label)
                            val notes = listOfNotNull(
                                voice.qualityLabel.takeIf { it.isNotBlank() },
                                "internet gerektirir".takeIf { voice.networkOnly }
                            )
                            if (notes.isNotEmpty()) {
                                Text(
                                    notes.joinToString(" · "),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    },
                    trailingIcon = {
                        if (voice.name == selected) {
                            Icon(Icons.Filled.Check, contentDescription = null)
                        }
                    },
                    onClick = { open = false; onPick(voice) }
                )
            }
            if (voices.isEmpty() && !loading) {
                DropdownMenuItem(
                    text = { Text("Ses bulunamadı") },
                    onClick = { open = false }
                )
            }
        }
    }
}
