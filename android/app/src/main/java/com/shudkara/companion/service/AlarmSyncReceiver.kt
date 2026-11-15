package com.shudkara.companion.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import android.util.Log
import com.shudkara.companion.data.ShudkaraApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class AlarmSyncReceiver : BroadcastReceiver() {

    companion object {
        const val TAG = "AlarmSyncReceiver"
        const val ACTION_ALARM_SYNC = "com.shudkara.companion.ACTION_POLL_ALARM_SYNC"
    }

    override fun onReceive(context: Context, intent: Intent) {
        Log.d(TAG, "Background alarm auto-sync triggered")

        val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val wakeLock = powerManager?.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "shudkara:AlarmSyncReceiverWakeLock"
        )
        wakeLock?.acquire(30 * 1000L) // 30 second safety window

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val api = ShudkaraApi(context)
                val result = api.syncPendingDeviceAlarms()
                if (result.isSuccess) {
                    val count = result.getOrNull() ?: 0
                    if (count > 0) {
                        Log.i(TAG, "Successfully auto-synced and scheduled $count pending hardware alarm(s) from cloud!")
                    }
                } else {
                    Log.w(TAG, "Background alarm sync error: ${result.exceptionOrNull()?.message}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Exception during background alarm sync", e)
            } finally {
                if (wakeLock?.isHeld == true) {
                    wakeLock.release()
                }
            }
        }
    }
}
