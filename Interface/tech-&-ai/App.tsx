import React, { useState } from 'react';
import {
  Scissors,
  Merge,
  FileEdit,
  History as HistoryIcon,
  Layers,
  Cpu,
  Zap,
  Crown
} from 'lucide-react';
import SplitPromptTab from './components/SplitPromptTab';
import MergeOverlapTab from './components/MergeOverlapTab';
import CustomSplitTab from './components/CustomSplitTab';
import RenameFileTab from './components/RenameFileTab';
import HistoryTab from './components/HistoryTab';
import UpgradeTab from './components/UpgradeTab';
import AutoWhiskApp from './components/AutoWhisk/AutoWhiskTab';

export enum TabId {
  AUTO_WHISK = 'AUTO_WHISK',
  SPLIT_PROMPT = 'SPLIT_PROMPT',
  MERGE_OVERLAP = 'MERGE_OVERLAP',
  CUSTOM_SPLIT = 'CUSTOM_SPLIT',
  RENAME_FILE = 'RENAME_FILE',
  HISTORY = 'HISTORY',
  UPGRADE = 'UPGRADE'
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>(TabId.AUTO_WHISK);

  const renderContent = () => {
    switch (activeTab) {
      case TabId.AUTO_WHISK:
        return <AutoWhiskApp />;
      case TabId.SPLIT_PROMPT:
        return <SplitPromptTab />;
      case TabId.MERGE_OVERLAP:
        return <MergeOverlapTab />;
      case TabId.CUSTOM_SPLIT:
        return <CustomSplitTab />;
      case TabId.RENAME_FILE:
        return <RenameFileTab />;
      case TabId.HISTORY:
        return <HistoryTab />;
      case TabId.UPGRADE:
        return <UpgradeTab />;
      default:
        return <SplitPromptTab />;
    }
  };

  const tabs = [
    { id: TabId.AUTO_WHISK, label: 'AutoWhisk', icon: Zap, desc: 'Trộn nội dung tự động' },
    { id: TabId.SPLIT_PROMPT, label: 'Tách Prompt AI', icon: Scissors, desc: 'Phân tích & Tách lệnh' },
    { id: TabId.MERGE_OVERLAP, label: 'Gộp Gối Đầu', icon: Merge, desc: 'Ghép văn bản thông minh' },
    { id: TabId.CUSTOM_SPLIT, label: 'Tách Theo Yêu Cầu', icon: Layers, desc: 'Regex & Tùy chỉnh' },
    { id: TabId.RENAME_FILE, label: 'Đổi Tên File', icon: FileEdit, desc: 'Batch Rename' },
    { id: TabId.HISTORY, label: 'Lịch Sử Hoạt Động', icon: HistoryIcon, desc: 'Logs' },
    { id: TabId.UPGRADE, label: 'Upgrade', icon: Crown, desc: 'Nâng cấp tài khoản' },
  ];

  return (
    <div className="flex h-screen bg-[#09090b] text-zinc-100 font-sans overflow-hidden selection:bg-zinc-700">

      {/* Sidebar Navigation */}
      <aside className="w-[300px] bg-[#18181b] border-r border-zinc-800 flex flex-col shrink-0 relative z-20">

        {/* Logo Section */}
        <div className="relative pt-8 pb-8 px-6 text-center">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-20 bg-zinc-800/50 blur-[40px] rounded-full pointer-events-none" />

          <h1 className="relative z-10 text-2xl font-bold text-zinc-100 tracking-tight mb-1">
            Tech & AI
          </h1>
          <p className="relative z-10 text-zinc-500 text-sm font-medium">All in one AI Tools</p>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto py-2 custom-scrollbar">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                   w-full group flex items-center p-3.5 rounded-xl border transition-all duration-200 text-left relative
                   ${isActive
                    ? 'bg-zinc-800/80 border-zinc-700/50 shadow-sm'
                    : 'bg-transparent border-transparent hover:bg-zinc-800/40 hover:border-zinc-800'
                  }
                 `}
              >
                {/* Icon Box */}
                <div className={`
                   flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mr-3 transition-colors duration-200
                   ${isActive
                    ? 'bg-zinc-100 text-zinc-900 shadow-md'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-500 group-hover:text-zinc-300 group-hover:border-zinc-700'
                  }
                 `}>
                  <Icon className="w-4.5 h-4.5" />
                </div>

                {/* Text Info */}
                <div className="flex flex-col">
                  <span className={`text-[14px] font-semibold tracking-wide ${isActive ? 'text-zinc-100' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                    {tab.label}
                  </span>
                </div>

                {/* Active Indicator Line */}
                {isActive && (
                  <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-zinc-400" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-6 border-t border-zinc-800">
          <div className="flex items-center justify-center space-x-2 text-zinc-500 text-xs uppercase tracking-widest font-semibold hover:text-zinc-300 transition-colors cursor-default">
            <Cpu className="w-3 h-3" />
            <span>Lozy MMO</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col h-full bg-[#09090b]">
        {[
          TabId.AUTO_WHISK,
          TabId.SPLIT_PROMPT,
          TabId.MERGE_OVERLAP,
          TabId.CUSTOM_SPLIT,
          TabId.RENAME_FILE
        ].includes(activeTab) ? (
          <div className="flex-1 h-full overflow-hidden animate-fade-in">
            {renderContent()}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
            {/* Card Container */}
            <div className="max-w-7xl mx-auto h-full animate-fade-in pb-10">
              <div className="bg-[#18181b] border border-zinc-800 rounded-3xl p-6 md:p-10 shadow-[0_8px_30px_rgba(0,0,0,0.3)] min-h-[90%] relative overflow-hidden">
                {/* Background decorative blob (Dark) */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-zinc-800/10 blur-[100px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2" />

                <div className="relative z-10 h-full">
                  {renderContent()}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;