import React from 'react';
import { History as HistoryIcon, Search, Trash2, RefreshCw, Check, FileText, ChevronRight, Clock, Tag, Hash } from 'lucide-react';
import { useHistory, HistoryEntry } from './useHistory';

const HistoryTab: React.FC = () => {
  const {
    entries,
    selectedEntry, setSelectedEntry,
    searchText, setSearchText,
    copyFeedback,
    refresh, clearAll, deleteEntry, handleCopy,
  } = useHistory();

  const renderDetail = (entry: HistoryEntry) => (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700/50">
          <Clock className="w-3 h-3 text-zinc-500" />
          <span className="text-[11px] text-zinc-400">{entry.time}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700/50">
          <Tag className="w-3 h-3 text-amber-500" />
          <span className="text-[11px] text-amber-400 font-bold">{entry.tab}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700/50">
          <Hash className="w-3 h-3 text-emerald-500" />
          <span className="text-[11px] text-emerald-400">{entry.output_count} kết quả</span>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Input</span>
          <button
            onClick={() => handleCopy(entry.input, 'detail-input')}
            className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            {copyFeedback === 'detail-input' ? <Check className="w-3 h-3" /> : 'Copy'}
          </button>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 max-h-32 overflow-y-auto custom-scrollbar">
          <p className="text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed">{entry.input}</p>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Output ({entry.output_count})</span>
          <button
            onClick={() => handleCopy(entry.output.join('\n\n'), 'detail-output')}
            className="text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            {copyFeedback === 'detail-output' ? <Check className="w-3 h-3" /> : 'Copy All'}
          </button>
        </div>
        <div className="space-y-2 overflow-y-auto custom-scrollbar max-h-[calc(100%-2rem)]">
          {entry.output.map((text, idx) => (
            <div key={idx} className="flex gap-3 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/60 hover:border-zinc-700 transition-colors">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-600 flex items-center justify-center text-white text-[10px] font-bold">
                {idx + 1}
              </div>
              <p className="flex-1 text-[12px] text-zinc-400 line-clamp-3 leading-relaxed">{text}</p>
              <button
                onClick={() => handleCopy(text, `detail-${idx}`)}
                className="flex-shrink-0 self-start px-1.5 py-0.5 rounded bg-amber-600/90 hover:bg-amber-500 text-white text-[9px] font-bold transition-colors"
              >
                {copyFeedback === `detail-${idx}` ? <Check className="w-2.5 h-2.5" /> : 'nn'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col p-4 gap-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text" value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Tìm kiếm lịch sử..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-2.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
          />
        </div>
        <button onClick={refresh} className="p-2.5 bg-zinc-800 border border-zinc-700/50 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button onClick={clearAll} disabled={entries.length === 0}
          className="flex items-center gap-1.5 px-3 py-2.5 bg-red-600/10 border border-red-500/30 rounded-lg text-red-400 text-xs font-bold hover:bg-red-600/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-3 h-3" /> Xóa hết
        </button>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <div className="w-[360px] flex flex-col shrink-0 gap-2">
          <div className="flex items-center gap-2 pb-2">
            <HistoryIcon className="w-4 h-4 text-zinc-500" />
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Lịch sử</span>
            <span className="ml-auto bg-zinc-800 text-zinc-400 text-[10px] px-2 py-0.5 rounded-full border border-zinc-700 font-mono">
              {entries.length} mục
            </span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 min-h-0">
            {entries.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-700 text-sm">Chưa có lịch sử</div>
            ) : (
              entries.map((entry, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedEntry(entry)}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedEntry === entry
                    ? 'bg-amber-600/10 border-amber-500/40'
                    : 'bg-zinc-900/60 border-zinc-800/60 hover:border-zinc-700'
                    }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] text-amber-400 font-bold bg-amber-600/15 px-1.5 py-0.5 rounded">{entry.tab}</span>
                      <span className="text-[10px] text-zinc-600">{entry.time}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 truncate">{entry.input}</p>
                    <span className="text-[10px] text-zinc-600 mt-0.5">{entry.output_count} kết quả</span>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteEntry(idx); }}
                    className="flex-shrink-0 p-1 rounded hover:bg-red-600/20 text-zinc-700 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-700 flex-shrink-0" />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0 gap-3">
          <div className="flex items-center gap-2 pb-2">
            <FileText className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-bold text-amber-500/80 uppercase tracking-wider">Chi tiết</span>
          </div>
          {selectedEntry ? (
            renderDetail(selectedEntry)
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-700 text-sm">
              Chọn 1 mục để xem chi tiết
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryTab;