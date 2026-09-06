package com.seslipdf.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.animateScrollBy
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Bedtime
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.VolumeOff
import androidx.compose.material.icons.filled.VolumeUp
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
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
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
import androidx.compose.runtime.withFrameNanos
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.abs
import android.os.SystemClock

/** Okunan cumlenin ekranda durmasi istenen yer (ustten oran). */
private const val LINE_POSITION = 0.34f

/** Turkce icin kabaca saniyede okunan karakter sayisi (1.0 hizda). */
private const val CHARS_PER_SECOND = 13f

/** Akisin en yuksek hizi (piksel/saniye). */
private const val MAX_SPEED = 4000f

/** Hiz degisimlerinin yumusatilmasi. */
private const val SMOOTHING = 6f

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
    val scope = rememberCoroutineScope()

    /** Sessiz modda akisin surup surmedigi. */
    var flowing by remember { mutableStateOf(false) }

    // Ekranda hedef cizgideki cumle: sessiz modda "okunan" cumle budur.
    val anchorIndex by remember {
        derivedStateOf {
            val info = listState.layoutInfo
            val viewport = info.viewportEndOffset - info.viewportStartOffset
            val desired = info.viewportStartOffset + viewport * LINE_POSITION
            info.visibleItemsInfo.lastOrNull { it.offset <= desired }?.index
                ?: info.visibleItemsInfo.firstOrNull()?.index
                ?: 0
        }
    }

    // Vurgulanan ve baslikta gosterilen cumle.
    val shownIndex = if (vm.silentMode) anchorIndex else status.index

    // Sessiz modda okunan yer, biraz duraklayinca kaydedilir; sesli moda
    // gecildiginde okuma gozun kaldigi satirdan devam eder.
    LaunchedEffect(vm.silentMode, anchorIndex) {
        if (!vm.silentMode) return@LaunchedEffect
        delay(1200)
        if (anchorIndex != ReaderState.status.value.index) {
            ReaderService.seek(context, anchorIndex)
        }
    }

    // Sessiz mod: yazi, secilen sabit hizda kesintisiz akar. Ses yoktur, hizi
    // tamamen kullanici belirler.
    LaunchedEffect(vm.silentMode, flowing, sentences.size) {
        if (!vm.silentMode || !flowing) return@LaunchedEffect
        var lastFrame = 0L
        while (isActive) {
            val now = withFrameNanos { it }
            val seconds = if (lastFrame == 0L) 0f
                else ((now - lastFrame) / 1_000_000_000f).coerceIn(0f, 0.1f)
            lastFrame = now
            if (seconds > 0f) listState.scrollBy(vm.flowPixelsPerSecond * seconds)
        }
    }

    // Metin, film jenerigi gibi kesintisiz akar: her karede biraz kaydirilir.
    // Hiz, okunan cumlenin ne kadar surecegine gore hesaplanir (sesin temposu) ve
    // cumle ekrandaki hedef yerinden sapinca kendini duzeltir. Boylece akis hem
    // durmadan surer hem de sesle ayni yerde kalir.
    LaunchedEffect(vm.autoScroll, vm.silentMode, sentences.size) {
        if (!vm.autoScroll || vm.silentMode || sentences.isEmpty()) return@LaunchedEffect
        var velocity = 0f
        var lastFrame = 0L
        while (isActive) {
            val now = withFrameNanos { it }
            val seconds = if (lastFrame == 0L) 0f
                else ((now - lastFrame) / 1_000_000_000f).coerceIn(0f, 0.1f)
            lastFrame = now
            if (seconds <= 0f) continue

            val state = ReaderState.status.value
            val info = listState.layoutInfo
            val line = info.visibleItemsInfo.firstOrNull { it.index == state.index }

            if (line == null) {
                // Okunan cumle ekranda degil (cumleye dokunuldu, sayfaya gidildi):
                // akisla degil, dogrudan oraya gidilir.
                listState.scrollToItem(state.index.coerceIn(0, sentences.lastIndex))
                velocity = 0f
                continue
            }

            val viewport = (info.viewportEndOffset - info.viewportStartOffset).toFloat()
            val desired = info.viewportStartOffset + viewport * LINE_POSITION
            val error = line.offset - desired

            // Cumlenin tahmini okunma suresi: uzunlugu / (karakter hizi x okuma hizi).
            val length = sentences.getOrNull(state.index)?.length ?: 0
            val spoken = (length / (CHARS_PER_SECOND * vm.rate)).coerceIn(0.5f, 60f)
            val flow = if (state.playing) line.size / spoken else 0f

            val goal = (flow + error * vm.scrollGain).coerceIn(-MAX_SPEED, MAX_SPEED)
            velocity += (goal - velocity) * (seconds * SMOOTHING).coerceAtMost(1f)
            if (abs(velocity) > 0.5f) listState.scrollBy(velocity * seconds)
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
                if (status.pageCount > 0)
                    "Sayfa ${text?.pageOf(shownIndex) ?: status.page} / ${status.pageCount}"
                else "Hazırlanıyor…",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                "${shownIndex + 1} / ${status.total} cümle",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Spacer(Modifier.height(8.dp))
        LinearProgressIndicator(
            progress = {
                if (status.total <= 0) 0f
                else (shownIndex.toFloat() / status.total).coerceIn(0f, 1f)
            },
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
                val active = index == shownIndex
                Text(
                    sentence,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
                    color = when {
                        active -> MaterialTheme.colorScheme.onPrimaryContainer
                        index < shownIndex -> MaterialTheme.colorScheme.onSurfaceVariant
                        else -> MaterialTheme.colorScheme.onSurface
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(
                            if (active) MaterialTheme.colorScheme.primaryContainer
                            else MaterialTheme.colorScheme.background
                        )
                        .clickable {
                            ReaderService.seek(context, index)
                            if (vm.silentMode) scope.launch { listState.scrollToItem(index) }
                        }
                        .padding(horizontal = 10.dp, vertical = 8.dp)
                )
            }
        }

        Controls(
            silent = vm.silentMode,
            playing = if (vm.silentMode) flowing else status.playing,
            onPrev = {
                if (vm.silentMode) scope.launch { pageBy(listState, -0.8f) }
                else ReaderService.previous(context)
            },
            onToggle = {
                if (vm.silentMode) {
                    flowing = !flowing
                } else if (status.playing) {
                    ReaderService.pause(context)
                } else {
                    ReaderService.play(context)
                }
            },
            onNext = {
                if (vm.silentMode) scope.launch { pageBy(listState, 0.8f) }
                else ReaderService.next(context)
            },
            onSleep = { showSleep = true },
            onPage = { showPage = true },
            onClose = { ReaderService.close(context) },
            onToggleMode = {
                val goingSilent = !vm.silentMode
                vm.updateSilentMode(goingSilent)
                if (goingSilent) {
                    // Ses sussun; akis kullanici baslatana kadar beklesin.
                    ReaderService.pause(context)
                    flowing = false
                } else {
                    // Okuma, gozun kaldigi satirdan devam etsin.
                    flowing = false
                    ReaderService.seek(context, anchorIndex)
                }
            },
            sleepAt = status.sleepAt
        )

        if (vm.silentMode) {
            FlowSpeedRow(
                step = vm.flowStep,
                value = vm.flowSpeed,
                onValue = { value, persist -> vm.updateFlowSpeed(value, persist) }
            )
        } else {
            SpeedRow(
                rate = vm.rate,
                onRate = { vm.updateRate(it) }
            )
        }
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
    silent: Boolean,
    playing: Boolean,
    onPrev: () -> Unit,
    onToggle: () -> Unit,
    onNext: () -> Unit,
    onSleep: () -> Unit,
    onPage: () -> Unit,
    onClose: () -> Unit,
    onToggleMode: () -> Unit,
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
                    contentDescription = if (silent) "Bir ekran geri" else "Önceki cümle",
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
                    contentDescription = when {
                        playing -> "Duraklat"
                        silent -> "Akışı başlat"
                        else -> "Oku"
                    },
                    modifier = Modifier.size(38.dp)
                )
            }
            Spacer(Modifier.size(10.dp))
            IconButton(onClick = onNext, modifier = Modifier.size(56.dp)) {
                Icon(
                    Icons.Filled.SkipNext,
                    contentDescription = if (silent) "Bir ekran ileri" else "Sonraki cümle",
                    modifier = Modifier.size(34.dp)
                )
            }
        }

        Row(
            Modifier
                .fillMaxWidth()
                .padding(top = 6.dp)
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Sesli okuma <-> sessiz (kendi hizinda) okuma
            FilterChip(
                selected = silent,
                onClick = onToggleMode,
                label = { Text(if (silent) "Sessiz okuma" else "Sesli okuma") },
                leadingIcon = {
                    Icon(
                        if (silent) Icons.Filled.VolumeOff else Icons.Filled.VolumeUp,
                        contentDescription = null
                    )
                }
            )
            AssistChip(
                onClick = onPage,
                label = { Text("Sayfaya git") },
                leadingIcon = { Icon(Icons.Filled.MenuBook, contentDescription = null) }
            )
            if (!silent) {
                AssistChip(
                    onClick = onSleep,
                    label = { Text(sleepLabel(sleepAt)) },
                    leadingIcon = { Icon(Icons.Filled.Bedtime, contentDescription = null) }
                )
            }
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

/** Sessiz modda akis hizi: kademe gosterilir, -/+ ile ince ayar yapilir. */
@Composable
private fun FlowSpeedRow(step: Int, value: Float, onValue: (Float, Boolean) -> Unit) {
    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "Akış hızı",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { onValue((value - 0.05f).coerceAtLeast(0f), true) }) {
                    Icon(Icons.Filled.Remove, contentDescription = "Yavaşlat")
                }
                Text("$step", style = MaterialTheme.typography.titleMedium)
                IconButton(onClick = { onValue((value + 0.05f).coerceAtMost(1f), true) }) {
                    Icon(Icons.Filled.Add, contentDescription = "Hızlandır")
                }
            }
        }
        Slider(
            value = value,
            onValueChange = { onValue(it, false) },
            onValueChangeFinished = { onValue(value, true) },
            valueRange = 0f..1f
        )
    }
}

/** Sessiz modda ileri/geri dugmeleri bir ekran kaydirir. */
private suspend fun pageBy(state: LazyListState, fraction: Float) {
    val info = state.layoutInfo
    val height = (info.viewportEndOffset - info.viewportStartOffset).toFloat()
    if (height > 0f) state.animateScrollBy(height * fraction)
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
