package com.seslipdf.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Ekran goruntusundeki referans tasarim gibi: her zaman koyu tema.
private val Sky = Color(0xFF38BDF8)
private val Ink950 = Color(0xFF0B0F19)
private val Ink900 = Color(0xFF141A26)
private val Ink800 = Color(0xFF1E2735)

private val DarkColors = darkColorScheme(
    primary = Sky,
    onPrimary = Color(0xFF04121F),
    primaryContainer = Color(0xFF0E4A6B),
    onPrimaryContainer = Color(0xFFD8F1FF),
    secondary = Color(0xFF34D399),
    onSecondary = Color(0xFF04211A),
    background = Ink950,
    onBackground = Color(0xFFF3F6FA),
    surface = Ink900,
    onSurface = Color(0xFFF3F6FA),
    surfaceVariant = Ink800,
    onSurfaceVariant = Color(0xFFC4CEDC),
    outline = Color(0xFF33415A),
    outlineVariant = Color(0xFF283345),
    error = Color(0xFFF87171),
    onError = Color(0xFF250505)
)

@Composable
fun SesliPdfTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColors,
        typography = AppTypography,
        content = content
    )
}
