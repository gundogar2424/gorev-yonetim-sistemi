package com.karttakip.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Blue = Color(0xFF60A5FA)
private val BlueDark = Color(0xFF2563EB)
private val Slate950 = Color(0xFF0B1120)
private val Slate900 = Color(0xFF111A2E)
private val Slate800 = Color(0xFF1B2740)

private val DarkColors = darkColorScheme(
    primary = Blue,
    onPrimary = Color(0xFF07132A),
    secondary = Color(0xFF34D399),
    background = Slate950,
    surface = Slate900,
    surfaceVariant = Slate800,
    onBackground = Color(0xFFF1F5F9),
    onSurface = Color(0xFFF1F5F9),
    onSurfaceVariant = Color(0xFFCBD5E1),
    outline = Color(0xFF334155),
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
        typography = AppTypography,
        content = content
    )
}
