import React, { useState } from 'react';
import { Scissors, List, Search, Check, Plus, PenLine, CheckCircle, FileText, Film, Filter } from 'lucide-react';
import { useSplitPrompt } from './useSplitPrompt';

const SplitPromptTab: React.FC = () => {
   const {
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
   } = useSplitPrompt();

   const [imgCopyMode, setImgCopyMode] = useState(true);
   const [vidCopyMode, setVidCopyMode] = useState(true);
   const [imgFrom, setImgFrom] = useState('');
   const [imgTo, setImgTo] = useState('');
   const [vidFrom, setVidFrom] = useState('');
   const [vidTo, setVidTo] = useState('');

   const getItemsInRange = (list: string[], from: string, to: string) => {
      const s = Math.max(0, (parseInt(from) || 1) - 1);
      const e = Math.min(list.length, parseInt(to) || list.length);
      return list.slice(s, e);
   };

   const renderItems = (list: string[], pfx: string) => (
      list.length === 0 ? (
         <div className="h-full flex items-center justify-center text-zinc-700 text-sm">Waiting...</div>
      ) : (
         list.map((text, idx) => (
            <div key={idx} className="flex gap-3 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/60 hover:border-zinc-700 transition-colors">
               <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold mt-0.5">
                  {idx + 1}
               </div>
               <p className="flex-1 text-[13px] text-zinc-400 line-clamp-4 leading-relaxed">{text}</p>
               <button
                  onClick={() => handleCopy(text, `${pfx}-${idx}`)}
                  className="flex-shrink-0 self-start px-2 py-1 rounded-md bg-indigo-600/90 hover:bg-indigo-500 text-white text-[10px] font-bold transition-colors"
               >
                  {copyFeedback === `${pfx}-${idx}` ? <Check className="w-3 h-3" /> : 'nn'}
               </button>
            </div>
         ))
      )
   );

   const renderControls = (
      list: string[], pfx: string,
      from: string, setFrom: (v: string) => void,
      to: string, setTo: (v: string) => void,
      mode: boolean, setMode: (v: boolean) => void
   ) => {
      const sep = mode ? '\n' : '\n\n';
      return (
         <div className="flex items-center gap-1.5 flex-wrap">
            <input type="text" inputMode="numeric" placeholder="Từ" value={from} onChange={e => setFrom(e.target.value)}
               className="w-12 bg-zinc-800 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-[11px] text-center text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50" />
            <input type="text" inputMode="numeric" placeholder="Đến" value={to} onChange={e => setTo(e.target.value)}
               className="w-12 bg-zinc-800 border border-zinc-700/50 rounded-lg px-2 py-1.5 text-[11px] text-center text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50" />
            <div
               onClick={() => setMode(!mode)}
               className="flex items-center gap-1.5 cursor-pointer select-none px-2.5 py-1.5 bg-zinc-800 border border-zinc-700/50 rounded-lg"
            >
               <span className={`text-[10px] font-bold ${mode ? 'text-indigo-400' : 'text-zinc-500'}`}>1 dòng</span>
               <div className={`relative w-7 h-4 rounded-full transition-colors duration-300 ${mode ? 'bg-indigo-600' : 'bg-zinc-700'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-md transition-transform duration-300 ${mode ? 'translate-x-3' : 'translate-x-0'}`} />
               </div>
               <span className={`text-[10px] font-bold ${!mode ? 'text-indigo-400' : 'text-zinc-500'}`}>Khoảng</span>
            </div>
            <button
               onClick={() => handleCopy(getItemsInRange(list, from, to).join(sep), `${pfx}-copy`)}
               disabled={list.length === 0}
               className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700/50 rounded-lg text-[11px] text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
               {copyFeedback === `${pfx}-copy` ? <Check className="w-3 h-3" /> : <><FileText className="w-3 h-3" /> Copy</>}
            </button>
            <button
               onClick={() => handleCopy(list.join(sep), `${pfx}-all`)}
               disabled={list.length === 0}
               className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors border border-indigo-500 text-indigo-400 hover:bg-indigo-600 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
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
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-2.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50"
                     />
                  </div>
                  <button onClick={handleSearch} className="px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors">
                     Tìm
                  </button>
               </div>

               <textarea
                  ref={textareaRef} value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Nhập nội dung cần tách prompt..."
                  className="flex-1 w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-300 focus:outline-none focus:border-zinc-700 resize-none custom-scrollbar placeholder-zinc-700 leading-relaxed"
               />

               <div className="flex gap-2 items-center">
                  <div className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold bg-violet-600/20 border border-violet-500/50 text-violet-400 shrink-0">
                     <Filter className="w-3 h-3" /> Lọc số
                  </div>
                  <input
                     type="text" value={filterText} onChange={e => setFilterText(e.target.value)}
                     placeholder="VD: 1,3,5 (bỏ trống = lấy hết)"
                     className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50"
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
                  <PenLine className="w-4 h-4" /> Thực hiện Tách
               </button>
            </div>

            <div className="flex-1 flex flex-col min-w-0 gap-3">
               <div className="flex items-center gap-2">
                  <List className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Image Prompts</span>
                  <span className="ml-auto bg-zinc-800 text-zinc-400 text-[10px] px-2 py-0.5 rounded-full border border-zinc-700 font-mono">
                     {result.images.length} items
                  </span>
               </div>
               <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 min-h-0">
                  {renderItems(result.images, 'img')}
               </div>
               <div className="pt-3 border-t border-zinc-800">
                  {renderControls(result.images, 'img', imgFrom, setImgFrom, imgTo, setImgTo, imgCopyMode, setImgCopyMode)}
               </div>
            </div>

            <div className="flex-1 flex flex-col min-w-0 gap-3">
               <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-bold text-indigo-500/80 uppercase tracking-wider">Video Prompts</span>
                  <span className="ml-auto bg-zinc-800 text-zinc-400 text-[10px] px-2 py-0.5 rounded-full border border-zinc-700 font-mono">
                     {result.videos.length} items
                  </span>
               </div>
               <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 min-h-0">
                  {renderItems(result.videos, 'vid')}
               </div>
               <div className="pt-3 border-t border-zinc-800">
                  {renderControls(result.videos, 'vid', vidFrom, setVidFrom, vidTo, setVidTo, vidCopyMode, setVidCopyMode)}
               </div>
            </div>
         </div>

         <div className="pt-2 border-t border-zinc-800">
            <div className="flex items-center gap-3 text-xs">
               <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
               <span className="text-emerald-500 font-medium">Images: {result.images.length} | Videos: {result.videos.length}</span>
               {result.format && (
                  <span className="bg-zinc-800 text-zinc-400 text-[10px] px-2 py-0.5 rounded-full border border-zinc-700 font-mono">
                     Format: {result.format}
                  </span>
               )}
            </div>
         </div>
      </div>
   );
};

export default SplitPromptTab;