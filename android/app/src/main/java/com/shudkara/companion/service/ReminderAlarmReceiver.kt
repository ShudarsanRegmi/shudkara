package com.shudkara.companion.service

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.util.Log
import android.widget.Toast
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
        const val ACTION_DISMISS = "com.shudkara.companion.ACTION_DISMISS_REMINDER"
        const val ACTION_SNOOZE = "com.shudkara.companion.ACTION_SNOOZE_REMINDER"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getStringExtra(EXTRA_REMINDER_ID) ?: ""
        val title = intent.getStringExtra(EXTRA_TITLE) ?: "Reminder"
        val message = intent.getStringExtra(EXTRA_MESSAGE) ?: ""
        val notifId = (id.hashCode() and 0x7FFFFFFF) % 1000000

        // Handle Quick Actions from Notification
        if (intent.action == ACTION_DISMISS) {
            AlarmRingtoneManager.stopAlarmSound(context)
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            nm?.cancel(notifId)
            Toast.makeText(context, "Reminder dismissed", Toast.LENGTH_SHORT).show()
            return
        }

        if (intent.action == ACTION_SNOOZE) {
            AlarmRingtoneManager.stopAlarmSound(context)
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            nm?.cancel(notifId)
            val snoozeMillis = System.currentTimeMillis() + 5 * 60 * 1000L
            ReminderScheduler.scheduleExactReminder(context, id, title, message, snoozeMillis)
            Toast.makeText(context, "Snoozed for 5 minutes", Toast.LENGTH_SHORT).show()
            return
        }

        Log.d(TAG, "Triggered reminder alarm: '$title' ($id)")

        // 1. Unconditionally Start Loud Repeating Alarm Sound & Vibration immediately
        AlarmRingtoneManager.startAlarmSound(context, id)

        // 2. Prepare Full-Screen Intent for ReminderAlertActivity
        val fullScreenIntent = Intent(context, ReminderAlertActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra(ReminderAlertActivity.EXTRA_REMINDER_ID, id)
            putExtra(ReminderAlertActivity.EXTRA_TITLE, title)
            putExtra(ReminderAlertActivity.EXTRA_MESSAGE, message)
        }

        val fullScreenPendingIntent = PendingIntent.getActivity(
            context,
            notifId,
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // 3. Prepare Notification Dismiss Action
        val dismissIntent = Intent(context, ReminderAlarmReceiver::class.java).apply {
            action = ACTION_DISMISS
            putExtra(EXTRA_REMINDER_ID, id)
        }
        val dismissPendingIntent = PendingIntent.getBroadcast(
            context,
            notifId + 1,
            dismissIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // 4. Prepare Notification Snooze Action
        val snoozeIntent = Intent(context, ReminderAlarmReceiver::class.java).apply {
            action = ACTION_SNOOZE
            putExtra(EXTRA_REMINDER_ID, id)
            putExtra(EXTRA_TITLE, title)
            putExtra(EXTRA_MESSAGE, message)
        }
        val snoozePendingIntent = PendingIntent.getBroadcast(
            context,
            notifId + 2,
            snoozeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val alarmSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)

        // 5. Post Heads-Up / Full-Screen High Priority Notification
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val builder = NotificationCompat.Builder(context, ShudkaraApp.CHANNEL_ALARMS_REMINDERS)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("⏰ $title")
            .setContentText(if (message.isNotBlank()) message else "Tap to open reminder prompt")
            .setStyle(NotificationCompat.BigTextStyle().bigText(message.ifBlank { "Scheduled reminder from Shudkara" }))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setSound(alarmSoundUri)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Dismiss", dismissPendingIntent)
            .addAction(android.R.drawable.ic_menu_recent_history, "Snooze 5m", snoozePendingIntent)

        notificationManager.notify(notifId, builder.build())

        // 6. Launch floating prompt activity directly over any running app or home screen
        try {
            context.startActivity(fullScreenIntent)
        } catch (e: Exception) {
            Log.w(TAG, "Direct activity start held by OS; fullScreenIntent will pop up Heads-Up", e)
        }
    }
}
