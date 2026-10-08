package com.qtn.plugin

import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path
import java.util.Locale

/** Uses the running JVM's architecture (including an IDE running under emulation). */
internal object QtnBundledRuntime {
    fun platform(osName: String = System.getProperty("os.name"), archName: String = System.getProperty("os.arch")): String {
        val os = osName.lowercase(Locale.ROOT)
        val platform = when {
            os.startsWith("windows") -> "win"
            os.startsWith("mac") || os == "darwin" -> "darwin"
            os == "linux" -> "linux"
            else -> throw IOException("Unsupported QTN runtime operating system: $osName")
        }
        val arch = when (archName.lowercase(Locale.ROOT)) {
            "amd64", "x86_64", "x64" -> "x64"
            "aarch64", "arm64" -> "arm64"
            else -> throw IOException("Unsupported QTN runtime architecture: $archName")
        }
        return "$platform-$arch"
    }

    fun resolve(pluginPath: Path, platform: String = platform()): Path {
        require(platform in setOf("win-x64", "win-arm64", "darwin-x64", "darwin-arm64", "linux-x64", "linux-arm64"))
        val executable = if (platform.startsWith("win-")) "node.exe" else "node"
        val node = pluginPath.resolve("runtimes").resolve(platform).resolve(executable).toAbsolutePath()
        if (!Files.isRegularFile(node)) throw IOException("Bundled QTN runtime is missing: $node")
        if (!platform.startsWith("win-") && !Files.isExecutable(node)) {
            if (!node.toFile().setExecutable(true, true) || !Files.isExecutable(node)) {
                throw IOException("Bundled QTN runtime is not executable: $node")
            }
        }
        return node
    }
}
