function collapse(s: string): string {
    return s.trim().replace(/\s+/g, ' ').trim();
}

function parseFlowVideoFormat(raw: string): { images: string[]; videos: string[] } {
    const imgList: string[] = [];
    const vidList: string[] = [];
    const re = /IMAGE PROMPT:(.*?)(?=FLOW VIDEO PROMPT:)\s*FLOW VIDEO PROMPT:(.*?)(?=\nScene|\nIMAGE PROMPT:|$)/gsi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        imgList.push(collapse(m[1]));
        vidList.push(collapse(m[2]));
    }
    return { images: imgList, videos: vidList };
}

function isImageRatioFormat(raw: string): boolean {
    return /Image\s+\d+[^\n]*ratio/i.test(raw);
}

function parseImageRatioFormatKeepHeader(raw: string): string[] {
    const results: string[] = [];
    const re = /(Image\s+(\d+)[^\n]*ratio[^\n]*)\n(.*?)(?=Image\s+\d+[^\n]*ratio|\Z)/gis;
    const matches: { num: number; header: string; content: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        matches.push({ num: parseInt(m[2]), header: m[1].trim(), content: collapse(m[3]) });
    }
    matches.sort((a, b) => a.num - b.num);
    for (const item of matches) {
        const full = item.header + '\n' + item.content;
        if (full.trim()) results.push(full);
    }
    return results;
}

function isTitleDashFormat(raw: string): boolean {
    if (/^\s*Motion\s+Prompt\s*\d+/im.test(raw)) return false;
    if (/^\s*Image\s*\d+/im.test(raw)) return false;
    const matches = raw.match(/(?:^|\n)[A-Z][A-Za-z\s]+?\s*[\u2014\u2013-]\s*\S/gm);
    return (matches?.length ?? 0) >= 1;
}

function parseTitleDashFormatKeepHeader(raw: string): string[] {
    const results: string[] = [];
    const re = /(?:^|\n)([A-Z][A-Za-z\s]+?)\s*[\u2014\u2013-]\s*/gm;
    const ml: { index: number; length: number; title: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        ml.push({ index: m.index, length: m[0].length, title: m[1].trim() });
    }
    for (let i = 0; i < ml.length; i++) {
        const start = ml[i].index + ml[i].length;
        const end = i + 1 < ml.length ? ml[i + 1].index : raw.length;
        const content = collapse(raw.substring(start, end));
        if (content) results.push(`${ml[i].title}\n${content}`);
    }
    return results;
}

function isMotionPromptFormat(raw: string): boolean {
    return /Motion\s+Prompt\s*\d+/i.test(raw);
}

function parseMotionPromptFormatKeepHeader(raw: string): string[] {
    const results: string[] = [];
    const re = /(Motion\s+Prompt\s*(\d+)\s*(?:\([^)]*\))?)\s*\n?(.*?)(?=Motion\s+Prompt\s*\d+|$)/gis;
    const matches: { num: number; header: string; content: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        matches.push({ num: parseInt(m[2]), header: collapse(m[1]), content: collapse(m[3]) });
    }
    matches.sort((a, b) => a.num - b.num);
    for (const item of matches) {
        if (item.content) results.push(`${item.header}\n${item.content}`);
    }
    return results;
}

function isImageInlineFormat(raw: string): boolean {
    if (/Image\s+\d+\s*:/i.test(raw)) return false;
    if (/Image\s+\d+[^\n]*ratio/i.test(raw)) return false;
    return /Image\s*\d+\s*\n?[A-Z]/i.test(raw);
}

function parseImageInlineFormatKeepHeader(raw: string): string[] {
    const results: string[] = [];
    const re = /Image\s*(\d+)\s*\n?([A-Z].*?)(?=Image\s*\d+\s*\n?[A-Z]|$)/gis;
    const matches: { num: number; content: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        matches.push({ num: parseInt(m[1]), content: collapse(m[2]) });
    }
    matches.sort((a, b) => a.num - b.num);
    for (const item of matches) {
        if (item.content) results.push(`Image ${item.num}\n${item.content}`);
    }
    return results;
}

function parsePromptFormat(raw: string): string[] {
    const results: string[] = [];
    const chunks = raw.split(/(?:^|\n)\s*Prompt:/i);
    for (const chunk of chunks) {
        const clean = collapse(chunk).replace(/^(?:Prompt:|Image Prompt:)\s*/i, '').trim();
        if (clean) results.push(clean);
    }
    return results;
}

