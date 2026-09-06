package com.otoara.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.otoara.app.data.Attempt
import com.otoara.app.data.AttemptResult
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun HistoryScreen(vm: RedialViewModel) {
    val history by vm.history.collectAsState()
    val stamp = SimpleDateFormat("d MMM HH:mm:ss", Locale("tr"))

    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp)
        ) {
            Text("Geçmiş", style = MaterialTheme.typography.headlineSmall, modifier = Modifier.weight(1f))
            if (history.isNotEmpty()) {
                TextButton(onClick = { vm.clearHistory() }) { Text("Temizle") }
            }
        }

        if (history.isEmpty()) {
            Text(
                "Henüz arama kaydı yok.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(top = 48.dp)
            )
            return@Column
        }

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.padding(top = 8.dp, bottom = 16.dp)
        ) {
            items(history, key = { it.id }) { a -> AttemptRow(a, stamp.format(Date(a.startedAt))) }
        }
    }
}

@Composable
private fun AttemptRow(a: Attempt, time: String) {
    val color = when (a.result) {
        AttemptResult.ANSWERED -> MaterialTheme.colorScheme.secondary
        AttemptResult.FAILED -> MaterialTheme.colorScheme.error
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    Panel {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(
                    if (a.label.isBlank()) a.number else "${a.label} — ${a.number}",
                    style = MaterialTheme.typography.titleSmall
                )
                Text(
                    "$time  •  ${a.tryNo}. deneme",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Spacer(Modifier.width(10.dp))
            Column(horizontalAlignment = Alignment.End) {
                Text(AttemptResult.label(a.result), style = MaterialTheme.typography.titleSmall, color = color)
                if (a.connectedSec > 0) {
                    Text(
                        "${a.connectedSec} sn",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}
