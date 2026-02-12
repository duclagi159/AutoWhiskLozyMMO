using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;

namespace ToolApp;

public class UpdateManager
{
    public const string RepoOwner = "duclagi159";
    public const string RepoName = "AutoWhiskLozyMMO";
    public const string AssetFilename = "ToolApp-win-x64.zip";
    public const string GithubToken = "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";

    public record UpdateInfo(bool Available, string CurrentVersion, string RemoteVersion, string Tag, string ReleaseUrl, string Body);

    public static async Task<UpdateInfo> CheckForUpdateAsync()
    {
        var currentVersion = System.Reflection.Assembly.GetExecutingAssembly().GetName().Version;
        var currentVersionStr = currentVersion?.ToString() ?? "0.0.0";

        using var http = new HttpClient();
        http.DefaultRequestHeaders.UserAgent.ParseAdd("ToolApp-Updater");

        if (!string.IsNullOrWhiteSpace(GithubToken) && !GithubToken.Contains("YOUR_GITHUB_TOKEN_HERE"))
        {
            http.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", GithubToken);
        }

        var apiUrl = $"https://api.github.com/repos/{RepoOwner}/{RepoName}/releases/latest";

        try
        {
            var releaseJson = await http.GetStringAsync(apiUrl);
            using var doc = JsonDocument.Parse(releaseJson);
            var root = doc.RootElement;

            if (root.TryGetProperty("tag_name", out var tagNameProp))
            {
                var tagName = tagNameProp.GetString();
                var versionString = tagName?.TrimStart('v');
                var body = root.TryGetProperty("body", out var b) ? b.GetString() : "";
                var htmlUrl = root.TryGetProperty("html_url", out var u) ? u.GetString() : "";

                if (Version.TryParse(versionString, out var remoteVersion))
                {
                    bool available = remoteVersion > currentVersion;
                    return new UpdateInfo(available, currentVersionStr, versionString, tagName, htmlUrl, body);
                }
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Update check failed: {ex.Message}");
        }

        return new UpdateInfo(false, currentVersionStr, "", "", "", "");
    }

    public static async Task PerformUpdateAsync(Action<string> logCallback)
    {
        logCallback("Checking for latest release...");
        var assetName = AssetFilename;
        var exePath = Environment.ProcessPath;

        if (string.IsNullOrWhiteSpace(exePath) || exePath.EndsWith("dotnet.exe", StringComparison.OrdinalIgnoreCase))
        {
            logCallback("Error: Cannot update when running via dotnet run. Run the .exe directly.");
            return;
        }

        using var http = new HttpClient();
        http.Timeout = TimeSpan.FromSeconds(120);
        http.DefaultRequestHeaders.UserAgent.ParseAdd("ToolApp-Updater");
        if (!string.IsNullOrWhiteSpace(GithubToken))
        {
            http.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", GithubToken);
        }

        var apiUrl = $"https://api.github.com/repos/{RepoOwner}/{RepoName}/releases/latest";
        var releaseJson = await http.GetStringAsync(apiUrl);

        using var doc = JsonDocument.Parse(releaseJson);
        if (!doc.RootElement.TryGetProperty("assets", out var assets))
        {
            logCallback("Error: No assets found in release.");
            return;
        }

        string? downloadUrl = null;
        foreach (var asset in assets.EnumerateArray())
        {
            if (asset.TryGetProperty("name", out var nameProp) &&
                nameProp.GetString()?.Equals(assetName, StringComparison.OrdinalIgnoreCase) == true &&
                asset.TryGetProperty("url", out var urlProp))
            {
                downloadUrl = urlProp.GetString();
                break;
            }
        }

        if (string.IsNullOrWhiteSpace(downloadUrl))
        {
            logCallback($"Error: Asset '{assetName}' not found in release.");
            return;
        }

        // Download with progress reporting and retry
        var tempRoot = Path.Combine(Path.GetTempPath(), "ToolAppUpdate");
        Directory.CreateDirectory(tempRoot);
        var zipPath = Path.Combine(tempRoot, assetName);

        const int maxRetries = 3;
        for (int attempt = 1; attempt <= maxRetries; attempt++)
        {
            try
            {
                logCallback($"Downloading update (attempt {attempt}/{maxRetries})...");
                using var request = new HttpRequestMessage(HttpMethod.Get, downloadUrl);
                request.Headers.Accept.ParseAdd("application/octet-stream");
                using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
                response.EnsureSuccessStatusCode();

                var totalBytes = response.Content.Headers.ContentLength ?? -1;
                var totalKB = totalBytes > 0 ? totalBytes / 1024 : 0;
                long downloadedBytes = 0;
                int lastPercent = -1;

                await using var contentStream = await response.Content.ReadAsStreamAsync();
                await using var fs = new FileStream(zipPath, FileMode.Create, FileAccess.Write, FileShare.None);

                var buffer = new byte[8192];
                int bytesRead;
                while ((bytesRead = await contentStream.ReadAsync(buffer, 0, buffer.Length)) > 0)
                {
                    await fs.WriteAsync(buffer, 0, bytesRead);
                    downloadedBytes += bytesRead;

                    // Report progress every 5%
                    if (totalBytes > 0)
                    {
                        int percent = (int)(downloadedBytes * 100 / totalBytes);
                        if (percent / 5 != lastPercent / 5)
                        {
                            lastPercent = percent;
                            logCallback($"Downloading: {percent}% ({downloadedBytes / 1024} KB / {totalKB} KB)");
                        }
                    }
                }

                logCallback($"Download complete: {downloadedBytes / 1024} KB");
                break; // Success, exit retry loop
            }
            catch (Exception ex) when (attempt < maxRetries)
            {
                logCallback($"Download failed (attempt {attempt}): {ex.Message}. Retrying in 3s...");
                await Task.Delay(3000);
            }
            catch (Exception ex)
            {
                logCallback($"Error: Download failed after {maxRetries} attempts: {ex.Message}");
                return;
            }
        }

        logCallback("Extracting files...");
        var extractDir = Path.Combine(tempRoot, "extract");
        if (Directory.Exists(extractDir)) Directory.Delete(extractDir, true);
        Directory.CreateDirectory(extractDir);
        ZipFile.ExtractToDirectory(zipPath, extractDir, true);

        // Handle nested folder if zip contains a root folder
        var payloadRoot = extractDir;
        var entries = Directory.GetFileSystemEntries(extractDir);
        if (entries.Length == 1 && Directory.Exists(entries[0]))
        {
            payloadRoot = entries[0];
        }

        logCallback("Preparing to restart...");
        var baseDir = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
        var updaterPath = Path.Combine(tempRoot, "apply-update.cmd");
        var logPath = Path.Combine(baseDir, "update_log.txt");
        var pid = Environment.ProcessId;
        var script = $"""
@echo off
setlocal enabledelayedexpansion
(
echo [INFO] Update started at %TIME%
echo [INFO] Waiting for PID {pid} to exit...
:wait_loop
tasklist /FI "PID eq {pid}" 2>NUL | find "{pid}" >NUL
if !errorlevel! == 0 (
    echo [INFO] Process {pid} still running, waiting...
    timeout /t 1 /nobreak >nul
    goto wait_loop
)
echo [INFO] Process exited.
echo [INFO] Source: "{payloadRoot}"
echo [INFO] Destination: "{baseDir}"

echo [INFO] Starting copy...
:copy_retry
xcopy "{payloadRoot}\*" "{baseDir}\" /E /I /Y /H /R
if !errorlevel! neq 0 (
    echo [ERROR] Copy failed with errorlevel !errorlevel!. Retrying in 2 seconds...
    timeout /t 2 /nobreak >nul
    goto copy_retry
)

echo [INFO] Copy successful.
echo [INFO] Restarting application: "{exePath}"
start "" "{exePath}"
) > "{logPath}" 2>&1
endlocal
del "%~f0"
""";
        await File.WriteAllTextAsync(updaterPath, script, System.Text.Encoding.Default);

        Process.Start(new ProcessStartInfo
        {
            FileName = "cmd.exe",
            Arguments = $"/c \"{updaterPath}\"",
            CreateNoWindow = true,
            UseShellExecute = false
        });

        logCallback("Restarting...");
        Environment.Exit(0);
    }
}
