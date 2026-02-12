import React, { useState, useRef } from 'react';
import { Merge, List, FileText, Copy, Play, Search, Check, ListChecks, Hash } from 'lucide-react';

const MergeOverlapTab: React.FC = () => {
  const [input, setInput] = useState('');
  const [originalList, setOriginalList] = useState<string[]>([]);
  const [mergedResult, setMergedResult] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Search state
  const [searchText, setSearchText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Range Copy State
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const handleMerge = () => {
    if (!input.trim()) return;
    setIsProcessing(true);

    // Mock processing logic
    setTimeout(() => {
        // Tách input thành danh sách dựa trên dòng mới (để demo List Gốc)
        const list = input.split(/\n+/).filter(line => line.trim() !== '');
        setOriginalList(list);

        // Mock gộp: Nối lại (trong thực tế sẽ là thuật toán tìm overlap)
        setMergedResult(list.join(' ')); 
        
        setIsProcessing(false);
    }, 500);
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        if (!searchText.trim() || !textareaRef.current) return;
        const text = input.toLowerCase();
        const search = searchText.toLowerCase();
        const index = text.indexOf(search);
        
        if (index !== -1) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(index, index + search.length);
        }
    }
  };

  const handleCopy = (text: string, id: string) => {
      navigator.clipboard.writeText(text);
      setCopyFeedback(id);
      setTimeout(() => setCopyFeedback(null), 2000);
  };

  const handleCopyRange = () => {
      const start = parseInt(rangeStart);
      const end = parseInt(rangeEnd);

      if (isNaN(start) || isNaN(end) || originalList.length === 0) return;

      // Adjust for 0-based index (user enters 1-based)
      const startIndex = Math.max(0, start - 1);
      const endIndex = Math.min(originalList.length, end);

      if (startIndex >= endIndex) return;

      const slice = originalList.slice(startIndex, endIndex);
      // Join with space as per current merge logic
      handleCopy(slice.join(' '), 'range');
  };

  const handleCopyAllOriginal = () => {
      handleCopy(originalList.join('\n'), 'original-all');
  };

  return (
    <div className="h-full flex flex-row gap-4">
        
        {/* COT 1: INPUT */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#18181b] border border-zinc-800 rounded-2xl p-4 shadow-sm">
            <div className="flex justify-between items-center mb-3">
               <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center shrink-0">
                  <span className="w-2 h-2 rounded-full bg-orange-500 mr-2"></span>
                  Input
               </label>
               
               {/* Search Input */}
               <div className="relative group/search">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 group-focus-within/search:text-orange-500 transition-colors" />
                  <input 
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onKeyDown={handleSearch}
                    placeholder="Tìm chữ..." 
                    className="bg-zinc-900/50 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 w-32 focus:w-48 transition-all duration-300"
                  />
               </div>
            </div>
            
            <textarea 
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Nhập văn bản hoặc danh sách cần gộp..."
                className="flex-1 w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 resize-none custom-scrollbar placeholder-zinc-700 leading-relaxed mb-3"
            />
            {/* Nút bấm chuyển xuống dưới */}
            <button 
               onClick={handleMerge}
               disabled={isProcessing || !input}
               className={`
                  w-full flex items-center justify-center py-3 rounded-xl font-bold text-sm transition-all
                  ${isProcessing || !input 
                    ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' 
                    : 'bg-orange-600 text-white hover:bg-orange-500 shadow-lg shadow-orange-900/20 hover:scale-[1.02] active:scale-[0.98]'
                  }
               `}
            >
               {isProcessing ? 'Processing...' : (
                 <>Gộp Ngay <Play className="w-4 h-4 ml-2" fill="currentColor" /></>
               )}
            </button>
        </div>

        {/* COT 2: LIST GỐC */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#18181b] border border-zinc-800 rounded-2xl p-4 shadow-sm">
            <div className="flex justify-between items-center mb-3">
               <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center">
                  <List className="w-3.5 h-3.5 mr-2" />
                  List Gốc
               </label>
               <span className="bg-zinc-800 text-zinc-400 text-[10px] px-2 py-0.5 rounded-full border border-zinc-700 font-mono">
                  {originalList.length} items
               </span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-2 space-y-2 mb-3">
                 {originalList.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-700 text-sm">
                     Waiting for input...
                  </div>
               ) : (
                  originalList.map((item, idx) => (
                     <div key={idx} className="bg-zinc-800/40 p-3 rounded-lg border border-zinc-800/50 text-sm text-zinc-300 hover:border-zinc-700 transition-colors">
                        <div className="flex items-center mb-1">
                            <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-1 rounded mr-2">#{idx + 1}</span>
                        </div>
                        <div className="line-clamp-3 text-zinc-400">
                            {item}
                        </div>
                     </div>
                  ))
               )}
            </div>
            {/* Footer Action: Copy All */}
            <div className="pt-3 border-t border-zinc-800">
                <button
                    onClick={handleCopyAllOriginal}
                    disabled={originalList.length === 0}
                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all border border-zinc-700/50
                        ${originalList.length === 0 
                            ? 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed' 
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white'
                        }`}
                >
                    {copyFeedback === 'original-all' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <ListChecks className="w-3.5 h-3.5" />}
                    Copy All List
                </button>
            </div>
        </div>

        {/* COT 3: GỘP ĐẦU CUỐI */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#18181b] border border-zinc-800 rounded-2xl p-4 shadow-sm">
             <div className="flex justify-between items-center mb-3">
               <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center">
                  <Merge className="w-3.5 h-3.5 mr-2" />
                  Gộp Đầu Cuối
               </label>
               <button 
                 onClick={() => handleCopy(mergedResult, 'full-result')}
                 className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center transition-colors"
               >
                  {copyFeedback === 'full-result' ? <Check className="w-3 h-3 mr-1 text-emerald-500" /> : <Copy className="w-3 h-3 mr-1" />}
                  Copy Full
               </button>
            </div>
            <div className="flex-1 bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-4 overflow-hidden mb-3">
               <textarea 
                  readOnly
                  value={mergedResult}
                  className="w-full h-full bg-transparent text-sm text-zinc-300 resize-none focus:outline-none custom-scrollbar placeholder-zinc-700"
                  placeholder="Kết quả gộp sẽ hiển thị tại đây..."
               />
            </div>

            {/* Footer Action: Range Copy */}
            <div className="pt-3 border-t border-zinc-800">
                 <div className="flex items-center gap-2 bg-zinc-900/50 p-1.5 rounded-lg border border-zinc-800/50">
                    <div className="flex items-center gap-1 flex-1 bg-zinc-800/50 rounded px-2 border border-zinc-700/30">
                        <Hash className="w-3 h-3 text-zinc-500" />
                        <input 
                            type="number" 
                            placeholder="Start" 
                            value={rangeStart}
                            onChange={(e) => setRangeStart(e.target.value)}
                            className="w-full bg-transparent text-xs text-center py-1.5 text-zinc-200 placeholder-zinc-600 focus:outline-none"
                        />
                    </div>
                    <span className="text-zinc-600">-</span>
                    <div className="flex items-center gap-1 flex-1 bg-zinc-800/50 rounded px-2 border border-zinc-700/30">
                        <Hash className="w-3 h-3 text-zinc-500" />
                        <input 
                            type="number" 
                            placeholder="End" 
                            value={rangeEnd}
                            onChange={(e) => setRangeEnd(e.target.value)}
                            className="w-full bg-transparent text-xs text-center py-1.5 text-zinc-200 placeholder-zinc-600 focus:outline-none"
                        />
                    </div>
                    <button
                        onClick={handleCopyRange}
                        disabled={!mergedResult || !rangeStart || !rangeEnd}
                        className={`h-full px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1
                            ${!mergedResult || !rangeStart || !rangeEnd
                                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                                : 'bg-orange-600 text-white hover:bg-orange-500 shadow-lg shadow-orange-900/20'
                            }`}
                    >
                        {copyFeedback === 'range' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                 </div>
            </div>
        </div>
    </div>
  );
};

export default MergeOverlapTab;