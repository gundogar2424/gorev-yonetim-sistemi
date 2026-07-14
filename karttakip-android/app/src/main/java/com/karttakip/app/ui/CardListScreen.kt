package com.karttakip.app.ui

import androidx.compose.foundation.background
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
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.karttakip.app.data.Card as CardEntity
import com.karttakip.app.domain.CardCalc
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private val dateFmt = DateTimeFormatter.ofPattern("d MMM", Locale("tr", "TR"))

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

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Kart Takip", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onAdd) {
                Icon(Icons.Default.Add, contentDescription = "Kart ekle")
            }
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
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            best?.let {
                item {
                    RecommendationCard(
                        icon = Icons.Default.Lightbulb,
                        tint = Color(0xFF22C55E),
                        title = "Bugün bunu kullan: ${it.name}",
                        body = "En uzun faizsiz süre bu kartta: ${CardCalc.floatDays(it, today)} gün " +
                            "(son ödeme ${dateFmt.format(CardCalc.purchaseDueDate(it, today))}). " +
                            "Yeni harcamanı bu kartla yaparsan parayı en geç ödersin."
                    )
                }
            }
            urgent?.let {
                if (it.debt > 0) {
                    item {
                        val due = CardCalc.nextDue(it, today)
                        RecommendationCard(
                            icon = Icons.Default.Warning,
                            tint = Color(0xFFF59E0B),
                            title = "En yakın ödeme: ${it.name}",
                            body = "Son ödeme ${dateFmt.format(due)} " +
                                "(${CardCalc.daysUntil(due, today)} gün kaldı) — Borç: ${formatMoney(it.debt)}."
                        )
                    }
                }
            }

            item {
                Text(
                    "Kartların",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }

            items(cards.sortedBy { CardCalc.nextDue(it, today) }, key = { it.id }) { card ->
                CardRow(card = card, today = today, onClick = { onEdit(card.id) })
            }
        }
    }
}

@Composable
private fun RecommendationCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    tint: Color,
    title: String,
    body: String
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(Modifier.padding(16.dp)) {
            Box(
                Modifier
                    .size(40.dp)
                    .background(tint.copy(alpha = 0.15f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = tint)
            }
            Spacer(Modifier.size(12.dp))
            Column {
                Text(title, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Spacer(Modifier.height(4.dp))
                Text(
                    body,
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.75f)
                )
            }
        }
    }
}

@Composable
private fun CardRow(card: CardEntity, today: LocalDate, onClick: () -> Unit) {
    val nextStatement = CardCalc.nextStatement(card, today)
    val nextDue = CardCalc.nextDue(card, today)
    val daysToDue = CardCalc.daysUntil(nextDue, today)

    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Row(
            Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                Modifier
                    .size(44.dp)
                    .background(Color(card.colorArgb), RoundedCornerShape(8.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.CreditCard, contentDescription = null, tint = Color.White)
            }
            Spacer(Modifier.size(12.dp))
            Column(Modifier.weight(1f)) {
                Text(card.name, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                if (card.bank.isNotBlank()) {
                    Text(
                        card.bank,
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                    )
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    "Kesim ${dateFmt.format(nextStatement)}  •  Son ödeme ${dateFmt.format(nextDue)}",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                val urgentColor = when {
                    daysToDue <= 2 -> MaterialTheme.colorScheme.error
                    daysToDue <= 5 -> Color(0xFFF59E0B)
                    else -> MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                }
                Text("$daysToDue gün", fontWeight = FontWeight.Bold, color = urgentColor, fontSize = 15.sp)
                if (card.debt > 0) {
                    Text(
                        formatMoney(card.debt),
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                    )
                }
            }
        }
    }
}

@Composable
private fun EmptyState(modifier: Modifier) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                Icons.Default.CreditCard,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f),
                modifier = Modifier.size(64.dp)
            )
            Spacer(Modifier.height(12.dp))
            Text("Henüz kart yok", fontWeight = FontWeight.Bold, fontSize = 18.sp)
            Text(
                "Sağ alttaki + ile ilk kredi kartını ekle.",
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
            )
        }
    }
}

internal fun formatMoney(v: Double): String = "%,.0f ₺".format(Locale("tr", "TR"), v)
