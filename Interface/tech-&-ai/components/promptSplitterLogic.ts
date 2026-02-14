function collapseWhitespace(s: string): string {
    return s.trim().replace(/\s+/g, ' ').trim();
}

export function isPromptImageVideoFormat(raw: string): boolean {
    return /PROMPT\s+\d+/i.test(raw)
        && /IMAGE PROMPT\s*\([^)]*\)\s*:/i.test(raw)
        && /VIDEO PROMPT\s*\([^)]*\)\s*:/i.test(raw);
}

export function parsePromptImageVideoFormat(raw: string, filterNums?: Set<number>): { images: string[]; videos: string[] } {
    const images: string[] = [];
    const videos: string[] = [];
    const re = /PROMPT\s+(\d+)\s*\n.*?IMAGE PROMPT\s*\([^)]*\)\s*:\s*\n(.*?)VIDEO PROMPT\s*\([^)]*\)\s*:\s*\n(.*?)(?=PROMPT\s+\d+|$)/gis;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        const num = parseInt(m[1]);
        if (filterNums && !filterNums.has(num)) continue;
        const img = collapseWhitespace(m[2]);
        const vid = collapseWhitespace(m[3]);
        if (img) images.push(img);
        if (vid) videos.push(vid);
    }
    return { images, videos };
}

export function parseFlowVideoFormat(raw: string): { images: string[]; videos: string[] } {
    const images: string[] = [];
    const videos: string[] = [];
    const re = /IMAGE PROMPT:(.*?)(?=FLOW VIDEO PROMPT:)\s*FLOW VIDEO PROMPT:(.*?)(?=\nScene|\nIMAGE PROMPT:|$)/gis;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        images.push(collapseWhitespace(m[1]));
        videos.push(collapseWhitespace(m[2]));
    }
    return { images, videos };
}

export function parseJsonFormat(raw: string): string[] {
    const results: string[] = [];
    let depth = 0, startIdx = -1;
    for (let i = 0; i < raw.length; i++) {
        if (raw[i] === '{') { if (depth === 0) startIdx = i; depth++; }
        else if (raw[i] === '}') {
            depth--;
            if (depth === 0 && startIdx !== -1) {
                const clean = collapseWhitespace(raw.substring(startIdx, i + 1));
                if (clean) results.push(clean);
                startIdx = -1;
            }
        }
    }
    return results;
}

export function isImageMarkerFormat(raw: string): boolean {
    return /\[\s*IMAGE\s*\d+\s*\]/i.test(raw);
}

export function parseImageMarkerFormat(raw: string, filterNums?: Set<number>): string[] {
    const results: string[] = [];
    const re = /\[\s*IMAGE\s*(\d+)\s*\]\s*(.*?)(?=\[\s*IMAGE\s*\d+\s*\]|\Z)/gis;
    const matches: { num: number; text: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        matches.push({ num: parseInt(m[1]), text: collapseWhitespace(m[2]) });
    }
    matches.sort((a, b) => a.num - b.num);
    for (const item of matches) {
        if (filterNums && !filterNums.has(item.num)) continue;
        if (item.text) results.push(item.text);
    }
    return results;
}

export function isImageRatioFormat(raw: string): boolean {
    return /Image\s+\d+[^\n]*ratio/i.test(raw);
}

export function parseImageRatioFormat(raw: string, filterNums?: Set<number>): string[] {
    const results: string[] = [];
    const re = /(Image\s+(\d+)[^\n]*ratio[^\n]*)\n(.*?)(?=Image\s+\d+[^\n]*ratio|$)/gis;
    const matches: { num: number; text: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        matches.push({ num: parseInt(m[2]), text: collapseWhitespace(m[3]) });
    }
    matches.sort((a, b) => a.num - b.num);
    for (const item of matches) {
        if (filterNums && !filterNums.has(item.num)) continue;
        if (item.text) results.push(item.text);
    }
    return results;
}

