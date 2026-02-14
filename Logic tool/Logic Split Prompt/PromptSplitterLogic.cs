using System.Text.RegularExpressions;

namespace PromptToolCSharp.Logic;

/// <summary>
/// Logic xử lý tách prompt - chuyển từ Python Logic_TachPrompt/logic.py
/// Bao gồm 25+ regex parsers auto-detect format.
/// </summary>
public static class PromptSplitterLogic
{
    // =============================================================================
    // PARSERS
    // =============================================================================

    // --- Flow Video Parser ---
    public static (List<string> Images, List<string> Videos) ParseFlowVideoFormat(string raw)
    {
        var imgList = new List<string>();
        var vidList = new List<string>();
        var matches = Regex.Matches(raw,
            @"IMAGE PROMPT:(.*?)(?=FLOW VIDEO PROMPT:)\s*FLOW VIDEO PROMPT:(.*?)(?=\nScene|\nIMAGE PROMPT:|$)",
            RegexOptions.Singleline | RegexOptions.IgnoreCase);
        foreach (Match m in matches)
        {
            imgList.Add(CollapseWhitespace(m.Groups[1].Value));
            vidList.Add(CollapseWhitespace(m.Groups[2].Value));
        }
        return (imgList, vidList);
    }

    // --- JSON Format Parser ---
    public static List<string> ParseJsonFormat(string raw)
    {
        var results = new List<string>();
        int depth = 0, startIdx = -1;
        for (int i = 0; i < raw.Length; i++)
        {
            if (raw[i] == '{')
            {
                if (depth == 0) startIdx = i;
                depth++;
            }
            else if (raw[i] == '}')
            {
                depth--;
                if (depth == 0 && startIdx != -1)
                {
                    string jsonStr = raw.Substring(startIdx, i - startIdx + 1);
                    string clean = CollapseWhitespace(jsonStr);
                    if (!string.IsNullOrEmpty(clean)) results.Add(clean);
                    startIdx = -1;
                }
            }
        }
        return results;
    }

    // --- Image Marker Format [IMAGE X] ---
    public static bool IsImageMarkerFormat(string raw)
        => Regex.IsMatch(raw, @"\[\s*IMAGE\s*\d+\s*\]", RegexOptions.IgnoreCase);

