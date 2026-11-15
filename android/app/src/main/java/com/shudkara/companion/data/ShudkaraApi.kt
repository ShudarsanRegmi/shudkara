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
import com.shudkara.companion.service.ReminderScheduler
import com.shudkara.companion.service.SystemAlarmHelper
import java.io.IOException
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

data class FinanceExpenseSet(
    val id: String,
    val name: String,
    val category: String,
    val budget: Double?
)

data class FinancePerson(
    val id: String,
    val name: String,
    val contact: String = "",
    val isDefault: Boolean = false,
    val netBalance: Double = 0.0,
    val netReceivable: Double = 0.0,
    val netPayable: Double = 0.0
)

data class BankBacklogItem(
    val id: String,
    val rawSms: String,
    val sender: String,
    val bank: String,
    val type: String, // "DEBIT" or "CREDIT"
    val amount: Double,
    val date: String,
    val account: String = "",
    val counterpartyAccount: String = "",
    val upiRef: String = "",
    val status: String = "pending" // "pending", "reconciled", "rotated_ignored"
)

data class AlarmItemDto(
    val id: String,
    val type: String, // "alarm" or "reminder"
    val title: String,
    val label: String? = null,
    val message: String? = null,
    val hour: Int? = null,
    val minutes: Int? = null,
    val days: List<Int>? = null,
    val targetDate: String? = null,
    val priority: String = "normal",
    val notificationStyle: String = "clock_alarm",
    val isEnabled: Boolean = true,
    val vibrate: Boolean = true,
    val skipUi: Boolean = true,
    val syncToDevice: Boolean = true,
    val deviceSyncStatus: String = "pending"
)

class ShudkaraApi(private val context: Context) {

    private val prefs = PreferencesManager(context)
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private fun buildRequestForBase(baseUrl: String, path: String): Request.Builder {
        val cleanBase = baseUrl.removeSuffix("/")
        val builder = Request.Builder()
            .url("$cleanBase$path")
            .addHeader("Content-Type", "application/json")

        if (prefs.sessionToken.isNotBlank()) {
            builder.addHeader("X-Session-Token", prefs.sessionToken)
            builder.addHeader("Authorization", "Bearer ${prefs.sessionToken}")
        }
        return builder
    }

    /**
     * Executes an HTTP request against the user's primary server URL.
     * If the primary connection throws a network reset, SSL handshake failure, or connect exception
     * (e.g. Cloudflare Edge SSL / network reset), it automatically fails over to the Azure backend
     * without crashing or throwing to the UI.
     */
    private fun executeWithFallback(path: String, buildCall: (Request.Builder) -> Request.Builder): okhttp3.Response {
        val primaryBase = prefs.serverUrl.removeSuffix("/")
        val fallbackBase = PreferencesManager.AZURE_FALLBACK_URL.removeSuffix("/")

        val primaryReq = buildCall(buildRequestForBase(primaryBase, path)).build()
        try {
            val response = client.newCall(primaryReq).execute()
            if (response.isSuccessful || response.code in 400..499) {
                return response
            }
            // If server returned a gateway / proxy 502/503/504 error and primary is not fallback, try fallback
            if (primaryBase != fallbackBase) {
                response.close()
                val fallbackReq = buildCall(buildRequestForBase(fallbackBase, path)).build()
                val fbResponse = client.newCall(fallbackReq).execute()
                if (fbResponse.isSuccessful) {
                    prefs.serverUrl = fallbackBase
                }
                return fbResponse
            }
            return response
        } catch (e: Exception) {
            // Connection reset by peer, SSL failure, or connect error
            if (primaryBase != fallbackBase) {
                try {
                    val fallbackReq = buildCall(buildRequestForBase(fallbackBase, path)).build()
                    val fbResponse = client.newCall(fallbackReq).execute()
                    if (fbResponse.isSuccessful) {
                        prefs.serverUrl = fallbackBase
                    }
                    return fbResponse
                } catch (_: Exception) {
                    throw e
                }
            } else {
                throw e
            }
        }
    }

