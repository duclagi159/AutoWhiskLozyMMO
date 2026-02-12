﻿using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Windows.Forms;
using ToolApp;

// Note: ToolApp namespace is used for MainForm and UpdateManager

var usage = $"""
Whisk-like CLI (offline) v{System.Reflection.Assembly.GetExecutingAssembly().GetName().Version}

Usage:
  ToolApp --subject <path> --scene <path> --style <path> [--text "optional"] [--out <dir>]
  ToolApp --update
  ToolApp --check-update

Example:
  ToolApp --subject subject.jpg --scene scene.jpg --style style.jpg --text "soft light"
  ToolApp --update
""";

// No arguments = Launch GUI mode
if (args.Length == 0)
{
    var thread = new Thread(() =>
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new ToolApp.MainForm());
    });
    thread.SetApartmentState(ApartmentState.STA);
    thread.Start();
    thread.Join();
    return;
}

if (args.Any(a => a.Equals("--help", StringComparison.OrdinalIgnoreCase)))
{
    Console.WriteLine(usage);
    return;
}

try
{
    if (args.Any(a => a.Equals("--check-update", StringComparison.OrdinalIgnoreCase)))
    {
        var info = await UpdateManager.CheckForUpdateAsync();
        Console.WriteLine($"Current version: {info.CurrentVersion}");
        if (info.Available)
        {
            Console.WriteLine($"Update available: {info.Tag} (v{info.RemoteVersion})");
            Console.WriteLine($"Release URL: {info.ReleaseUrl}");
            Console.WriteLine("Run 'ToolApp --update' to apply.");
        }
        else
        {
            Console.WriteLine("You are up to date.");
        }
        return;
    }

    if (args.Any(a => a.Equals("--update", StringComparison.OrdinalIgnoreCase)))
    {
        await UpdateManager.PerformUpdateAsync(msg => Console.WriteLine(msg));
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

    return result;
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