function isSceneTitle(line: string): boolean {
    line = line.trim();
    if (line.length > 60) return false;
    if (/^\d+-second/i.test(line)) return false;
    if (!/[a-zA-Z]/.test(line)) return false;
    if (/[.,;]/.test(line)) return false;
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length > 6) return false;
    return words.some(w => w.length > 0 && /[a-zA-Z]/.test(w[0]) && w[0] === w[0].toUpperCase());
}

function isTitleContentFormat(raw: string): boolean {
    const lines = raw.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return false;
    const titleCount = lines.filter(isSceneTitle).length;
    const contentCount = lines.length - titleCount;
    return titleCount >= 1 && contentCount >= 1 && titleCount <= Math.floor(lines.length / 2) + 1;
}

function parseTitleContentFormat(raw: string): string[] {
    const results: string[] = [];
    let currentTitle: string | null = null;
    const currentContent: string[] = [];
    for (const line of raw.trim().split('\n')) {
        const stripped = line.trim();
        if (!stripped) continue;
        if (isSceneTitle(stripped)) {
            if (currentTitle !== null && currentContent.length > 0) {
                const full = collapse(currentContent.join(' '));
                if (full) results.push(full);
            }
            currentTitle = stripped;
            currentContent.length = 0;
        } else {
            currentContent.push(stripped);
        }
    }
    if (currentTitle !== null && currentContent.length > 0) {
        const full = collapse(currentContent.join(' '));
        if (full) results.push(full);
    }
    return results;
}

function parseParagraphFormat(raw: string): string[] {
    const results: string[] = [];
    const chunks = raw.split(/\n\s*\n/);
    for (const chunk of chunks) {
        const clean = collapse(chunk).replace(/^(?:Prompt:|Image Prompt:)\s*/i, '').trim();
        if (clean) results.push(clean);
    }
    return results;
}

function isImageScriptPlaceholderFormat(raw: string): boolean {
    const hasImage = /Image\s+\d+:/i.test(raw);
    const hasScript = /SCRIPT PLACEHOLDER:/i.test(raw);
    const hasSceneAddon = /SCENE ADD-ON \(English\):/i.test(raw);
    return hasImage && hasScript && !hasSceneAddon;
}

function parseImageScriptPlaceholderFormat(raw: string): string[] {
    const results: string[] = [];
    const promptKeywords = [
        'illustration', 'background', 'character', 'scene', 'drawing',
        'doodle', 'sketch', 'art style', 'minimalist', 'hand-drawn',
        'pure black', 'pure white', 'outline', 'line art'
    ];
    const parts = raw.split(/Image\s+\d+:\s*/i);
    for (const part of parts) {
        if (!part.trim()) continue;
        const scriptMatch = part.match(/SCRIPT PLACEHOLDER:\s*/i);
        if (!scriptMatch || scriptMatch.index === undefined) continue;
        const afterScript = part.substring(scriptMatch.index + scriptMatch[0].length).trim();
        const lines = afterScript.split('\n');
        const promptLines: string[] = [];
        let scriptEnded = false;
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed.startsWith('A ') && trimmed.length > 50) { scriptEnded = true; promptLines.push(trimmed); }
            else if (scriptEnded) promptLines.push(trimmed);
            else if (promptKeywords.some(kw => trimmed.toLowerCase().includes(kw)) && trimmed.length > 50) { scriptEnded = true; promptLines.push(trimmed); }
        }
        if (promptLines.length > 0) results.push(collapse(promptLines.join(' ')));
    }
    return results;
}

function isFrameScriptSceneFormat(raw: string): boolean {
    return /FRAME\s+\d+/i.test(raw)
        && /SCRIPT PLACEHOLDER:/i.test(raw)
        && /SCENE ADD-ON \(English\):/i.test(raw);
}

function parseFrameScriptSceneFormat(raw: string): string[] {
    const results: string[] = [];
    const re = /(FRAME\s+\d+.*?)(?=FRAME\s+\d+|$)/gis;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        const lines = m[1].trim().split('\n').map(l => l.trim()).filter(Boolean);
        const joined = lines.join('\n');
        if (joined) results.push(joined);
    }
    return results;
}

function isLongSentenceFormat(raw: string): boolean {
    if (raw.trim().includes('\n')) return false;
    return (raw.match(/\.[A-Z]/g)?.length ?? 0) >= 1;
}

