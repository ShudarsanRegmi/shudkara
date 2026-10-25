package com.shudkara.companion.service

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.widget.Toast
import androidx.core.app.NotificationCompat
import com.shudkara.companion.ShudkaraApp
import com.shudkara.companion.ui.MainActivity

class FinanceReminderReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val amount = intent.getDoubleExtra("remind_amount", 0.0)
        val desc = intent.getStringExtra("remind_desc") ?: "Recent Transaction"
        val type = intent.getStringExtra("remind_type") ?: "DEBIT"
        val isDelayedTrigger = intent.getBooleanExtra("is_delayed_trigger", false)

        if (!isDelayedTrigger && amount > 0.0) {
            // Schedule 1-hour delay using AlarmManager
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val delayedIntent = Intent(context, FinanceReminderReceiver::class.java).apply {
                putExtra("remind_amount", amount)
                putExtra("remind_desc", desc)
                putExtra("remind_type", type)
                putExtra("is_delayed_trigger", true)
            }
            val pendingAlarm = PendingIntent.getBroadcast(
                context,
                (System.currentTimeMillis() % 100000).toInt(),
                delayedIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // Trigger in 60 minutes (3600_000 ms)
            val triggerAt = SystemClock.elapsedRealtime() + 60 * 60 * 1000L
            try {
                alarmManager.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pendingAlarm)
                Toast.makeText(context, "Reminder set for 1 hour to log Rs. $amount", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                // If exact alarm permission restricted, trigger fallback
                alarmManager.set(AlarmManager.ELAPSED_REALTIME, triggerAt, pendingAlarm)
            }
            return
        }

        // Delayed Trigger Fired: Show the Reminder Notification!
        if (amount > 0.0) {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val notifId = (System.currentTimeMillis() % 100000).toInt()

            val openIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("extra_tab", 2)
                putExtra("finance_mode", if (type == "DEBIT") "expense" else "borrow")
                putExtra("finance_amount", amount)
                putExtra("finance_desc", desc)
            }
            val openPendingIntent = PendingIntent.getActivity(
                context,
                notifId,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val builder = NotificationCompat.Builder(context, ShudkaraApp.CHANNEL_FINANCE_SMS)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("⏰ Reminder: Log Rs. $amount ($desc)")
                .setContentText("Don't forget to categorize where this money was spent or received!")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(openPendingIntent)
                .addAction(android.R.drawable.ic_input_add, "Log Now", openPendingIntent)

            notificationManager.notify(notifId, builder.build())
        }
    }
}
