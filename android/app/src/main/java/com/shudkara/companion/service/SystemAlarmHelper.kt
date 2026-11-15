package com.shudkara.companion.service

import android.content.Context
import android.content.Intent
import android.provider.AlarmClock
import android.util.Log
import java.util.ArrayList

object SystemAlarmHelper {

    private const val TAG = "SystemAlarmHelper"

    /**
     * Schedules a native system alarm directly into the device's default Clock app.
     *
     * @param context Application or Activity context
     * @param hour Hour of day (0-23)
     * @param minutes Minute of hour (0-59)
     * @param message Optional alarm label / message
     * @param days Optional list of Calendar day integers (e.g. Calendar.MONDAY = 2, Calendar.SUNDAY = 1)
     * @param vibrate Whether the phone should vibrate when ringing
     * @param skipUi If true, creates the alarm quietly in background without opening Clock UI
     */
    fun setSystemClockAlarm(
        context: Context,
        hour: Int,
        minutes: Int,
        message: String? = null,
        days: List<Int>? = null,
        vibrate: Boolean = true,
        skipUi: Boolean = true
    ): Boolean {
        return try {
            val intent = Intent(AlarmClock.ACTION_SET_ALARM).apply {
                putExtra(AlarmClock.EXTRA_HOUR, hour.coerceIn(0, 23))
                putExtra(AlarmClock.EXTRA_MINUTES, minutes.coerceIn(0, 59))
                if (!message.isNullOrBlank()) {
                    putExtra(AlarmClock.EXTRA_MESSAGE, message.trim())
                }
                if (!days.isNullOrEmpty()) {
                    putIntegerArrayListExtra(AlarmClock.EXTRA_DAYS, ArrayList(days))
                }
                putExtra(AlarmClock.EXTRA_VIBRATE, vibrate)
                putExtra(AlarmClock.EXTRA_SKIP_UI, skipUi)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }

            if (intent.resolveActivity(context.packageManager) != null) {
                context.startActivity(intent)
                Log.d(TAG, "Successfully invoked system alarm for $hour:$minutes (message: $message, skipUi: $skipUi)")
                true
            } else {
                Log.w(TAG, "No Clock application resolved for ACTION_SET_ALARM, retrying without skipUi")
                intent.putExtra(AlarmClock.EXTRA_SKIP_UI, false)
                context.startActivity(intent)
                true
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to set system alarm via AlarmClock intent", e)
            try {
                // Secondary fallback without skipUi (some OEMs restrict background silent alarm creation)
                val fallbackIntent = Intent(AlarmClock.ACTION_SET_ALARM).apply {
                    putExtra(AlarmClock.EXTRA_HOUR, hour.coerceIn(0, 23))
                    putExtra(AlarmClock.EXTRA_MINUTES, minutes.coerceIn(0, 59))
                    if (!message.isNullOrBlank()) {
                        putExtra(AlarmClock.EXTRA_MESSAGE, message.trim())
                    }
                    putExtra(AlarmClock.EXTRA_SKIP_UI, false)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(fallbackIntent)
                true
            } catch (fallbackEx: Exception) {
                Log.e(TAG, "Fallback system alarm launch failed", fallbackEx)
                false
            }
        }
    }

    /**
     * Opens the device's native clock alarms list screen.
     */
    fun openClockAlarms(context: Context): Boolean {
        return try {
            val intent = Intent(AlarmClock.ACTION_SHOW_ALARMS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
            true
        } catch (e: Exception) {
            Log.e(TAG, "Could not open system alarms", e)
            false
        }
    }
}