export function isInlineParenFormat(raw: string): boolean {
    if (/^\s*Motion\s+Prompt\s*\d+/i.test(raw)) return false;
    if (/^\s*Image\s*\d+/i.test(raw)) return false;
    if (/\)\.\s*Image\s*\d+/i.test(raw)) return false;
    if (/\)\.\s*Motion\s+Prompt\s*\d+/i.test(raw)) return false;
    if (/(?:^|\n)[A-Z][A-Za-z\s]+?\s*[\u2014\u2013-]\s*/m.test(raw)) return false;
    if (/(?:^|\n)\s*Scene\s*:/i.test(raw)) return false;
    return (raw.match(/\)\.\s*[A-Z]/g) || []).length >= 1;
}

export function parseInlineParenFormat(raw: string): string[] {
    const results: string[] = [];
    const parts = raw.split(/(\)\.)(?:\s*)(?=[A-Z])/);
    let current = '';
    for (const part of parts) {
        if (part === ').') {
            current += part;
            const clean = collapseWhitespace(current);
            if (clean) results.push(clean);
            current = '';
        } else current += part;
    }
    if (current.trim()) {
        const clean = collapseWhitespace(current);
        if (clean) results.push(clean);
    }
    return results;
}

export function isTitleDashFormat(raw: string): boolean {
    if (/^\s*Motion\s+Prompt\s*\d+/im.test(raw)) return false;
    if (/^\s*Image\s*\d+/im.test(raw)) return false;
    return (raw.match(/(?:^|\n)[A-Z][A-Za-z\s]+?\s*[\u2014\u2013-]\s*\S/gm) || []).length >= 1;
}

export function parseTitleDashFormat(raw: string, filterNums?: Set<number>): string[] {
    const results: string[] = [];
    const re = /(?:^|\n)([A-Z][A-Za-z\s]+?)\s*[\u2014\u2013-]\s*/gm;
    const matchList: RegExpExecArray[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) matchList.push(m);
    for (let i = 0; i < matchList.length; i++) {
        const start = matchList[i].index + matchList[i][0].length;
        const end = (i + 1 < matchList.length) ? matchList[i + 1].index : raw.length;
        const clean = collapseWhitespace(raw.substring(start, end));
        if (clean) results.push(clean);
    }
    return results;
}

export function isMotionPromptFormat(raw: string): boolean {
    return /Motion\s+Prompt\s*\d+/i.test(raw);
}

export function parseMotionPromptFormat(raw: string, filterNums?: Set<number>): string[] {
    const results: string[] = [];
    const re = /Motion\s+Prompt\s*(\d+)\s*(?:\([^)]*\))?\s*\n?(.*?)(?=Motion\s+Prompt\s*\d+|$)/gis;
    const matches: { num: number; text: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        matches.push({ num: parseInt(m[1]), text: collapseWhitespace(m[2]) });
    }
    matches.sort((a, b) => a.num - b.num);
    for (const item of matches) {
        if (filterNums && !filterNums.has(item.num)) continue;
        if (item.text) results.push(item.text);
    }
    return results;
}

export function isScriptPlaceholderFormat(raw: string): boolean {
    return /Image\s+\d+\s*:.*?SCRIPT\s+PLACEHOLDER\s*:/is.test(raw);
}

export function parseScriptPlaceholderFormat(raw: string, filterNums?: Set<number>): string[] {
    const results: string[] = [];
    const promptKeywords = [
        'illustration', 'background', 'character', 'scene', 'drawing',
        'doodle', 'sketch', 'art style', 'minimalist', 'hand-drawn',
        'pure black', 'pure white', 'outline', 'line art', 'figure',
        'image shows', 'visual', 'centered', 'frame', 'camera', 'shot',
        'cinematic', 'composition', 'lighting', 'render', 'style',
        'aesthetic', 'color palette', 'texture', 'gradient', 'shading'
    ];
    const re = /Image\s+(\d+)\s*:.*?SCRIPT\s+PLACEHOLDER\s*:\s*(.*?)(?=Image\s+\d+\s*:|$)/gis;
    const matches: { num: number; content: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        matches.push({ num: parseInt(m[1]), content: m[2] });
    }
    matches.sort((a, b) => a.num - b.num);
    for (const item of matches) {
        if (filterNums && !filterNums.has(item.num)) continue;
        const lines = item.content.trim().split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length === 0) continue;
        let promptStartIdx = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('A ') && lines[i].length > 50) { promptStartIdx = i; break; }
            const lower = lines[i].toLowerCase();
            if (promptKeywords.some(kw => lower.includes(kw)) && lines[i].length > 50) { promptStartIdx = i; break; }
        }
        let clean: string;
        if (promptStartIdx === -1) {
            const parts = item.content.split(/\n\s*\n/).map(p => p.trim()).filter(p => p);
            let content = item.content;
            if (parts.length > 1) {
                content = parts.find(p => p.startsWith('A ') && p.length > 50) ?? parts[parts.length - 1];
            }
            clean = collapseWhitespace(content);
        } else {
            clean = collapseWhitespace(lines.slice(promptStartIdx).join(' '));
        }
        if (clean) results.push(clean);
    }
    return results;
}

