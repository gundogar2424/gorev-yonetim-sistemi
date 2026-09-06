package com.seslipdf.app.ui

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DriveFileRenameOutline
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.RestartAlt
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.seslipdf.app.data.Doc
import com.seslipdf.app.data.DocSource
import com.seslipdf.app.data.DocStatus

/**
 * Kitaplik: eklenen PDF'ler, isleme durumlari ve okuma ilerlemeleri.
 */
@Composable
fun LibraryScreen(
    vm: LibraryViewModel,
    onPickPdf: () -> Unit,
    onOpen: (Doc) -> Unit
) {
    val docs by vm.docs.collectAsStateWithLifecycle()
    val working by vm.extracting.collectAsStateWithLifecycle()

    var renaming by remember { mutableStateOf<Doc?>(null) }
    var deleting by remember { mutableStateOf<Doc?>(null) }
    var unlocking by remember { mutableStateOf<Doc?>(null) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Column {
                Text("Sesli PDF", style = MaterialTheme.typography.displaySmall)
                Text(
                    "PDF'i ekleyin, uygulama metnini çıkarıp size sesli okusun.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        item {
            Button(
                onClick = onPickPdf,
                modifier = Modifier.fillMaxWidth().height(54.dp),
                shape = RoundedCornerShape(16.dp)
            ) {
                Icon(Icons.Filled.Add, contentDescription = null)
                Spacer(Modifier.size(8.dp))
                Text("PDF ekle", style = MaterialTheme.typography.labelLarge)
            }
        }

        working?.let { progress ->
            item {
                Panel {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(22.dp),
                            strokeWidth = 2.dp
                        )
                        Spacer(Modifier.size(12.dp))
                        Column {
                            Text(
                                if (progress.ocr) "Taranmış sayfalar okunuyor (OCR)"
                                else "Metin çıkarılıyor",
                                style = MaterialTheme.typography.titleSmall
                            )
                            Text(
                                "${progress.page} / ${progress.total} sayfa",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    Spacer(Modifier.size(10.dp))
                    LinearProgressIndicator(
                        progress = { progress.ratio },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }

        if (docs.isEmpty()) {
            item {
                Panel {
                    Text("Henüz belge yok", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.size(6.dp))
                    Text(
                        "\"PDF ekle\" ile telefonunuzdaki bir PDF'i seçin. Başka bir " +
                            "uygulamada PDF'i paylaşıp \"Sesli PDF\"i seçerek de " +
                            "ekleyebilirsiniz.\n\nSeçtiğiniz dosya kopyalanmaz; yalnızca " +
                            "metni çıkarılıp telefonda saklanır.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        items(docs, key = { it.id }) { doc ->
            DocCard(
                doc = doc,
                onOpen = {
                    when (doc.status) {
                        DocStatus.READY -> onOpen(doc)
                        DocStatus.LOCKED -> unlocking = doc
                        DocStatus.FAILED, DocStatus.PENDING -> vm.retry(doc)
                        else -> Unit
                    }
                },
                onRename = { renaming = doc },
                onRestart = { vm.restart(doc) },
                onRetry = { if (doc.status == DocStatus.LOCKED) unlocking = doc else vm.retry(doc) },
                onDelete = { deleting = doc }
            )
        }

        item { Spacer(Modifier.height(24.dp)) }
    }

    renaming?.let { doc ->
        var name by remember(doc.id) { mutableStateOf(doc.title) }
        AlertDialog(
            onDismissRequest = { renaming = null },
            title = { Text("Adı değiştir") },
            text = {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                TextButton(onClick = { vm.rename(doc, name); renaming = null }) { Text("Kaydet") }
            },
            dismissButton = {
                TextButton(onClick = { renaming = null }) { Text("Vazgeç") }
            }
        )
    }

    deleting?.let { doc ->
        AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("Silinsin mi?") },
            text = {
                Text(
                    "\"${doc.title}\" kitaplıktan kaldırılacak ve çıkarılmış metni " +
                        "silinecek. PDF dosyanıza dokunulmaz."
                )
            },
            confirmButton = {
                TextButton(onClick = { vm.delete(doc); deleting = null }) { Text("Sil") }
            },
            dismissButton = {
                TextButton(onClick = { deleting = null }) { Text("Vazgeç") }
            }
        )
    }

    unlocking?.let { doc ->
        var password by remember(doc.id) { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { unlocking = null },
            icon = { Icon(Icons.Filled.Lock, contentDescription = null) },
            title = { Text("PDF parolası") },
            text = {
                Column {
                    Text(
                        "Bu belge parola ile korunuyor. Parola yalnızca metni çıkarmak " +
                            "için kullanılır, hiçbir yere kaydedilmez."
                    )
                    Spacer(Modifier.size(12.dp))
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = { vm.retry(doc, password); unlocking = null }) { Text("Aç") }
            },
            dismissButton = {
                TextButton(onClick = { unlocking = null }) { Text("Vazgeç") }
            }
        )
    }
}

@Composable
private fun DocCard(
    doc: Doc,
    onOpen: () -> Unit,
    onRename: () -> Unit,
    onRestart: () -> Unit,
    onRetry: () -> Unit,
    onDelete: () -> Unit
) {
    var menu by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onOpen),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(doc.title, style = MaterialTheme.typography.titleMedium, maxLines = 2)
                    Spacer(Modifier.size(4.dp))
                    Text(
                        subtitle(doc),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                if (doc.ready) {
                    FilledIconButton(onClick = onOpen) {
                        Icon(Icons.Filled.PlayArrow, contentDescription = "Oku")
                    }
                } else if (doc.status == DocStatus.LOCKED) {
                    FilledIconButton(onClick = onRetry) {
                        Icon(Icons.Filled.Lock, contentDescription = "Parola gir")
                    }
                } else if (doc.status == DocStatus.FAILED || doc.status == DocStatus.PENDING) {
                    FilledIconButton(onClick = onRetry) {
                        Icon(Icons.Filled.Refresh, contentDescription = "Yeniden dene")
                    }
                }

                Box {
                    IconButton(onClick = { menu = true }) {
                        Icon(Icons.Filled.MoreVert, contentDescription = "Seçenekler")
                    }
                    DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                        DropdownMenuItem(
                            text = { Text("Adı değiştir") },
                            leadingIcon = {
                                Icon(Icons.Filled.DriveFileRenameOutline, contentDescription = null)
                            },
                            onClick = { menu = false; onRename() }
                        )
                        if (doc.ready) {
                            DropdownMenuItem(
                                text = { Text("Baştan başla") },
                                leadingIcon = {
                                    Icon(Icons.Filled.RestartAlt, contentDescription = null)
                                },
                                onClick = { menu = false; onRestart() }
                            )
                        }
                        DropdownMenuItem(
                            text = { Text("Metni yeniden çıkar") },
                            leadingIcon = { Icon(Icons.Filled.Refresh, contentDescription = null) },
                            onClick = { menu = false; onRetry() }
                        )
                        DropdownMenuItem(
                            text = { Text("Sil") },
                            leadingIcon = { Icon(Icons.Filled.Delete, contentDescription = null) },
                            onClick = { menu = false; onDelete() }
                        )
                    }
                }
            }

            if (doc.ready && doc.position > 0) {
                Spacer(Modifier.size(10.dp))
                LinearProgressIndicator(
                    progress = { doc.progress },
                    modifier = Modifier.fillMaxWidth()
                )
            }

            if (doc.note.isNotBlank()) {
                Spacer(Modifier.size(8.dp))
                Text(
                    doc.note,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (doc.status == DocStatus.READY)
                        MaterialTheme.colorScheme.onSurfaceVariant
                    else MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

/** Kart altindaki tek satirlik ozet. */
private fun subtitle(doc: Doc): String = when (doc.status) {
    DocStatus.READY -> buildString {
        append("${doc.pageCount} sayfa")
        if (doc.position > 0) append("  ·  ${percentText(doc.progress)} okundu")
        if (doc.source != DocSource.TEXT) append("  ·  ${DocSource.label(doc.source)}")
    }
    DocStatus.WORKING -> "Metin çıkarılıyor…"
    DocStatus.PENDING -> "Sırada — dokunarak başlatın"
    DocStatus.LOCKED -> "Parola gerekli — dokunun"
    else -> "Okunamadı — yeniden denemek için dokunun"
}
