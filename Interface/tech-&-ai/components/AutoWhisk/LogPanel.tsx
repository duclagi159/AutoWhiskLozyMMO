import { useEffect, useRef, useState } from 'react';
import { LogEntry } from './AutoWhiskTab';

interface Props {
  logs: LogEntry[];
  onClear: () => void;
}

const LOG_STYLES: Record<LogEntry['type'], string> = {
  info: 'text-blue-400',
  success: 'text-green-400',
  error: 'text-red-400',
  step: 'text-cyan-400',
};

const LOG_ICONS: Record<LogEntry['type'], string> = {
  info: 'ℹ️',
  success: '✅',
  error: '❌',
  step: '▶️',
};

export function LogPanel({ logs, onClear }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (containerRef.current && autoScroll) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  const errorCount = logs.filter(l => l.type === 'error').length;
  const successCount = logs.filter(l => l.type === 'success').length;

  return (
    <div className="bg-[#12121a] rounded-xl border border-gray-800 overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 bg-[#1a1a2a] cursor-pointer hover:bg-[#1f1f2f] transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{isExpanded ? '📋' : '📋'}</span>
          <span className="text-sm font-medium text-gray-300">Logs</span>
          <span className="text-xs text-gray-500">({logs.length})</span>
          {errorCount > 0 && (
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
              {errorCount} errors
            </span>
          )}
          {successCount > 0 && (
            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
              {successCount} success
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!autoScroll && (
            <button
              onClick={(e) => { e.stopPropagation(); setAutoScroll(true); }}
              className="px-2 py-1 bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 rounded text-xs transition-colors"
            >
              ↓ Auto-scroll
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
          >
            Xóa
          </button>
          <span className="text-gray-500 text-sm">{isExpanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {isExpanded && (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="bg-[#0a0a0f] p-3 font-mono text-xs max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
        >
          {logs.length === 0 ? (
            <div className="text-gray-600 text-center py-4">
              Chưa có log nào...
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 py-1 px-2 rounded hover:bg-gray-800/50 ${LOG_STYLES[log.type]}`}
                >
                  <span className="text-gray-600 shrink-0 w-20">[{log.time}]</span>
                  <span className="shrink-0">{LOG_ICONS[log.type]}</span>
                  <span className="break-all">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
