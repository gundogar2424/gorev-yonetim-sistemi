package com.seslipdf.app.ui

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
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bedtime
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.seslipdf.app.tts.ReaderService
import com.seslipdf.app.tts.ReaderState
import kotlinx.coroutines.delay
import android.os.SystemClock

/**
 * Okuma ekrani: cumleler listelenir, okunan cumle vurgulanir; dokununca oradan
 * devam edilir. Kumanda (oynat/duraklat, ileri/geri), hiz ve uyku sayaci burada.
 */
@Composable
fun ReaderScreen(
    vm: LibraryViewModel,
    onGoLibrary: () -> Unit
) {
    val context = LocalContext.current
    val status by ReaderState.status.collectAsStateWithLifecycle()
    val text by ReaderState.text.collectAsStateWithLifecycle()

    var showSleep by remember { mutableStateOf(false) }
    var showPage by remember { mutableStateOf(false) }

    if (status.docId == 0L && !status.loading) {
        EmptyReader(onGoLibrary)
        return
    }

    val sentences = text?.sentences.orEmpty()
    val listState = rememberLazyListState()

    // Okunan cumle ekranin ustune dogru kaydirilir.
    LaunchedEffect(status.index, vm.autoScroll, sentences.size) {
        if (vm.autoScroll && sentences.isNotEmpty()) {
            listState.animateScrollToItem((status.index - 2).coerceAtLeast(0))
        }
    }

    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {

        Spacer(Modifier.height(12.dp))
        Text(
            status.title.ifBlank { "Belge" },
            style = MaterialTheme.typography.titleLarge,
            maxLines = 2
        )
        Row(
            Modifier.fillMaxWidth().padding(top = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                if (status.pageCount > 0) "Sayfa ${status.page} / ${status.pageCount}"
                else "Hazırlanıyor…",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                "${status.index + 1} / ${status.total} cümle",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Spacer(Modifier.height(8.dp))
        LinearProgressIndicator(
            progress = { status.progress },
            modifier = Modifier.fillMaxWidth()
        )

        status.error?.let { message ->
            Spacer(Modifier.height(10.dp))
            Panel {
                Text(message, style = MaterialTheme.typography.bodyMedium)
                TextButton(onClick = { ReaderState.clearError() }) { Text("Tamam") }
            }
        }

        if (status.loading && sentences.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            return@Column
        }

        LazyColumn(
            state = listState,
            modifier = Modifier.weight(1f).fillMaxWidth(),
            contentPadding = PaddingValues(vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            itemsIndexed(sentences) { index, sentence ->
                val active = index == status.index
                Text(
                    sentence,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
                    color = when {
                        active -> MaterialTheme.colorScheme.onPrimaryContainer
                        index < status.index -> MaterialTheme.colorScheme.onSurfaceVariant
                        else -> MaterialTheme.colorScheme.onSurface
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(
                            if (active) MaterialTheme.colorScheme.primaryContainer
                            else MaterialTheme.colorScheme.background
                        )
                        .clickable { ReaderService.seek(context, index) }
                        .padding(horizontal = 10.dp, vertical = 8.dp)
                )
            }
        }

        Controls(
            playing = status.playing,
            onPrev = { ReaderService.previous(context) },
            onToggle = {
                if (status.playing) ReaderService.pause(context) else ReaderService.play(context)
            },
            onNext = { ReaderService.next(context) },
            onSleep = { showSleep = true },
            onPage = { showPage = true },
            onClose = { ReaderService.close(context) },
            sleepAt = status.sleepAt
        )

        SpeedRow(
            rate = vm.rate,
            onRate = { vm.updateRate(it) }
        )
        Spacer(Modifier.height(10.dp))
    }

    if (showSleep) {
        SleepDialog(
            current = status.sleepAt,
            onPick = { minutes ->
                vm.updateSleepMinutes(minutes)
                ReaderService.sleepTimer(context, minutes)
                showSleep = false
            },
            onDismiss = { showSleep = false }
        )
    }

    if (showPage) {
        var page by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showPage = false },
            title = { Text("Sayfaya git") },
            text = {
                Column {
                    Text("1 – ${status.pageCount} arası bir sayfa yazın.")
                    Spacer(Modifier.height(10.dp))
                    OutlinedTextField(
                        value = page,
                        onValueChange = { value -> page = value.filter { it.isDigit() }.take(5) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    val target = page.toIntOrNull()
                    val doc = text
                    if (target != null && doc != null) {
                        ReaderService.seek(
                            context,
                            doc.startOfPage(target.coerceIn(1, status.pageCount.coerceAtLeast(1)))
                        )
                    }
                    showPage = false
                }) { Text("Git") }
            },
            dismissButton = { TextButton(onClick = { showPage = false }) { Text("Vazgeç") } }
        )
    }
}

@Composable
private fun EmptyReader(onGoLibrary: () -> Unit) {
    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                Icons.Filled.MenuBook,
                contentDescription = null,
                modifier = Modifier.size(56.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Spacer(Modifier.height(14.dp))
            Text("Okunacak belge seçilmedi", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(6.dp))
            Text(
                "Kitaplıktan bir PDF açın; kaldığınız yerden devam edilir.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(18.dp))
            Button(onClick = onGoLibrary) { Text("Kitaplığa git") }
        }
    }
}

@Composable
private fun Controls(
    playing: Boolean,
    onPrev: () -> Unit,
    onToggle: () -> Unit,
    onNext: () -> Unit,
    onSleep: () -> Unit,
    onPage: () -> Unit,
    onClose: () -> Unit,
    sleepAt: Long
) {
    Column {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onPrev, modifier = Modifier.size(56.dp)) {
                Icon(
                    Icons.Filled.SkipPrevious,
                    contentDescription = "Önceki cümle",
                    modifier = Modifier.size(34.dp)
                )
            }
            Spacer(Modifier.size(10.dp))
            FilledIconButton(
                onClick = onToggle,
                modifier = Modifier.size(72.dp),
                colors = IconButtonDefaults.filledIconButtonColors(
                    containerColor = MaterialTheme.colorScheme.primary
                )
            ) {
                Icon(
                    if (playing) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                    contentDescription = if (playing) "Duraklat" else "Oku",
                    modifier = Modifier.size(38.dp)
                )
            }
            Spacer(Modifier.size(10.dp))
            IconButton(onClick = onNext, modifier = Modifier.size(56.dp)) {
                Icon(
                    Icons.Filled.SkipNext,
                    contentDescription = "Sonraki cümle",
                    modifier = Modifier.size(34.dp)
                )
            }
        }

        Row(
            Modifier.fillMaxWidth().padding(top = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            AssistChip(
                onClick = onPage,
                label = { Text("Sayfaya git") },
                leadingIcon = { Icon(Icons.Filled.MenuBook, contentDescription = null) }
            )
            AssistChip(
                onClick = onSleep,
                label = { Text(sleepLabel(sleepAt)) },
                leadingIcon = { Icon(Icons.Filled.Bedtime, contentDescription = null) }
            )
            AssistChip(
                onClick = onClose,
                label = { Text("Kapat") },
                leadingIcon = { Icon(Icons.Filled.Close, contentDescription = null) }
            )
        }
    }
}

/** Uyku sayacinin kalan suresi saniye saniye tazelenir. */
@Composable
private fun sleepLabel(sleepAt: Long): String {
    if (sleepAt <= 0L) return "Uyku"
    val remaining by produceState(initialValue = sleepAt - SystemClock.elapsedRealtime(), sleepAt) {
        while (true) {
            value = sleepAt - SystemClock.elapsedRealtime()
            if (value <= 0) break
            delay(1_000)
        }
    }
    if (remaining <= 0) return "Uyku"
    val minutes = (remaining / 60_000).toInt()
    val seconds = ((remaining % 60_000) / 1000).toInt()
    return "%d:%02d".format(minutes, seconds)
}

@Composable
private fun SpeedRow(rate: Float, onRate: (Float) -> Unit) {
    var value by remember(rate) { mutableStateOf(rate) }
    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                "Okuma hızı",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text("%.1f×".format(value), style = MaterialTheme.typography.labelLarge)
        }
        Slider(
            value = value,
            onValueChange = { value = it },
            onValueChangeFinished = { onRate(value) },
            valueRange = 0.5f..2.5f,
            steps = 19
        )
    }
}

@Composable
private fun SleepDialog(current: Long, onPick: (Int) -> Unit, onDismiss: () -> Unit) {
    val options = listOf(0, 5, 15, 30, 45, 60, 90)
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Uyku sayacı") },
        text = {
            Column {
                Text("Seçilen süre dolunca okuma kendiliğinden duraklar.")
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    options.take(4).forEach { minutes ->
                        FilterChip(
                            selected = (minutes == 0 && current == 0L),
                            onClick = { onPick(minutes) },
                            label = { Text(if (minutes == 0) "Kapat" else "$minutes dk") }
                        )
                    }
                }
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    options.drop(4).forEach { minutes ->
                        FilterChip(
                            selected = false,
                            onClick = { onPick(minutes) },
                            label = { Text("$minutes dk") }
                        )
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Kapat") } }
    )
}
