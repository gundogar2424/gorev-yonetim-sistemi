package com.otoara.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BatteryAlert
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.EditCalendar
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.otoara.app.call.Phase
import com.otoara.app.call.RedialStatus
import com.otoara.app.data.AttemptResult

@Composable
fun HomeScreen(
    vm: RedialViewModel,
    status: RedialStatus,
    perms: PermState,
    onRequestPerms: () -> Unit,
    onBatteryExempt: () -> Unit,
    onOverlaySettings: () -> Unit,
    onPickContact: () -> Unit,
    onStart: () -> Unit,
    onStop: () -> Unit,
    onHistory: () -> Unit,
    onPlans: () -> Unit
) {
    var error by remember { mutableStateOf<String?>(null) }
    val targets by vm.targets.collectAsState()

    LaunchedEffect(vm.number) { error = null }

    Column(
        Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp)
            .padding(top = 16.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {

        // ---------------------------------------------------------- baslik
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "OTOMATİK\nARAMA",
                style = MaterialTheme.typography.displaySmall,
                fontWeight = FontWeight.Bold,
                lineHeight = 34.sp,
                modifier = Modifier.weight(1f)
            )
            IconButton(onClick = onPlans) {
                Icon(
                    Icons.Filled.EditCalendar,
                    contentDescription = "Planlı aramalar",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            IconButton(onClick = onHistory) {
                Icon(
                    Icons.Filled.History,
                    contentDescription = "Geçmiş",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // -------------------------------------------------------- calisiyor
        if (status.running) {
            RunningPanel(status)
        } else if (status.finishedReason != null) {
            FinishedPanel(status)
        }

        // ----------------------------------------------------------- izinler
        if (!perms.ready) {
            PermissionPanel(perms, onRequestPerms)
        }

        // ------------------------------------------------------ hedef numara
        Panel(title = "Hedef Numara") {
            Spacer(Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = vm.number,
                    onValueChange = { vm.updateNumber(it, "") },
                    singleLine = true,
                    enabled = !status.running,
                    placeholder = { Text("05xx xxx xx xx") },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    textStyle = MaterialTheme.typography.headlineSmall,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone)
                )
                Spacer(Modifier.width(8.dp))
                IconButton(
                    onClick = onPickContact,
                    enabled = !status.running,
                    modifier = Modifier.size(52.dp)
                ) {
                    Icon(
                        Icons.Filled.Person,
                        contentDescription = "Kişilerden seç",
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(30.dp)
                    )
                }
            }

            if (vm.label.isNotBlank()) {
                Text(
                    vm.label,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(top = 6.dp)
                )
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .padding(top = 6.dp)
                    .clickable(enabled = !status.running) { vm.updateExtensionOn(!vm.extensionOn) }
            ) {
                Checkbox(
                    checked = vm.extensionOn,
                    onCheckedChange = { vm.updateExtensionOn(it) },
                    enabled = !status.running
                )
                Text("Dahili Numara Ekle", style = MaterialTheme.typography.titleSmall)
            }

            if (vm.extensionOn) {
                OutlinedTextField(
                    value = vm.extension,
                    onValueChange = { vm.updateExtension(it) },
                    singleLine = true,
                    enabled = !status.running,
                    label = { Text("Dahili") },
                    supportingText = { Text("Bağlantı kurulunca tuşlanır (ör. 1023)") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone)
                )
            }

            if (targets.isNotEmpty() && !status.running) {
                Spacer(Modifier.height(10.dp))
                Text(
                    "Son aranan",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                targets.take(5).forEach { t ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { vm.updateNumber(t.number, t.label) }
                            .padding(vertical = 8.dp)
                    ) {
                        Icon(
                            Icons.Filled.Call,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(Modifier.width(10.dp))
                        Text(
                            if (t.label.isBlank()) t.number else "${t.label} — ${t.number}",
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.weight(1f)
                        )
                        TextButton(onClick = { vm.deleteTarget(t.number) }) { Text("Sil") }
                    }
                }
            }
        }

        // -------------------------------------------------- zamanlama ayarlari
        Panel(title = "Zamanlama Ayarları") {
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                NumberField(
                    "Aralık (sn)", vm.interval, vm::updateInterval,
                    Modifier.weight(1f), enabled = !status.running
                )
                NumberField(
                    "Tekrar Sayısı", vm.repeats, vm::updateRepeats,
                    Modifier.weight(1f), enabled = !status.running
                )
            }
            Spacer(Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                NumberField(
                    "Süre (dk)", vm.ringMin, vm::updateRingMin,
                    Modifier.weight(1f), enabled = !status.running
                )
                NumberField(
                    "Süre (sn)", vm.ringSec, vm::updateRingSec,
                    Modifier.weight(1f), enabled = !status.running
                )
            }
            Text(
                "Aralık: iki arama arasındaki bekleme. Süre: bir çağrının en fazla " +
                    "ne kadar çalacağı — dolunca kapatılıp yeniden aranır.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 12.dp)
            )
        }

        // ---------------------------------------------------------- secenekler
        Panel(title = "Seçenekler") {
            Spacer(Modifier.height(6.dp))
            SwitchRow(
                title = "Cevaplanınca dur",
                subtitle = if (perms.callLog) {
                    "Karşı taraf açtığında tekrar arama biter."
                } else {
                    "Arama kaydı izni verilmedi; süreye bakarak tahmin edilir."
                },
                checked = vm.stopWhenAnswered,
                enabled = !status.running,
                onChange = vm::updateStopWhenAnswered
            )
            SwitchRow(
                title = "Süre dolunca kapat",
                subtitle = if (perms.hangUp) {
                    "Çağrı süresi dolunca uygulama çağrıyı kapatır."
                } else {
                    "Bunun için \"Telefon çağrılarını yönet\" izni gerekir."
                },
                checked = vm.hangUpOnTimeout,
                enabled = !status.running,
                onChange = vm::updateHangUpOnTimeout
            )
            SwitchRow(
                title = "Hoparlörü aç",
                subtitle = "Çağrı kurulunca ses hoparlöre verilir. Bazı " +
                    "telefonlarda sistem buna izin vermeyebilir.",
                checked = vm.speaker,
                enabled = !status.running,
                onChange = vm::updateSpeaker
            )
        }

        // ------------------------------------------------------- pil uyarisi
        if (!perms.batteryFree && !status.running) {
            Panel {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Filled.BatteryAlert,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.secondary
                    )
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text("Pil optimizasyonu açık", style = MaterialTheme.typography.titleSmall)
                        Text(
                            "Ekran kapalıyken döngü durabilir. Muafiyet vermeniz önerilir.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    TextButton(onClick = onBatteryExempt) { Text("Ayarla") }
                }
            }
        }

        if (!perms.overlay && !status.running) {
            Panel {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Filled.Layers,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.secondary
                    )
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            "Diğer uygulamaların üzerinde göster",
                            style = MaterialTheme.typography.titleSmall
                        )
                        Text(
                            "Bazı telefonlarda arka planda arama başlatmak için gerekir.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    TextButton(onClick = onOverlaySettings) { Text("Ayarla") }
                }
            }
        }

        if (error != null) {
            Text(
                error!!,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center
            )
        }

        // ------------------------------------------------------------ dugme
        Spacer(Modifier.height(4.dp))
        if (status.running) {
            Button(
                onClick = onStop,
                modifier = Modifier.fillMaxWidth().height(62.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error,
                    contentColor = Color.White
                )
            ) {
                Icon(Icons.Filled.Stop, contentDescription = null)
                Spacer(Modifier.width(10.dp))
                Text("DURDUR", style = MaterialTheme.typography.titleMedium)
            }
        } else {
            Button(
                onClick = {
                    val problem = vm.validate()
                    if (problem != null) {
                        error = problem
                    } else if (!perms.ready) {
                        error = "Önce gerekli izinleri verin."
                        onRequestPerms()
                    } else {
                        error = null
                        onStart()
                    }
                },
                modifier = Modifier.fillMaxWidth().height(62.dp),
                shape = RoundedCornerShape(16.dp)
            ) {
                Icon(Icons.Filled.Call, contentDescription = null)
                Spacer(Modifier.width(10.dp))
                Text("ARAMAYI BAŞLAT", style = MaterialTheme.typography.titleMedium)
            }
        }
    }
}