    public static List<string> ParseImageMarkerFormat(string raw, HashSet<int>? filterNums = null)
    {
        var results = new List<string>();
        var matches = Regex.Matches(raw,
            @"\[\s*IMAGE\s*(\d+)\s*\]\s*(.*?)(?=\[\s*IMAGE\s*\d+\s*\]|\Z)",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
        var sorted = matches.Cast<Match>().OrderBy(m => int.Parse(m.Groups[1].Value));
        foreach (var m in sorted)
        {
            int num = int.Parse(m.Groups[1].Value);
            if (filterNums != null && !filterNums.Contains(num)) continue;
            string clean = CollapseWhitespace(m.Groups[2].Value);
            if (!string.IsNullOrEmpty(clean)) results.Add(clean);
        }
        return results;
    }

    // --- Image Ratio Format ---
    public static bool IsImageRatioFormat(string raw)
        => Regex.IsMatch(raw, @"Image\s+\d+[^\n]*ratio", RegexOptions.IgnoreCase);

    public static List<string> ParseImageRatioFormat(string raw, HashSet<int>? filterNums = null)
    {
        var results = new List<string>();
        var matches = Regex.Matches(raw,
            @"(Image\s+(\d+)[^\n]*ratio[^\n]*)\n(.*?)(?=Image\s+\d+[^\n]*ratio|\Z)",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
        var sorted = matches.Cast<Match>().OrderBy(m => int.Parse(m.Groups[2].Value));
        foreach (var m in sorted)
        {
            int num = int.Parse(m.Groups[2].Value);
            if (filterNums != null && !filterNums.Contains(num)) continue;
            string clean = CollapseWhitespace(m.Groups[3].Value);
            if (!string.IsNullOrEmpty(clean)) results.Add(clean);
        }
        return results;
    }

    // --- Inline Paren Format ). ---
    public static bool IsInlineParenFormat(string raw)
    {
        if (Regex.IsMatch(raw, @"^\s*Motion\s+Prompt\s*\d+", RegexOptions.IgnoreCase)) return false;
        if (Regex.IsMatch(raw, @"^\s*Image\s*\d+", RegexOptions.IgnoreCase)) return false;
        if (Regex.IsMatch(raw, @"\)\.\s*Image\s*\d+", RegexOptions.IgnoreCase)) return false;
        if (Regex.IsMatch(raw, @"\)\.\s*Motion\s+Prompt\s*\d+", RegexOptions.IgnoreCase)) return false;
        if (Regex.IsMatch(raw, @"(?:^|\n)[A-Z][A-Za-z\s]+?\s*[\u2014\u2013-]\s*", RegexOptions.Multiline)) return false;
        if (Regex.IsMatch(raw, @"(?:^|\n)\s*Scene\s*:", RegexOptions.IgnoreCase)) return false;
        return Regex.Matches(raw, @"\)\.\s*[A-Z]").Count >= 1;
    }

    public static List<string> ParseInlineParenFormat(string raw)
    {
        var results = new List<string>();
        var parts = Regex.Split(raw, @"(\)\.)(?:\s*)(?=[A-Z])");
        string current = "";
        foreach (var part in parts)
        {
            if (part == ").")
            {
                current += part;
                string clean = CollapseWhitespace(current);
                if (!string.IsNullOrEmpty(clean)) results.Add(clean);
                current = "";
            }
            else current += part;
        }
        if (!string.IsNullOrWhiteSpace(current))
        {
            string clean = CollapseWhitespace(current);
            if (!string.IsNullOrEmpty(clean)) results.Add(clean);
        }
        return results;
    }

    // --- Title Dash Format ---
    public static bool IsTitleDashFormat(string raw)
    {
        if (Regex.IsMatch(raw, @"^\s*Motion\s+Prompt\s*\d+", RegexOptions.IgnoreCase | RegexOptions.Multiline)) return false;
        if (Regex.IsMatch(raw, @"^\s*Image\s*\d+", RegexOptions.IgnoreCase | RegexOptions.Multiline)) return false;
        return Regex.Matches(raw, @"(?:^|\n)[A-Z][A-Za-z\s]+?\s*[\u2014\u2013-]\s*\S", RegexOptions.Multiline).Count >= 1;
    }

    public static List<string> ParseTitleDashFormat(string raw, HashSet<int>? filterNums = null)
    {
        var results = new List<string>();
        var matches = Regex.Matches(raw, @"(?:^|\n)([A-Z][A-Za-z\s]+?)\s*[\u2014\u2013-]\s*", RegexOptions.Multiline);
        var matchList = matches.Cast<Match>().ToList();
        for (int i = 0; i < matchList.Count; i++)
        {
            int start = matchList[i].Index + matchList[i].Length;
            int end = (i + 1 < matchList.Count) ? matchList[i + 1].Index : raw.Length;
            string content = raw.Substring(start, end - start).Trim();
            string clean = CollapseWhitespace(content);
            if (!string.IsNullOrEmpty(clean)) results.Add(clean);
        }
        return results;
    }

    // --- Motion Prompt Format ---
    public static bool IsMotionPromptFormat(string raw)
        => Regex.IsMatch(raw, @"Motion\s+Prompt\s*\d+", RegexOptions.IgnoreCase);

    public static List<string> ParseMotionPromptFormat(string raw, HashSet<int>? filterNums = null)
    {
        var results = new List<string>();
        var matches = Regex.Matches(raw,
            @"Motion\s+Prompt\s*(\d+)\s*(?:\([^)]*\))?\s*\n?(.*?)(?=Motion\s+Prompt\s*\d+|\Z)",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
        var sorted = matches.Cast<Match>().OrderBy(m => int.Parse(m.Groups[1].Value));
        foreach (var m in sorted)
        {
            int num = int.Parse(m.Groups[1].Value);
            if (filterNums != null && !filterNums.Contains(num)) continue;
            string clean = CollapseWhitespace(m.Groups[2].Value);
            if (!string.IsNullOrEmpty(clean)) results.Add(clean);
        }
        return results;
    }

    // --- Script Placeholder Format ---
    public static bool IsScriptPlaceholderFormat(string raw)
        => Regex.IsMatch(raw, @"Image\s+\d+\s*:.*?SCRIPT\s+PLACEHOLDER\s*:", RegexOptions.IgnoreCase | RegexOptions.Singleline);

    public static List<string> ParseScriptPlaceholderFormat(string raw, HashSet<int>? filterNums = null)
    {
        var results = new List<string>();
        var promptKeywords = new[] {
            "illustration", "background", "character", "scene", "drawing",
            "doodle", "sketch", "art style", "minimalist", "hand-drawn",
            "pure black", "pure white", "outline", "line art", "figure",
            "image shows", "visual", "centered", "frame", "camera", "shot",
            "cinematic", "composition", "lighting", "render", "style",
            "aesthetic", "color palette", "texture", "gradient", "shading"
        };

        var matches = Regex.Matches(raw,
            @"Image\s+(\d+)\s*:.*?SCRIPT\s+PLACEHOLDER\s*:\s*(.*?)(?=Image\s+\d+\s*:|$)",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
        var sorted = matches.Cast<Match>().OrderBy(m => int.Parse(m.Groups[1].Value));

        foreach (var m in sorted)
        {
            int num = int.Parse(m.Groups[1].Value);
            if (filterNums != null && !filterNums.Contains(num)) continue;
            string content = m.Groups[2].Value.Trim();
            var lines = content.Split('\n').Select(l => l.Trim()).Where(l => !string.IsNullOrEmpty(l)).ToArray();
            if (lines.Length == 0) continue;

            int promptStartIdx = -1;
            for (int i = 0; i < lines.Length; i++)
            {
                if (lines[i].StartsWith("A ") && lines[i].Length > 50) { promptStartIdx = i; break; }
                string lower = lines[i].ToLower();
                if (promptKeywords.Any(kw => lower.Contains(kw)) && lines[i].Length > 50) { promptStartIdx = i; break; }
            }

            string clean;
            if (promptStartIdx == -1)
            {
                var parts = Regex.Split(content, @"\n\s*\n").Select(p => p.Trim()).Where(p => !string.IsNullOrEmpty(p)).ToArray();
                if (parts.Length > 1)
                {
                    content = parts.FirstOrDefault(p => p.StartsWith("A ") && p.Length > 50) ?? parts.Last();
                }
                clean = CollapseWhitespace(content);
            }
            else
            {
                clean = CollapseWhitespace(string.Join(" ", lines.Skip(promptStartIdx)));
            }
            if (!string.IsNullOrEmpty(clean)) results.Add(clean);
        }
        return results;
    }

    // --- Image Inline Format ---
    public static bool IsImageInlineFormat(string raw)
    {
        if (Regex.IsMatch(raw, @"Image\s+\d+\s*:", RegexOptions.IgnoreCase)) return false;
        if (Regex.IsMatch(raw, @"Image\s+\d+[^\n]*ratio", RegexOptions.IgnoreCase)) return false;
        return Regex.IsMatch(raw, @"Image\s*\d+\s*\n?[A-Z]", RegexOptions.IgnoreCase);
    }

    public static List<string> ParseImageInlineFormat(string raw, HashSet<int>? filterNums = null)
    {
        var results = new List<string>();
        var matches = Regex.Matches(raw,
            @"Image\s*(\d+)\s*\n?([A-Z].*?)(?=Image\s*\d+\s*\n?[A-Z]|\Z)",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
        var sorted = matches.Cast<Match>().OrderBy(m => int.Parse(m.Groups[1].Value));
        foreach (var m in sorted)
        {
            int num = int.Parse(m.Groups[1].Value);
            if (filterNums != null && !filterNums.Contains(num)) continue;
            string clean = CollapseWhitespace(m.Groups[2].Value);
            if (!string.IsNullOrEmpty(clean)) results.Add(clean);
        }
        return results;
    }

    // --- Numbered Paren Title Format: 1) Title — Content ---
    public static bool IsNumberedParenTitleFormat(string raw)
        => Regex.Matches(raw, @"\d+\)\s*[A-Za-z][^\u2014\u2013]{0,50}[\u2014\u2013]").Count >= 1;

    public static List<string> ParseNumberedParenTitleFormat(string raw)
    {
        var results = new List<string>();
        var matches = Regex.Matches(raw, @"(\d+)\)\s*([A-Za-z][^\u2014\u2013]{0,50})[\u2014\u2013]\s*");
        var matchList = matches.Cast<Match>().ToList();
        for (int i = 0; i < matchList.Count; i++)
        {
            int start = matchList[i].Index + matchList[i].Length;
            int end = (i + 1 < matchList.Count) ? matchList[i + 1].Index : raw.Length;
            string content = CollapseWhitespace(raw.Substring(start, end - start));
            if (!string.IsNullOrEmpty(content)) results.Add(content);
        }
        return results;
    }

    // --- Numbered Scene Format: 1) content ---
    public static List<string> ParseNumberedSceneFormat(string raw)
    {
        var results = new List<string>();
        var matches = Regex.Matches(raw, @"^\d+\)\s*[^\n]+\n(.+?)(?=^\d+\)|\Z)", RegexOptions.Multiline | RegexOptions.Singleline);
        foreach (Match m in matches)
        {
            string clean = CollapseWhitespace(m.Groups[1].Value);
            if (!string.IsNullOrEmpty(clean)) results.Add(clean);
        }
        return results;
    }

    // --- Numbered Title Format: 1. Title\nContent ---
    public static bool IsNumberedTitleFormat(string raw)
    {
        var matches = Regex.Matches(raw, @"^\d+\.\s*([^\n]+)\n", RegexOptions.Multiline);
        if (matches.Count < 1) return false;
        foreach (Match m in matches)
        {
            string title = m.Groups[1].Value.Trim();
            if (title.Length > 50) return false;
            if (Regex.IsMatch(title, @"[,;:]")) return false;
        }
        return true;
    }

    public static List<string> ParseNumberedTitleFormat(string raw)
    {
        var results = new List<string>();
        var matches = Regex.Matches(raw, @"^\d+\.\s*[^\n]+\n(.+?)(?=^\d+\.\s*[^\n]+\n|\Z)", RegexOptions.Multiline | RegexOptions.Singleline);
        foreach (Match m in matches)
        {
            string clean = CollapseWhitespace(m.Groups[1].Value);
            if (!string.IsNullOrEmpty(clean)) results.Add(clean);
        }
        return results;
    }

    // --- Car Year Format ---
    public static List<string> ParseCarYearFormat(string raw)
    {
        var results = new List<string>();
        string cleaned = raw.Replace("**", "");
        var matches = Regex.Matches(cleaned, @"\((1[89]\d{2}|20\d{2})\)\s*[\u2014\u2013-]");
        var matchList = matches.Cast<Match>().ToList();
        if (matchList.Count == 0) return results;

        for (int i = 0; i < matchList.Count; i++)
        {
            int yearPos = matchList[i].Index;
            int searchStart = (i == 0) ? 0 : matchList[i - 1].Index + matchList[i - 1].Length;
            string textBefore = cleaned.Substring(searchStart, yearPos - searchStart);

            int nameStart;
            if (i == 0)
            {
                var nm = Regex.Match(textBefore, @"(\d+\.\s*)?([A-Z])");
                nameStart = nm.Success ? searchStart + nm.Groups[2].Index : searchStart;
            }
            else
            {
                var tm = Regex.Match(textBefore, @"[a-z]([A-Z])");
                if (tm.Success) nameStart = searchStart + tm.Groups[1].Index;
                else
                {
                    var nm = Regex.Match(textBefore, @"(\d+\.\s*)?([A-Z])");
                    nameStart = nm.Success ? searchStart + nm.Groups[2].Index : searchStart;
                }
            }

            int endPos;
            if (i + 1 < matchList.Count)
            {
                int nextYearPos = matchList[i + 1].Index;
                string textBetween = cleaned.Substring(matchList[i].Index + matchList[i].Length, nextYearPos - matchList[i].Index - matchList[i].Length);
                var nextTm = Regex.Match(textBetween, @"[a-z]([A-Z])");
                if (nextTm.Success) endPos = matchList[i].Index + matchList[i].Length + nextTm.Groups[1].Index;
                else
                {
                    var nm = Regex.Match(textBetween, @"(\d+\.\s*)?([A-Z])");
                    endPos = nm.Success ? matchList[i].Index + matchList[i].Length + nm.Groups[2].Index : nextYearPos;
                }
            }
            else endPos = cleaned.Length;

            string prompt = cleaned.Substring(nameStart, endPos - nameStart).Trim();
            prompt = Regex.Replace(prompt, @"^\d+\.\s*", "");
            prompt = Regex.Replace(prompt, @"\s+\d+\.\s*$", "");
            prompt = CollapseWhitespace(prompt);
            if (!string.IsNullOrEmpty(prompt)) results.Add(prompt);
        }
        return results;
    }

    // --- Title Dash Content Parser ---
    public static List<string> TitleDashContentParser(string raw)
    {
        var result = new List<string>();
        var matches = Regex.Matches(raw,
            @"[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*\s*[\u2014\u2013-]\s*(.+?)(?=(?:[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*\s*[\u2014\u2013-])|$)",
            RegexOptions.Singleline);
        foreach (Match m in matches)
        {
            string content = m.Groups[1].Value.Trim();
            if (!string.IsNullOrEmpty(content)) result.Add(content);
        }
        if (result.Count == 0)
        {
            foreach (string line in raw.Split('\n'))
            {
                string trimmed = line.Trim();
                if (string.IsNullOrEmpty(trimmed)) continue;
                var m = Regex.Match(trimmed, @"^[A-Z][A-Za-z\s]+\s*[\u2014\u2013-]\s*(.+)$");
                if (m.Success) { string c = m.Groups[1].Value.Trim(); if (!string.IsNullOrEmpty(c)) result.Add(c); }
                else if (!string.IsNullOrEmpty(trimmed)) result.Add(trimmed);
            }
        }
        return result;
    }

    // --- Image Colon Format ---
    public static List<string> ParseImageColonFormat(string raw, HashSet<int>? filterNums = null)
    {
        var results = new List<string>();
        var matches = Regex.Matches(raw, @"Image\s+(\d+)\s*:\s*(.*?)(?=Image\s+\d+\s*:|\Z)", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        var sorted = matches.Cast<Match>().OrderBy(m => int.Parse(m.Groups[1].Value));
        foreach (var m in sorted)
        {
            int num = int.Parse(m.Groups[1].Value);
            if (filterNums != null && !filterNums.Contains(num)) continue;
            string clean = CollapseWhitespace(m.Groups[2].Value);
            if (!string.IsNullOrEmpty(clean)) results.Add(clean);
        }
        return results;
    }

    // --- Image Newline Format ---
    public static List<string> ParseImageNewlineFormat(string raw, HashSet<int>? filterNums = null)
    {
        var results = new List<string>();
        var matches = Regex.Matches(raw, @"^\s*Image\s+(\d+)\s*\n(.*?)(?=^\s*Image\s+\d+|\Z)",
            RegexOptions.Multiline | RegexOptions.IgnoreCase | RegexOptions.Singleline);
        var sorted = matches.Cast<Match>().OrderBy(m => int.Parse(m.Groups[1].Value));
        foreach (var m in sorted)
        {
            int num = int.Parse(m.Groups[1].Value);
            if (filterNums != null && !filterNums.Contains(num)) continue;
            string clean = CollapseWhitespace(m.Groups[2].Value);
            if (!string.IsNullOrEmpty(clean)) results.Add(clean);
        }
        return results;
    }

    // --- Title Content Format ---
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
        var lines = raw.Trim().Split('\n');
        string? currentTitle = null;
        var currentContent = new List<string>();

        foreach (string line in lines)
        {
            string stripped = line.Trim();
            if (string.IsNullOrEmpty(stripped)) continue;
            if (IsSceneTitle(stripped))
            {
                if (currentTitle != null && currentContent.Count > 0)
                {
                    string full = CollapseWhitespace(string.Join(" ", currentContent));
                    if (!string.IsNullOrEmpty(full)) results.Add(full);
                }
                currentTitle = stripped;
                currentContent.Clear();
            }
            else currentContent.Add(stripped);
        }
        if (currentTitle != null && currentContent.Count > 0)
        {
            string full = CollapseWhitespace(string.Join(" ", currentContent));
            if (!string.IsNullOrEmpty(full)) results.Add(full);
        }
        return results;
    }

    // --- Scene Format ---
    public static List<string> ParseSceneFormat(string raw)
    {
        var results = new List<string>();
        var matches = Regex.Matches(raw, @"^\s*Scene\s+(\d+)\s*\n(.*?)(?=^\s*Scene\s+\d+|\Z)",
            RegexOptions.Multiline | RegexOptions.IgnoreCase | RegexOptions.Singleline);
        var sorted = matches.Cast<Match>().OrderBy(m => int.Parse(m.Groups[1].Value));
        foreach (var m in sorted)
        {
            string clean = CollapseWhitespace(m.Groups[2].Value);
            if (!string.IsNullOrEmpty(clean)) results.Add(clean);
        }
        return results;
    }

    public static List<string> ParseSceneColonFormat(string raw)
    {
        var results = new List<string>();
        var matches = Regex.Matches(raw, @"(?:^|\n)\s*Scene\s*:", RegexOptions.IgnoreCase);
        var matchList = matches.Cast<Match>().ToList();
        for (int i = 0; i < matchList.Count; i++)
        {
            int start = matchList[i].Index;
            int end = (i + 1 < matchList.Count) ? matchList[i + 1].Index : raw.Length;
            string block = raw.Substring(start, end - start);
            string clean = CollapseWhitespace(block);
            if (!string.IsNullOrEmpty(clean)) results.Add(clean);
        }
        return results;
    }

    // --- Prompt Format ---
    public static List<string> ParsePromptFormat(string raw)
    {
        var results = new List<string>();
        var chunks = Regex.Split(raw, @"(?:^|\n)\s*Prompt:", RegexOptions.IgnoreCase);
        foreach (string chunk in chunks)
        {
            string clean = Regex.Replace(CollapseWhitespace(chunk), @"^(?:Prompt:|Image Prompt:)\s*", "", RegexOptions.IgnoreCase).Trim();
            if (!string.IsNullOrEmpty(clean)) results.Add(clean);
        }
        return results;
    }

    // --- Paragraph Format ---
    public static List<string> ParseParagraphFormat(string raw)
    {
        var results = new List<string>();
        var chunks = Regex.Split(raw, @"\n\s*\n");
        foreach (string chunk in chunks)
        {
            string clean = Regex.Replace(CollapseWhitespace(chunk), @"^(?:Prompt:|Image Prompt:)\s*", "", RegexOptions.IgnoreCase).Trim();
            if (!string.IsNullOrEmpty(clean)) results.Add(clean);
        }
        return results;
    }

    // --- Frame TEXT VERSION Format ---
    public static bool IsFrameTextVersionFormat(string raw)
        => Regex.IsMatch(raw, @"FRAME\s+\d+", RegexOptions.IgnoreCase)
        && Regex.IsMatch(raw, @"TEXT VERSION\s*\(English\)\s*:", RegexOptions.IgnoreCase)
        && Regex.IsMatch(raw, @"NO-TEXT VERSION\s*\(English\)", RegexOptions.IgnoreCase);

    public static List<string> ParseFrameTextVersionFormat(string raw, HashSet<int>? filterNums = null)
    {
        var results = new List<string>();
        var blocks = Regex.Split(raw, @"(?=FRAME\s+\d+)", RegexOptions.IgnoreCase);
        foreach (string block in blocks)
        {
            if (string.IsNullOrWhiteSpace(block)) continue;
            var frameMatch = Regex.Match(block, @"FRAME\s+(\d+)", RegexOptions.IgnoreCase);
            if (frameMatch.Success)
            {
                int num = int.Parse(frameMatch.Groups[1].Value);
                if (filterNums != null && !filterNums.Contains(num)) continue;
            }
            var textVer = Regex.Match(block,
                @"TEXT VERSION\s*\(English\)\s*:\s*(.*?)(?=NO-TEXT VERSION\s*\(English\)|FRAME\s+\d+|$)",
                RegexOptions.IgnoreCase | RegexOptions.Singleline);
            if (textVer.Success)
            {
                string content = CollapseWhitespace(textVer.Groups[1].Value);
                if (!string.IsNullOrEmpty(content)) results.Add(content);
            }
        }
        return results;
    }

    // --- Scene Add-On Format ---
    public static bool IsSceneAddonFormat(string raw)
        => Regex.IsMatch(raw, @"SCENE ADD-ON \(English\):", RegexOptions.IgnoreCase);

    public static List<string> ParseSceneAddonFormat(string raw)
    {
        var results = new List<string>();
        var matches = Regex.Matches(raw,
            @"SCENE ADD-ON \(English\):\s*(.*?)(?=FRAME \d+|$)",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
        foreach (Match m in matches)
        {
            string clean = Regex.Replace(m.Groups[1].Value, @"SCRIPT PLACEHOLDER:.*?(?=SCENE ADD-ON|FRAME|$)", "", RegexOptions.IgnoreCase | RegexOptions.Singleline);
            clean = Regex.Replace(clean, @"FRAME \d+", "", RegexOptions.IgnoreCase);
            clean = CollapseWhitespace(clean);
            if (!string.IsNullOrEmpty(clean)) results.Add(clean);
        }
        return results;
    }

    // --- Prompt Add-On Format ---
    public static bool IsPromptAddonFormat(string raw)
        => Regex.IsMatch(raw, @"PROMPT\s*\(ADD-ON\)\s*:", RegexOptions.IgnoreCase);

    public static List<string> ParsePromptAddonFormat(string raw)
    {
        var results = new List<string>();
        var matches = Regex.Matches(raw,
            @"PROMPT\s*\(ADD-ON\)\s*:\s*(.*?)(?=FRAME\s+\d+|SCRIPT\s+PLACEHOLDER|TEXT\s+IN\s+VIDEO|PROMPT\s*\(ADD-ON\)|$)",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
        foreach (Match m in matches)
        {
            string clean = CollapseWhitespace(m.Groups[1].Value);
            if (!string.IsNullOrEmpty(clean)) results.Add(clean);
        }
        return results;
    }

    // --- Scene Prompt English Format ---
    public static bool IsScenePromptEnglishFormat(string raw)
        => Regex.IsMatch(raw, @"SCENE\s+PROMPT\s*\(English\)\s*:", RegexOptions.IgnoreCase);

    public static List<string> ParseScenePromptEnglishFormat(string raw)
    {
        var results = new List<string>();
        var matches = Regex.Matches(raw,
            @"SCENE\s+PROMPT\s*\(English\)\s*:\s*(.*?)(?=FRAME\s+\d+|SCRIPT\s+PLACEHOLDER|TEXT\s+OVERLAY|SCENE\s+PROMPT|$)",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
        foreach (Match m in matches)
        {
            string clean = CollapseWhitespace(m.Groups[1].Value);
            if (!string.IsNullOrEmpty(clean)) results.Add(clean);
        }
        return results;
    }

    // --- Frame Colon Format ---
    public static bool IsFrameColonFormat(string raw)
        => Regex.IsMatch(raw, @"FRAME\s+\d+\s*:", RegexOptions.IgnoreCase);

    public static List<string> ParseFrameColonFormat(string raw)
    {
        var results = new List<string>();
        var matches = Regex.Matches(raw,
            @"FRAME\s+\d+\s*:\s*(.*?)(?=FRAME\s+\d+\s*:|$)",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
        foreach (Match m in matches)
        {
            string clean = CollapseWhitespace(m.Groups[1].Value);
            if (!string.IsNullOrEmpty(clean)) results.Add(clean);
        }
        return results;
    }

    // --- Frame Pipe Scene Prompt Format ---
    public static bool IsFramePipeScenePromptFormat(string raw)
    {
        bool hasFrame = Regex.IsMatch(raw, @"FRAME\s+\d+\s*\|", RegexOptions.IgnoreCase);
        bool hasScript = Regex.IsMatch(raw, @"SCRIPT\s+PLACEHOLDER\s*:", RegexOptions.IgnoreCase);
        bool hasScene = Regex.IsMatch(raw, @"SCENE\s+PROMPT\s*(?:\([^)]*\))?\s*:", RegexOptions.IgnoreCase);
        return hasFrame && hasScript && hasScene;
    }

    public static List<string> ParseFramePipeScenePromptFormat(string raw)
    {
        var results = new List<string>();
        var matches = Regex.Matches(raw,
            @"SCENE\s+PROMPT\s*(?:\([^)]*\))?\s*:\s*(.*?)(?=FRAME\s+\d+|$)",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);
        foreach (Match m in matches)
        {
            string clean = CollapseWhitespace(m.Groups[1].Value);
            if (!string.IsNullOrEmpty(clean)) results.Add(clean);
        }
        return results;
    }

    // =============================================================================
    // DETECT FORMAT
    // =============================================================================
    public static string DetectFormat(string raw)
    {
        string rawCleaned = raw.Replace("**", "");

        if (raw.ToUpper().Contains("FLOW VIDEO PROMPT:")) return "flow_video";
        if (raw.TrimStart().StartsWith("{") && raw.Contains("car_name_model")) return "json_car";
        if (IsFrameTextVersionFormat(raw)) return "frame_text_version";
        if (IsSceneAddonFormat(raw)) return "scene_addon";
        if (IsPromptAddonFormat(raw)) return "prompt_addon";
        if (IsScenePromptEnglishFormat(raw)) return "scene_prompt_english";
        if (IsFramePipeScenePromptFormat(raw)) return "frame_pipe_scene_prompt";
        if (IsFrameColonFormat(raw)) return "frame_colon";
        if (IsScriptPlaceholderFormat(raw)) return "script_placeholder";
        if (IsImageMarkerFormat(raw)) return "image_marker";
        if (IsImageRatioFormat(raw)) return "image_ratio";
        if (IsInlineParenFormat(raw)) return "inline_paren";
        if (IsTitleDashFormat(raw)) return "title_dash";
        if (IsMotionPromptFormat(raw)) return "motion_prompt";
        if (IsImageInlineFormat(raw)) return "image_inline";
        if (IsNumberedParenTitleFormat(raw)) return "numbered_paren_title";
        if (Regex.IsMatch(raw, @"^\d+\)\s*\w+", RegexOptions.Multiline)) return "numbered_scene";
        if (IsNumberedTitleFormat(raw)) return "numbered_title";
        if (Regex.IsMatch(rawCleaned, @"\((1[89]\d{2}|20\d{2})\)\s*[\u2014\u2013-]")) return "car_year";
        if (Regex.IsMatch(raw, @"[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*\s*[\u2014\u2013-]\s+") && !Regex.IsMatch(raw, @"Image\s+\d+", RegexOptions.IgnoreCase))
            return "title_dash_content";
        if (Regex.IsMatch(raw, @"Image\s+\d+\s*:", RegexOptions.IgnoreCase)) return "image_colon";
        if (Regex.IsMatch(raw, @"^\s*Image\s+\d+", RegexOptions.Multiline | RegexOptions.IgnoreCase)) return "image_newline";
        if (IsTitleContentFormat(raw)) return "title_content";
        if (Regex.IsMatch(raw, @"(?:^|\n)\s*Scene\s*:", RegexOptions.IgnoreCase)) return "scene_colon";
        if (Regex.IsMatch(raw, @"^\s*Scene\s+\d+", RegexOptions.Multiline | RegexOptions.IgnoreCase)) return "scene";
        if (Regex.Matches(raw.ToLower(), "prompt:").Count > 1) return "prompt";
        return "paragraph";
    }

    // =============================================================================
    // MAIN PROCESS
    // =============================================================================
    public static HashSet<int>? ParseFilterNums(string filterText)
    {
        if (string.IsNullOrWhiteSpace(filterText)) return null;
        var nums = new HashSet<int>();
        foreach (string part in filterText.Replace(" ", "").Split(','))
        {
            if (int.TryParse(part, out int n)) nums.Add(n);
        }
        return nums.Count > 0 ? nums : null;
    }

    public static (List<string> Images, List<string> Videos) ParseInput(string raw, HashSet<int>? filterNums = null)
    {
        var dataImg = new List<string>();
        var dataVid = new List<string>();
        string fmt = DetectFormat(raw);

        switch (fmt)
        {
            case "flow_video": (dataImg, dataVid) = ParseFlowVideoFormat(raw); break;
            case "json_car": dataImg = ParseJsonFormat(raw); break;
            case "frame_text_version": dataImg = ParseFrameTextVersionFormat(raw, filterNums); break;
            case "scene_addon": dataImg = ParseSceneAddonFormat(raw); break;
            case "prompt_addon": dataImg = ParsePromptAddonFormat(raw); break;
            case "scene_prompt_english": dataImg = ParseScenePromptEnglishFormat(raw); break;
            case "frame_pipe_scene_prompt": dataImg = ParseFramePipeScenePromptFormat(raw); break;
            case "frame_colon": dataImg = ParseFrameColonFormat(raw); break;
            case "script_placeholder": dataImg = ParseScriptPlaceholderFormat(raw, filterNums); break;
            case "image_marker": dataImg = ParseImageMarkerFormat(raw, filterNums); break;
            case "image_ratio": dataImg = ParseImageRatioFormat(raw, filterNums); break;
            case "inline_paren": dataImg = ParseInlineParenFormat(raw); break;
            case "title_dash": dataImg = ParseTitleDashFormat(raw, filterNums); break;
            case "motion_prompt": dataImg = ParseMotionPromptFormat(raw, filterNums); break;
            case "image_inline": dataImg = ParseImageInlineFormat(raw, filterNums); break;
            case "numbered_paren_title": dataImg = ParseNumberedParenTitleFormat(raw); break;
            case "numbered_scene": dataImg = ParseNumberedSceneFormat(raw); break;
            case "numbered_title": dataImg = ParseNumberedTitleFormat(raw); break;
            case "car_year": dataImg = ParseCarYearFormat(raw); break;
            case "title_dash_content": dataImg = TitleDashContentParser(raw); break;
            case "image_colon": dataImg = ParseImageColonFormat(raw, filterNums); break;
            case "image_newline": dataImg = ParseImageNewlineFormat(raw, filterNums); break;
            case "title_content": dataImg = ParseTitleContentFormat(raw); break;
            case "scene_colon": dataImg = ParseSceneColonFormat(raw); break;
            case "scene": dataImg = ParseSceneFormat(raw); break;
            case "prompt": dataImg = ParsePromptFormat(raw); break;
            default: dataImg = ParseParagraphFormat(raw); break;
        }
        return (dataImg, dataVid);
    }

    public static (List<string> Images, List<string> Videos) ProcessSplit(string raw, string filterText = "")
    {
        var filterNums = ParseFilterNums(filterText);
        return ParseInput(raw, filterNums);
    }

    // =============================================================================
    // UTILITY
    // =============================================================================
    private static string CollapseWhitespace(string s)
        => Regex.Replace(s.Trim(), @"\s+", " ").Trim();
}
