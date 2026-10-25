package com.shudkara.companion.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Slate900 = Color(0xFF0F172A)
val Slate800 = Color(0xFF1E293B)
val Slate700 = Color(0xFF334155)
val Slate600 = Color(0xFF475569)
val Slate500 = Color(0xFF64748B)
val Slate400 = Color(0xFF94A3B8)
val Slate300 = Color(0xFFCBD5E1)
val Slate200 = Color(0xFFE2E8F0)
val Slate100 = Color(0xFFF1F5F9)
val Slate50 = Color(0xFFF8FAFC)

val Orange600 = Color(0xFFEA580C)
val Orange50 = Color(0xFFFFF7ED)

val Indigo600 = Color(0xFF4F46E5)
val Indigo50 = Color(0xFFEEF2FF)

val Emerald600 = Color(0xFF16A34A)
val Emerald500 = Color(0xFF10B981)
val Emerald50 = Color(0xFFF0FDF4)

val Amber600 = Color(0xFFD97706)
val Amber50 = Color(0xFFFFFBEB)

val Red600 = Color(0xFFDC2626)
val Red50 = Color(0xFFFEF2F2)

private val LightColorScheme = lightColorScheme(
    primary = Indigo600,
    onPrimary = Color.White,
    secondary = Orange600,
    onSecondary = Color.White,
    background = Slate50,
    surface = Color.White,
    onBackground = Slate900,
    onSurface = Slate900,
    surfaceVariant = Slate100,
    outline = Slate200
)

@Composable
fun ShudkaraTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        content = content
    )
}
