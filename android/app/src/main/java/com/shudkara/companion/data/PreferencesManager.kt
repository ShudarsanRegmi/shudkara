package com.shudkara.companion.data

import android.content.Context
import android.content.SharedPreferences

class PreferencesManager(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences("shudkara_prefs", Context.MODE_PRIVATE)

    companion object {
        const val DEFAULT_SERVER_URL = "https://shudkara.shudarsanregmi.com.np"
        const val AZURE_FALLBACK_URL = "https://mango-stone-072adb410.7.azurestaticapps.net"
    }

    var serverUrl: String
        get() {
            val url = prefs.getString("server_url", DEFAULT_SERVER_URL) ?: DEFAULT_SERVER_URL
            // Auto-migrate legacy/stale defaults stored on existing device installations
            if (url == "https://shudkara.com" || url.isBlank() || url.contains("localhost") || url.contains("10.0.2.2")) {
                prefs.edit().putString("server_url", DEFAULT_SERVER_URL).apply()
                return DEFAULT_SERVER_URL
            }
            return url
        }
        set(value) {
            val clean = value.trim().removeSuffix("/")
            prefs.edit().putString("server_url", clean).apply()
        }

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