function parseLongSentenceFormat(raw: string): string[] {
    const results: string[] = [];
    const parts = raw.split(/(?<=\.)(?=[A-Z])/);
    for (const part of parts) {
        const cleaned = part.trim();
        if (cleaned) results.push(cleaned);
    }
    return results;
}

function isPeriodNewlineFormat(raw: string): boolean {
    if (!raw.includes('\n')) return false;
    return (raw.match(/\.\s*\n\s*\n/g)?.length ?? 0) >= 1;
}

function parsePeriodNewlineFormat(raw: string): string[] {
    const results: string[] = [];
    const parts = raw.split(/\n\s*\n+/);
    for (const part of parts) {
        const cleaned = collapse(part);
        if (cleaned) results.push(cleaned);
    }
    return results;
}

function parseSingleLine(raw: string): string[] {
    const results: string[] = [];
    const splitRe = /((?:no\s+watermark|no\s+text|no\s+dialogue|no\s+speech)\.)\s+(?=[A-Z])/gi;
    const parts = raw.split(splitRe);

    if (parts.length > 1) {
        let current = '';
        for (const part of parts) {
            if (/(?:no\s+watermark|no\s+text|no\s+dialogue|no\s+speech)\./i.test(part)) {
                current += part;
                if (current.trim()) results.push(current.trim());
                current = '';
            } else {
                current += part;
            }
        }
        if (current.trim()) results.push(current.trim());
    } else if (/\.[A-Z]/.test(raw)) {
        for (const part of raw.split(/(?<=\.)(?=[A-Z])/)) {
            const cleaned = part.trim();
            if (cleaned) results.push(cleaned);
        }
    } else {
        results.push(raw.trim());
    }
    return results;
}

export function parseInput(raw: string): string[] {
    if (raw.toUpperCase().includes('FLOW VIDEO PROMPT:')) {
        return parseFlowVideoFormat(raw).images;
    }
    if (isFrameScriptSceneFormat(raw)) return parseFrameScriptSceneFormat(raw);
    if (isImageScriptPlaceholderFormat(raw)) return parseImageScriptPlaceholderFormat(raw);
    if (isPeriodNewlineFormat(raw)) return parsePeriodNewlineFormat(raw);
    if (isLongSentenceFormat(raw)) return parseLongSentenceFormat(raw);
    if (isImageRatioFormat(raw)) return parseImageRatioFormatKeepHeader(raw);
    if (isTitleDashFormat(raw)) return parseTitleDashFormatKeepHeader(raw);
    if (isMotionPromptFormat(raw)) return parseMotionPromptFormatKeepHeader(raw);
    if (isImageInlineFormat(raw)) return parseImageInlineFormatKeepHeader(raw);
    if ((raw.toLowerCase().match(/prompt:/g)?.length ?? 0) > 1) return parsePromptFormat(raw);
    if (raw.includes('\n\n') || /\n\s*\n/.test(raw)) return parseParagraphFormat(raw);
    if (isTitleContentFormat(raw)) return parseTitleContentFormat(raw);
    if (raw.includes('\n')) {
        return raw.trim().split('\n').map(l => l.trim()).filter(Boolean);
    }
    return parseSingleLine(raw);
}

export function addPrefix(prompts: string[], prefix: string): string[] {
    if (!prefix) return prompts;
    const fmt = prefix.endsWith(' ') ? prefix : prefix + ' ';
    return prompts.map(p => fmt + p);
}

export function addSuffix(prompts: string[], suffix: string): string[] {
    if (!suffix) return prompts;
    const fmt = suffix.startsWith(' ') ? suffix : ' ' + suffix;
    return prompts.map(p => p + fmt);
}

export function createChainPairs(prompts: string[]): string[] {
    const pairs: string[] = [];
    for (let i = 0; i < prompts.length - 1; i++) {
        pairs.push(`${prompts[i]} ${prompts[i + 1]}`);
    }
    return pairs;
}

export function processChain(raw: string, prefix = '', suffix = ''): { singles: string[]; chains: string[] } {
    const prompts = parseInput(raw);
    const withPrefix = addPrefix(prompts, prefix.trim());
    const withSuffix = addSuffix(withPrefix, suffix.trim());
    const chains = createChainPairs(withSuffix);
    return { singles: withSuffix, chains };
}
