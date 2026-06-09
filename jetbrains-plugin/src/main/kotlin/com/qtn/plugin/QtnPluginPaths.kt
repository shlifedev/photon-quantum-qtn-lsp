package com.qtn.plugin

import com.intellij.ide.plugins.cl.PluginAwareClassLoader
import java.nio.file.Path

internal object QtnPluginPaths {
    fun getPluginPath(): Path? =
        (QtnPluginPaths::class.java.classLoader as? PluginAwareClassLoader)
            ?.pluginDescriptor
            ?.pluginPath
}
