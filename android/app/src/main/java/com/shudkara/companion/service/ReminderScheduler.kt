package com.shudkara.companion.service

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.util.Log
import com.shudkara.companion.ui.MainActivity

object ReminderScheduler {

    private const val TAG = "ReminderScheduler"

    /**
     * Checks if the app has permission to schedule exact alarms (Android 12+).
     */
    fun canScheduleExactAlarms(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            return alarmManager?.canScheduleExactAlarms() ?: false
        }
        return true
    }

    /**
     * Schedules an exact alarm/reminder that wakes the device from Doze mode,
     * sounds high-priority alarm audio, and displays a heads-up pop-up alert dialog.
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

        // Show intent for AlarmClockInfo: clicking status bar alarm icon opens MainActivity
        val showIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("extra_tab", 3)
        }
        val showPendingIntent = PendingIntent.getActivity(
            context,
            requestCode,
            showIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return try {
            // Priority 1: setAlarmClock (bypasses all Doze battery restrictions & shows system alarm clock icon)
            val alarmClockInfo = AlarmManager.AlarmClockInfo(triggerTimeMillis, showPendingIntent)
            alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)
            Log.d(TAG, "Scheduled exact alarm via setAlarmClock for '$title' at $triggerTimeMillis (reqCode: $requestCode)")
            true
        } catch (e: Exception) {
            Log.w(TAG, "setAlarmClock failed, falling back to setExactAndAllowWhileIdle", e)
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
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
                true
            } catch (ex: Exception) {
                Log.e(TAG, "All exact alarm scheduling attempts failed", ex)
                try {
                    alarmManager.set(AlarmManager.RTC_WAKEUP, triggerTimeMillis, pendingIntent)
                    true
                } catch (fallbackEx: Exception) {
                    Log.e(TAG, "Final fallback failed", fallbackEx)
                    false
                }
            }
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
