import { useState, useCallback } from 'react';

export interface HistoryEntry {
    time: string;
    tab: string;
    input: string;
    output: string[];
    output_count: number;
}

const STORAGE_KEY = 'lozy_history';

function loadHistory(): HistoryEntry[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function saveHistory(entries: HistoryEntry[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function addHistory(tab: string, input: string, output: string[]) {
    const entries = loadHistory();
    const entry: HistoryEntry = {
        time: new Date().toLocaleString('vi-VN'),
        tab,
        input: input.length > 500 ? input.substring(0, 500) + '...' : input,
        output: output.slice(0, 50),
        output_count: output.length,
    };
    entries.unshift(entry);
    if (entries.length > 200) entries.length = 200;
    saveHistory(entries);
}

export function useHistory() {
    const [entries, setEntries] = useState<HistoryEntry[]>(loadHistory);
    const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
    const [searchText, setSearchText] = useState('');
    const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

    const refresh = useCallback(() => {
        setEntries(loadHistory());
    }, []);

    const clearAll = useCallback(() => {
        saveHistory([]);
        setEntries([]);
        setSelectedEntry(null);
    }, []);

    const deleteEntry = useCallback((idx: number) => {
        const updated = [...loadHistory()];
        updated.splice(idx, 1);
        saveHistory(updated);
        setEntries(updated);
        setSelectedEntry(null);
    }, []);

    const handleCopy = useCallback((text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopyFeedback(id);
        setTimeout(() => setCopyFeedback(null), 2000);
    }, []);

    const filtered = searchText.trim()
        ? entries.filter(e =>
            e.tab.toLowerCase().includes(searchText.toLowerCase()) ||
            e.input.toLowerCase().includes(searchText.toLowerCase()) ||
            e.output.some(o => o.toLowerCase().includes(searchText.toLowerCase()))
        )
        : entries;

    return {
        entries: filtered,
        selectedEntry, setSelectedEntry,
        searchText, setSearchText,
        copyFeedback,
        refresh, clearAll, deleteEntry, handleCopy,
    };
}
