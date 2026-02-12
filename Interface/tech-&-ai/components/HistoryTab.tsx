import React from 'react';
import { History as HistoryIcon } from 'lucide-react';

const HistoryTab: React.FC = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 relative">
       {/* Decorative glow - Dark Zinc */}
       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-zinc-800/20 blur-[100px] rounded-full pointer-events-none" />

       <div className="bg-[#18181b] p-8 rounded-[2rem] border border-zinc-800 mb-8 shadow-[0_20px_40px_rgba(0,0,0,0.5)] relative z-10">
          <HistoryIcon className="w-16 h-16 text-zinc-600" />
       </div>

       <h2 className="text-3xl font-bold text-zinc-100 mb-3 relative z-10 tracking-tight">Lịch Sử Hoạt Động</h2>
       <div className="flex items-center space-x-2 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-1.5 mb-8 relative z-10">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-zinc-400"></span>
          </span>
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Coming Soon</span>
       </div>
       
       <p className="text-zinc-500 text-center max-w-md leading-relaxed relative z-10 font-medium">
         Tính năng <strong>Lịch Sử Hoạt Động</strong> đang được đội ngũ <span className="text-zinc-200 font-bold">Lozy MMO</span> phát triển. 
         Chúng tôi sẽ sớm ra mắt tính năng này trong bản cập nhật tiếp theo!
       </p>
    </div>
  );
};

export default HistoryTab;