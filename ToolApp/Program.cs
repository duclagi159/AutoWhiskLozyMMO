﻿using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO.Compression;
using System.Net.Http;
using System.Text;
using System.Text.Json;

var usage = """
Whisk-like CLI (offline)

Usage:
  ToolApp --subject <path> --scene <path> --style <path> [--text "optional"] [--out <dir>]
  ToolApp --update --repo <owner/name> --asset <file.zip>

Example:
  ToolApp --subject subject.jpg --scene scene.jpg --style style.jpg --text "soft light"
  ToolApp --update --repo duclagi159/AutoWhisk-Updates --asset ToolApp-win-x64.zip
""";

if (args.Length == 0 || args.Any(a => a.Equals("--help", StringComparison.OrdinalIgnoreCase)))
{
    Console.WriteLine(usage);
    return;
}

try
{
    if (args.Any(a => a.Equals("--update", StringComparison.OrdinalIgnoreCase)))
    {
        var updateArgs = args.Where(a => !a.Equals("--update", StringComparison.OrdinalIgnoreCase)).ToArray();
        var updateValues = ParseArgs(updateArgs);
        await UpdateFromReleaseAsync(updateValues);
        return;
    }

    var values = ParseArgs(args);

    if (!values.TryGetValue("subject", out var subjectPath) ||
        !values.TryGetValue("scene", out var scenePath) ||
        !values.TryGetValue("style", out var stylePath))
    {
        Console.Error.WriteLine("Missing required inputs: --subject, --scene, --style");
        Console.WriteLine(usage);
        return;
    }

    subjectPath = Path.GetFullPath(subjectPath);
    scenePath = Path.GetFullPath(scenePath);
    stylePath = Path.GetFullPath(stylePath);

    if (!File.Exists(subjectPath) || !File.Exists(scenePath) || !File.Exists(stylePath))
    {
        Console.Error.WriteLine("One or more input files do not exist.");
        return;
    }

    var outputDir = values.TryGetValue("out", out var outDir)
        ? Path.GetFullPath(outDir)
        : Path.Combine(Directory.GetCurrentDirectory(), "output");

    if (Directory.Exists(outputDir))
    {
        outputDir = $"{outputDir}-{DateTime.Now:yyyyMMdd-HHmmss}";
    }

    Directory.CreateDirectory(outputDir);

    var subjectName = Path.GetFileNameWithoutExtension(subjectPath);
    var sceneName = Path.GetFileNameWithoutExtension(scenePath);
    var styleName = Path.GetFileNameWithoutExtension(stylePath);
    var text = values.TryGetValue("text", out var t) ? t?.Trim() ?? string.Empty : string.Empty;

    var prompt = $"Subject: {subjectName}. Scene: {sceneName}. Style: {styleName}.";
    if (!string.IsNullOrWhiteSpace(text))
    {
        prompt = $"{prompt} {text}";
    }

    var promptPath = Path.Combine(outputDir, "prompt.txt");
    await File.WriteAllTextAsync(promptPath, prompt, new UTF8Encoding(false));

    var recipe = new
    {
        subject = subjectPath,
        scene = scenePath,
        style = stylePath,
        text,
        output = new
        {
            promptFile = "prompt.txt",
            previewFile = "preview.png"
        },
        createdAt = DateTimeOffset.Now
    };

    var recipePath = Path.Combine(outputDir, "recipe.json");
    var recipeJson = JsonSerializer.Serialize(recipe, new JsonSerializerOptions { WriteIndented = true });
    await File.WriteAllTextAsync(recipePath, recipeJson, new UTF8Encoding(false));

    var previewPath = Path.Combine(outputDir, "preview.png");
    CreatePreview(subjectPath, scenePath, stylePath, previewPath);

    Console.WriteLine("Generated:");
    Console.WriteLine(promptPath);
    Console.WriteLine(recipePath);
    Console.WriteLine(previewPath);
}
catch (Exception ex)
{
    Console.Error.WriteLine($"Error: {ex.Message}");
    Environment.Exit(1);
}

static Dictionary<string, string> ParseArgs(string[] args)
{
    var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    string? pendingKey = null;

    foreach (var arg in args)
    {
        if (pendingKey != null)
        {
            result[pendingKey] = arg;
            pendingKey = null;
            continue;
        }

        if (arg.StartsWith("--"))
        {
            var key = arg[2..];
            if (string.IsNullOrWhiteSpace(key))
            {
                continue;
            }
            pendingKey = key;
            continue;
        }

        throw new ArgumentException($"Unexpected argument: {arg}");
    }

    if (pendingKey != null)
    {
        throw new ArgumentException($"Missing value for --{pendingKey}");
    }

    return result;
}

