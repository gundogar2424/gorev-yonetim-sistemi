package com.seslipdf.app.ui

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LibraryBooks
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavHostController
import androidx.navigation.compose.currentBackStackEntryAsState

/** Uygulamanin ana bolumleri — her biri kendi ekrani. */
enum class Section(val route: String, val title: String, val icon: ImageVector) {
    LIBRARY("library", "Kitaplık", Icons.Filled.LibraryBooks),
    READER("reader", "Okuma", Icons.Filled.VolumeUp),
    SETTINGS("settings", "Ayarlar", Icons.Filled.Settings)
}

@Composable
fun BottomBar(nav: NavHostController) {
    val entry by nav.currentBackStackEntryAsState()
    val current = entry?.destination?.route

    NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
        Section.entries.forEach { section ->
            NavigationBarItem(
                selected = current == section.route,
                onClick = {
                    if (current != section.route) {
                        nav.navigate(section.route) {
                            popUpTo(Section.LIBRARY.route) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                },
                icon = { Icon(section.icon, contentDescription = section.title) },
                label = { Text(section.title) },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = MaterialTheme.colorScheme.primary,
                    selectedTextColor = MaterialTheme.colorScheme.primary,
                    indicatorColor = MaterialTheme.colorScheme.surfaceVariant,
                    unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant
                )
            )
        }
    }
}
