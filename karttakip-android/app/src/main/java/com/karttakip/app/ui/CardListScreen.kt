package com.karttakip.app.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import com.karttakip.app.notif.NotificationScheduler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Upload
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.karttakip.app.data.Card as CardEntity
import com.karttakip.app.domain.CardCalc
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private val dateFmt = DateTimeFormatter.ofPattern("d MMM", Locale("tr", "TR"))
private fun money(v: Double): String = "%,.0f ₺".format(Locale("tr", "TR"), v)
private fun Color.darken(f: Float = 0.6f): Color = Color(red * f, green * f, blue * f, alpha)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CardListScreen(
    onAdd: () -> Unit,
    onEdit: (Long) -> Unit,
    vm: CardViewModel = viewModel()
) {
    val cards by vm.cards.collectAsState()
    val today = LocalDate.now()
    val best = CardCalc.bestCardToUse(cards, today)
    val urgent = CardCalc.mostUrgentPayment(cards, today)
    val totalDebt = cards.sumOf { it.debt }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var menuOpen by remember { mutableStateOf(false) }

    val importLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri ->
        uri ?: return@rememberLauncherForActivityResult
        scope.launch {
            val text = withContext(Dispatchers.IO) {
                runCatching {
                    context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }
                }.getOrNull()
            }
            if (text == null) {
                Toast.makeText(context, "Dosya okunamadı", Toast.LENGTH_LONG).show()
                return@launch
            }
            vm.importCards(text) { n ->
                val msg = when {
                    n > 0 -> "$n kart içe aktarıldı"
                    n == 0 -> "Dosyada kart bulunamadı"
                    else -> "Dosya okunamadı (biçim hatalı)"
                }
                Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
            }
        }
    }

    val exportLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/json")
    ) { uri ->
        uri ?: return@rememberLauncherForActivityResult
        scope.launch {
            val json = vm.exportJson()
            val ok = withContext(Dispatchers.IO) {
                runCatching {
                    context.contentResolver.openOutputStream(uri)?.bufferedWriter()?.use { it.write(json) }
                }.isSuccess
            }
            Toast.makeText(
                context,
                if (ok) "Yedek kaydedildi" else "Yedek kaydedilemedi",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Kart Takip", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton(onClick = { menuOpen = true }) {
                        Icon(Icons.Default.MoreVert, contentDescription = "Menü")
                    }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        DropdownMenuItem(
                            text = { Text("Yedekten içe aktar") },
                            leadingIcon = { Icon(Icons.Default.Upload, contentDescription = null) },
                            onClick = {
                                menuOpen = false
                                importLauncher.launch(arrayOf("*/*"))
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Yedeği dışa aktar") },
                            leadingIcon = { Icon(Icons.Default.Download, contentDescription = null) },
                            onClick = {
                                menuOpen = false
                                exportLauncher.launch("kart-takip-yedek.json")
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Test bildirimi gönder") },
                            leadingIcon = { Icon(Icons.Default.NotificationsActive, contentDescription = null) },
                            onClick = {
                                menuOpen = false
                                val hasPerm = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
                                    ContextCompat.checkSelfPermission(
                                        context, Manifest.permission.POST_NOTIFICATIONS
                                    ) == PackageManager.PERMISSION_GRANTED
                                if (!hasPerm) {
                                    Toast.makeText(
                                        context,
                                        "Önce bildirim iznini aç: Ayarlar → Uygulamalar → Kart Takip → Bildirimler",
                                        Toast.LENGTH_LONG
                                    ).show()
                                } else {
                                    NotificationScheduler.showNotification(
                                        context, 999999,
                                        "Kart Takip — test 🔔",
                                        "Bildirimler çalışıyor! Gerçek hatırlatmalar kesim ve son ödeme günlerinde böyle gelir."
                                    )
                                    Toast.makeText(context, "Test bildirimi gönderildi", Toast.LENGTH_SHORT).show()
                                }
                            }
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground
                )
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onAdd,
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
                text = { Text("Kart ekle", fontWeight = FontWeight.SemiBold) },
                icon = { Icon(Icons.Default.Add, contentDescription = null) }
            )
        }
    ) { pad ->
        if (cards.isEmpty()) {
            EmptyState(Modifier.padding(pad))
            return@Scaffold
        }

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(pad),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 96.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item { SummaryHeader(totalDebt = totalDebt, cardCount = cards.size) }

            best?.let {
                item {
                    RecommendationCard(
                        icon = Icons.Default.Bolt,
                        accent = Color(0xFF34D399),
                        eyebrow = "BUGÜN BUNU KULLAN",
                        title = it.name,
                        body = "${CardCalc.floatDays(it, today)} gün faizsiz süre — en uzun. " +
                            "Yeni harcamanı bununla yaparsan parayı en geç ödersin " +
                            "(son ödeme ${dateFmt.format(CardCalc.purchaseDueDate(it, today))})."
                    )
                }
            }
            urgent?.let {
                if (it.debt > 0) {
                    val due = CardCalc.nextDue(it, today)
                    val days = CardCalc.daysUntil(due, today)
                    item {
                        RecommendationCard(
                            icon = Icons.Default.NotificationsActive,
                            accent = if (days <= 3) Color(0xFFF87171) else Color(0xFFFBBF24),
                            eyebrow = "EN YAKIN ÖDEME",
                            title = "${it.name} • ${money(it.debt)}",
                            body = "Son ödeme ${dateFmt.format(due)} — $days gün kaldı."
                        )
                    }
                }
            }

            item {
                Text(
                    "KARTLARIN",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 6.dp, start = 4.dp)
                )
            }

            items(cards.sortedBy { CardCalc.nextDue(it, today) }, key = { it.id }) { card ->
                CreditCardTile(card = card, today = today, onClick = { onEdit(card.id) })
            }
        }
    }
}

