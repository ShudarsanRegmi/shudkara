package com.shudkara.companion.data

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

class SyncWorker(
    context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        val queueManager = OfflineQueueManager(applicationContext)
        val (synced, failed) = queueManager.syncAll()

        return if (failed == 0) {
            Result.success()
        } else {
            Result.retry()
        }
    }
}