export function isImageInlineFormat(raw: string): boolean {
    if (/Image\s+\d+\s*:/i.test(raw)) return false;
    if (/Image\s+\d+[^\n]*ratio/i.test(raw)) return false;
    return /Image\s*\d+\s*\n?[A-Z]/i.test(raw);
}

export function parseImageInlineFormat(raw: string, filterNums?: Set<number>): string[] {
    const results: string[] = [];
    const re = /Image\s*(\d+)\s*\n?([A-Z].*?)(?=Image\s*\d+\s*\n?[A-Z]|$)/gis;
    const matches: { num: number; text: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        matches.push({ num: parseInt(m[1]), text: collapseWhitespace(m[2]) });
    }
    matches.sort((a, b) => a.num - b.num);
    for (const item of matches) {
        if (filterNums && !filterNums.has(item.num)) continue;
        if (item.text) results.push(item.text);
    }
    return results;
}

export function isNumberedParenTitleFormat(raw: string): boolean {
    return (raw.match(/\d+\)\s*[A-Za-z][^\u2014\u2013]{0,50}[\u2014\u2013]/g) || []).length >= 1;
}

export function parseNumberedParenTitleFormat(raw: string): string[] {
    const results: string[] = [];
    const re = /(\d+)\)\s*([A-Za-z][^\u2014\u2013]{0,50})[\u2014\u2013]\s*/g;
    const matchList: RegExpExecArray[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) matchList.push(m);
    for (let i = 0; i < matchList.length; i++) {
        const start = matchList[i].index + matchList[i][0].length;
        const end = (i + 1 < matchList.length) ? matchList[i + 1].index : raw.length;
        const content = collapseWhitespace(raw.substring(start, end));
        if (content) results.push(content);
    }
    return results;
}

export function parseNumberedSceneFormat(raw: string): string[] {
    const results: string[] = [];
    const re = /^\d+\)\s*[^\n]+\n(.+?)(?=^\d+\)|$)/gms;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        const clean = collapseWhitespace(m[1]);
        if (clean) results.push(clean);
    }
    return results;
}

export function isNumberedTitleFormat(raw: string): boolean {
    const re = /^\d+\.\s*([^\n]+)\n/gm;
    const matches: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        const title = m[1].trim();
        if (title.length > 50) return false;
        if (/[,;:]/.test(title)) return false;
        matches.push(title);
    }
    return matches.length >= 1;
}

export function parseNumberedTitleFormat(raw: string): string[] {
    const results: string[] = [];
    const re = /^\d+\.\s*[^\n]+\n(.+?)(?=^\d+\.\s*[^\n]+\n|$)/gms;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        const clean = collapseWhitespace(m[1]);
        if (clean) results.push(clean);
    }
    return results;
}

