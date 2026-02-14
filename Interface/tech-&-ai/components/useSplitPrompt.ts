import { useState, useRef, useCallback } from 'react';
import { processSplit } from './promptSplitterLogic';
import { addHistory } from './useHistory';

export interface SplitResult {
    images: string[];
    videos: string[];
    format: string;
}

export function useSplitPrompt() {
    const [input, setInput] = useState('');
    const [filterText, setFilterText] = useState('');
    const [searchText, setSearchText] = useState('');
    const [result, setResult] = useState<SplitResult>({ images: [], videos: [], format: '' });
    const [isProcessing, setIsProcessing] = useState(false);
    const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleProcess = useCallback(() => {
        if (!input.trim()) return;
        setIsProcessing(true);
        const { images, videos, format } = processSplit(input, filterText);
        setResult({ images, videos, format });
        addHistory('Tách Prompt AI', input, [...images, ...videos]);
        setIsProcessing(false);
    }, [input, filterText]);

    const handleCopy = useCallback((text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopyFeedback(id);
        setTimeout(() => setCopyFeedback(null), 2000);
    }, []);

    const handleSearch = useCallback(() => {
        if (!searchText.trim() || !textareaRef.current) return;
        const el = textareaRef.current;
        const text = input.toLowerCase();
        const search = searchText.toLowerCase();
        const index = text.indexOf(search);
        if (index !== -1) {
            const mirror = document.createElement('textarea');
            const style = getComputedStyle(el);
            mirror.style.cssText = `position:fixed;left:-9999px;top:0;width:${style.width};font:${style.font};line-height:${style.lineHeight};padding:${style.padding};border:${style.border};box-sizing:border-box;white-space:pre-wrap;word-wrap:break-word;overflow:hidden;`;
            mirror.value = input.substring(0, index);
            document.body.appendChild(mirror);
            const targetScroll = mirror.scrollHeight;
            document.body.removeChild(mirror);
            el.focus();
            el.setSelectionRange(index, index + search.length);
            el.scrollTop = Math.max(0, targetScroll - el.clientHeight / 3);
        }
    }, [searchText, input]);

    return {
        input, setInput,
        filterText, setFilterText,
        searchText, setSearchText,
        result,
        isProcessing,
        copyFeedback,
        textareaRef,
        handleProcess,
        handleCopy,
        handleSearch,
    };
}
