package com.shudkara.companion.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

data class QueuedAction(
    val id: String,
    val type: String, // "STREAK_CHECKIN" | "TIMELINE_MOMENT"
    val streakId: String? = null,
    val payloadJson: String,
    val description: String,
    val timestamp: Long
)

class OfflineQueueManager(private val context: Context) {

    private val prefs = context.getSharedPreferences("shudkara_offline_queue", Context.MODE_PRIVATE)
    private val api = ShudkaraApi(context)

    fun getQueue(): List<QueuedAction> {
        val raw = prefs.getString("queue", "[]") ?: "[]"
        val list = mutableListOf<QueuedAction>()
        try {
            val arr = JSONArray(raw)
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                list.add(
                    QueuedAction(
                        id = obj.getString("id"),
                        type = obj.getString("type"),
                        streakId = if (obj.has("streakId")) obj.getString("streakId") else null,
                        payloadJson = obj.getString("payloadJson"),
                        description = obj.getString("description"),
                        timestamp = obj.getLong("timestamp")
                    )
                )
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return list
    }

    private fun saveQueue(list: List<QueuedAction>) {
        val arr = JSONArray()
        list.forEach { item ->
            val obj = JSONObject().apply {
                put("id", item.id)
                put("type", item.type)
                if (item.streakId != null) put("streakId", item.streakId)
                put("payloadJson", item.payloadJson)
                put("description", item.description)
                put("timestamp", item.timestamp)
            }
            arr.put(obj)
        }
        prefs.edit().putString("queue", arr.toString()).apply()
    }

    fun enqueueStreakCheckIn(streakId: String, payload: StreakCheckInPayload, streakTitle: String) {
        val json = JSONObject().apply {
            put("date", payload.date)
            put("isLeaveDay", payload.isLeaveDay)
            if (payload.title != null) put("title", payload.title)
            if (payload.notes != null) put("notes", payload.notes)
            val photosArr = JSONArray()
            payload.photos.forEach { photosArr.put(it) }
            put("photos", photosArr)
        }

        val action = QueuedAction(
            id = "act_${System.currentTimeMillis()}_${(100..999).random()}",
            type = "STREAK_CHECKIN",
            streakId = streakId,
            payloadJson = json.toString(),
            description = "Check-in for \"$streakTitle\" (${payload.date})",
            timestamp = System.currentTimeMillis()
        )

        val current = getQueue().toMutableList()
        current.add(action)
        saveQueue(current)
    }

    fun enqueueTimelineMoment(payload: TimelineMomentPayload) {
        val json = JSONObject().apply {
            put("title", payload.title)
            put("content", payload.content)
            put("category", payload.category)
            put("timestamp", payload.timestamp)
            val tagsArr = JSONArray()
            payload.tags.forEach { tagsArr.put(it) }
            put("tags", tagsArr)

            val mediaArr = JSONArray()
            payload.mediaFiles.forEach { media ->
                val mObj = JSONObject().apply {
                    put("name", media.name)
                    put("type", media.type)
                    put("base64", media.base64)
                }
                mediaArr.put(mObj)
            }
            put("mediaFiles", mediaArr)
        }

        val action = QueuedAction(
            id = "act_${System.currentTimeMillis()}_${(100..999).random()}",
            type = "TIMELINE_MOMENT",
            payloadJson = json.toString(),
            description = "Timeline Moment: \"${payload.title.ifBlank { "Untitled" }}\"",
            timestamp = System.currentTimeMillis()
        )

        val current = getQueue().toMutableList()
        current.add(action)
        saveQueue(current)
    }

    fun removeAction(id: String) {
        val current = getQueue().filter { it.id != id }
        saveQueue(current)
    }

    fun clearQueue() {
        saveQueue(emptyList())
    }

    suspend fun syncAll(): Pair<Int, Int> = withContext(Dispatchers.IO) {
        val queue = getQueue()
        if (queue.isEmpty()) return@withContext Pair(0, 0)

        var synced = 0
        var failed = 0

        for (action in queue) {
            try {
                val success = when (action.type) {
                    "STREAK_CHECKIN" -> {
                        if (action.streakId != null) {
                            val obj = JSONObject(action.payloadJson)
                            val photosList = mutableListOf<String>()
                            val pArr = obj.optJSONArray("photos") ?: JSONArray()
                            for (k in 0 until pArr.length()) {
                                photosList.add(pArr.getString(k))
                            }
                            val p = StreakCheckInPayload(
                                date = obj.getString("date"),
                                photos = photosList,
                                title = if (obj.has("title")) obj.getString("title") else null,
                                notes = if (obj.has("notes")) obj.getString("notes") else null,
                                isLeaveDay = obj.optBoolean("isLeaveDay", false)
                            )
                            api.submitStreakCheckIn(action.streakId, p).isSuccess
                        } else false
                    }
                    "TIMELINE_MOMENT" -> {
                        val obj = JSONObject(action.payloadJson)
                        val tagsList = mutableListOf<String>()
                        val tArr = obj.optJSONArray("tags") ?: JSONArray()
                        for (k in 0 until tArr.length()) {
                            tagsList.add(tArr.getString(k))
                        }

                        val mediaList = mutableListOf<TimelineMediaItem>()
                        val mArr = obj.optJSONArray("mediaFiles") ?: JSONArray()
                        for (k in 0 until mArr.length()) {
                            val m = mArr.getJSONObject(k)
                            mediaList.add(
                                TimelineMediaItem(
                                    name = m.getString("name"),
                                    type = m.getString("type"),
                                    base64 = m.getString("base64")
                                )
                            )
                        }

                        val p = TimelineMomentPayload(
                            title = obj.getString("title"),
                            content = obj.getString("content"),
                            category = obj.getString("category"),
                            tags = tagsList,
                            timestamp = obj.getString("timestamp"),
                            mediaFiles = mediaList
                        )
                        api.submitTimelineMoment(p).isSuccess
                    }
                    else -> false
                }

                if (success) {
                    removeAction(action.id)
                    synced++
                } else {
                    failed++
                }
            } catch (e: Exception) {
                failed++
                break
            }
        }

        Pair(synced, failed)
    }
}
