package com.shudkara.companion.ui

import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shudkara.companion.data.AlarmItemDto
import com.shudkara.companion.data.ShudkaraApi
import com.shudkara.companion.service.ReminderScheduler
import com.shudkara.companion.service.SystemAlarmHelper
import com.shudkara.companion.ui.theme.*
import kotlinx.coroutines.launch
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AlarmsScreen(
    api: ShudkaraApi,
    context: Context
) {
    val coroutineScope = rememberCoroutineScope()
    var hour by remember { mutableIntStateOf(7) }
    var minute by remember { mutableIntStateOf(0) }
    var isPm by remember { mutableStateOf(false) }
    var label by remember { mutableStateOf("") }
    var vibrate by remember { mutableStateOf(true) }
    var isSyncing by remember { mutableStateOf(false) }
    var cloudAlarms by remember { mutableStateOf<List<AlarmItemDto>>(emptyList()) }
    var isLoadingAlarms by remember { mutableStateOf(false) }

    val refreshCloudAlarms = {
        coroutineScope.launch {
            isLoadingAlarms = true
            val res = api.fetchAlarms()
            if (res.isSuccess) {
                cloudAlarms = res.getOrNull() ?: emptyList()
            }
            isLoadingAlarms = false
        }
    }

    LaunchedEffect(Unit) {
        refreshCloudAlarms()
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // 1. Header Card
        item {
            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Amber50),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(Amber100)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Alarm,
                            contentDescription = null,
                            tint = Amber600,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Hardware Alarms Bridge",
                            fontWeight = FontWeight.Black,
                            fontSize = 15.sp,
                            color = Slate900
                        )
                        Text(
                            text = "Syncs with phone Clock & exact in-app alert dialogs",
                            fontSize = 11.sp,
                            color = Slate600
                        )
                    }
                }
            }
        }

        // 2. Quick Native System Alarm Creator
        item {
            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "Set System Clock Alarm",
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = Slate900
                        )
                        TextButton(
                            onClick = {
                                SystemAlarmHelper.openClockAlarms(context)
                            }
                        ) {
                            Text("Open Clock App", fontSize = 11.sp, color = Indigo600)
                        }
                    }

                    // Time Picker row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Hour Selector
                        Surface(
                            shape = RoundedCornerShape(14.dp),
                            color = Slate100,
                            modifier = Modifier.padding(4.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                IconButton(
                                    onClick = { hour = if (hour > 1) hour - 1 else 12 },
                                    modifier = Modifier.size(36.dp)
                                ) {
                                    Icon(Icons.Default.Remove, contentDescription = null, modifier = Modifier.size(16.dp))
                                }
                                Text(
                                    text = String.format(Locale.getDefault(), "%02d", hour),
                                    fontSize = 26.sp,
                                    fontWeight = FontWeight.Black,
                                    color = Slate900,
                                    modifier = Modifier.padding(horizontal = 8.dp)
                                )
                                IconButton(
                                    onClick = { hour = if (hour < 12) hour + 1 else 1 },
                                    modifier = Modifier.size(36.dp)
                                ) {
                                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                                }
                            }
                        }

                        Text(":", fontSize = 28.sp, fontWeight = FontWeight.Black, color = Slate400, modifier = Modifier.padding(horizontal = 4.dp))

                        // Minute Selector
                        Surface(
                            shape = RoundedCornerShape(14.dp),
                            color = Slate100,
                            modifier = Modifier.padding(4.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                IconButton(
                                    onClick = { minute = if (minute >= 5) minute - 5 else 55 },
                                    modifier = Modifier.size(36.dp)
                                ) {
                                    Icon(Icons.Default.Remove, contentDescription = null, modifier = Modifier.size(16.dp))
                                }
                                Text(
                                    text = String.format(Locale.getDefault(), "%02d", minute),
                                    fontSize = 26.sp,
                                    fontWeight = FontWeight.Black,
                                    color = Slate900,
                                    modifier = Modifier.padding(horizontal = 8.dp)
                                )
                                IconButton(
                                    onClick = { minute = if (minute <= 50) minute + 5 else 0 },
                                    modifier = Modifier.size(36.dp)
                                ) {
                                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                                }
                            }
                        }

                        Spacer(Modifier.width(8.dp))

                        // AM/PM Toggle
                        Surface(
                            shape = RoundedCornerShape(14.dp),
                            color = Slate100,
                            modifier = Modifier.padding(4.dp)
                        ) {
                            Row {
                                Surface(
                                    shape = RoundedCornerShape(10.dp),
                                    color = if (!isPm) Amber500 else Color.Transparent,
                                    modifier = Modifier.clickable { isPm = false }
                                ) {
                                    Text(
                                        text = "AM",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 12.sp,
                                        color = if (!isPm) Color.White else Slate600,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp)
                                    )
                                }
                                Surface(
                                    shape = RoundedCornerShape(10.dp),
                                    color = if (isPm) Amber500 else Color.Transparent,
                                    modifier = Modifier.clickable { isPm = true }
                                ) {
                                    Text(
                                        text = "PM",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 12.sp,
                                        color = if (isPm) Color.White else Slate600,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp)
                                    )
                                }
                            }
                        }
                    }

                    // Label Input
                    OutlinedTextField(
                        value = label,
                        onValueChange = { label = it },
                        label = { Text("Alarm Label / Message", fontSize = 12.sp) },
                        placeholder = { Text("e.g. Wake up, Habit check-in", fontSize = 12.sp) },
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    // Vibrate Switch Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Vibrate on Ring", fontSize = 13.sp, color = Slate700, fontWeight = FontWeight.Medium)
                        Switch(
                            checked = vibrate,
                            onCheckedChange = { vibrate = it },
                            colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = Amber500)
                        )
                    }

                    // Action Button: Set Phone Alarm
                    Button(
                        onClick = {
                            var finalHour = hour
                            if (isPm && finalHour < 12) finalHour += 12
                            if (!isPm && finalHour == 12) finalHour = 0

                            val success = SystemAlarmHelper.setSystemClockAlarm(
                                context = context,
                                hour = finalHour,
                                minutes = minute,
                                message = label.ifBlank { "Shudkara Alarm" },
                                vibrate = vibrate,
                                skipUi = true
                            )
                            if (success) {
                                Toast.makeText(context, "System Alarm set for $finalHour:${String.format(Locale.getDefault(), "%02d", minute)}!", Toast.LENGTH_SHORT).show()
                                coroutineScope.launch {
                                    api.createAlarm(
                                        title = label.ifBlank { "System Alarm" },
                                        hour = finalHour,
                                        minutes = minute,
                                        message = label,
                                        vibrate = vibrate,
                                        syncToDevice = false // Already set locally
                                    )
                                    refreshCloudAlarms()
                                }
                            } else {
                                Toast.makeText(context, "Could not set alarm on this device.", Toast.LENGTH_SHORT).show()
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Amber600),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                    ) {
                        Icon(Icons.Default.Alarm, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Set Device System Alarm", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
                }
            }
        }

        // 3. Cloud Sync Controls
        item {
            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Cloud Sync & Reminders",
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = Slate900
                        )
                        IconButton(onClick = { refreshCloudAlarms() }) {
                            Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = Slate500)
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Button(
                            onClick = {
                                coroutineScope.launch {
                                    isSyncing = true
                                    val syncRes = api.syncPendingDeviceAlarms()
                                    isSyncing = false
                                    if (syncRes.isSuccess) {
                                        val count = syncRes.getOrNull() ?: 0
                                        Toast.makeText(context, "Synced $count pending alarms from cloud!", Toast.LENGTH_SHORT).show()
                                        refreshCloudAlarms()
                                    } else {
                                        Toast.makeText(context, "Sync failed: ${syncRes.exceptionOrNull()?.message}", Toast.LENGTH_SHORT).show()
                                    }
                                }
                            },
                            enabled = !isSyncing,
                            colors = ButtonDefaults.buttonColors(containerColor = Indigo600),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.Sync, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(if (isSyncing) "Syncing..." else "Pull Cloud Alarms", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }

                        OutlinedButton(
                            onClick = {
                                // Test exact reminder firing in 5 seconds
                                val testTrigger = System.currentTimeMillis() + 5000L
                                ReminderScheduler.scheduleExactReminder(
                                    context = context,
                                    id = "test-${System.currentTimeMillis()}",
                                    title = "Test Shudkara Alarm",
                                    message = "This is a heads-up pop-up alert triggered from Companion!",
                                    triggerTimeMillis = testTrigger,
                                    priority = "urgent"
                                )
                                Toast.makeText(context, "Test reminder scheduled in 5 seconds!", Toast.LENGTH_LONG).show()
                            },
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.NotificationsActive, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Test Pop-up Alert", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }

        // 4. Cloud Alarms List
        item {
            Text(
                text = "Cloud Alarms & Reminders (${cloudAlarms.size})",
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
                color = Slate600,
                modifier = Modifier.padding(start = 4.dp, top = 4.dp)
            )
        }

        if (isLoadingAlarms) {
            item {
                Box(modifier = Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Amber500, modifier = Modifier.size(28.dp))
                }
            }
        } else if (cloudAlarms.isEmpty()) {
            item {
                Card(
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(containerColor = Slate100),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "No alarms synced yet",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 13.sp,
                            color = Slate600
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            text = "Create alarms from Shudkara website or set a device alarm above",
                            fontSize = 11.sp,
                            color = Slate400,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        } else {
            items(cloudAlarms) { alarm ->
                Card(
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = alarm.title,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = Slate900
                                )
                                Spacer(Modifier.width(8.dp))
                                if (alarm.type == "alarm" && alarm.hour != null) {
                                    val ampm = if (alarm.hour >= 12) "PM" else "AM"
                                    val dispH = if (alarm.hour % 12 == 0) 12 else alarm.hour % 12
                                    Surface(
                                        shape = RoundedCornerShape(6.dp),
                                        color = Amber50
                                    ) {
                                        Text(
                                            text = String.format(Locale.getDefault(), "%02d:%02d %s", dispH, alarm.minutes ?: 0, ampm),
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Amber700,
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                        )
                                    }
                                }
                            }

                            if (!alarm.message.isNullOrBlank()) {
                                Text(
                                    text = alarm.message,
                                    fontSize = 11.sp,
                                    color = Slate500,
                                    modifier = Modifier.padding(top = 2.dp)
                                )
                            }

                            Text(
                                text = "Status: ${alarm.deviceSyncStatus}",
                                fontSize = 10.sp,
                                color = if (alarm.deviceSyncStatus == "synced") Emerald600 else Amber600,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.padding(top = 4.dp)
                            )
                        }

                        IconButton(
                            onClick = {
                                coroutineScope.launch {
                                    api.deleteAlarm(alarm.id)
                                    refreshCloudAlarms()
                                }
                            }
                        ) {
                            Icon(Icons.Default.Delete, contentDescription = "Delete", tint = Slate400, modifier = Modifier.size(20.dp))
                        }
                    }
                }
            }
        }
    }
}
