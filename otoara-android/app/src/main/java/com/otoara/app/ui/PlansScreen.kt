package com.otoara.app.ui

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.otoara.app.data.Plan
import com.otoara.app.data.PlanRepeat
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

private val dayFormat = SimpleDateFormat("d MMMM yyyy, EEEE", Locale("tr"))
private val timeFormat = SimpleDateFormat("HH:mm", Locale("tr"))

@Composable
fun PlansScreen(
    vm: RedialViewModel,
    onPickContact: () -> Unit
) {
    if (vm.planFormOpen) {
        PlanForm(vm, onPickContact)
    } else {
        PlanList(vm)
    }
}

@Composable
private fun PlanList(vm: RedialViewModel) {
    val plans by vm.plans.collectAsState()

    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp)
        ) {
            Text(
                "Planlı Aramalar",
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.weight(1f)
            )
            IconButton(onClick = { vm.newPlan() }) {
                Icon(
                    Icons.Filled.Add,
                    contentDescription = "Yeni plan",
                    tint = MaterialTheme.colorScheme.primary
                )
            }
        }

        Text(
            "Belirlediğiniz tarih ve saatte telefon size sorar. Uygulama " +
                "kendiliğinden aramaz — arama ancak siz \"Ara\" dediğinizde başlar.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(vertical = 8.dp)
        )

        if (plans.isEmpty()) {
            Panel(modifier = Modifier.padding(top = 24.dp)) {
                Text("Henüz plan yok", style = MaterialTheme.typography.titleSmall)
                Text(
                    "Sağ üstteki + ile bir numara, tarih/saat ve kısa bir not ekleyin.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
            return@Column
        }

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.padding(top = 4.dp, bottom = 16.dp)
        ) {
            items(plans, key = { it.id }) { plan -> PlanRow(plan, vm) }
        }
    }
}

