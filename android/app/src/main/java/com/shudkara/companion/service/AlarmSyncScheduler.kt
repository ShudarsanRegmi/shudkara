package com.shudkara.companion.service

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.util.Log

object AlarmSyncScheduler {

    private const val TAG = "AlarmSyncScheduler"
    private const val SYNC_INTERVAL_MS = 3 * 60 * 1000L // 3 minutes fast cloud polling

    /**
     * Schedules repeating background polling for pending cloud alarms.
     * Operates continuously without requiring user to open the app or tap buttons.
     */
    fun scheduleAutoSync(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val intent = Intent(context, AlarmSyncReceiver::class.java).apply {
            action = AlarmSyncReceiver.ACTION_ALARM_SYNC
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            9001,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val triggerAt = SystemClock.elapsedRealtime() + SYNC_INTERVAL_MS

        try {
            alarmManager.setInexactRepeating(
                AlarmManager.ELAPSED_REALTIME_WAKEUP,
                triggerAt,
                SYNC_INTERVAL_MS,
                pendingIntent
            )
            Log.d(TAG, "Scheduled repeating background alarm auto-sync every 3 minutes")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to schedule repeating alarm sync", e)
        }
    }

    /**
     * Triggers an immediate one-shot background alarm sync broadcast right now.
     */
    fun triggerImmediateSync(context: Context) {
        val intent = Intent(context, AlarmSyncReceiver::class.java).apply {
            action = AlarmSyncReceiver.ACTION_ALARM_SYNC
        }
        context.sendBroadcast(intent)
    }
}