@Composable
private fun SummaryHeader(totalDebt: Double, cardCount: Int) {
    Column(Modifier.padding(start = 4.dp, top = 4.dp, bottom = 2.dp)) {
        Text(
            "Toplam borç",
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(2.dp))
        Text(
            money(totalDebt),
            style = MaterialTheme.typography.displayMedium,
            color = MaterialTheme.colorScheme.onBackground
        )
        Text(
            "$cardCount kart",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun RecommendationCard(
    icon: ImageVector,
    accent: Color,
    eyebrow: String,
    title: String,
    body: String
) {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(22.dp))
            .background(
                Brush.linearGradient(
                    listOf(accent.copy(alpha = 0.22f), accent.copy(alpha = 0.06f))
                )
            )
            .border(1.dp, accent.copy(alpha = 0.35f), RoundedCornerShape(22.dp))
            .padding(18.dp)
    ) {
        Row {
            Box(
                Modifier
                    .size(44.dp)
                    .background(accent.copy(alpha = 0.20f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = accent)
            }
            Spacer(Modifier.size(14.dp))
            Column {
                Text(
                    eyebrow,
                    style = MaterialTheme.typography.labelSmall,
                    color = accent,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    title,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.Bold
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    body,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun CreditCardTile(card: CardEntity, today: LocalDate, onClick: () -> Unit) {
    val nextStatement = CardCalc.nextStatement(card, today)
    val nextDue = CardCalc.nextDue(card, today)
    val daysToDue = CardCalc.daysUntil(nextDue, today)
    val available = (card.limit - card.debt).coerceAtLeast(0.0)
    val base = Color(card.colorArgb)

    Box(
        Modifier
            .fillMaxWidth()
            .height(172.dp)
            .clip(RoundedCornerShape(22.dp))
            .background(Brush.linearGradient(listOf(base, base.darken(0.55f))))
            .clickable(onClick = onClick)
            .padding(18.dp)
    ) {
        Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
            // Ust satir: banka + cip ikonu
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(
                    (if (card.bank.isNotBlank()) card.bank else "KREDİ KARTI").uppercase(Locale("tr", "TR")),
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White.copy(alpha = 0.75f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false)
                )
                Icon(
                    Icons.Default.CreditCard,
                    contentDescription = null,
                    tint = Color.White.copy(alpha = 0.85f),
                    modifier = Modifier.size(22.dp)
                )
            }

            // Kart adi + kullanilabilir limit
            Column {
                Text(
                    card.name,
                    style = MaterialTheme.typography.headlineSmall,
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                if (card.limit > 0) {
                    Text(
                        "Kullanılabilir ${money(available)}",
                        style = MaterialTheme.typography.labelMedium,
                        color = Color.White.copy(alpha = 0.8f)
                    )
                }
            }

            // Alt satir: son odeme + gun rozeti + borc
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom
            ) {
                Column {
                    Text(
                        "Kesim ${dateFmt.format(nextStatement)}",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White.copy(alpha = 0.7f)
                    )
                    Text(
                        "Son ödeme ${dateFmt.format(nextDue)}",
                        style = MaterialTheme.typography.titleSmall,
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    DaysBadge(daysToDue)
                    if (card.debt > 0) {
                        Spacer(Modifier.height(4.dp))
                        Text(
                            money(card.debt),
                            style = MaterialTheme.typography.labelLarge,
                            color = Color.White.copy(alpha = 0.9f)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DaysBadge(days: Long) {
    val bg = when {
        days <= 2 -> Color(0xFFEF4444)
        days <= 5 -> Color(0xFFF59E0B)
        else -> Color.White.copy(alpha = 0.22f)
    }
    Box(
        Modifier
            .clip(RoundedCornerShape(50))
            .background(bg)
            .padding(horizontal = 12.dp, vertical = 5.dp)
    ) {
        Text(
            "$days gün",
            style = MaterialTheme.typography.labelMedium,
            color = Color.White,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun EmptyState(modifier: Modifier) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(32.dp)
        ) {
            Box(
                Modifier
                    .size(88.dp)
                    .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(24.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Default.CreditCard,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(44.dp)
                )
            }
            Spacer(Modifier.height(18.dp))
            Text(
                "Henüz kart yok",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onBackground,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.height(6.dp))
            Text(
                "Alttaki “Kart ekle” ile ilk kredi kartını ekle; kesim ve son ödeme tarihlerini gir, gerisini uygulama halletsin.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
