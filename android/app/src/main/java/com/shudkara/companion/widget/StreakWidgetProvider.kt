package com.shudkara.companion.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.shudkara.companion.R
import com.shudkara.companion.data.PreferencesManager
import com.shudkara.companion.ui.MainActivity
import org.json.JSONArray
import org.json.JSONObject

class StreakWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val prefs = PreferencesManager(context)
        val streaksJson = prefs.cachedStreaksJson

        var streakTitle = "Daily Challenge"
        var streakDays = 0

        try {
            val json = JSONObject(streaksJson)
            val arr = json.optJSONArray("streaks") ?: JSONArray()
            if (arr.length() > 0) {
                val first = arr.getJSONObject(0)
                streakTitle = first.optString("title", "Daily Challenge")
                val checkIns = first.optJSONArray("checkIns") ?: JSONArray()
                streakDays = checkIns.length()
            }
        } catch (_: Exception) {}

        for (appWidgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_streak)
            views.setTextViewText(R.id.widget_streak_title, streakTitle)
            views.setTextViewText(R.id.widget_streak_count, "🔥 ${streakDays}d")

            // Intent to launch quick snap
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("extra_tab", 0) // Streaks tab
                putExtra("extra_action", "snap")
            }

            val pendingIntent = PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            views.setOnClickPendingIntent(R.id.widget_btn_snap, pendingIntent)
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
