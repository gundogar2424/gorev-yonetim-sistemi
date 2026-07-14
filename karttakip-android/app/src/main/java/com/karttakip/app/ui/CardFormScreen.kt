package com.karttakip.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.karttakip.app.data.Card

private val PRESET_COLORS = listOf(
    0xFF3B82F6, 0xFFEF4444, 0xFF22C55E, 0xFFF59E0B,
    0xFF8B5CF6, 0xFFEC4899, 0xFF14B8A6, 0xFF64748B
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CardFormScreen(
    cardId: Long,
    onBack: () -> Unit,
    vm: CardViewModel = viewModel()
) {
    val isEdit = cardId != 0L
    var loaded by remember { mutableStateOf(!isEdit) }
    var existing by remember { mutableStateOf<Card?>(null) }

    var name by remember { mutableStateOf("") }
    var bank by remember { mutableStateOf("") }
    var statementDay by remember { mutableStateOf("") }
    var dueDay by remember { mutableStateOf("") }
    var limit by remember { mutableStateOf("") }
    var debt by remember { mutableStateOf("") }
    var remind by remember { mutableStateOf("3") }
    var color by remember { mutableStateOf(PRESET_COLORS.first()) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(cardId) {
        if (isEdit) {
            vm.getById(cardId)?.let { c ->
                existing = c
                name = c.name
                bank = c.bank
                statementDay = c.statementDay.toString()
                dueDay = c.dueDay.toString()
                limit = if (c.limit > 0) c.limit.toLong().toString() else ""
                debt = if (c.debt > 0) c.debt.toLong().toString() else ""
                remind = c.remindDaysBefore.toString()
                color = c.colorArgb
            }
            loaded = true
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (isEdit) "Kartı düzenle" else "Yeni kart") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Geri")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface
                )
            )
        }
    ) { pad ->
        if (!loaded) return@Scaffold

        Column(
            Modifier
                .padding(pad)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedTextField(
                value = name, onValueChange = { name = it },
                label = { Text("Kart adı (ör. Bonus, Maximum)") },
                singleLine = true, modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = bank, onValueChange = { bank = it },
                label = { Text("Banka (opsiyonel)") },
                singleLine = true, modifier = Modifier.fillMaxWidth()
            )

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = statementDay, onValueChange = { statementDay = it.filter(Char::isDigit).take(2) },
                    label = { Text("Kesim günü") },
                    supportingText = { Text("Ayın kaçı") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true, modifier = Modifier.weight(1f)
                )
                OutlinedTextField(
                    value = dueDay, onValueChange = { dueDay = it.filter(Char::isDigit).take(2) },
                    label = { Text("Son ödeme günü") },
                    supportingText = { Text("Ayın kaçı") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true, modifier = Modifier.weight(1f)
                )
            }

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = limit, onValueChange = { limit = it.filter(Char::isDigit) },
                    label = { Text("Limit (₺)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true, modifier = Modifier.weight(1f)
                )
                OutlinedTextField(
                    value = debt, onValueChange = { debt = it.filter(Char::isDigit) },
                    label = { Text("Güncel borç (₺)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true, modifier = Modifier.weight(1f)
                )
            }

            OutlinedTextField(
                value = remind, onValueChange = { remind = it.filter(Char::isDigit).take(2) },
                label = { Text("Son ödemeden kaç gün önce hatırlat") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true, modifier = Modifier.fillMaxWidth()
            )

            Text("Renk", fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PRESET_COLORS.forEach { c ->
                    Box(
                        Modifier
                            .size(36.dp)
                            .background(Color(c), CircleShape)
                            .then(
                                if (c == color) Modifier.border(3.dp, MaterialTheme.colorScheme.onSurface, CircleShape)
                                else Modifier
                            )
                            .clickable { color = c },
                        contentAlignment = Alignment.Center
                    ) {
                        if (c == color) Icon(Icons.Default.Check, contentDescription = null, tint = Color.White)
                    }
                }
            }

            error?.let {
                Text(it, color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Bold)
            }

            Spacer(Modifier.height(4.dp))

            Button(
                onClick = {
                    val sd = statementDay.toIntOrNull()
                    val dd = dueDay.toIntOrNull()
                    when {
                        name.isBlank() -> error = "Kart adı gerekli."
                        sd == null || sd !in 1..31 -> error = "Kesim günü 1-31 arası olmalı."
                        dd == null || dd !in 1..31 -> error = "Son ödeme günü 1-31 arası olmalı."
                        else -> {
                            error = null
                            val card = Card(
                                id = existing?.id ?: 0L,
                                name = name.trim(),
                                bank = bank.trim(),
                                statementDay = sd,
                                dueDay = dd,
                                limit = limit.toDoubleOrNull() ?: 0.0,
                                debt = debt.toDoubleOrNull() ?: 0.0,
                                colorArgb = color,
                                remindDaysBefore = remind.toIntOrNull()?.coerceIn(0, 30) ?: 3
                            )
                            vm.save(card) { onBack() }
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.Check, contentDescription = null)
                Spacer(Modifier.size(8.dp))
                Text(if (isEdit) "Kaydet" else "Ekle")
            }

            if (isEdit) {
                OutlinedButton(
                    onClick = { existing?.let { c -> vm.delete(c) { onBack() } } },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.Delete, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                    Spacer(Modifier.size(8.dp))
                    Text("Kartı sil", color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}