export function parseCarYearFormat(raw: string): string[] {
    const results: string[] = [];
    const cleaned = raw.replace(/\*\*/g, '');
    const re = /\((1[89]\d{2}|20\d{2})\)\s*[\u2014\u2013-]/g;
    const matchList: RegExpExecArray[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(cleaned)) !== null) matchList.push(m);
    if (matchList.length === 0) return results;

    for (let i = 0; i < matchList.length; i++) {
        const yearPos = matchList[i].index;
        const searchStart = (i === 0) ? 0 : matchList[i - 1].index + matchList[i - 1][0].length;
        const textBefore = cleaned.substring(searchStart, yearPos);

        let nameStart: number;
        if (i === 0) {
            const nm = /(\d+\.\s*)?([A-Z])/.exec(textBefore);
            nameStart = nm ? searchStart + (nm.index + (nm[1]?.length || 0)) : searchStart;
        } else {
            const tm = /[a-z]([A-Z])/.exec(textBefore);
            if (tm) nameStart = searchStart + tm.index + 1;
            else {
                const nm = /(\d+\.\s*)?([A-Z])/.exec(textBefore);
                nameStart = nm ? searchStart + (nm.index + (nm[1]?.length || 0)) : searchStart;
            }
        }

        let endPos: number;
        if (i + 1 < matchList.length) {
            const nextYearPos = matchList[i + 1].index;
            const textBetween = cleaned.substring(matchList[i].index + matchList[i][0].length, nextYearPos);
            const nextTm = /[a-z]([A-Z])/.exec(textBetween);
            if (nextTm) endPos = matchList[i].index + matchList[i][0].length + nextTm.index + 1;
            else {
                const nm = /(\d+\.\s*)?([A-Z])/.exec(textBetween);
                endPos = nm ? matchList[i].index + matchList[i][0].length + (nm.index + (nm[1]?.length || 0)) : nextYearPos;
            }
        } else endPos = cleaned.length;

        let prompt = cleaned.substring(nameStart, endPos).trim();
        prompt = prompt.replace(/^\d+\.\s*/, '');
        prompt = prompt.replace(/\s+\d+\.\s*$/, '');
        prompt = collapseWhitespace(prompt);
        if (prompt) results.push(prompt);
    }
    return results;
}

export function titleDashContentParser(raw: string): string[] {
    const result: string[] = [];
    const re = /[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*\s*[\u2014\u2013-]\s*(.+?)(?=(?:[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*\s*[\u2014\u2013-])|$)/gs;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        const content = m[1].trim();
        if (content) result.push(content);
    }
    if (result.length === 0) {
        for (const line of raw.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const lm = /^[A-Z][A-Za-z\s]+\s*[\u2014\u2013-]\s*(.+)$/.exec(trimmed);
            if (lm) { const c = lm[1].trim(); if (c) result.push(c); }
            else result.push(trimmed);
        }
    }
    return result;
}

export function parseImageColonFormat(raw: string, filterNums?: Set<number>): string[] {
    const results: string[] = [];
    const re = /Image\s+(\d+)\s*:\s*(.*?)(?=Image\s+\d+\s*:|$)/gis;
    const matches: { num: number; text: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        matches.push({ num: parseInt(m[1]), text: collapseWhitespace(m[2]) });
    }
    matches.sort((a, b) => a.num - b.num);
    for (const item of matches) {
        if (filterNums && !filterNums.has(item.num)) continue;
        if (item.text) results.push(item.text);
    }
    return results;
}

export function parseImageNewlineFormat(raw: string, filterNums?: Set<number>): string[] {
    const results: string[] = [];
    const re = /^\s*Image\s+(\d+)\s*\n(.*?)(?=^\s*Image\s+\d+|$)/gmis;
    const matches: { num: number; text: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        matches.push({ num: parseInt(m[1]), text: collapseWhitespace(m[2]) });
    }
    matches.sort((a, b) => a.num - b.num);
    for (const item of matches) {
        if (filterNums && !filterNums.has(item.num)) continue;
        if (item.text) results.push(item.text);
    }
    return results;
}

function isSceneTitle(line: string): boolean {
    line = line.trim();
    if (line.length > 60) return false;
    if (/^\d+-second/i.test(line)) return false;
    if (!/[a-zA-Z]/.test(line)) return false;
    if (/[.,;]/.test(line)) return false;
    const words = line.split(/\s+/).filter(w => w);
    if (words.length > 6) return false;
    return words.some(w => w.length > 0 && /[a-zA-Z]/.test(w[0]) && w[0] === w[0].toUpperCase());
}

export function isTitleContentFormat(raw: string): boolean {
    const lines = raw.trim().split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) return false;
    const titleCount = lines.filter(isSceneTitle).length;
    const contentCount = lines.length - titleCount;
    return titleCount >= 1 && contentCount >= 1 && titleCount <= Math.floor(lines.length / 2) + 1;
}

