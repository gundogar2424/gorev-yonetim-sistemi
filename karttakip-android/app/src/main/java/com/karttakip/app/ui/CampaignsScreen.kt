package com.karttakip.app.ui

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.LocalOffer
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.karttakip.app.data.Campaign
import com.karttakip.app.data.CampaignData
import com.karttakip.app.data.Card
import com.karttakip.app.data.CampaignRepository
import com.karttakip.app.data.TrackedCampaign
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale

private val dFmt = DateTimeFormatter.ofPattern("d MMM yyyy", Locale("tr", "TR"))
private fun tl(v: Double): String = "%,.0f ₺".format(Locale("tr", "TR"), v)
private fun LocalDate.toUtcMillis(): Long = this.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
private fun Long.toUtcLocalDate(): LocalDate = Instant.ofEpochMilli(this).atZone(ZoneOffset.UTC).toLocalDate()

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CampaignsScreen(
    onBack: () -> Unit,
    vm: CardViewModel = viewModel()
) {
    val cards by vm.cards.collectAsState()
    val tracked by vm.tracked.collectAsState()
    val context = LocalContext.current
    val today = LocalDate.now()

    var data by remember { mutableStateOf<CampaignData?>(CampaignRepository.cached(context)) }
    var loading by remember { mutableStateOf(true) }
    var refreshKey by remember { mutableIntStateOf(0) }

    var trackFor by remember { mutableStateOf<Campaign?>(null) }
    var trackCardId by remember { mutableStateOf(0L) }   // takibe alirken on-secili kart
    var spendFor by remember { mutableStateOf<TrackedCampaign?>(null) }
    var dismissed by remember { mutableStateOf(CampaignRepository.dismissed(context)) }

    fun hide(c: Campaign) {
        val s = dismissed.toMutableSet().apply { add(c.title) }
        CampaignRepository.setDismissed(context, s)
        dismissed = s
    }

    LaunchedEffect(refreshKey) {
        loading = true
        val d = withContext(Dispatchers.IO) { CampaignRepository.fetch(context) }
        if (d != null) data = d
        loading = false
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Kampanyalar", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Geri")
                    }
                },
                actions = {
                    IconButton(onClick = { refreshKey++ }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Yenile")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground
                )
            )
        }
    ) { pad ->
        val d = data
        LazyColumn(
            Modifier.fillMaxSize().padding(pad),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // --- Karta bagli OLMAYAN takipler (karta baglilar kendi kartinin altinda) ---
            val cardIds = cards.map { it.id }.toSet()
            val unlinked = tracked.filter { it.cardId == 0L || it.cardId !in cardIds }
            if (unlinked.isNotEmpty()) {
                item {
                    Text(
                        "TAKİP ETTİKLERİM (karta bağlı değil)",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                items(unlinked, key = { "t" + it.id }) { tc ->
                    TrackedCard(
                        tc = tc,
                        today = today,
                        onJoin = { vm.setJoined(tc, !tc.joined) },
                        onOpenBank = { openUrl(context, tc.url) },
                        onAddSpend = { spendFor = tc },
                        onComplete = { vm.completeTracked(tc) },
                        onDelete = { vm.deleteTracked(tc) }
                    )
                }
                item { Spacer(Modifier.height(4.dp)) }
            }

            if (loading && d == null) {
                item {
                    Box(Modifier.fillMaxWidth().padding(top = 32.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
            }

            if (d != null) {
                item {
                    Text(
                        "Güncelleme: ${d.updated}",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                if (cards.isEmpty()) {
                    item {
                        Text(
                            "Önce kart ekle; sonra kartlarına uygun kampanyaları burada görürsün.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                cards.forEach { card ->
                    val matched = d.campaigns.filter { it.title !in dismissed && CampaignRepository.matches(card, it) }
                    val mine = tracked.filter { it.cardId == card.id }
                    item { CardCampaignHeader(card.name, card.bank, matched.size, mine.size) }
                    // Bu KARTLA takip edilen kampanyalar, kartin hemen altinda.
                    items(mine, key = { "t" + it.id }) { tc ->
                        TrackedCard(
                            tc = tc,
                            today = today,
                            onJoin = { vm.setJoined(tc, !tc.joined) },
                            onOpenBank = { openUrl(context, tc.url) },
                            onAddSpend = { spendFor = tc },
                            onComplete = { vm.completeTracked(tc) },
                            onDelete = { vm.deleteTracked(tc) }
                        )
                    }
                    if (matched.isEmpty()) {
                        item {
                            Text(
                                "Şu an bu karta özel kampanya bulamadım.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(start = 4.dp, bottom = 4.dp)
                            )
                        }
                    } else {
                        items(matched) { c ->
                            CampaignCard(
                                c,
                                onOpen = { openUrl(context, c.url) },
                                onTrack = { trackCardId = card.id; trackFor = c },
                                onHide = { hide(c) }
                            )
                        }
                    }
                }

                val others = d.campaigns.filter { c -> c.title !in dismissed && cards.none { CampaignRepository.matches(it, c) } }
                if (others.isNotEmpty()) {
                    item {
                        Text(
                            "DİĞER KAMPANYALAR",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                    }
                    items(others) { c ->
                        CampaignCard(
                            c,
                            onOpen = { openUrl(context, c.url) },
                            onTrack = { trackCardId = 0L; trackFor = c },
                            onHide = { hide(c) }
                        )
                    }
                }

                if (dismissed.isNotEmpty()) {
                    item {
                        Text(
                            "${dismissed.size} kampanya gizlendi · Geri getir",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier
                                .padding(top = 8.dp)
                                .clickable {
                                    CampaignRepository.setDismissed(context, emptySet())
                                    dismissed = emptySet()
                                }
                        )
                    }
                }

                if (d.note.isNotBlank()) {
                    item {
                        Text(
                            d.note,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 10.dp)
                        )
                    }
                }
            } else if (!loading) {
                item {
                    Text(
                        "Kampanyalar yüklenemedi. İnternet bağlantını kontrol edip sağ üstteki yenile tuşuna bas.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }

    // --- Diyaloglar ---
    trackFor?.let { c ->
        TrackDialog(
            campaign = c,
            cards = cards,
            initialCardId = trackCardId,
            onDismiss = { trackFor = null },
            onSave = { tc -> vm.track(tc); trackFor = null }
        )
    }
    spendFor?.let { tc ->
        SpendDialog(
            tc = tc,
            onDismiss = { spendFor = null },
            onAdd = { amount -> vm.addSpend(tc, amount); spendFor = null }
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TrackedCard(
    tc: TrackedCampaign,
    today: LocalDate,
    onJoin: () -> Unit,
    onOpenBank: () -> Unit,
    onAddSpend: () -> Unit,
    onComplete: () -> Unit,
    onDelete: () -> Unit
) {
    val remaining = (tc.targetSpend - tc.spentSoFar).coerceAtLeast(0.0)
    val progress = if (tc.targetSpend > 0.0) (tc.spentSoFar / tc.targetSpend).toFloat().coerceIn(0f, 1f) else 0f
    val reached = tc.targetSpend > 0.0 && remaining <= 0.0

    val daysLeft = if (tc.deadlineEpochDay > 0)
        java.time.temporal.ChronoUnit.DAYS.between(today, LocalDate.ofEpochDay(tc.deadlineEpochDay)) else null

    val accent = when {
        tc.completed -> Color(0xFF16A34A)
        reached -> Color(0xFF16A34A)
        daysLeft != null && daysLeft <= 3 -> Color(0xFFEF4444)
        else -> MaterialTheme.colorScheme.primary
    }

    Column(
        Modifier
            .fillMaxWidth()
            .border(1.5.dp, accent.copy(alpha = 0.5f), RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(16.dp))
            .padding(14.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                tc.title,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.weight(1f)
            )
            IconButton(onClick = onDelete, modifier = Modifier.size(28.dp)) {
                Icon(Icons.Default.Delete, contentDescription = "Sil", tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(18.dp))
            }
        }
        if (tc.reward.isNotBlank()) {
            Text("Ödül: ${tc.reward}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        Spacer(Modifier.height(8.dp))

        if (tc.completed) {
            Text("✓ Tamamlandı", color = Color(0xFF16A34A), fontWeight = FontWeight.Bold)
        } else {
            // Katilim durumu: katilmadan harcama saymaz.
            if (tc.joined) {
                Text("✓ Katıldım", style = MaterialTheme.typography.labelMedium, color = Color(0xFF16A34A), fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
            } else {
                Text(
                    "⚠️ Önce bankadan katıl — yoksa harcaman saymaz",
                    style = MaterialTheme.typography.labelMedium,
                    color = Color(0xFFF59E0B),
                    fontWeight = FontWeight.Bold
                )
                Spacer(Modifier.height(6.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (tc.url.isNotBlank()) PillButton("Bankadan katıl", Icons.Default.LocalOffer, Color(0xFF8B5CF6), onOpenBank)
                    PillButton("Katıldım", Icons.Default.Check, Color(0xFF16A34A), onJoin)
                }
                Spacer(Modifier.height(10.dp))
            }

            if (tc.targetSpend > 0.0) {
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier.fillMaxWidth().height(8.dp),
                    color = accent
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    "${tl(tc.spentSoFar)} / ${tl(tc.targetSpend)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    if (reached) "Hedef tamam — ödülünü kontrol et 🎉" else "${tl(remaining)} daha harcaman lazım",
                    fontWeight = FontWeight.Bold,
                    color = accent
                )
            } else {
                Text("Harcama: ${tl(tc.spentSoFar)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            if (daysLeft != null) {
                val t = when {
                    daysLeft < 0 -> "Süre doldu (${dFmt.format(LocalDate.ofEpochDay(tc.deadlineEpochDay))})"
                    daysLeft == 0L -> "Bugün son gün!"
                    else -> "Son gün ${dFmt.format(LocalDate.ofEpochDay(tc.deadlineEpochDay))} — $daysLeft gün"
                }
                Text(t, style = MaterialTheme.typography.labelMedium, color = if (daysLeft in 0..3) Color(0xFFEF4444) else MaterialTheme.colorScheme.onSurfaceVariant)
            }

            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PillButton("Harcama ekle", Icons.Default.Add, MaterialTheme.colorScheme.primary, onAddSpend)
                PillButton("Tamamlandı", Icons.Default.Check, Color(0xFF16A34A), onComplete)
            }
        }
    }
}

@Composable
private fun PillButton(text: String, icon: androidx.compose.ui.graphics.vector.ImageVector, accent: Color, onClick: () -> Unit) {
    Row(
        Modifier
            .background(accent.copy(alpha = 0.15f), RoundedCornerShape(50))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(16.dp))
        Spacer(Modifier.size(6.dp))
        Text(text, style = MaterialTheme.typography.labelMedium, color = accent, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun CardCampaignHeader(name: String, bank: String, count: Int, trackedCount: Int = 0) {
    Row(Modifier.fillMaxWidth().padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier.size(34.dp).background(MaterialTheme.colorScheme.primary.copy(alpha = 0.18f), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.LocalOffer, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
        }
        Spacer(Modifier.size(10.dp))
        Column(Modifier.weight(1f)) {
            Text(name, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onBackground)
            if (bank.isNotBlank()) {
                Text(bank, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        Column(horizontalAlignment = Alignment.End) {
            Text("$count kampanya", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (trackedCount > 0) {
                Text("🎯 $trackedCount takipte", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CampaignCard(c: Campaign, onOpen: () -> Unit, onTrack: () -> Unit, onHide: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f), RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(16.dp))
            .padding(14.dp)
    ) {
        Row(verticalAlignment = Alignment.Top) {
            Text(
                c.title,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier
                    .weight(1f)
                    .clickable { if (c.url.isNotBlank()) onOpen() }
            )
            // Sag ust kose: X ile pasife at (kalabalik yapmasin).
            IconButton(onClick = onHide, modifier = Modifier.size(26.dp)) {
                Icon(Icons.Default.Close, contentDescription = "Yok say", tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
            }
        }
        if (c.detail.isNotBlank()) {
            Spacer(Modifier.height(4.dp))
            Text(c.detail, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Spacer(Modifier.height(8.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            if (c.reward.isNotBlank()) Chip(c.reward, Color(0xFF16A34A))
            if (c.minSpend.isNotBlank()) Chip("Min ${c.minSpend}", Color(0xFFF59E0B))
            if (c.category.isNotBlank()) Chip(c.category, Color(0xFF3B82F6))
            if (c.validUntil.isNotBlank()) Chip(c.validUntil, Color(0xFF8B5CF6))
        }
        Spacer(Modifier.height(10.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            PillButton("Takip et", Icons.Default.Add, MaterialTheme.colorScheme.primary, onTrack)
            if (c.url.isNotBlank()) PillButton("Detay", Icons.Default.LocalOffer, Color(0xFF8B5CF6), onOpen)
        }
    }
}

@Composable
private fun Chip(text: String, accent: Color) {
    Box(Modifier.background(accent.copy(alpha = 0.16f), RoundedCornerShape(50)).padding(horizontal = 10.dp, vertical = 4.dp)) {
        Text(text, style = MaterialTheme.typography.labelSmall, color = accent, fontWeight = FontWeight.SemiBold)
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun TrackDialog(
    campaign: Campaign,
    cards: List<Card>,
    initialCardId: Long,
    onDismiss: () -> Unit,
    onSave: (TrackedCampaign) -> Unit
) {
    var target by remember { mutableStateOf("") }
    var cardId by remember { mutableStateOf(initialCardId) }
    var deadline by remember { mutableStateOf<LocalDate?>(null) }
    var showPicker by remember { mutableStateOf(false) }

    if (showPicker) {
        val state = rememberDatePickerState(initialSelectedDateMillis = (deadline ?: LocalDate.now()).toUtcMillis())
        DatePickerDialog(
            onDismissRequest = { showPicker = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { deadline = it.toUtcLocalDate() }
                    showPicker = false
                }) { Text("Tamam") }
            },
            dismissButton = { TextButton(onClick = { showPicker = false }) { Text("Vazgeç") } }
        ) { DatePicker(state = state) }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Takibe al") },
        text = {
            Column {
                Text(campaign.title, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                if (campaign.reward.isNotBlank()) {
                    Text("Ödül: ${campaign.reward}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = target,
                    onValueChange = { target = it.filter(Char::isDigit) },
                    label = { Text("Hedef harcama (₺)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(10.dp))
                Row(
                    Modifier
                        .fillMaxWidth()
                        .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(12.dp))
                        .clickable { showPicker = true }
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        deadline?.let { "Son tarih: ${dFmt.format(it)}" } ?: "Son tarih seç (opsiyonel)",
                        color = if (deadline != null) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Icon(Icons.Default.CalendarMonth, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                }
                // Hangi kartla? Secili kart dolu renkte; takip o kartin altinda gorunur.
                if (cards.isNotEmpty()) {
                    Spacer(Modifier.height(12.dp))
                    Text("Hangi kartla?", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(6.dp))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        cards.forEach { card ->
                            val sel = card.id == cardId
                            val accent = Color(card.colorArgb)
                            Box(
                                Modifier
                                    .background(if (sel) accent else accent.copy(alpha = 0.15f), RoundedCornerShape(50))
                                    .clickable { cardId = if (sel) 0L else card.id }
                                    .padding(horizontal = 10.dp, vertical = 5.dp)
                            ) {
                                Text(
                                    card.name,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (sel) Color.White else accent,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                onSave(
                    TrackedCampaign(
                        title = campaign.title,
                        reward = campaign.reward,
                        targetSpend = target.toDoubleOrNull() ?: 0.0,
                        spentSoFar = 0.0,
                        deadlineEpochDay = deadline?.toEpochDay() ?: 0L,
                        cardId = cardId,
                        url = campaign.url
                    )
                )
            }) { Text("Takip et") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Vazgeç") } }
    )
}

@Composable
private fun SpendDialog(tc: TrackedCampaign, onDismiss: () -> Unit, onAdd: (Double) -> Unit) {
    var amount by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Harcama ekle") },
        text = {
            Column {
                Text(tc.title, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(
                    value = amount,
                    onValueChange = { amount = it.filter(Char::isDigit) },
                    label = { Text("Bu harcama (₺)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = { TextButton(onClick = { onAdd(amount.toDoubleOrNull() ?: 0.0) }) { Text("Ekle") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Vazgeç") } }
    )
}

/**
 * Linki TARAYICIDA acar. Duz ACTION_VIEW, banka uygulamasi kuruluysa (app link)
 * onu acip kullaniciyi uygulamaya atiyordu; CATEGORY_APP_BROWSER secicisi ile
 * dogrudan varsayilan tarayici hedeflenir. Olmazsa duz ACTION_VIEW'a duser.
 */
private fun openUrl(context: Context, url: String) {
    if (url.isBlank()) return
    val uri = Uri.parse(url)
    val browser = Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_BROWSER).apply {
        data = uri
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    runCatching { context.startActivity(browser) }.onFailure {
        runCatching {
            context.startActivity(Intent(Intent.ACTION_VIEW, uri).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            })
        }
    }
}
