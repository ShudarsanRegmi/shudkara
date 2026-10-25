package com.shudkara.companion.data

import android.content.Context
import android.content.SharedPreferences

class PreferencesManager(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences("shudkara_prefs", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = prefs.getString("server_url", "https://shudkara.com") ?: "https://shudkara.com"
        set(value) = prefs.edit().putString("server_url", value.trim().removeSuffix("/")).apply()

    var sessionToken: String
        get() = prefs.getString("session_token", "") ?: ""
        set(value) = prefs.edit().putString("session_token", value.trim()).apply()

    var cachedStreaksJson: String
        get() = prefs.getString("cached_streaks", "[]") ?: "[]"
        set(value) = prefs.edit().putString("cached_streaks", value).apply()

    var lastSyncTime: Long
        get() = prefs.getLong("last_sync_time", 0L)
        set(value) = prefs.edit().putLong("last_sync_time", value).apply()

    fun isConfigured(): Boolean {
        return serverUrl.isNotBlank() && sessionToken.isNotBlank()
    }
}
