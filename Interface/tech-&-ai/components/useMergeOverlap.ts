import { useState, useRef, useCallback } from 'react';
import { processChain } from './chainLogic';
import { addHistory } from './useHistory';

export interface MergedItem {
    text: string;
    count: number;
}

export function useMergeOverlap() {
    const [input, setInput] = useState('');
    const [extraText, setExtraText] = useState('');
    const [isSuffixMode, setIsSuffixMode] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [originalGroups, setOriginalGroups] = useState<MergedItem[]>([]);
    const [overlapGroups, setOverlapGroups] = useState<MergedItem[]>([]);
    const [pairCount, setPairCount] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const [gocFrom, setGocFrom] = useState('');
    const [gocTo, setGocTo] = useState('');
    const [gdFrom, setGdFrom] = useState('');
    const [gdTo, setGdTo] = useState('');

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

    const handleProcess = useCallback(() => {
        if (!input.trim()) return;
        setIsProcessing(true);

        const prefix = !isSuffixMode ? extraText.trim() : '';
        const suffix = isSuffixMode ? extraText.trim() : '';
        const { singles, chains } = processChain(input, prefix, suffix);

        setOriginalGroups(singles.map(text => ({ text, count: 1 })));
        setOverlapGroups(chains.map(text => ({ text, count: 2 })));
        setPairCount(chains.length);
        addHistory('Gộp Gối Đầu', input, chains);
        setIsProcessing(false);
    }, [input, extraText, isSuffixMode]);

    const getItemsInRange = useCallback((list: MergedItem[], from: string, to: string) => {
        const s = Math.max(0, (parseInt(from) || 1) - 1);
        const e = Math.min(list.length, parseInt(to) || list.length);
        return list.slice(s, e).map(i => i.text);
    }, []);

    return {
        input, setInput,
        extraText, setExtraText,
        isSuffixMode, setIsSuffixMode,
        searchText, setSearchText,
        originalGroups, overlapGroups,
        pairCount, isProcessing, copyFeedback,
        textareaRef,
        gocFrom, setGocFrom, gocTo, setGocTo,
        gdFrom, setGdFrom, gdTo, setGdTo,
        handleCopy, handleSearch, handleProcess,
        getItemsInRange,
    };
}