@Composable
private fun PlanRow(plan: Plan, vm: RedialViewModel) {
    val past = plan.timeAt < System.currentTimeMillis() && plan.repeat == PlanRepeat.ONCE
    Panel(modifier = Modifier.clickable { vm.editPlan(plan) }) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(plan.title, style = MaterialTheme.typography.titleSmall)
                if (plan.label.isNotBlank()) {
                    Text(
                        plan.number,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Text(
                    "${dayFormat.format(Date(plan.timeAt))} · ${timeFormat.format(Date(plan.timeAt))}",
                    style = MaterialTheme.typography.bodySmall,
                    color = if (past) MaterialTheme.colorScheme.onSurfaceVariant
                    else MaterialTheme.colorScheme.primary
                )
                if (plan.repeat != PlanRepeat.ONCE) {
                    Text(
                        PlanRepeat.label(plan.repeat),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.secondary
                    )
                }
                if (plan.note.isNotBlank()) {
                    Text(
                        plan.note,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
                if (past && !plan.enabled) {
                    Text(
                        "Zamanı geçti",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            Spacer(Modifier.width(8.dp))
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Switch(
                    checked = plan.enabled,
                    onCheckedChange = { vm.togglePlan(plan, it) }
                )
                IconButton(onClick = { vm.deletePlan(plan) }) {
                    Icon(
                        Icons.Filled.Delete,
                        contentDescription = "Sil",
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun PlanForm(vm: RedialViewModel, onPickContact: () -> Unit) {
    val context = LocalContext.current
    var error by remember { mutableStateOf<String?>(null) }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp)
            .padding(top = 12.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { vm.closePlanForm() }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Geri")
            }
            Text(
                if (vm.planId == 0L) "Yeni Plan" else "Planı Düzenle",
                style = MaterialTheme.typography.headlineSmall
            )
        }

        Panel(title = "Aranacak numara") {
            Spacer(Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = vm.planNumber,
                    onValueChange = { vm.updatePlanNumber(it, "") },
                    singleLine = true,
                    placeholder = { Text("05xx xxx xx xx") },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    textStyle = MaterialTheme.typography.titleLarge,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone)
                )
                Spacer(Modifier.width(8.dp))
                IconButton(
                    onClick = { vm.updatePickingForPlan(true); onPickContact() },
                    modifier = Modifier.size(52.dp)
                ) {
                    Icon(
                        Icons.Filled.Person,
                        contentDescription = "Kişilerden seç",
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(30.dp)
                    )
                }
            }
            if (vm.planLabel.isNotBlank()) {
                Text(
                    vm.planLabel,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(top = 6.dp)
                )
            }
        }

        Panel(title = "Ne zaman sorulsun?") {
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(
                    onClick = { pickDate(context, vm) },
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Filled.CalendarMonth, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(dayFormat.format(Date(vm.planTime)), maxLines = 1)
                }
            }
            Spacer(Modifier.height(10.dp))
            OutlinedButton(
                onClick = { pickTime(context, vm) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Filled.Schedule, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(timeFormat.format(Date(vm.planTime)))
            }

            Spacer(Modifier.height(14.dp))
            Text(
                "Tekrar",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier
                    .padding(top = 8.dp)
                    .horizontalScroll(rememberScrollState())
            ) {
                PlanRepeat.all.forEach { code ->
                    FilterChip(
                        selected = vm.planRepeat == code,
                        onClick = { vm.updatePlanRepeat(code) },
                        label = { Text(PlanRepeat.label(code)) }
                    )
                }
            }
        }

        Panel(title = "Not") {
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                value = vm.planNote,
                onValueChange = { vm.updatePlanNote(it) },
                placeholder = { Text("Niçin aranacak? (ör. fatura sorusu)") },
                supportingText = { Text("Hatırlatma bildiriminde bu not görünür.") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                minLines = 2
            )
        }

        if (error != null) {
            Text(
                error!!,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            TextButton(
                onClick = { vm.closePlanForm() },
                modifier = Modifier.weight(1f)
            ) { Text("Vazgeç") }
            Button(
                onClick = {
                    val problem = vm.validatePlan()
                    if (problem != null) {
                        error = problem
                    } else {
                        error = null
                        vm.savePlan()
                    }
                },
                modifier = Modifier.weight(2f).height(52.dp),
                shape = RoundedCornerShape(14.dp)
            ) { Text("Kaydet") }
        }
    }
}

private fun pickDate(context: android.content.Context, vm: RedialViewModel) {
    val cal = Calendar.getInstance().apply { timeInMillis = vm.planTime }
    DatePickerDialog(
        context,
        { _, year, month, day ->
            val c = Calendar.getInstance().apply { timeInMillis = vm.planTime }
            c.set(Calendar.YEAR, year)
            c.set(Calendar.MONTH, month)
            c.set(Calendar.DAY_OF_MONTH, day)
            vm.updatePlanTime(c.timeInMillis)
        },
        cal.get(Calendar.YEAR),
        cal.get(Calendar.MONTH),
        cal.get(Calendar.DAY_OF_MONTH)
    ).apply {
        datePicker.minDate = System.currentTimeMillis() - 60_000
    }.show()
}

private fun pickTime(context: android.content.Context, vm: RedialViewModel) {
    val cal = Calendar.getInstance().apply { timeInMillis = vm.planTime }
    TimePickerDialog(
        context,
        { _, hour, minute ->
            val c = Calendar.getInstance().apply { timeInMillis = vm.planTime }
            c.set(Calendar.HOUR_OF_DAY, hour)
            c.set(Calendar.MINUTE, minute)
            c.set(Calendar.SECOND, 0)
            c.set(Calendar.MILLISECOND, 0)
            vm.updatePlanTime(c.timeInMillis)
        },
        cal.get(Calendar.HOUR_OF_DAY),
        cal.get(Calendar.MINUTE),
        true
    ).show()
}