@Composable
private fun SwitchRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    enabled: Boolean,
    onChange: (Boolean) -> Unit
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleSmall)
            Text(
                subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Spacer(Modifier.width(12.dp))
        Switch(checked = checked, onCheckedChange = onChange, enabled = enabled)
    }
}

@Composable
private fun RunningPanel(status: RedialStatus) {
    val phaseText = when (status.phase) {
        Phase.DIALING -> "Aranıyor…"
        Phase.IN_CALL -> "Görüşme sürüyor"
        Phase.WAITING -> "Sonraki arama bekleniyor"
        else -> "Hazırlanıyor…"
    }
    Panel {
        Row(verticalAlignment = Alignment.Bottom) {
            Text(
                "${status.tryNo}",
                style = MaterialTheme.typography.displayMedium,
                color = MaterialTheme.colorScheme.primary
            )
            Text(
                " / ${status.total}",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 6.dp)
            )
            Spacer(Modifier.weight(1f))
            if (status.secondsLeft > 0) {
                Text(
                    "${status.secondsLeft} sn",
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.secondary,
                    modifier = Modifier.padding(bottom = 6.dp)
                )
            }
        }
        Text(phaseText, style = MaterialTheme.typography.titleSmall)
        Text(
            status.number,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        status.lastResult?.let {
            Text(
                "Son deneme: ${AttemptResult.label(it)}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
        LinearProgressIndicator(
            progress = {
                if (status.total > 0) status.tryNo.toFloat() / status.total else 0f
            },
            modifier = Modifier.fillMaxWidth().padding(top = 14.dp)
        )
    }
}

@Composable
private fun FinishedPanel(status: RedialStatus) {
    val answered = status.lastResult == AttemptResult.ANSWERED
    Panel {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(10.dp)
                    .background(
                        if (answered) MaterialTheme.colorScheme.secondary
                        else MaterialTheme.colorScheme.onSurfaceVariant,
                        RoundedCornerShape(5.dp)
                    )
            )
            Spacer(Modifier.width(10.dp))
            Column {
                Text(
                    status.finishedReason ?: "Bitti",
                    style = MaterialTheme.typography.titleSmall
                )
                Text(
                    "${status.number} • ${status.tryNo} deneme",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun PermissionPanel(perms: PermState, onRequest: () -> Unit) {
    Panel {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                Icons.Filled.Lock,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.error
            )
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text("İzinler eksik", style = MaterialTheme.typography.titleSmall)
                val missing = buildList {
                    if (!perms.call) add("arama yapma")
                    if (!perms.phoneState) add("telefon durumu")
                }.joinToString(", ")
                Text(
                    "Uygulamanın çalışması için gerekli: $missing.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            TextButton(onClick = onRequest) { Text("İzin ver") }
        }
    }
}
