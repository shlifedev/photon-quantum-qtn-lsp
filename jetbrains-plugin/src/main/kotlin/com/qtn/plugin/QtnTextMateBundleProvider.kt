package com.qtn.plugin

import org.jetbrains.plugins.textmate.api.TextMateBundleProvider

class QtnTextMateBundleProvider : TextMateBundleProvider {
    override fun getBundles(): List<TextMateBundleProvider.PluginBundle> {
        val pluginPath = QtnPluginPaths.getPluginPath() ?: return emptyList()
        return listOf(
            TextMateBundleProvider.PluginBundle(
                "qtn",
                pluginPath.resolve("bundles/qtn.tmbundle")
            )
        )
    }
}