export function parseTitleContentFormat(raw: string): string[] {
    const results: string[] = [];
    const lines = raw.trim().split('\n');
    let currentTitle: string | null = null;
    const currentContent: string[] = [];
    for (const line of lines) {
        const stripped = line.trim();
        if (!stripped) continue;
        if (isSceneTitle(stripped)) {
            if (currentTitle !== null && currentContent.length > 0) {
                const full = collapseWhitespace(currentContent.join(' '));
                if (full) results.push(full);
            }
            currentTitle = stripped;
            currentContent.length = 0;
        } else currentContent.push(stripped);
    }
    if (currentTitle !== null && currentContent.length > 0) {
        const full = collapseWhitespace(currentContent.join(' '));
        if (full) results.push(full);
    }
    return results;
}

export function parseSceneFormat(raw: string): string[] {
    const results: string[] = [];
    const re = /^\s*Scene\s+(\d+)\s*\n(.*?)(?=^\s*Scene\s+\d+|$)/gmis;
    const matches: { num: number; text: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        matches.push({ num: parseInt(m[1]), text: collapseWhitespace(m[2]) });
    }
    matches.sort((a, b) => a.num - b.num);
    for (const item of matches) {
        if (item.text) results.push(item.text);
    }
    return results;
}

export function parseSceneColonFormat(raw: string): string[] {
    const results: string[] = [];
    const re = /(?:^|\n)\s*Scene\s*:/gi;
    const matchList: RegExpExecArray[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) matchList.push(m);
    for (let i = 0; i < matchList.length; i++) {
        const start = matchList[i].index;
        const end = (i + 1 < matchList.length) ? matchList[i + 1].index : raw.length;
        const clean = collapseWhitespace(raw.substring(start, end));
        if (clean) results.push(clean);
    }
    return results;
}

export function parsePromptFormat(raw: string): string[] {
    const results: string[] = [];
    const chunks = raw.split(/(?:^|\n)\s*Prompt:/i);
    for (const chunk of chunks) {
        const clean = collapseWhitespace(chunk).replace(/^(?:Prompt:|Image Prompt:)\s*/i, '').trim();
        if (clean) results.push(clean);
    }
    return results;
}

export function parseParagraphFormat(raw: string): string[] {
    const results: string[] = [];
    const chunks = raw.split(/\n\s*\n/);
    for (const chunk of chunks) {
        const clean = collapseWhitespace(chunk).replace(/^(?:Prompt:|Image Prompt:)\s*/i, '').trim();
        if (clean) results.push(clean);
    }
    return results;
}

export function isFrameTextVersionFormat(raw: string): boolean {
    return /FRAME\s+\d+/i.test(raw)
        && /TEXT VERSION\s*\(English\)\s*:/i.test(raw)
        && /NO-TEXT VERSION\s*\(English\)/i.test(raw);
}

export function parseFrameTextVersionFormat(raw: string, filterNums?: Set<number>): string[] {
    const results: string[] = [];
    const blocks = raw.split(/(?=FRAME\s+\d+)/i);
    for (const block of blocks) {
        if (!block.trim()) continue;
        const frameMatch = /FRAME\s+(\d+)/i.exec(block);
        if (frameMatch) {
            const num = parseInt(frameMatch[1]);
            if (filterNums && !filterNums.has(num)) continue;
        }
        const textVer = /TEXT VERSION\s*\(English\)\s*:\s*(.*?)(?=NO-TEXT VERSION\s*\(English\)|FRAME\s+\d+|$)/is.exec(block);
        if (textVer) {
            const content = collapseWhitespace(textVer[1]);
            if (content) results.push(content);
        }
    }
    return results;
}

export function isSceneAddonFormat(raw: string): boolean {
    return /SCENE ADD-ON \(English\):/i.test(raw);
}

export function parseSceneAddonFormat(raw: string): string[] {
    const results: string[] = [];
    const re = /SCENE ADD-ON \(English\):\s*(.*?)(?=FRAME \d+|$)/gis;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        let clean = m[1].replace(/SCRIPT PLACEHOLDER:.*?(?=SCENE ADD-ON|FRAME|$)/gis, '');
        clean = clean.replace(/FRAME \d+/gi, '');
        clean = collapseWhitespace(clean);
        if (clean) results.push(clean);
    }
    return results;
}

