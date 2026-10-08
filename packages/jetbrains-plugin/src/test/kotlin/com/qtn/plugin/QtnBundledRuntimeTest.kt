package com.qtn.plugin

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.assertThrows
import org.junit.Assume.assumeFalse
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.IOException
import java.nio.file.Files

class QtnBundledRuntimeTest {
    @get:Rule val folder = TemporaryFolder()

    @Test fun `selects all six platforms using JVM architecture aliases`() {
        for ((os, key) in listOf("Windows 11" to "win", "Mac OS X" to "darwin", "Linux" to "linux")) {
            for (arch in listOf("amd64", "x86_64", "x64")) {
                assertEquals("$key-x64", QtnBundledRuntime.platform(os, arch))
            }
            for (arch in listOf("aarch64", "arm64")) {
                assertEquals("$key-arm64", QtnBundledRuntime.platform(os, arch))
            }
        }
    }

    @Test fun `unsupported OS or architecture fails explicitly`() {
        assertThrows(IOException::class.java) { QtnBundledRuntime.platform("FreeBSD", "amd64") }
        assertThrows(IOException::class.java) { QtnBundledRuntime.platform("Linux", "riscv64") }
    }

    @Test fun `missing bundled executable never falls back to installed Node`() {
        assertThrows(IOException::class.java) { QtnBundledRuntime.resolve(folder.root.toPath(), "win-x64") }
    }

    @Test fun `uses absolute paths including spaces and unicode`() {
        val plugin = folder.newFolder("QTN 한글 plugin").toPath()
        val node = plugin.resolve("runtimes/win-x64/node.exe")
        Files.createDirectories(node.parent)
        Files.createFile(node)
        assertEquals(node.toAbsolutePath(), QtnBundledRuntime.resolve(plugin, "win-x64"))
    }

    @Test fun `repairs execute bit lost while unpacking zip`() {
        assumeFalse(System.getProperty("os.name").startsWith("Windows"))
        val plugin = folder.root.toPath()
        val node = plugin.resolve("runtimes/linux-x64/node")
        Files.createDirectories(node.parent)
        Files.createFile(node)
        assertTrue(node.toFile().setExecutable(false, false))
        QtnBundledRuntime.resolve(plugin, "linux-x64")
        assertTrue(Files.isExecutable(node))
    }
}
