import React, { useState } from 'react';
import { Merge, List, Search, Check, Plus, PenLine, CheckCircle, FileText } from 'lucide-react';
import { useMergeOverlap, MergedItem } from './useMergeOverlap';

const MergeOverlapTab: React.FC = () => {
    const [gocCopyMode, setGocCopyMode] = useState(true);
    const [gdCopyMode, setGdCopyMode] = useState(true);
    const {
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
    } = useMergeOverlap();

    const renderItems = (items: MergedItem[], prefix: string) =>
        items.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-700 text-sm">Waiting...</div>
        ) : (
            items.map((item, idx) => (
                <div key={idx} className="flex gap-3 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/60 hover:border-zinc-700 transition-colors">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-600 flex items-center justify-center text-white text-xs font-bold mt-0.5">
                        {idx + 1}
                    </div>
                    <p className="flex-1 text-[13px] text-zinc-400 line-clamp-4 leading-relaxed">{item.text}</p>
                    <button
                        onClick={() => handleCopy(item.text, `${prefix}-${idx}`)}
                        className="flex-shrink-0 self-start px-2 py-1 rounded-md bg-orange-600/90 hover:bg-orange-500 text-white text-[10px] font-bold transition-colors"
                    >
                        {copyFeedback === `${prefix}-${idx}` ? <Check className="w-3 h-3" /> : 'nn'}
                    </button>
                </div>
            ))
        );

    const renderControls = (
        list: MergedItem[],
        from: string, setFrom: (v: string) => void,
        to: string, setTo: (v: string) => void,
        pfx: string,
        mode: boolean, setMode: (v: boolean) => void
    ) => {
        const sep = mode ? '\n' : '\n\n';
        return (
            <div className="flex items-center gap-1.5 flex-wrap">
                <input type="text" inputMode="numeric" placeholder="Từ" value={from} onChange={e => setFrom(e.target.value)}
                    className="w-12 bg-zinc-800 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-[11px] text-center text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-orange-500/50" />
                <input type="text" inputMode="numeric" placeholder="Đến" value={to} onChange={e => setTo(e.target.value)}
                    className="w-12 bg-zinc-800 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-[11px] text-center text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-orange-500/50" />
                <div
                    onClick={() => setMode(!mode)}
                    className="flex items-center gap-1.5 cursor-pointer select-none px-2.5 py-1.5 bg-zinc-800 border border-zinc-700/50 rounded-lg"
                >
                    <span className={`text-[10px] font-bold ${mode ? 'text-orange-400' : 'text-zinc-500'}`}>1 dòng</span>
                    <div className={`relative w-7 h-4 rounded-full transition-colors duration-300 ${mode ? 'bg-orange-600' : 'bg-zinc-700'}`}>
                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-md transition-transform duration-300 ${mode ? 'translate-x-3' : 'translate-x-0'}`} />
                    </div>
                    <span className={`text-[10px] font-bold ${!mode ? 'text-orange-400' : 'text-zinc-500'}`}>Khoảng</span>
                </div>
                <button
                    onClick={() => handleCopy(getItemsInRange(list, from, to).join(sep), `${pfx}-copy`)}
                    disabled={list.length === 0}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700/50 rounded-lg text-[11px] text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {copyFeedback === `${pfx}-copy` ? <Check className="w-3 h-3" /> : <><FileText className="w-3 h-3" /> Copy</>}
                </button>
                <button
                    onClick={() => handleCopy(list.map(i => i.text).join(sep), `${pfx}-all`)}
                    disabled={list.length === 0}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors border border-orange-500 text-orange-400 hover:bg-orange-600 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {copyFeedback === `${pfx}-all` ? <Check className="w-3 h-3" /> : 'Copy tất cả'}
                </button>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col p-4 gap-3">
            <div className="flex-1 flex gap-4 min-h-0">
                <div className="w-[300px] flex flex-col shrink-0 gap-3">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                            <input
                                type="text" value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                placeholder="Tìm kiếm trong text..."
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-2.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-orange-500/50"
                            />
                        </div>
                        <button onClick={handleSearch} className="px-4 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-lg transition-colors">
                            Tìm
                        </button>
                    </div>

                    <textarea
                        ref={textareaRef} value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Nhập danh sách prompt cần gộp gối đầu..."
                        className="flex-1 w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-300 focus:outline-none focus:border-zinc-700 resize-none custom-scrollbar placeholder-zinc-700 leading-relaxed"
                    />

                    <div className="flex gap-2 items-center">
                        <button
                            onClick={() => setIsSuffixMode(!isSuffixMode)}
                            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors shrink-0 border ${isSuffixMode
                                ? 'bg-orange-600/20 border-orange-500/50 text-orange-400'
                                : 'bg-sky-600/20 border-sky-500/50 text-sky-400'
                                }`}
                        >
                            <Plus className="w-3 h-3" />
                            {isSuffixMode ? 'Thêm đuôi' : 'Thêm đầu'}
                        </button>
                        <input
                            type="text" value={extraText} onChange={e => setExtraText(e.target.value)}
                            placeholder="Ví dụ: no speech."
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-orange-500/50"
                        />
                    </div>

                    <button
                        onClick={handleProcess}
                        disabled={isProcessing || !input.trim()}
                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all
              ${isProcessing || !input.trim()
                                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700/50'
                            }`}
                    >
                        <PenLine className="w-4 h-4" /> Xử lý gối đầu
                    </button>
                </div>

                <div className="flex-1 flex flex-col min-w-0 gap-3">
                    <div className="flex items-center gap-2">
                        <List className="w-4 h-4 text-zinc-500" />
                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">List Gốc</span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 min-h-0">
                        {renderItems(originalGroups, 'goc')}
                    </div>
                    <div className="pt-3 border-t border-zinc-800">
                        {renderControls(originalGroups, gocFrom, setGocFrom, gocTo, setGocTo, 'goc', gocCopyMode, setGocCopyMode)}
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-w-0 gap-3">
                    <div className="flex items-center gap-2">
                        <Merge className="w-4 h-4 text-orange-500" />
                        <span className="text-xs font-bold text-orange-500/80 uppercase tracking-wider">List Gối Đầu</span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 min-h-0">
                        {renderItems(overlapGroups, 'gd')}
                    </div>
                    <div className="pt-3 border-t border-zinc-800">
                        {renderControls(overlapGroups, gdFrom, setGdFrom, gdTo, setGdTo, 'gd', gdCopyMode, setGdCopyMode)}
                    </div>
                </div>
            </div>

            <div className="pt-2 border-t border-zinc-800">
                <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500 font-medium">Đã tạo: {pairCount} Cặp</span>
                </div>
            </div>
        </div>
    );
};

export default MergeOverlapTab;