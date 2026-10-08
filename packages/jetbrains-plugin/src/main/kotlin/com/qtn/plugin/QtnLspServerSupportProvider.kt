package com.qtn.plugin

import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.execution.ExecutionException
import com.intellij.execution.process.OSProcessHandler
import com.intellij.execution.process.ProcessAdapter
import com.intellij.execution.process.ProcessEvent
import com.intellij.execution.process.ProcessOutputTypes
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.project.Project
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.progress.ProcessCanceledException
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.util.Key
import com.intellij.platform.lsp.api.LspServerSupportProvider
import com.intellij.platform.lsp.api.LspServerSupportProvider.LspServerStarter
import com.intellij.platform.lsp.api.ProjectWideLspServerDescriptor
import com.intellij.platform.lsp.api.LspServerListener
import org.eclipse.lsp4j.InitializeResult
import java.nio.file.Path
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.io.path.exists

class QtnLspServerSupportProvider : LspServerSupportProvider {
    override fun fileOpened(project: Project, file: VirtualFile, serverStarter: LspServerStarter) {
        if (file.extension != "qtn") return

        // TextMate 하이라이팅은 LSP와 무관하게 동작하므로, 서버를 못 띄우는 상황에서는
        // 예외로 죽이지 말고 안내만 하고 조용히 빠진다.
        val serverPath = QtnLspLauncher.findServerJs()
        if (serverPath == null) {
            QtnLspLauncher.notifyOnce(
                project,
                "QTN language server is missing from the plugin distribution. " +
                    "Syntax highlighting still works; reinstall the plugin to restore IntelliSense."
            )
            return
        }

        try {
            val pluginPath = QtnPluginPaths.getPluginPath()
                ?: error("QTN plugin installation directory could not be located")
            val nodePath = QtnBundledRuntime.resolve(pluginPath)
            serverStarter.ensureServerStarted(QtnLspServerDescriptor(project, nodePath.toString(), serverPath))
        } catch (e: ProcessCanceledException) {
            throw e
        } catch (e: Exception) {
            QtnLspLauncher.notifyOnce(project, "QTN IntelliSense could not start. Syntax highlighting still works. " +
                "Reinstall/update the QTN plugin and check the IDE log for details. ${e.message}")
        }
    }
}

internal object QtnLspLauncher {
    private val notified = AtomicBoolean(false)
    private val log = Logger.getInstance(QtnLspLauncher::class.java)

    fun logStderr(message: String) = log.warn("QTN server stderr: $message")

    fun findServerJs(): Path? =
        QtnPluginPaths.getPluginPath()
            ?.resolve("language-server/out/server.js")
            ?.takeIf { it.exists() }

    fun notifyOnce(project: Project, message: String) {
        log.warn(message)
        if (!notified.compareAndSet(false, true)) return
        NotificationGroupManager.getInstance()
            .getNotificationGroup("QTN Language Server")
            .createNotification("QTN Language Support", message, NotificationType.WARNING)
            .notify(project)
    }
}

class QtnLspServerDescriptor(
    project: Project,
    private val nodePath: String,
    private val serverPath: Path,
) : ProjectWideLspServerDescriptor(project, "QTN") {
    private val initialized = AtomicBoolean(false)

    override fun isSupportedFile(file: VirtualFile): Boolean = file.extension == "qtn"

    override val lspServerListener = object : LspServerListener {
        override fun serverInitialized(params: InitializeResult) { initialized.set(true) }
    }

    override fun startServerProcess(): OSProcessHandler {
        initialized.set(false)
        try {
            return super.startServerProcess().also { handler ->
                handler.addProcessListener(object : ProcessAdapter() {
                    override fun onTextAvailable(event: ProcessEvent, outputType: Key<*>) {
                        if (outputType == ProcessOutputTypes.STDERR) QtnLspLauncher.logStderr(event.text.take(8192))
                    }

                    override fun processTerminated(event: ProcessEvent) {
                        if (event.exitCode != 0 && !initialized.get() && !project.isDisposed) {
                            QtnLspLauncher.notifyOnce(project,
                                "QTN IntelliSense failed to initialize (exit ${event.exitCode}). " +
                                "Syntax highlighting still works. Check the IDE log and update/reinstall the plugin.")
                        }
                    }
                })
            }
        } catch (e: ExecutionException) {
            QtnLspLauncher.notifyOnce(project, "The bundled QTN runtime could not start: ${e.message}. " +
                "Syntax highlighting still works. Check the IDE log and update/reinstall the plugin.")
            throw e
        }
    }

    override fun createInitializationOptions(): Any {
        val locale = java.util.Locale.getDefault().language  // "ko", "en", etc.
        return mapOf("locale" to locale)
    }

    override fun createCommandLine(): GeneralCommandLine =
        GeneralCommandLine(nodePath, serverPath.toString(), "--stdio")
            .withEnvironment("NODE_OPTIONS", "")
            .withEnvironment("NODE_PATH", "")
}