    suspend fun sendEmailOtp(): Result<String> = withContext(Dispatchers.IO) {
        try {
            executeWithFallback("/api/auth/send-otp") { it.post("{}".toRequestBody(jsonMediaType)) }.use { response ->
                val bodyStr = response.body?.string() ?: ""
                val json = try { JSONObject(bodyStr) } catch (_: Exception) { JSONObject() }
                if (response.isSuccessful && json.optBoolean("success", true)) {
                    Result.success(json.optString("message", "OTP sent to registered owner email"))
                } else {
                    Result.failure(Exception(json.optString("error", "Failed to send OTP (HTTP ${response.code})")))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun verifyEmailOtp(code: String): Result<String> = withContext(Dispatchers.IO) {
        try {
            val payload = JSONObject().put("code", code.trim()).toString()
            executeWithFallback("/api/auth/verify-otp") { it.post(payload.toRequestBody(jsonMediaType)) }.use { response ->
                val bodyStr = response.body?.string() ?: ""
                val json = try { JSONObject(bodyStr) } catch (_: Exception) { JSONObject() }
                if (response.isSuccessful && json.optBoolean("success", false)) {
                    val token = json.optString("token", "")
                    if (token.isNotBlank()) {
                        prefs.sessionToken = token
                        Result.success(token)
                    } else {
                        Result.failure(Exception("Missing token in response"))
                    }
                } else {
                    Result.failure(Exception(json.optString("error", "Invalid or expired OTP")))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun verifyTotp(code: String): Result<String> = withContext(Dispatchers.IO) {
        try {
            val payload = JSONObject().put("code", code.trim()).toString()
            executeWithFallback("/api/auth/verify-totp") { it.post(payload.toRequestBody(jsonMediaType)) }.use { response ->
                val bodyStr = response.body?.string() ?: ""
                val json = try { JSONObject(bodyStr) } catch (_: Exception) { JSONObject() }
                if (response.isSuccessful && json.optBoolean("success", false)) {
                    val token = json.optString("token", "")
                    if (token.isNotBlank()) {
                        prefs.sessionToken = token
                        Result.success(token)
                    } else {
                        Result.failure(Exception("Missing token in response"))
                    }
                } else {
                    Result.failure(Exception(json.optString("error", "Invalid TOTP code")))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun testConnection(): Result<String> = withContext(Dispatchers.IO) {
        try {
            executeWithFallback("/api/streaks") { it.get() }.use { response ->
                if (response.isSuccessful) {
                    Result.success("Connected successfully (HTTP ${response.code}) via ${prefs.serverUrl}")
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
            executeWithFallback("/api/streaks") { it.get() }.use { response ->
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

            executeWithFallback("/api/streaks/$streakId/checkin") {
                it.post(json.toString().toRequestBody(jsonMediaType))
            }.use { response ->
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

            executeWithFallback("/api/timeline") {
                it.post(json.toString().toRequestBody(jsonMediaType))
            }.use { response ->
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

    // ─────────────────────────────────────────────────────────────────────────
    // FINANCE APIS
    // ─────────────────────────────────────────────────────────────────────────

    suspend fun fetchExpenseSets(): Result<List<FinanceExpenseSet>> = withContext(Dispatchers.IO) {
        try {
            executeWithFallback("/api/finance/expense-sets") { it.get() }.use { response ->
                if (!response.isSuccessful) {
                    return@withContext Result.failure(Exception("HTTP ${response.code}"))
                }
                val bodyStr = response.body?.string() ?: "[]"
                val arr = JSONArray(bodyStr)
                val list = mutableListOf<FinanceExpenseSet>()
                for (i in 0 until arr.length()) {
                    val s = arr.getJSONObject(i)
                    list.add(
                        FinanceExpenseSet(
                            id = s.optString("id", ""),
                            name = s.optString("name", "Set"),
                            category = s.optString("category", "General"),
                            budget = if (s.has("budget") && !s.isNull("budget")) s.optDouble("budget") else null
                        )
                    )
                }
                Result.success(list)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun submitExpense(
        amount: Double,
        description: String,
        category: String,
        expenseSetId: String?,
        paymentMethod: String,
        isRotation: Boolean,
        rotationNote: String?,
        date: String? = null,
        splitPersonName: String? = null,
        splitAmount: Double? = null,
        paidByPersonName: String? = null
    ): Result<String> = withContext(Dispatchers.IO) {
        try {
            val now = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
            val time = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date())
            val json = JSONObject().apply {
                put("amount", amount)
                put("description", description)
                put("category", category)
                put("expenseSetId", expenseSetId ?: JSONObject.NULL)
                put("paymentMethod", paymentMethod)
                put("isRotation", isRotation)
                if (rotationNote != null) put("rotationNote", rotationNote)
                put("date", if (!date.isNullOrBlank()) date else now)
                put("time", time)
                if (!splitPersonName.isNullOrBlank() && splitAmount != null && splitAmount > 0) {
                    put("splitWith", JSONObject().apply {
                        put("personName", splitPersonName)
                        put("amount", splitAmount)
                    })
                }
                if (!paidByPersonName.isNullOrBlank()) {
                    put("paidBy", JSONObject().apply {
                        put("personName", paidByPersonName)
                    })
                }
            }

            executeWithFallback("/api/finance/expenses") {
                it.post(json.toString().toRequestBody(jsonMediaType))
            }.use { response ->
                if (response.isSuccessful) {
                    Result.success("Expense logged successfully")
                } else {
                    Result.failure(Exception("Failed to log expense (HTTP ${response.code})"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun fetchPeople(): Result<List<FinancePerson>> = withContext(Dispatchers.IO) {
        try {
            executeWithFallback("/api/finance/people") { it.get() }.use { response ->
                if (!response.isSuccessful) return@withContext Result.failure(Exception("HTTP ${response.code}"))
                val arr = JSONArray(response.body?.string() ?: "[]")
                val list = mutableListOf<FinancePerson>()
                for (i in 0 until arr.length()) {
                    val p = arr.getJSONObject(i)
                    list.add(
                        FinancePerson(
                            id = p.optString("id", ""),
                            name = p.optString("name", ""),
                            contact = p.optString("contact", ""),
                            isDefault = p.optBoolean("isDefault", false),
                            netBalance = p.optDouble("netBalance", 0.0),
                            netReceivable = p.optDouble("netReceivable", 0.0),
                            netPayable = p.optDouble("netPayable", 0.0)
                        )
                    )
                }
                Result.success(list)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createPerson(name: String, contact: String = "", isDefault: Boolean = false): Result<FinancePerson> = withContext(Dispatchers.IO) {
        try {
            val json = JSONObject().apply {
                put("name", name)
                put("contact", contact)
                put("isDefault", isDefault)
            }
            executeWithFallback("/api/finance/people") {
                it.post(json.toString().toRequestBody(jsonMediaType))
            }.use { response ->
                if (!response.isSuccessful) return@withContext Result.failure(Exception("HTTP ${response.code}"))
                val obj = JSONObject(response.body?.string() ?: "{}")
                Result.success(
                    FinancePerson(
                        id = obj.optString("id", ""),
                        name = obj.optString("name", name),
                        contact = obj.optString("contact", contact),
                        isDefault = obj.optBoolean("isDefault", isDefault)
                    )
                )
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun fetchBacklog(): Result<List<BankBacklogItem>> = withContext(Dispatchers.IO) {
        try {
            executeWithFallback("/api/finance/backlog?status=pending") { it.get() }.use { response ->
                if (!response.isSuccessful) return@withContext Result.failure(Exception("HTTP ${response.code}"))
                val arr = JSONArray(response.body?.string() ?: "[]")
                val list = mutableListOf<BankBacklogItem>()
                for (i in 0 until arr.length()) {
                    val b = arr.getJSONObject(i)
                    list.add(
                        BankBacklogItem(
                            id = b.optString("id", ""),
                            rawSms = b.optString("rawSms", ""),
                            sender = b.optString("sender", "BANK"),
                            bank = b.optString("bank", "CUB"),
                            type = b.optString("type", "DEBIT"),
                            amount = b.optDouble("amount", 0.0),
                            date = b.optString("date", ""),
                            account = b.optString("account", ""),
                            counterpartyAccount = b.optString("counterpartyAccount", ""),
                            upiRef = b.optString("upiRef", ""),
                            status = b.optString("status", "pending")
                        )
                    )
                }
                Result.success(list)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun postToBacklog(
        rawSms: String,
        sender: String,
        bank: String,
        type: String,
        amount: Double,
        date: String,
        account: String,
        counterpartyAccount: String,
        upiRef: String
    ): Result<String> = withContext(Dispatchers.IO) {
        try {
            val json = JSONObject().apply {
                put("rawSms", rawSms)
                put("sender", sender)
                put("bank", bank)
                put("type", type)
                put("amount", amount)
                put("date", date)
                put("account", account)
                put("counterpartyAccount", counterpartyAccount)
                put("upiRef", upiRef)
            }
            executeWithFallback("/api/finance/backlog") {
                it.post(json.toString().toRequestBody(jsonMediaType))
            }.use { response ->
                if (response.isSuccessful) {
                    Result.success("Backlog saved")
                } else {
                    Result.failure(Exception("Failed to save backlog (HTTP ${response.code})"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun reconcileBacklog(backlogId: String, payload: JSONObject): Result<String> = withContext(Dispatchers.IO) {
        try {
            executeWithFallback("/api/finance/backlog/$backlogId/reconcile") {
                it.post(payload.toString().toRequestBody(jsonMediaType))
            }.use { response ->
                if (response.isSuccessful) {
                    Result.success("Reconciled successfully")
                } else {
                    Result.failure(Exception("Reconcile failed (HTTP ${response.code})"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun ignoreBacklog(backlogId: String): Result<String> = withContext(Dispatchers.IO) {
        try {
            executeWithFallback("/api/finance/backlog/$backlogId/ignore") {
                it.post("{}".toRequestBody(jsonMediaType))
            }.use { response ->
                if (response.isSuccessful) {
                    Result.success("Marked as rotated/ignored")
                } else {
                    Result.failure(Exception("Failed to ignore (HTTP ${response.code})"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun settlePerson(personId: String, date: String = "", notes: String = ""): Result<String> = withContext(Dispatchers.IO) {
        try {
            val json = JSONObject().apply {
                if (date.isNotBlank()) put("date", date)
                if (notes.isNotBlank()) put("notes", notes)
            }
            executeWithFallback("/api/finance/people/$personId/settle") {
                it.post(json.toString().toRequestBody(jsonMediaType))
            }.use { response ->
                if (response.isSuccessful) {
                    Result.success("Settled successfully")
                } else {
                    Result.failure(Exception("Settle failed (HTTP ${response.code})"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun submitLend(
        personName: String,
        contact: String,
        amount: Double,
        expectedReturnDate: String,
        isRotation: Boolean,
        notes: String
    ): Result<String> = withContext(Dispatchers.IO) {
        try {
            val now = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
            val json = JSONObject().apply {
                put("personName", personName)
                put("contact", contact)
                put("amount", amount)
                put("lentDate", now)
                put("expectedReturnDate", expectedReturnDate)
                put("isRotation", isRotation)
                put("notes", notes)
            }

            executeWithFallback("/api/finance/lends") {
                it.post(json.toString().toRequestBody(jsonMediaType))
            }.use { response ->
                if (response.isSuccessful) {
                    Result.success("Lend recorded successfully")
                } else {
                    Result.failure(Exception("Failed to log lend (HTTP ${response.code})"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun submitBorrow(
        personName: String,
        contact: String,
        amount: Double,
        expectedReturnDate: String,
        isRotation: Boolean,
        notes: String
    ): Result<String> = withContext(Dispatchers.IO) {
        try {
            val now = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
            val json = JSONObject().apply {
                put("personName", personName)
                put("contact", contact)
                put("amount", amount)
                put("borrowedDate", now)
                put("expectedReturnDate", expectedReturnDate)
                put("isRotation", isRotation)
                put("notes", notes)
            }

            executeWithFallback("/api/finance/borrows") {
                it.post(json.toString().toRequestBody(jsonMediaType))
            }.use { response ->
                if (response.isSuccessful) {
                    Result.success("Borrow recorded successfully")
                } else {
                    Result.failure(Exception("Failed to log borrow (HTTP ${response.code})"))
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

        if (dates.contains(todayStr)) {
            streak++
            currentCal.add(java.util.Calendar.DAY_OF_YEAR, -1)
        } else {
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

    suspend fun fetchAlarms(pendingDeviceSyncOnly: Boolean = false): Result<List<AlarmItemDto>> = withContext(Dispatchers.IO) {
        try {
            val queryParam = if (pendingDeviceSyncOnly) "?pending_device_sync=true" else ""
            executeWithFallback("/api/alarms$queryParam") { it.get() }.use { response ->
                if (!response.isSuccessful) {
                    return@withContext Result.failure(Exception("HTTP ${response.code}: ${response.message}"))
                }
                val bodyStr = response.body?.string() ?: "{}"
                val json = JSONObject(bodyStr)
                val alarmsArr = json.optJSONArray("alarms") ?: JSONArray()
                val list = mutableListOf<AlarmItemDto>()

                for (i in 0 until alarmsArr.length()) {
                    val a = alarmsArr.getJSONObject(i)
                    val daysList = mutableListOf<Int>()
                    val daysArr = a.optJSONArray("days")
                    if (daysArr != null) {
                        for (d in 0 until daysArr.length()) {
                            daysList.add(daysArr.getInt(d))
                        }
                    }

                    list.add(
                        AlarmItemDto(
                            id = a.optString("id", ""),
                            type = a.optString("type", "alarm"),
                            title = a.optString("title", "Alarm"),
                            label = if (a.has("label")) a.optString("label") else null,
                            message = if (a.has("message")) a.optString("message") else null,
                            hour = if (a.has("hour") && !a.isNull("hour")) a.getInt("hour") else null,
                            minutes = if (a.has("minutes") && !a.isNull("minutes")) a.getInt("minutes") else null,
                            days = if (daysList.isNotEmpty()) daysList else null,
                            targetDate = if (a.has("targetDate") && !a.isNull("targetDate")) a.optString("targetDate") else null,
                            priority = a.optString("priority", "normal"),
                            notificationStyle = a.optString("notificationStyle", "clock_alarm"),
                            isEnabled = a.optBoolean("isEnabled", true),
                            vibrate = a.optBoolean("vibrate", true),
                            skipUi = a.optBoolean("skipUi", true),
                            syncToDevice = a.optBoolean("syncToDevice", true),
                            deviceSyncStatus = a.optString("deviceSyncStatus", "pending")
                        )
                    )
                }
                Result.success(list)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun acknowledgeAlarmSync(alarmId: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            executeWithFallback("/api/alarms/$alarmId/sync-ack") { it.post("{}".toRequestBody(jsonMediaType)) }.use { response ->
                if (response.isSuccessful) {
                    Result.success(true)
                } else {
                    Result.failure(Exception("Sync ack failed with HTTP ${response.code}"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createAlarm(
        title: String,
        hour: Int,
        minutes: Int,
        days: List<Int> = emptyList(),
        message: String? = null,
        vibrate: Boolean = true,
        syncToDevice: Boolean = true
    ): Result<AlarmItemDto> = withContext(Dispatchers.IO) {
        try {
            val json = JSONObject().apply {
                put("type", "alarm")
                put("title", title)
                put("label", title)
                if (!message.isNullOrBlank()) put("message", message)
                put("hour", hour)
                put("minutes", minutes)
                val daysArr = JSONArray()
                days.forEach { daysArr.put(it) }
                put("days", daysArr)
                put("vibrate", vibrate)
                put("skipUi", true)
                put("syncToDevice", syncToDevice)
                put("isEnabled", true)
            }
            val body = json.toString().toRequestBody(jsonMediaType)
            executeWithFallback("/api/alarms") { it.post(body) }.use { response ->
                if (!response.isSuccessful) {
                    return@withContext Result.failure(Exception("HTTP ${response.code}"))
                }
                val bodyStr = response.body?.string() ?: "{}"
                val resObj = JSONObject(bodyStr)
                val a = resObj.optJSONObject("alarm") ?: JSONObject()
                Result.success(
                    AlarmItemDto(
                        id = a.optString("id", ""),
                        type = a.optString("type", "alarm"),
                        title = a.optString("title", title),
                        hour = hour,
                        minutes = minutes,
                        days = days,
                        isEnabled = true
                    )
                )
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteAlarm(alarmId: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            executeWithFallback("/api/alarms/$alarmId") { it.delete() }.use { response ->
                if (response.isSuccessful) {
                    Result.success(true)
                } else {
                    Result.failure(Exception("Delete failed with HTTP ${response.code}"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Pulls all alarms and reminders flagged with syncToDevice: true from Shudkara cloud,
     * registers them into the device's Clock app or exact in-app reminder scheduler,
     * and sends back an acknowledgment to the cloud.
     */
    suspend fun syncPendingDeviceAlarms(): Result<Int> = withContext(Dispatchers.IO) {
        try {
            val fetchRes = fetchAlarms(pendingDeviceSyncOnly = true)
            if (fetchRes.isFailure) {
                return@withContext Result.failure(fetchRes.exceptionOrNull() ?: Exception("Failed to fetch pending alarms"))
            }

            val pendingList = fetchRes.getOrNull() ?: emptyList()
            var syncedCount = 0

            for (item in pendingList) {
                var scheduledSuccessfully = false

                if (item.type == "alarm" && item.hour != null && item.minutes != null) {
                    // Set System Clock Alarm
                    scheduledSuccessfully = SystemAlarmHelper.setSystemClockAlarm(
                        context = context,
                        hour = item.hour,
                        minutes = item.minutes,
                        message = item.label ?: item.title,
                        days = item.days,
                        vibrate = item.vibrate,
                        skipUi = item.skipUi
                    )
                } else if (item.type == "reminder" && !item.targetDate.isNullOrBlank()) {
                    // Schedule Exact In-App Reminder
                    try {
                        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
                        val cleanDate = item.targetDate.replace(".000Z", "").replace("Z", "")
                        val date = sdf.parse(cleanDate)
                        val triggerTime = date?.time ?: System.currentTimeMillis()

                        if (triggerTime > System.currentTimeMillis()) {
                            scheduledSuccessfully = ReminderScheduler.scheduleExactReminder(
                                context = context,
                                id = item.id,
                                title = item.title,
                                message = item.message,
                                triggerTimeMillis = triggerTime,
                                priority = item.priority
                            )
                        } else {
                            // Target date is already past, mark as synced to prevent infinite loop
                            scheduledSuccessfully = true
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }

                if (scheduledSuccessfully) {
                    acknowledgeAlarmSync(item.id)
                    syncedCount++
                }
            }

            Result.success(syncedCount)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
