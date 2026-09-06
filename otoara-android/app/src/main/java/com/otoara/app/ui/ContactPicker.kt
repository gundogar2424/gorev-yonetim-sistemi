package com.otoara.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.otoara.app.data.ContactEntry

/**
 * Uygulamanin kendi rehber ekrani.
 *
 * Sistemin secme ekrani numaralari listeledigi icin ayni kisi alt alta
 * defalarca cikiyordu; burada her kisi **tek satir**, ayni numara tekrarlari
 * elenmis halde gorunur. Kisinin birden fazla farkli numarasi varsa satira
 * dokununca altinda acilir.
 */
@Composable
fun ContactPickerDialog(vm: RedialViewModel) {
    Dialog(
        onDismissRequest = { vm.closeContacts() },
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.background
        ) {
            Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth().padding(top = 14.dp)
                ) {
                    Text(
                        "Kişiler",
                        style = MaterialTheme.typography.headlineSmall,
                        modifier = Modifier.weight(1f)
                    )
                    IconButton(onClick = { vm.closeContacts() }) {
                        Icon(Icons.Filled.Close, contentDescription = "Kapat")
                    }
                }

                OutlinedTextField(
                    value = vm.contactQuery,
                    onValueChange = { vm.updateContactQuery(it) },
                    singleLine = true,
                    placeholder = { Text("İsim veya numara ara") },
                    leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp)
                )

                when {
                    vm.contactsLoading -> Box(
                        Modifier.fillMaxWidth().padding(top = 48.dp),
                        contentAlignment = Alignment.Center
                    ) { CircularProgressIndicator() }

                    vm.contacts.isEmpty() -> Text(
                        "Rehberde numaralı kişi bulunamadı.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().padding(top = 48.dp)
                    )

                    else -> {
                        val list = vm.visibleContacts
                        if (list.isEmpty()) {
                            Text(
                                "Eşleşen kişi yok.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.fillMaxWidth().padding(top = 32.dp)
                            )
                        } else {
                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(2.dp),
                                modifier = Modifier.padding(bottom = 12.dp)
                            ) {
                                items(list, key = { it.name }) { contact ->
                                    ContactRow(contact) { number ->
                                        vm.chooseContact(contact.name, number)
                                    }
                                    HorizontalDivider(
                                        color = MaterialTheme.colorScheme.outlineVariant
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ContactRow(contact: ContactEntry, onPick: (String) -> Unit) {
    var expanded by remember(contact.name) { mutableStateOf(false) }
    val single = contact.numbers.size == 1

    Column(
        Modifier
            .fillMaxWidth()
            .clickable {
                if (single) onPick(contact.numbers.first().number) else expanded = !expanded
            }
            .padding(vertical = 12.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                contact.name,
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.weight(1f)
            )
            if (!single) {
                Text(
                    "${contact.numbers.size} numara",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }

        if (single) {
            Text(
                contact.numbers.first().number,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        } else if (expanded) {
            contact.numbers.forEach { phone ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onPick(phone.number) }
                        .padding(top = 10.dp, start = 8.dp)
                ) {
                    Text(
                        phone.number,
                        style = MaterialTheme.typography.bodyLarge,
                        modifier = Modifier.weight(1f)
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        phone.typeLabel,
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}