export function isPromptAddonFormat(raw: string): boolean {
    return /PROMPT\s*\(ADD-ON\)\s*:/i.test(raw);
}

export function parsePromptAddonFormat(raw: string): string[] {
    const results: string[] = [];
    const re = /PROMPT\s*\(ADD-ON\)\s*:\s*(.*?)(?=FRAME\s+\d+|SCRIPT\s+PLACEHOLDER|TEXT\s+IN\s+VIDEO|PROMPT\s*\(ADD-ON\)|$)/gis;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        const clean = collapseWhitespace(m[1]);
        if (clean) results.push(clean);
    }
    return results;
}

export function isScenePromptEnglishFormat(raw: string): boolean {
    return /SCENE\s+PROMPT\s*\(English\)\s*:/i.test(raw);
}

export function parseScenePromptEnglishFormat(raw: string): string[] {
    const results: string[] = [];
    const re = /SCENE\s+PROMPT\s*\(English\)\s*:\s*(.*?)(?=FRAME\s+\d+|SCRIPT\s+PLACEHOLDER|TEXT\s+OVERLAY|SCENE\s+PROMPT|$)/gis;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        const clean = collapseWhitespace(m[1]);
        if (clean) results.push(clean);
    }
    return results;
}

export function isFrameColonFormat(raw: string): boolean {
    return /FRAME\s+\d+\s*:/i.test(raw);
}

export function parseFrameColonFormat(raw: string): string[] {
    const results: string[] = [];
    const re = /FRAME\s+\d+\s*:\s*(.*?)(?=FRAME\s+\d+\s*:|$)/gis;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        const clean = collapseWhitespace(m[1]);
        if (clean) results.push(clean);
    }
    return results;
}

export function isFramePipeScenePromptFormat(raw: string): boolean {
    const hasFrame = /FRAME\s+\d+\s*\|/i.test(raw);
    const hasScript = /SCRIPT\s+PLACEHOLDER\s*:/i.test(raw);
    const hasScene = /SCENE\s+PROMPT\s*(?:\([^)]*\))?\s*:/i.test(raw);
    return hasFrame && hasScript && hasScene;
}

export function parseFramePipeScenePromptFormat(raw: string): string[] {
    const results: string[] = [];
    const re = /SCENE\s+PROMPT\s*(?:\([^)]*\))?\s*:\s*(.*?)(?=FRAME\s+\d+|$)/gis;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        const clean = collapseWhitespace(m[1]);
        if (clean) results.push(clean);
    }
    return results;
}

export function detectFormat(raw: string): string {
    const rawCleaned = raw.replace(/\*\*/g, '');
    if (isPromptImageVideoFormat(raw)) return 'prompt_image_video';
    if (raw.toUpperCase().includes('FLOW VIDEO PROMPT:')) return 'flow_video';
    if (raw.trimStart().startsWith('{') && raw.includes('car_name_model')) return 'json_car';
    if (isFrameTextVersionFormat(raw)) return 'frame_text_version';
    if (isSceneAddonFormat(raw)) return 'scene_addon';
    if (isPromptAddonFormat(raw)) return 'prompt_addon';
    if (isScenePromptEnglishFormat(raw)) return 'scene_prompt_english';
    if (isFramePipeScenePromptFormat(raw)) return 'frame_pipe_scene_prompt';
    if (isFrameColonFormat(raw)) return 'frame_colon';
    if (isScriptPlaceholderFormat(raw)) return 'script_placeholder';
    if (isImageMarkerFormat(raw)) return 'image_marker';
    if (isImageRatioFormat(raw)) return 'image_ratio';
    if (isInlineParenFormat(raw)) return 'inline_paren';
    if (isTitleDashFormat(raw)) return 'title_dash';
    if (isMotionPromptFormat(raw)) return 'motion_prompt';
    if (isImageInlineFormat(raw)) return 'image_inline';
    if (isNumberedParenTitleFormat(raw)) return 'numbered_paren_title';
    if (/^\d+\)\s*\w+/m.test(raw)) return 'numbered_scene';
    if (isNumberedTitleFormat(raw)) return 'numbered_title';
    if (/\((1[89]\d{2}|20\d{2})\)\s*[\u2014\u2013-]/.test(rawCleaned)) return 'car_year';
    if (/[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*\s*[\u2014\u2013-]\s+/.test(raw) && !/Image\s+\d+/i.test(raw))
        return 'title_dash_content';
    if (/Image\s+\d+\s*:/i.test(raw)) return 'image_colon';
    if (/^\s*Image\s+\d+/mi.test(raw)) return 'image_newline';
    if (isTitleContentFormat(raw)) return 'title_content';
    if (/(?:^|\n)\s*Scene\s*:/i.test(raw)) return 'scene_colon';
    if (/^\s*Scene\s+\d+/mi.test(raw)) return 'scene';
    if ((raw.toLowerCase().match(/prompt:/g) || []).length > 1) return 'prompt';
    return 'paragraph';
}

