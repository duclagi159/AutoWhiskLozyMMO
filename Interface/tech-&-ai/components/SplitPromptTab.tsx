import React, { useState, useRef } from 'react';
import { Sparkles, Copy, Braces, List, Play, ArrowRight, Search, Film } from 'lucide-react';

const SplitPromptTab: React.FC = () => {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Search state
  const [searchText, setSearchText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Toggle state: false = Video Prompt (Default), true = JSON
  const [showJson, setShowJson] = useState(false);

  const handleSplit = () => {
    if (!input.trim()) return;
    setIsProcessing(true);
    
    // Simulate AI processing
    setTimeout(() => {
      const mockResult = input.split(/[.\n]+/).filter(s => s.trim().length > 0).map(s => s.trim());
      
      if (mockResult.length === 0) {
        setResults(["Không tìm thấy prompt hợp lệ.", "Vui lòng kiểm tra lại đầu vào."]);
      } else {
        setResults(mockResult);
      }
      setIsProcessing(false);
    }, 800);
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

  // Helper to get current content based on mode
  const getCurrentContent = () => {
    if (results.length === 0) return '';
    return showJson 
        ? JSON.stringify(results, null, 2) 
        : results.join(', '); // Video prompt format: comma separated
  };

  return (
    <div className="h-full flex flex-row gap-4">
         
         {/* COT 1: INPUT */}
         <div className="flex-1 flex flex-col min-w-0 bg-[#18181b] border border-zinc-800 rounded-2xl p-4 shadow-sm group">
            <div className="flex justify-between items-center mb-3">
               <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center shrink-0">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 mr-2"></span>
                  Input Source
               </label>
               
               {/* Search Input */}
               <div className="relative group/search">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 group-focus-within/search:text-indigo-500 transition-colors" />
                  <input 
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onKeyDown={handleSearch}
                    placeholder="Tìm chữ..." 
                    className="bg-zinc-900/50 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 w-32 focus:w-48 transition-all duration-300"
                  />
               </div>
            </div>
            
            <textarea 
               ref={textareaRef}
               value={input}
               onChange={(e) => setInput(e.target.value)}
               placeholder="Nhập nội dung cần tách..."
               className="flex-1 w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 resize-none custom-scrollbar placeholder-zinc-700 leading-relaxed transition-colors mb-3"
            />

            {/* Nút bấm chuyển xuống dưới */}
            <button 
               onClick={handleSplit}
               disabled={isProcessing || !input}
               className={`
                  w-full flex items-center justify-center py-3 rounded-xl font-bold text-sm transition-all
                  ${isProcessing || !input 
                    ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/20 hover:scale-[1.02] active:scale-[0.98]'
                  }
               `}
            >
               {isProcessing ? 'Processing...' : (
                 <>Thực hiện Tách <Play className="w-4 h-4 ml-2" fill="currentColor" /></>
               )}
            </button>
         </div>

         {/* COT 2: OUTPUT LIST */}
         <div className="flex-1 flex flex-col min-w-0 bg-[#18181b] border border-zinc-800 rounded-2xl p-4 shadow-sm">
            <div className="flex justify-between items-center mb-3">
               <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center">
                  <List className="w-3.5 h-3.5 mr-2" />
                  Kết quả (List)
               </label>
               <span className="bg-zinc-800 text-zinc-400 text-[10px] px-2 py-0.5 rounded-full border border-zinc-700 font-mono">
                  {results.length} items
               </span>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-2 space-y-2">
               {results.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-700 text-sm">
                     <ArrowRight className="w-6 h-6 mb-2 opacity-20" />
                     Waiting for input...
                  </div>
               ) : (
                  results.map((item, idx) => (
                     <div key={idx} className="bg-zinc-800/40 p-3 rounded-lg border border-zinc-800/50 text-sm text-zinc-300 hover:border-zinc-600 transition-colors group/item relative">
                        <span className="absolute top-2 right-2 opacity-0 group-hover/item:opacity-100 cursor-pointer text-zinc-500 hover:text-zinc-200 transition-opacity" title="Copy">
                           <Copy className="w-3.5 h-3.5" />
                        </span>
                        {item}
                     </div>
                  ))
               )}
            </div>
         </div>

         {/* COT 3: OUTPUT VIDEO PROMPT / JSON */}
         <div className="flex-1 flex flex-col min-w-0 bg-[#18181b] border border-zinc-800 rounded-2xl p-4 shadow-sm transition-all duration-300">
            <div className="flex justify-between items-center mb-3">
               <div className="flex items-center gap-3">
                   {/* Toggle Label Icon */}
                   <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center select-none shrink-0">
                      {showJson ? <Braces className="w-3.5 h-3.5 mr-2" /> : <Film className="w-3.5 h-3.5 mr-2" />}
                      {showJson ? 'JSON Output' : 'Video Prompt'}
                   </label>

                   <div className="h-3 w-px bg-zinc-700/50"></div>

                   {/* Toggle Switch with ON/OFF text */}
                   <div 
                      onClick={() => setShowJson(!showJson)}
                      className="flex items-center gap-2 cursor-pointer group/toggle select-none"
                      title={showJson ? "Switch to Video Prompt" : "Switch to JSON Output"}
                   >
                      <span className={`text-[9px] font-bold transition-colors ${!showJson ? 'text-zinc-300' : 'text-zinc-600'}`}>OFF</span>
                      <div className={`
                        relative w-8 h-4.5 rounded-full transition-colors duration-300 ease-out
                        ${showJson ? 'bg-indigo-600' : 'bg-zinc-700 group-hover/toggle:bg-zinc-600'}
                      `}>
                          <div className={`
                             absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-md transform transition-transform duration-300
                             ${showJson ? 'translate-x-3.5' : 'translate-x-0'}
                          `} />
                      </div>
                      <span className={`text-[9px] font-bold transition-colors ${showJson ? 'text-indigo-400' : 'text-zinc-600'}`}>ON</span>
                   </div>
               </div>

               <button 
                 onClick={() => navigator.clipboard.writeText(getCurrentContent())}
                 className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center transition-colors"
               >
                  <Copy className="w-3 h-3 mr-1" /> Copy
               </button>
            </div>
            
            <div className={`
                flex-1 border rounded-xl p-4 overflow-hidden relative transition-colors duration-300
                ${showJson ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-900/30 border-zinc-800/50'}
            `}>
               <textarea 
                  readOnly
                  value={getCurrentContent()}
                  className={`
                     w-full h-full bg-transparent resize-none focus:outline-none custom-scrollbar
                     ${showJson ? 'text-xs font-mono text-emerald-500/90' : 'text-sm text-zinc-300 leading-relaxed'}
                  `}
                  placeholder={showJson ? "// JSON output..." : "Video prompt output..."}
               />
            </div>
         </div>

    </div>
  );
};

export default SplitPromptTab;