package com.shudkara.companion.ui

import android.app.KeyguardManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Snooze
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shudkara.companion.service.ReminderScheduler
import com.shudkara.companion.ui.theme.*
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class ReminderAlertActivity : ComponentActivity() {

    companion object {
        const val EXTRA_REMINDER_ID = "extra_reminder_id"
        const val EXTRA_TITLE = "extra_title"
        const val EXTRA_MESSAGE = "extra_message"
    }

    private var ringtone: Ringtone? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Ensure activity wakes device and displays even on lockscreen
        turnScreenOnAndUnlock()

        val reminderId = intent.getStringExtra(EXTRA_REMINDER_ID) ?: ""
        val title = intent.getStringExtra(EXTRA_TITLE) ?: "Reminder"
        val message = intent.getStringExtra(EXTRA_MESSAGE) ?: ""

        // Play alarm ringtone
        startAlarmAudio()

        setContent {
            ShudkaraTheme {
                ReminderAlertContent(
                    title = title,
                    message = message,
                    onDismiss = {
                        stopAlarmAudio()
                        dismissNotification(reminderId)
                        finish()
                    },
                    onSnooze = {
                        stopAlarmAudio()
                        dismissNotification(reminderId)
                        val snoozeMillis = System.currentTimeMillis() + 5 * 60 * 1000L
                        ReminderScheduler.scheduleExactReminder(
                            context = this@ReminderAlertActivity,
                            id = reminderId,
                            title = title,
                            message = message,
                            triggerTimeMillis = snoozeMillis
                        )
                        Toast.makeText(this@ReminderAlertActivity, "Snoozed for 5 minutes", Toast.LENGTH_SHORT).show()
                        finish()
                    },
                    onOpenApp = {
                        stopAlarmAudio()
                        dismissNotification(reminderId)
                        val appIntent = Intent(this@ReminderAlertActivity, MainActivity::class.java).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                        }
                        startActivity(appIntent)
                        finish()
                    }
                )
            }
        }
    }

    private fun turnScreenOnAndUnlock() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(KeyguardManager::class.java)
            keyguardManager?.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }
    }

    private fun startAlarmAudio() {
        try {
            val alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

            val r = RingtoneManager.getRingtone(this, alertUri)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                r.audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            }
            r.play()
            ringtone = r
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun stopAlarmAudio() {
        try {
            ringtone?.stop()
            ringtone = null
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun dismissNotification(id: String) {
        val notifId = (id.hashCode() and 0x7FFFFFFF) % 1000000
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        notificationManager?.cancel(notifId)
    }

    override fun onDestroy() {
        super.onDestroy()
        stopAlarmAudio()
    }
}

@Composable
fun ReminderAlertContent(
    title: String,
    message: String,
    onDismiss: () -> Unit,
    onSnooze: () -> Unit,
    onOpenApp: () -> Unit
) {
    val currentTime = remember {
        SimpleDateFormat("hh:mm a", Locale.getDefault()).format(Date())
    }

    // Pulsing circle animation
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 0.95f,
        targetValue = 1.15f,
        animationSpec = infiniteRepeatable(
            animation = tween(600, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulseScale"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.65f))
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Card(
            shape = RoundedCornerShape(32.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 16.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Animated Bell Icon
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(80.dp)
                        .scale(pulseScale)
                        .clip(CircleShape)
                        .background(Amber100)
                ) {
                    Icon(
                        imageVector = Icons.Default.Alarm,
                        contentDescription = "Alarm ringing",
                        tint = Amber600,
                        modifier = Modifier.size(44.dp)
                    )
                }

                // Current Time
                Text(
                    text = currentTime,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate400
                )

                // Title
                Text(
                    text = title,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Black,
                    color = Slate900,
                    textAlign = TextAlign.Center
                )

                // Message Notes
                if (message.isNotBlank()) {
                    Surface(
                        color = Slate50,
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = message,
                            fontSize = 13.sp,
                            color = Slate600,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(14.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Action Buttons
                Button(
                    onClick = onDismiss,
                    colors = ButtonDefaults.buttonColors(containerColor = Amber600),
                    shape = RoundedCornerShape(18.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                ) {
                    Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Acknowledge & Dismiss", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = onSnooze,
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier
                            .weight(1f)
                            .height(46.dp)
                    ) {
                        Icon(Icons.Default.Snooze, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Snooze 5m", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    }

                    TextButton(
                        onClick = onOpenApp,
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier
                            .weight(1f)
                            .height(46.dp)
                    ) {
                        Text("Open App", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Indigo600)
                    }
                }
            }
        }
    }
}