export function parseFilterNums(filterText: string): Set<number> | undefined {
    if (!filterText.trim()) return undefined;
    const nums = new Set<number>();
    for (const part of filterText.replace(/ /g, '').split(',')) {
        const n = parseInt(part);
        if (!isNaN(n)) nums.add(n);
    }
    return nums.size > 0 ? nums : undefined;
}

export function parseInput(raw: string, filterNums?: Set<number>): { images: string[]; videos: string[] } {
    let images: string[] = [];
    let videos: string[] = [];
    const fmt = detectFormat(raw);
    switch (fmt) {
        case 'prompt_image_video': ({ images, videos } = parsePromptImageVideoFormat(raw, filterNums)); break;
        case 'flow_video': ({ images, videos } = parseFlowVideoFormat(raw)); break;
        case 'json_car': images = parseJsonFormat(raw); break;
        case 'frame_text_version': images = parseFrameTextVersionFormat(raw, filterNums); break;
        case 'scene_addon': images = parseSceneAddonFormat(raw); break;
        case 'prompt_addon': images = parsePromptAddonFormat(raw); break;
        case 'scene_prompt_english': images = parseScenePromptEnglishFormat(raw); break;
        case 'frame_pipe_scene_prompt': images = parseFramePipeScenePromptFormat(raw); break;
        case 'frame_colon': images = parseFrameColonFormat(raw); break;
        case 'script_placeholder': images = parseScriptPlaceholderFormat(raw, filterNums); break;
        case 'image_marker': images = parseImageMarkerFormat(raw, filterNums); break;
        case 'image_ratio': images = parseImageRatioFormat(raw, filterNums); break;
        case 'inline_paren': images = parseInlineParenFormat(raw); break;
        case 'title_dash': images = parseTitleDashFormat(raw, filterNums); break;
        case 'motion_prompt': images = parseMotionPromptFormat(raw, filterNums); break;
        case 'image_inline': images = parseImageInlineFormat(raw, filterNums); break;
        case 'numbered_paren_title': images = parseNumberedParenTitleFormat(raw); break;
        case 'numbered_scene': images = parseNumberedSceneFormat(raw); break;
        case 'numbered_title': images = parseNumberedTitleFormat(raw); break;
        case 'car_year': images = parseCarYearFormat(raw); break;
        case 'title_dash_content': images = titleDashContentParser(raw); break;
        case 'image_colon': images = parseImageColonFormat(raw, filterNums); break;
        case 'image_newline': images = parseImageNewlineFormat(raw, filterNums); break;
        case 'title_content': images = parseTitleContentFormat(raw); break;
        case 'scene_colon': images = parseSceneColonFormat(raw); break;
        case 'scene': images = parseSceneFormat(raw); break;
        case 'prompt': images = parsePromptFormat(raw); break;
        default: images = parseParagraphFormat(raw); break;
    }
    return { images, videos };
}

export function processSplit(raw: string, filterText = ''): { images: string[]; videos: string[]; format: string } {
    const filterNums = parseFilterNums(filterText);
    const format = detectFormat(raw);
    const { images, videos } = parseInput(raw, filterNums);
    return { images, videos, format };
}
