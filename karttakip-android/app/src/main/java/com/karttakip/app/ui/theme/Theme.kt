package com.karttakip.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Blue = Color(0xFF3B82F6)
private val BlueDark = Color(0xFF2563EB)
private val Slate900 = Color(0xFF0F172A)
private val Slate800 = Color(0xFF1E293B)

private val DarkColors = darkColorScheme(
    primary = Blue,
    onPrimary = Color.White,
    secondary = Color(0xFF22C55E),
    background = Slate900,
    surface = Slate800,
    onBackground = Color(0xFFE2E8F0),
    onSurface = Color(0xFFE2E8F0),
    error = Color(0xFFF87171)
)

private val LightColors = lightColorScheme(
    primary = BlueDark,
    onPrimary = Color.White,
    secondary = Color(0xFF16A34A),
    background = Color(0xFFF8FAFC),
    surface = Color.White,
    error = Color(0xFFDC2626)
)

@Composable
fun KartTakipTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content
    )
}