static async Task UpdateFromReleaseAsync(Dictionary<string, string> values)
{
    if (!values.TryGetValue("repo", out var repo) || string.IsNullOrWhiteSpace(repo) ||
        !values.TryGetValue("asset", out var assetName) || string.IsNullOrWhiteSpace(assetName))
    {
        Console.Error.WriteLine("Missing required inputs for update: --repo, --asset");
        return;
    }

    var exePath = Environment.ProcessPath;
    if (string.IsNullOrWhiteSpace(exePath) || exePath.EndsWith("dotnet.exe", StringComparison.OrdinalIgnoreCase))
    {
        Console.Error.WriteLine("Update requires a published executable. Please run the .exe directly.");
        return;
    }

    using var http = new HttpClient();
    http.DefaultRequestHeaders.UserAgent.ParseAdd("ToolApp-Updater");

    var apiUrl = $"https://api.github.com/repos/{repo}/releases/latest";
    var releaseJson = await http.GetStringAsync(apiUrl);

    using var doc = JsonDocument.Parse(releaseJson);
    if (!doc.RootElement.TryGetProperty("assets", out var assets))
    {
        Console.Error.WriteLine("No assets found in the latest release.");
        return;
    }

    string? downloadUrl = null;
    foreach (var asset in assets.EnumerateArray())
    {
        if (asset.TryGetProperty("name", out var nameProp) &&
            nameProp.GetString()?.Equals(assetName, StringComparison.OrdinalIgnoreCase) == true &&
            asset.TryGetProperty("browser_download_url", out var urlProp))
        {
            downloadUrl = urlProp.GetString();
            break;
        }
    }

    if (string.IsNullOrWhiteSpace(downloadUrl))
    {
        Console.Error.WriteLine($"Asset not found: {assetName}");
        return;
    }

    var tempRoot = Path.Combine(Path.GetTempPath(), "ToolAppUpdate", Guid.NewGuid().ToString("N"));
    Directory.CreateDirectory(tempRoot);
    var zipPath = Path.Combine(tempRoot, assetName);

    using (var response = await http.GetAsync(downloadUrl, HttpCompletionOption.ResponseHeadersRead))
    {
        response.EnsureSuccessStatusCode();
        await using var fs = new FileStream(zipPath, FileMode.Create, FileAccess.Write, FileShare.None);
        await response.Content.CopyToAsync(fs);
    }

    var extractDir = Path.Combine(tempRoot, "extract");
    Directory.CreateDirectory(extractDir);
    ZipFile.ExtractToDirectory(zipPath, extractDir, true);

    var payloadRoot = extractDir;
    var entries = Directory.GetFileSystemEntries(extractDir);
    if (entries.Length == 1 && Directory.Exists(entries[0]))
    {
        payloadRoot = entries[0];
    }

    var baseDir = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
    var updaterPath = Path.Combine(tempRoot, "apply-update.cmd");
    var script = $"""
@echo off
setlocal
ping 127.0.0.1 -n 3 > nul
xcopy "{payloadRoot}\*" "{baseDir}\" /E /I /Y > nul
start "" "{exePath}"
endlocal
del "%~f0"
""";
    await File.WriteAllTextAsync(updaterPath, script, new UTF8Encoding(false));

    Process.Start(new ProcessStartInfo
    {
        FileName = "cmd.exe",
        Arguments = $"/c \"{updaterPath}\"",
        CreateNoWindow = true,
        UseShellExecute = false
    });

    Environment.Exit(0);
}

static void CreatePreview(string subjectPath, string scenePath, string stylePath, string previewPath)
{
    using var subject = new Bitmap(subjectPath);
    using var scene = new Bitmap(scenePath);
    using var style = new Bitmap(stylePath);

    const int targetHeight = 512;
    using var subjectResized = ResizeToHeight(subject, targetHeight);
    using var sceneResized = ResizeToHeight(scene, targetHeight);
    using var styleResized = ResizeToHeight(style, targetHeight);

    var totalWidth = subjectResized.Width + sceneResized.Width + styleResized.Width;
    using var collage = new Bitmap(totalWidth, targetHeight);
    using var g = Graphics.FromImage(collage);
    g.Clear(Color.Black);
    g.DrawImage(subjectResized, 0, 0);
    g.DrawImage(sceneResized, subjectResized.Width, 0);
    g.DrawImage(styleResized, subjectResized.Width + sceneResized.Width, 0);
    collage.Save(previewPath, ImageFormat.Png);
}

static Bitmap ResizeToHeight(Image source, int targetHeight)
{
    var scale = (double)targetHeight / source.Height;
    var targetWidth = (int)Math.Round(source.Width * scale);
    var dest = new Bitmap(targetWidth, targetHeight);
    dest.SetResolution(source.HorizontalResolution, source.VerticalResolution);
    using var g = Graphics.FromImage(dest);
    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
    g.SmoothingMode = SmoothingMode.HighQuality;
    g.PixelOffsetMode = PixelOffsetMode.HighQuality;
    g.DrawImage(source, 0, 0, targetWidth, targetHeight);
    return dest;
}
