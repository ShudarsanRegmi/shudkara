package com.shudkara.companion.service

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast
import com.shudkara.companion.data.ShudkaraApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class FinanceActionReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_MARK_ROTATED = "com.shudkara.companion.ACTION_MARK_ROTATED"
        const val ACTION_DEFER = "com.shudkara.companion.ACTION_DEFER"
        const val EXTRA_NOTIF_ID = "extra_notif_id"
        const val EXTRA_BACKLOG_ID = "extra_backlog_id"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val notifId = intent.getIntExtra(EXTRA_NOTIF_ID, -1)
        val backlogId = intent.getStringExtra(EXTRA_BACKLOG_ID) ?: ""

        if (notifId != -1) {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.cancel(notifId)
        }

        when (intent.action) {
            ACTION_MARK_ROTATED -> {
                val api = ShudkaraApi(context)
                CoroutineScope(Dispatchers.IO).launch {
                    if (backlogId.isNotBlank()) {
                        api.ignoreBacklog(backlogId)
                    }
                }
                Toast.makeText(context, "Marked as rotated (ignored from expenses)", Toast.LENGTH_SHORT).show()
            }
            ACTION_DEFER -> {
                Toast.makeText(context, "Saved in Backlog. Reconcile anytime from app.", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
