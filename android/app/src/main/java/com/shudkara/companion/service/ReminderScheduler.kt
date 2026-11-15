package com.shudkara.companion.service

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

object ReminderScheduler {

    private const val TAG = "ReminderScheduler"

    /**
     * Schedules an exact in-app reminder that wakes the device from Doze mode
     * and shows a heads-up / full-screen alert dialog with audio.
     */
    fun scheduleExactReminder(
        context: Context,
        id: String,
        title: String,
        message: String? = null,
        triggerTimeMillis: Long,
        priority: String = "important"
    ): Boolean {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return false

        // Generate stable request code from id hash
        val requestCode = (id.hashCode() and 0x7FFFFFFF) % 1000000

        val intent = Intent(context, ReminderAlarmReceiver::class.java).apply {
            putExtra(ReminderAlarmReceiver.EXTRA_REMINDER_ID, id)
            putExtra(ReminderAlarmReceiver.EXTRA_TITLE, title)
            putExtra(ReminderAlarmReceiver.EXTRA_MESSAGE, message ?: "")
            putExtra(ReminderAlarmReceiver.EXTRA_PRIORITY, priority)
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                // Allows wakeup even in battery Doze mode
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerTimeMillis,
                    pendingIntent
                )
            } else {
                alarmManager.setExact(
                    AlarmManager.RTC_WAKEUP,
                    triggerTimeMillis,
                    pendingIntent
                )
            }
            Log.d(TAG, "Scheduled exact reminder '$title' for $triggerTimeMillis (reqCode: $requestCode)")
            true
        } catch (e: SecurityException) {
            Log.w(TAG, "Exact alarm permission restricted, falling back to inexact window", e)
            try {
                alarmManager.set(AlarmManager.RTC_WAKEUP, triggerTimeMillis, pendingIntent)
                true
            } catch (ex: Exception) {
                Log.e(TAG, "Failed to schedule reminder fallback", ex)
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to schedule reminder", e)
            false
        }
    }

    /**
     * Cancels a previously scheduled in-app reminder.
     */
    fun cancelReminder(context: Context, id: String) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val requestCode = (id.hashCode() and 0x7FFFFFFF) % 1000000

        val intent = Intent(context, ReminderAlarmReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )

        if (pendingIntent != null) {
            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()
            Log.d(TAG, "Cancelled reminder $id (reqCode: $requestCode)")
        }
    }
}
