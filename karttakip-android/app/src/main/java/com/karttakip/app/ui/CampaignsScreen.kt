package com.karttakip.app.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.LocalOffer
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
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
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.karttakip.app.data.Campaign
import com.karttakip.app.data.CampaignData
import com.karttakip.app.data.CampaignRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CampaignsScreen(
    onBack: () -> Unit,
    vm: CardViewModel = viewModel()
) {
    val cards by vm.cards.collectAsState()
    val context = LocalContext.current

    var data by remember { mutableStateOf<CampaignData?>(CampaignRepository.cached(context)) }
    var loading by remember { mutableStateOf(true) }
    var refreshKey by remember { mutableIntStateOf(0) }

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
            Modifier
                .fillMaxSize()
                .padding(pad),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (loading && d == null) {
                item {
                    Box(Modifier.fillMaxWidth().padding(top = 48.dp), contentAlignment = Alignment.Center) {
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

                // Her kart icin ona uygun kampanyalar.
                cards.forEach { card ->
                    val matched = d.campaigns.filter { CampaignRepository.matches(card, it) }
                    item {
                        CardCampaignHeader(card.name, card.bank, matched.size)
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
                        items(matched) { c -> CampaignCard(c) { openUrl(context, c.url) } }
                    }
                }

                // Hangi karta ait oldugu eslesmeyen genel kampanyalar.
                val others = d.campaigns.filter { c -> cards.none { CampaignRepository.matches(it, c) } }
                if (others.isNotEmpty()) {
                    item {
                        Text(
                            "DİĞER KAMPANYALAR",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                    }
                    items(others) { c -> CampaignCard(c) { openUrl(context, c.url) } }
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
}

@Composable
private fun CardCampaignHeader(name: String, bank: String, count: Int) {
    Row(
        Modifier.fillMaxWidth().padding(top = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
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
        Text("$count kampanya", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CampaignCard(c: Campaign, onClick: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f), RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(16.dp))
            .clickable { if (c.url.isNotBlank()) onClick() }
            .padding(14.dp)
    ) {
        Text(c.title, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
        if (c.detail.isNotBlank()) {
            Spacer(Modifier.height(4.dp))
            Text(c.detail, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Spacer(Modifier.height(8.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            if (c.reward.isNotBlank()) Chip(c.reward, Color(0xFF16A34A))
            if (c.minSpend.isNotBlank()) Chip("Min ${c.minSpend}", Color(0xFFF59E0B))
            if (c.category.isNotBlank()) Chip(c.category, Color(0xFF3B82F6))
            if (c.validUntil.isNotBlank()) Chip("Son ${c.validUntil}", Color(0xFF8B5CF6))
        }
    }
}

@Composable
private fun Chip(text: String, accent: Color) {
    Box(
        Modifier.background(accent.copy(alpha = 0.16f), RoundedCornerShape(50)).padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        Text(text, style = MaterialTheme.typography.labelSmall, color = accent, fontWeight = FontWeight.SemiBold)
    }
}

private fun openUrl(context: android.content.Context, url: String) {
    if (url.isBlank()) return
    runCatching {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        })
    }
}
