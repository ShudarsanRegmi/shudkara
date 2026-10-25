package com.shudkara.companion.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

data class StreakItem(
    val id: String,
    val title: String,
    val category: String,
    val targetTime: String,
    val currentStreak: Int,
    val longestStreak: Int,
    val todayChecked: Boolean,
    val isOverdue: Boolean
)

data class StreakCheckInPayload(
    val date: String,
    val photos: List<String>,
    val title: String? = null,
    val notes: String? = null,
    val isLeaveDay: Boolean = false
)

data class TimelineMediaItem(
    val name: String,
    val type: String,
    val base64: String
)

data class TimelineMomentPayload(
    val title: String,
    val content: String,
    val category: String,
    val tags: List<String>,
    val timestamp: String,
    val mediaFiles: List<TimelineMediaItem>
)

class ShudkaraApi(private val context: Context) {

    private val prefs = PreferencesManager(context)
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private fun buildRequest(path: String): Request.Builder {
        val baseUrl = prefs.serverUrl.removeSuffix("/")
        val builder = Request.Builder()
            .url("$baseUrl$path")
            .addHeader("Content-Type", "application/json")

        if (prefs.sessionToken.isNotBlank()) {
            builder.addHeader("X-Session-Token", prefs.sessionToken)
            builder.addHeader("Authorization", "Bearer ${prefs.sessionToken}")
        }
        return builder
    }

    suspend fun testConnection(): Result<String> = withContext(Dispatchers.IO) {
        try {
            val request = buildRequest("/api/streaks").get().build()
            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    Result.success("Connected successfully (HTTP ${response.code})")
                } else if (response.code == 401) {
                    Result.failure(Exception("Unauthorized: Invalid Session Token"))
                } else {
                    Result.failure(Exception("Server returned HTTP ${response.code}"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun fetchStreaks(): Result<List<StreakItem>> = withContext(Dispatchers.IO) {
        try {
            val request = buildRequest("/api/streaks").get().build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext Result.failure(Exception("HTTP ${response.code}: ${response.message}"))
                }

                val bodyStr = response.body?.string() ?: "{}"
                prefs.cachedStreaksJson = bodyStr

                val json = JSONObject(bodyStr)
                val streaksArray = json.optJSONArray("streaks") ?: JSONArray()
                val list = mutableListOf<StreakItem>()

                val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())

                for (i in 0 until streaksArray.length()) {
                    val s = streaksArray.getJSONObject(i)
                    val id = s.optString("id", "")
                    val title = s.optString("title", "Streak")
                    val category = s.optString("category", "General")
                    val targetTime = s.optString("targetTime", "17:00")

                    val checkIns = s.optJSONArray("checkIns") ?: JSONArray()
                    var todayChecked = false
                    val checkInDates = mutableSetOf<String>()

                    for (j in 0 until checkIns.length()) {
                        val c = checkIns.getJSONObject(j)
                        val date = c.optString("date", "")
                        if (date.isNotBlank()) {
                            checkInDates.add(date)
                            if (date == todayStr) {
                                todayChecked = true
                            }
                        }
                    }

                    // Simple consecutive streak calculation
                    val currentStreak = calculateCurrentStreak(checkInDates, todayStr)
                    val longestStreak = maxOf(currentStreak, checkInDates.size)

                    list.add(
                        StreakItem(
                            id = id,
                            title = title,
                            category = category,
                            targetTime = targetTime,
                            currentStreak = currentStreak,
                            longestStreak = longestStreak,
                            todayChecked = todayChecked,
                            isOverdue = !todayChecked
                        )
                    )
                }

                Result.success(list)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun submitStreakCheckIn(streakId: String, payload: StreakCheckInPayload): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val json = JSONObject().apply {
                put("date", payload.date)
                put("isLeaveDay", payload.isLeaveDay)
                if (payload.title != null) put("title", payload.title)
                if (payload.notes != null) put("notes", payload.notes)
                if (payload.photos.isNotEmpty()) {
                    val arr = JSONArray()
                    payload.photos.forEach { arr.put(it) }
                    put("photos", arr)
                    put("photoUrl", payload.photos[0])
                }
            }

            val request = buildRequest("/api/streaks/$streakId/checkin")
                .post(json.toString().toRequestBody(jsonMediaType))
                .build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    Result.success(true)
                } else {
                    Result.failure(Exception("Check-in failed: HTTP ${response.code}"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun submitTimelineMoment(payload: TimelineMomentPayload): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
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

            val request = buildRequest("/api/timeline")
                .post(json.toString().toRequestBody(jsonMediaType))
                .build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    Result.success(true)
                } else {
                    Result.failure(Exception("Moment creation failed: HTTP ${response.code}"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun calculateCurrentStreak(dates: Set<String>, todayStr: String): Int {
        if (dates.isEmpty()) return 0
        var streak = 0
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        var currentCal = java.util.Calendar.getInstance()

        // Check if checked today
        if (dates.contains(todayStr)) {
            streak++
            currentCal.add(java.util.Calendar.DAY_OF_YEAR, -1)
        } else {
            // Check if checked yesterday
            currentCal.add(java.util.Calendar.DAY_OF_YEAR, -1)
            val yesterdayStr = sdf.format(currentCal.time)
            if (!dates.contains(yesterdayStr)) {
                return 0
            }
        }

        while (true) {
            val dateStr = sdf.format(currentCal.time)
            if (dates.contains(dateStr)) {
                streak++
                currentCal.add(java.util.Calendar.DAY_OF_YEAR, -1)
            } else {
                break
            }
        }
        return streak
    }
}
