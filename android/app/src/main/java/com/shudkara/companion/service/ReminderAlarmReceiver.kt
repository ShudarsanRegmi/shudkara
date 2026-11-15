package com.shudkara.companion.service

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.shudkara.companion.ShudkaraApp
import com.shudkara.companion.ui.ReminderAlertActivity

class ReminderAlarmReceiver : BroadcastReceiver() {

    companion object {
        const val TAG = "ReminderAlarmReceiver"
        const val EXTRA_REMINDER_ID = "extra_reminder_id"
        const val EXTRA_TITLE = "extra_title"
        const val EXTRA_MESSAGE = "extra_message"
        const val EXTRA_PRIORITY = "extra_priority"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getStringExtra(EXTRA_REMINDER_ID) ?: ""
        val title = intent.getStringExtra(EXTRA_TITLE) ?: "Reminder"
        val message = intent.getStringExtra(EXTRA_MESSAGE) ?: ""
        val priority = intent.getStringExtra(EXTRA_PRIORITY) ?: "important"

        Log.d(TAG, "Triggered reminder alarm: $title ($id)")

        // 1. Vibrate device with distinct pattern (0ms wait, 600ms vibe, 200ms rest, 600ms vibe)
        triggerVibration(context)

        // 2. Prepare Full-Screen Intent for ReminderAlertActivity
        val fullScreenIntent = Intent(context, ReminderAlertActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(ReminderAlertActivity.EXTRA_REMINDER_ID, id)
            putExtra(ReminderAlertActivity.EXTRA_TITLE, title)
            putExtra(ReminderAlertActivity.EXTRA_MESSAGE, message)
        }

        val notifId = (id.hashCode() and 0x7FFFFFFF) % 1000000
        val fullScreenPendingIntent = PendingIntent.getActivity(
            context,
            notifId,
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Default alarm sound URI
        val alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        // 3. Post High-Priority Notification with Full-Screen Intent
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val builder = NotificationCompat.Builder(context, ShudkaraApp.CHANNEL_ALARMS_REMINDERS)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("⏰ $title")
            .setContentText(if (message.isNotBlank()) message else "Scheduled reminder from Shudkara")
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setSound(alarmSound)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Open Alert", fullScreenPendingIntent)

        notificationManager.notify(notifId, builder.build())

        // 4. Try directly starting the full-screen dialog
        try {
            context.startActivity(fullScreenIntent)
        } catch (e: Exception) {
            Log.w(TAG, "Direct activity start restricted by background limits, relied on fullScreenIntent", e)
        }
    }

    private fun triggerVibration(context: Context) {
        try {
            val pattern = longArrayOf(0, 700, 250, 700, 250, 1000)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator?.vibrate(VibrationEffect.createWaveform(pattern, -1))
            } else {
                @Suppress("DEPRECATION")
                val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator?.vibrate(VibrationEffect.createWaveform(pattern, -1))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator?.vibrate(pattern, -1)
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Vibration could not be triggered", e)
        }
    }
}
