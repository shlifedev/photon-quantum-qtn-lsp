using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.ComponentModel.Composition;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.VisualStudio.Imaging;
using Microsoft.VisualStudio.LanguageServer.Client;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using Microsoft.VisualStudio.Threading;
using Microsoft.VisualStudio.Utilities;
using Newtonsoft.Json.Linq;

namespace QtnLanguageExtension
{
    [ContentType("qtn")]
    [Export(typeof(ILanguageClient))]
    public class QtnLanguageClient : ILanguageClient
    {
        private static int notified;
        private static readonly Guid OutputPaneId = new Guid("7891e659-b4f3-49af-bbd6-0f42b86f7666");
        private readonly Queue<string> stderr = new Queue<string>();
        private Process? serverProcess;

        public string Name => "QTN Language Server";
        public IEnumerable<string>? ConfigurationSections => null;
        public object? InitializationOptions => new JObject(
            new JProperty("locale", System.Globalization.CultureInfo.CurrentUICulture.Name));
        public IEnumerable<string> FilesToWatch => new[] { "**/*.qtn" };

        // A non-modal notice replaces Visual Studio's generic activation failure.
        public bool ShowNotificationOnInitializeFailed => false;
        public event AsyncEventHandler<EventArgs>? StartAsync;
        public event AsyncEventHandler<EventArgs>? StopAsync;

        public async Task<Connection?> ActivateAsync(CancellationToken token)
        {
            await Task.Yield();
            if (token.IsCancellationRequested) return null;
            StopProcess();
            lock (stderr) stderr.Clear();
            try
            {
                var extensionDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location)!;
                var nodePath = Path.Combine(extensionDir, "runtimes", "win-x64", "node.exe");
                var serverPath = Path.Combine(extensionDir, "LanguageServer", "server.js");
                if (!File.Exists(nodePath)) throw new FileNotFoundException("Bundled Node runtime is missing.", nodePath);
                if (!File.Exists(serverPath)) throw new FileNotFoundException("QTN Language Server bundle is missing.", serverPath);

                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = nodePath,
                        Arguments = $"\"{serverPath}\" --stdio",
                        WorkingDirectory = extensionDir,
                        RedirectStandardInput = true,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };
                process.StartInfo.EnvironmentVariables.Remove("NODE_OPTIONS");
                process.StartInfo.EnvironmentVariables.Remove("NODE_PATH");
                process.ErrorDataReceived += (_, e) =>
                {
                    if (e.Data == null) return;
                    lock (stderr)
                    {
                        if (stderr.Count == 20) stderr.Dequeue();
                        stderr.Enqueue(e.Data.Length > 2048 ? e.Data.Substring(0, 2048) : e.Data);
                    }
                    Trace.WriteLine(e.Data, "QTN Language Server");
                };
                serverProcess = process;
                if (!process.Start()) throw new InvalidOperationException("Could not start the bundled QTN runtime.");
                process.BeginErrorReadLine();
                if (token.IsCancellationRequested)
                {
                    StopProcess();
                    return null;
                }
                return new Connection(process.StandardOutput.BaseStream, process.StandardInput.BaseStream);
            }
            catch (Exception error) when (error is IOException || error is Win32Exception ||
                error is UnauthorizedAccessException || error is InvalidOperationException)
            {
                StopProcess();
                await ReportFailureAsync(error.ToString());
                return null;
            }
        }

        public async Task OnLoadedAsync()
        {
            if (StartAsync != null) await StartAsync.InvokeAsync(this, EventArgs.Empty);
        }

        public Task OnServerInitializedAsync() => Task.CompletedTask;

        public async Task<InitializationFailureContext?> OnServerInitializeFailedAsync(
            ILanguageClientInitializationInfo initializationState)
        {
            string details;
            lock (stderr) details = string.Join(Environment.NewLine, stderr);
            var message = $"QTN Language Server initialization failed: {initializationState.StatusMessage}";
            if (!string.IsNullOrWhiteSpace(details)) message += Environment.NewLine + details;
            StopProcess();
            await ReportFailureAsync(message);
            return new InitializationFailureContext { FailureMessage = message };
        }

        private void StopProcess()
        {
            var process = serverProcess;
            serverProcess = null;
            if (process == null) return;
            try { if (!process.HasExited) process.Kill(); }
            catch (InvalidOperationException) { }
            catch (Win32Exception) { }
            finally { process.Dispose(); }
        }

        private static async Task ReportFailureAsync(string details)
        {
            Trace.WriteLine(details, "QTN Language Server");
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync(CancellationToken.None);
            ReportFailureOnUIThread(details);
        }

        private static void ReportFailureOnUIThread(string details)
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            try
            {
                ActivityLog.LogWarning("QTN Language Server", details);
                var services = ServiceProvider.GlobalProvider;
                if (services.GetService(typeof(SVsOutputWindow)) is IVsOutputWindow output)
                {
                    var paneId = OutputPaneId;
                    output.CreatePane(ref paneId, "QTN Language Server", 1, 1);
                    output.GetPane(ref paneId, out var pane);
                    pane?.OutputStringThreadSafe(details + Environment.NewLine);
                }
                if (Interlocked.CompareExchange(ref notified, 1, 0) != 0) return;
                if (services.GetService(typeof(SVsShell)) is IVsShell shell &&
                    services.GetService(typeof(SVsInfoBarUIFactory)) is IVsInfoBarUIFactory factory)
                {
                    shell.GetProperty((int)__VSSPROPID7.VSSPROPID_MainWindowInfoBarHost, out var host);
                    if (host is IVsInfoBarHost infoBarHost)
                    {
                        var model = new InfoBarModel(
                            "QTN IntelliSense could not start. Syntax highlighting still works. " +
                            "Update/reinstall the QTN extension; see Output > QTN Language Server for details. " +
                            "A separate Node.js installation is not required.", KnownMonikers.StatusWarning, true);
                        infoBarHost.AddInfoBar(factory.CreateInfoBar(model));
                    }
                }
            }
            catch (Exception error)
            {
                // Diagnostic UI must never cause a second activation failure.
                Trace.WriteLine(error, "QTN Language Server notification");
            }
        }
    }
}
