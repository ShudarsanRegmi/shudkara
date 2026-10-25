package com.shudkara.companion

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import androidx.work.*
import com.shudkara.companion.data.SyncWorker
import java.util.concurrent.TimeUnit

class ShudkaraApp : Application() {

    companion object {
        const val CHANNEL_CAPTURE = "shudkara_capture_channel"
        const val CHANNEL_SYNC = "shudkara_sync_channel"
        const val CHANNEL_FINANCE_SMS = "shudkara_finance_sms"
        lateinit var instance: ShudkaraApp
            private set
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        createNotificationChannels()
        schedulePeriodicSync()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(NotificationManager::class.java)

            val captureChannel = NotificationChannel(
                CHANNEL_CAPTURE,
                "Quick Capture Notifications",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Notifications for quick streak and timeline captures"
            }

            val syncChannel = NotificationChannel(
                CHANNEL_SYNC,
                "Offline Sync Alerts",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Background sync status notifications"
            }

            val financeChannel = NotificationChannel(
                CHANNEL_FINANCE_SMS,
                "Finance Transaction Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Immediate transaction prompts and classification from bank SMS"
                enableVibration(true)
            }

            notificationManager.createNotificationChannel(captureChannel)
            notificationManager.createNotificationChannel(syncChannel)
            notificationManager.createNotificationChannel(financeChannel)
        }
    }

    private fun schedulePeriodicSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "ShudkaraBackgroundSync",
            ExistingPeriodicWorkPolicy.KEEP,
            syncRequest
        )
    }
}
