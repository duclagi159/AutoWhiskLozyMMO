using System.Text.RegularExpressions;

namespace PromptToolCSharp.Logic;

/// <summary>
/// Logic xử lý gối đầu prompt - chuyển từ Python Logic_GopGoiDau/logic.py
/// </summary>
public static class ChainLogic
{
    // =============================================================================
    // PARSERS
    // =============================================================================

    public static (List<string> Images, List<string> Videos) ParseFlowVideoFormat(string raw)
    {
        var imgList = new List<string>();
        var vidList = new List<string>();
        var matches = Regex.Matches(raw,
            @"IMAGE PROMPT:(.*?)(?=FLOW VIDEO PROMPT:)\s*FLOW VIDEO PROMPT:(.*?)(?=\nScene|\nIMAGE PROMPT:|$)",
            RegexOptions.Singleline | RegexOptions.IgnoreCase);
        foreach (Match m in matches)
        {
            imgList.Add(Collapse(m.Groups[1].Value));
            vidList.Add(Collapse(m.Groups[2].Value));
        }
        return (imgList, vidList);
    }

    public static bool IsImageRatioFormat(string raw)
        => Regex.IsMatch(raw, @"Image\s+\d+[^\n]*ratio", RegexOptions.IgnoreCase);

    public static List<string> ParseImageRatioFormatKeepHeader(string raw)
    {
        var results = new List<string>();
        var matches = Regex.Matches(raw,
            @"(Image\s+(\d+)[^\n]*ratio[^\n]*)\n(.*?)(?=Image\s+\d+[^\n]*ratio|\Z)",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
        var sorted = matches.Cast<Match>().OrderBy(m => int.Parse(m.Groups[2].Value));
        foreach (var m in sorted)
        {
            string header = m.Groups[1].Value.Trim();
            string content = Collapse(m.Groups[3].Value);
            string full = header + "\n" + content;
            if (!string.IsNullOrEmpty(full.Trim())) results.Add(full);
        }
        return results;
    }

    public static bool IsTitleDashFormat(string raw)
    {
        if (Regex.IsMatch(raw, @"^\s*Motion\s+Prompt\s*\d+", RegexOptions.IgnoreCase | RegexOptions.Multiline)) return false;
        if (Regex.IsMatch(raw, @"^\s*Image\s*\d+", RegexOptions.IgnoreCase | RegexOptions.Multiline)) return false;
        return Regex.Matches(raw, @"(?:^|\n)[A-Z][A-Za-z\s]+?\s*[\u2014\u2013-]\s*\S", RegexOptions.Multiline).Count >= 1;
    }

    public static List<string> ParseTitleDashFormatKeepHeader(string raw)
    {
        var results = new List<string>();
        var matches = Regex.Matches(raw, @"(?:^|\n)([A-Z][A-Za-z\s]+?)\s*[\u2014\u2013-]\s*", RegexOptions.Multiline);
        var ml = matches.Cast<Match>().ToList();
        for (int i = 0; i < ml.Count; i++)
        {
            string title = ml[i].Groups[1].Value.Trim();
            int start = ml[i].Index + ml[i].Length;
            int end = (i + 1 < ml.Count) ? ml[i + 1].Index : raw.Length;
            string content = Collapse(raw.Substring(start, end - start));
            if (!string.IsNullOrEmpty(content)) results.Add($"{title}\n{content}");
        }
        return results;
    }

    public static bool IsMotionPromptFormat(string raw)
        => Regex.IsMatch(raw, @"Motion\s+Prompt\s*\d+", RegexOptions.IgnoreCase);

    public static List<string> ParseMotionPromptFormatKeepHeader(string raw)
    {
        var results = new List<string>();
        var matches = Regex.Matches(raw,
            @"(Motion\s+Prompt\s*(\d+)\s*(?:\([^)]*\))?)\s*\n?(.*?)(?=Motion\s+Prompt\s*\d+|\Z)",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
        var sorted = matches.Cast<Match>().OrderBy(m => int.Parse(m.Groups[2].Value));
        foreach (var m in sorted)
        {
            string header = Collapse(m.Groups[1].Value);
            string content = Collapse(m.Groups[3].Value);
            if (!string.IsNullOrEmpty(content)) results.Add($"{header}\n{content}");
        }
        return results;
    }

    public static bool IsImageInlineFormat(string raw)
    {
        if (Regex.IsMatch(raw, @"Image\s+\d+\s*:", RegexOptions.IgnoreCase)) return false;
        if (Regex.IsMatch(raw, @"Image\s+\d+[^\n]*ratio", RegexOptions.IgnoreCase)) return false;
        return Regex.IsMatch(raw, @"Image\s*\d+\s*\n?[A-Z]", RegexOptions.IgnoreCase);
    }

    public static List<string> ParseImageInlineFormatKeepHeader(string raw)
    {
        var results = new List<string>();
        var matches = Regex.Matches(raw,
            @"Image\s*(\d+)\s*\n?([A-Z].*?)(?=Image\s*\d+\s*\n?[A-Z]|\Z)",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
        var sorted = matches.Cast<Match>().OrderBy(m => int.Parse(m.Groups[1].Value));
        foreach (var m in sorted)
        {
            int num = int.Parse(m.Groups[1].Value);
            string content = Collapse(m.Groups[2].Value);
            if (!string.IsNullOrEmpty(content)) results.Add($"Image {num}\n{content}");
        }
        return results;
    }

    public static List<string> ParsePromptFormat(string raw)
    {
        var results = new List<string>();
        var chunks = Regex.Split(raw, @"(?:^|\n)\s*Prompt:", RegexOptions.IgnoreCase);
        foreach (string chunk in chunks)
        {
            string clean = Regex.Replace(Collapse(chunk), @"^(?:Prompt:|Image Prompt:)\s*", "", RegexOptions.IgnoreCase).Trim();
            if (!string.IsNullOrEmpty(clean)) results.Add(clean);
        }
        return results;
    }

    public static bool IsSceneTitle(string line)
    {
        line = line.Trim();
        if (line.Length > 60) return false;
        if (Regex.IsMatch(line, @"^\d+-second", RegexOptions.IgnoreCase)) return false;
        if (!Regex.IsMatch(line, @"[a-zA-Z]")) return false;
        if (Regex.IsMatch(line, @"[.,;]")) return false;
        var words = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (words.Length > 6) return false;
        return words.Any(w => w.Length > 0 && char.IsLetter(w[0]) && char.IsUpper(w[0]));
    }

    public static bool IsTitleContentFormat(string raw)
    {
        var lines = raw.Trim().Split('\n').Select(l => l.Trim()).Where(l => !string.IsNullOrEmpty(l)).ToArray();
        if (lines.Length < 2) return false;
        int titleCount = lines.Count(IsSceneTitle);
        int contentCount = lines.Length - titleCount;
        return titleCount >= 1 && contentCount >= 1 && titleCount <= lines.Length / 2 + 1;
    }

    public static List<string> ParseTitleContentFormat(string raw)
    {
        var results = new List<string>();
        string? currentTitle = null;
        var currentContent = new List<string>();
        foreach (string line in raw.Trim().Split('\n'))
        {
            string stripped = line.Trim();
            if (string.IsNullOrEmpty(stripped)) continue;
            if (IsSceneTitle(stripped))
            {
                if (currentTitle != null && currentContent.Count > 0)
                {
                    string full = Collapse(string.Join(" ", currentContent));
                    if (!string.IsNullOrEmpty(full)) results.Add(full);
                }
                currentTitle = stripped;
                currentContent.Clear();
            }
            else currentContent.Add(stripped);
        }
        if (currentTitle != null && currentContent.Count > 0)
        {
            string full = Collapse(string.Join(" ", currentContent));
            if (!string.IsNullOrEmpty(full)) results.Add(full);
        }
        return results;
    }

    public static List<string> ParseParagraphFormat(string raw)
    {
        var results = new List<string>();
        var chunks = Regex.Split(raw, @"\n\s*\n");
        foreach (string chunk in chunks)
        {
            string clean = Regex.Replace(Collapse(chunk), @"^(?:Prompt:|Image Prompt:)\s*", "", RegexOptions.IgnoreCase).Trim();
            if (!string.IsNullOrEmpty(clean)) results.Add(clean);
        }
        return results;
    }

    public static bool IsImageScriptPlaceholderFormat(string raw)
    {
        bool hasImage = Regex.IsMatch(raw, @"Image\s+\d+:", RegexOptions.IgnoreCase);
        bool hasScript = Regex.IsMatch(raw, @"SCRIPT PLACEHOLDER:", RegexOptions.IgnoreCase);
        bool hasSceneAddon = Regex.IsMatch(raw, @"SCENE ADD-ON \(English\):", RegexOptions.IgnoreCase);
        return hasImage && hasScript && !hasSceneAddon;
    }

    public static List<string> ParseImageScriptPlaceholderFormat(string raw)
    {
        var results = new List<string>();
        var promptKeywords = new[] {
            "illustration", "background", "character", "scene", "drawing",
            "doodle", "sketch", "art style", "minimalist", "hand-drawn",
            "pure black", "pure white", "outline", "line art"
        };

        var parts = Regex.Split(raw, @"Image\s+\d+:\s*", RegexOptions.IgnoreCase);
        foreach (string part in parts)
        {
            if (string.IsNullOrWhiteSpace(part)) continue;
            var scriptMatch = Regex.Match(part, @"SCRIPT PLACEHOLDER:\s*", RegexOptions.IgnoreCase);
            if (!scriptMatch.Success) continue;

            string afterScript = part.Substring(scriptMatch.Index + scriptMatch.Length).Trim();
            var lines = afterScript.Split('\n');
            var promptLines = new List<string>();
            bool scriptEnded = false;

            foreach (string line in lines)
            {
                string trimmed = line.Trim();
                if (string.IsNullOrEmpty(trimmed)) continue;
                if (trimmed.StartsWith("A ") && trimmed.Length > 50) { scriptEnded = true; promptLines.Add(trimmed); }
                else if (scriptEnded) promptLines.Add(trimmed);
                else if (promptKeywords.Any(kw => trimmed.ToLower().Contains(kw)) && trimmed.Length > 50) { scriptEnded = true; promptLines.Add(trimmed); }
            }
            if (promptLines.Count > 0) results.Add(Collapse(string.Join(" ", promptLines)));
        }
        return results;
    }

    public static bool IsFrameScriptSceneFormat(string raw)
    {
        return Regex.IsMatch(raw, @"FRAME\s+\d+", RegexOptions.IgnoreCase)
            && Regex.IsMatch(raw, @"SCRIPT PLACEHOLDER:", RegexOptions.IgnoreCase)
            && Regex.IsMatch(raw, @"SCENE ADD-ON \(English\):", RegexOptions.IgnoreCase);
    }

    public static List<string> ParseFrameScriptSceneFormat(string raw)
    {
        var results = new List<string>();
        var matches = Regex.Matches(raw, @"(FRAME\s+\d+.*?)(?=FRAME\s+\d+|$)", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        foreach (Match m in matches)
        {
            var lines = m.Value.Trim().Split('\n').Select(l => l.Trim()).Where(l => !string.IsNullOrEmpty(l));
            string joined = string.Join("\n", lines);
            if (!string.IsNullOrEmpty(joined)) results.Add(joined);
        }
        return results;
    }

    public static bool IsLongSentenceFormat(string raw)
    {
        if (raw.Trim().Contains('\n')) return false;
        return Regex.Matches(raw, @"\.[A-Z]").Count >= 1;
    }

    public static List<string> ParseLongSentenceFormat(string raw)
    {
        var results = new List<string>();
        var parts = Regex.Split(raw, @"(?<=\.)(?=[A-Z])");
        foreach (string part in parts)
        {
            string cleaned = part.Trim();
            if (!string.IsNullOrEmpty(cleaned)) results.Add(cleaned);
        }
        return results;
    }

    public static bool IsPeriodNewlineFormat(string raw)
    {
        if (!raw.Contains('\n')) return false;
        return Regex.Matches(raw, @"\.\s*\n\s*\n").Count >= 1;
    }

    public static List<string> ParsePeriodNewlineFormat(string raw)
    {
        var results = new List<string>();
        var parts = Regex.Split(raw, @"\n\s*\n+");
        foreach (string part in parts)
        {
            string cleaned = Collapse(part);
            if (!string.IsNullOrEmpty(cleaned)) results.Add(cleaned);
        }
        return results;
    }

    // =============================================================================
    // MAIN PROCESS
    // =============================================================================
    public static List<string> ParseInput(string raw)
    {
        if (raw.ToUpper().Contains("FLOW VIDEO PROMPT:"))
        { var (imgs, _) = ParseFlowVideoFormat(raw); return imgs; }
        if (IsFrameScriptSceneFormat(raw)) return ParseFrameScriptSceneFormat(raw);
        if (IsImageScriptPlaceholderFormat(raw)) return ParseImageScriptPlaceholderFormat(raw);
        if (IsPeriodNewlineFormat(raw)) return ParsePeriodNewlineFormat(raw);
        if (IsLongSentenceFormat(raw)) return ParseLongSentenceFormat(raw);
        if (IsImageRatioFormat(raw)) return ParseImageRatioFormatKeepHeader(raw);
        if (IsTitleDashFormat(raw)) return ParseTitleDashFormatKeepHeader(raw);
        if (IsMotionPromptFormat(raw)) return ParseMotionPromptFormatKeepHeader(raw);
        if (IsImageInlineFormat(raw)) return ParseImageInlineFormatKeepHeader(raw);
        if (Regex.Matches(raw.ToLower(), "prompt:").Count > 1) return ParsePromptFormat(raw);
        if (raw.Contains("\n\n") || Regex.IsMatch(raw, @"\n\s*\n")) return ParseParagraphFormat(raw);
        if (IsTitleContentFormat(raw)) return ParseTitleContentFormat(raw);
        if (raw.Contains('\n'))
            return raw.Trim().Split('\n').Select(l => l.Trim()).Where(l => !string.IsNullOrEmpty(l)).ToList();
        return ParseSingleLine(raw);
    }

    private static List<string> ParseSingleLine(string raw)
    {
        var results = new List<string>();
        var parts = Regex.Split(raw, @"((?:no\s+watermark|no\s+text|no\s+dialogue|no\s+speech)\.)\s+(?=[A-Z])", RegexOptions.IgnoreCase);

        if (parts.Length > 1)
        {
            string current = "";
            foreach (string part in parts)
            {
                if (Regex.IsMatch(part, @"(?:no\s+watermark|no\s+text|no\s+dialogue|no\s+speech)\.", RegexOptions.IgnoreCase))
                {
                    current += part;
                    if (!string.IsNullOrWhiteSpace(current)) results.Add(current.Trim());
                    current = "";
                }
                else current += part;
            }
            if (!string.IsNullOrWhiteSpace(current)) results.Add(current.Trim());
        }
        else if (Regex.IsMatch(raw, @"\.[A-Z]"))
        {
            foreach (string part in Regex.Split(raw, @"(?<=\.)(?=[A-Z])"))
            {
                string cleaned = part.Trim();
                if (!string.IsNullOrEmpty(cleaned)) results.Add(cleaned);
            }
        }
        else results.Add(raw.Trim());

        return results;
    }

    public static List<string> AddPrefix(List<string> prompts, string prefix)
    {
        if (string.IsNullOrEmpty(prefix)) return prompts;
        string fmt = prefix.EndsWith(" ") ? prefix : prefix + " ";
        return prompts.Select(p => fmt + p).ToList();
    }

    public static List<string> AddSuffix(List<string> prompts, string suffix)
    {
        if (string.IsNullOrEmpty(suffix)) return prompts;
        string fmt = suffix.StartsWith(" ") ? suffix : " " + suffix;
        return prompts.Select(p => p + fmt).ToList();
    }

    public static List<string> CreateChainPairs(List<string> prompts)
    {
        var pairs = new List<string>();
        for (int i = 0; i < prompts.Count - 1; i++)
            pairs.Add($"{prompts[i]} {prompts[i + 1]}");
        return pairs;
    }

    public static (List<string> Singles, List<string> Chains) ProcessChain(string raw, string prefix = "", string suffix = "")
    {
        var prompts = ParseInput(raw);
        var withPrefix = AddPrefix(prompts, prefix.Trim());
        var withSuffix = AddSuffix(withPrefix, suffix.Trim());
        var chains = CreateChainPairs(withSuffix);
        return (withSuffix, chains);
    }

    private static string Collapse(string s) => Regex.Replace(s.Trim(), @"\s+", " ").Trim();
}
