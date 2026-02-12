import { useState } from 'react';
import { Task } from './types';
import { TaskRow } from './TaskRow';

interface Props {
  tasks: Task[];
  selectedCount: number;
  runnableCount: number;
  runningTaskIds: Set<string>;
  accountEmails: Record<string, string>;
  onAddTask: () => void;
  onShowBulkModal: () => void;
  onFillBulkImages: (type: 'start' | 'end') => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onRemoveTask: (id: string) => void;
  onResetTask: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onDeleteSelected: () => void;
  onRunSelected: () => void;
  onRunAll: () => void;
  onStop: () => void;
  isRunning: boolean;
  onPreviewVideo: (url: string, taskOrder: number) => void;
}

type FilterType = 'all' | 'pending' | 'running' | 'done' | 'error';

export function TaskTable({
  tasks,
  selectedCount,
  runnableCount,
  runningTaskIds,
  accountEmails,
  onAddTask,
  onShowBulkModal,
  onFillBulkImages,
  onUpdateTask,
  onRemoveTask,
  onResetTask,
  onToggleAll,
  onDeleteSelected,
  onRunSelected,
  onRunAll,
  onStop,
  isRunning,
  onPreviewVideo,
}: Props) {
  const [globalCount, setGlobalCount] = useState<number>(1);
  const [globalRatio, setGlobalRatio] = useState<'16:9' | '9:16'>('9:16');
  const [globalModel, setGlobalModel] = useState<string>('gemini-flix-2');
  const [globalRetry, setGlobalRetry] = useState<number>(5);
  const [filter, setFilter] = useState<FilterType>('all');
  const [savePath, setSavePath] = useState<string>('');

  const allSelected = tasks.length > 0 && tasks.every(t => t.selected);
  const hasRunnable = runnableCount > 0;
  const hasRunnableAll = tasks.some(t => ['pending', 'done', 'error'].includes(t.status) && t.prompt.trim());
  const hasRunningTasks = isRunning || runningTaskIds.size > 0 || tasks.some(t => ['queued', 'getting-token', 'uploading', 'generating', 'polling'].includes(t.status));

  // Filter counts
  const runningStatuses = ['queued', 'getting-token', 'uploading', 'generating', 'polling'];
  const counts = {
    all: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    running: tasks.filter(t => runningStatuses.includes(t.status)).length,
    done: tasks.filter(t => t.status === 'done').length,
    error: tasks.filter(t => t.status === 'error').length,
  };

  // Filter tasks
  const filteredTasks = tasks.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'pending') return t.status === 'pending';
    if (filter === 'running') return runningStatuses.includes(t.status);
    if (filter === 'done') return t.status === 'done';
    if (filter === 'error') return t.status === 'error';
    return true;
  });

  const handleGlobalCountChange = (count: number) => {
    setGlobalCount(count);
    tasks.filter(t => t.status === 'pending').forEach(t => {
      onUpdateTask(t.id, { count });
    });
  };

  const handleGlobalRatioChange = (ratio: '16:9' | '9:16') => {
    setGlobalRatio(ratio);
    tasks.filter(t => t.status === 'pending').forEach(t => {
      onUpdateTask(t.id, { ratio });
    });
  };

  const handleChooseFolder = () => {
    const input = document.createElement('input');
    input.type = 'file';
    (input as any).webkitdirectory = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        const path = (files[0] as any).path || files[0].webkitRelativePath?.split('/')[0] || 'Selected folder';
        const folderPath = path.substring(0, path.lastIndexOf('\\') || path.lastIndexOf('/'));
        setSavePath(folderPath || path);
      }
    };
    input.click();
  };

  const selectStyle = "px-2 py-1 bg-[#1a1a2a] border border-gray-700 rounded text-xs cursor-pointer focus:outline-none focus:border-cyan-500 text-gray-200";
  const labelStyle = "text-[11px] text-gray-500 whitespace-nowrap";

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-40 bg-[#12121a] border-b border-gray-800">
        <div className="flex items-center gap-2 px-3 py-2">
          {/* Left: Action buttons */}
          <button onClick={onAddTask} className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 rounded text-xs font-medium flex items-center gap-1 transition-colors shrink-0">
            <span>➕</span> Thêm
          </button>
          <button onClick={onShowBulkModal} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-xs font-medium flex items-center gap-1 transition-colors shrink-0">
            <span>📝</span> Hàng loạt
          </button>
          <button onClick={() => onFillBulkImages('start')} className="px-2.5 py-1.5 bg-orange-600/80 hover:bg-orange-600 rounded text-xs font-medium transition-colors shrink-0">
            Fill Ref
          </button>

          <div className="w-px h-5 bg-gray-700" />

          {/* Center: Settings */}
          <div className="flex items-center gap-1">
            <span className={labelStyle}>SL:</span>
            <select value={globalCount} onChange={e => handleGlobalCountChange(parseInt(e.target.value))} className={selectStyle}>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={4}>4</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className={labelStyle}>Ratio:</span>
            <select value={globalRatio} onChange={e => handleGlobalRatioChange(e.target.value as '16:9' | '9:16')} className={selectStyle}>
              <option value="9:16">9:16</option>
              <option value="16:9">16:9</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className={labelStyle}>Model:</span>
            <select value={globalModel} onChange={e => setGlobalModel(e.target.value)} className={`${selectStyle} min-w-[120px]`}>
              <option value="gemini-flix-2">Gemini Flix 2</option>
              <option value="veo-2">Veo 2</option>
              <option value="veo-3">Veo 3</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className={labelStyle}>Retry:</span>
            <input
              type="number"
              value={globalRetry}
              onChange={e => setGlobalRetry(Math.max(0, parseInt(e.target.value) || 0))}
              min={0}
              max={99}
              className="w-10 px-1.5 py-1 bg-[#1a1a2a] border border-gray-700 rounded text-xs text-center focus:outline-none focus:border-cyan-500 text-gray-200"
            />
          </div>

          <div className="w-px h-5 bg-gray-700" />

          {/* Filter */}
          <div className="flex items-center gap-1">
            <span className={labelStyle}>Filter:</span>
            <select value={filter} onChange={e => setFilter(e.target.value as FilterType)} className={`${selectStyle} min-w-[100px]`}>
              <option value="all">Tất cả ({counts.all})</option>
              <option value="pending">Chờ ({counts.pending})</option>
              <option value="running">Đang chạy ({counts.running})</option>
              <option value="done">Xong ({counts.done})</option>
              <option value="error">Lỗi ({counts.error})</option>
            </select>
          </div>

          <div className="flex-1" />

          {/* Right: Run buttons */}
          {selectedCount > 0 && (
            <button onClick={onDeleteSelected} disabled={hasRunningTasks} className="px-2 py-1.5 bg-red-600/80 hover:bg-red-600 disabled:opacity-50 rounded text-xs font-medium transition-colors shrink-0">
              🗑️ {selectedCount}
            </button>
          )}

          {hasRunningTasks ? (
            <button onClick={onStop} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-xs font-medium flex items-center gap-1 transition-colors shrink-0">
              ⏹️ Dừng
            </button>
          ) : (
            <>
              <button onClick={onRunSelected} disabled={!hasRunnable} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs font-medium flex items-center gap-1 transition-colors shrink-0">
                ▶️ Chạy ({runnableCount})
              </button>
              <button onClick={onRunAll} disabled={!hasRunnableAll} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs font-medium transition-colors shrink-0">
                Tất cả
              </button>
            </>
          )}

          <div className="w-px h-5 bg-gray-700" />

          {/* Save folder */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={labelStyle}>📁 Lưu vào:</span>
            <button
              onClick={handleChooseFolder}
              className="px-2.5 py-1 bg-[#1a1a2a] border border-gray-700 hover:border-gray-500 rounded text-xs text-gray-400 hover:text-gray-200 transition-colors max-w-[140px] truncate"
              title={savePath || 'Chọn thư mục...'}
            >
              {savePath ? savePath.split(/[\\/]/).pop() : 'Chọn thư mục...'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-5xl mb-4">📭</div>
            <div className="text-lg">{filter === 'all' ? 'Chưa có task nào' : `Không có task "${filter}"`}</div>
            <div className="text-sm mt-2 text-gray-600">
              {filter === 'all' ? 'Nhấn "Thêm" hoặc "Hàng loạt" để bắt đầu' : `Đang lọc: ${filter} — nhấn Filter > Tất cả để xem hết`}
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#1a1a2a] text-gray-400 text-[10px] uppercase tracking-wider">
                <th className="p-2 text-center w-10">
                  <input type="checkbox" checked={allSelected} onChange={e => onToggleAll(e.target.checked)} className="w-4 h-4 cursor-pointer accent-cyan-500 rounded" />
                </th>
                <th className="p-2 text-center w-10">#</th>
                <th className="p-2 text-left min-w-[300px]">Prompt</th>
                <th className="p-2 text-center w-24">Images</th>
                <th className="p-2 text-center w-20">Status</th>
                <th className="p-2 text-center w-56">Kết quả</th>
                <th className="p-2 text-center w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  isCurrentTask={runningTaskIds.has(task.id)}
                  accountEmail={task.accountId ? accountEmails[task.accountId] : undefined}
                  onUpdate={updates => onUpdateTask(task.id, updates)}
                  onRemove={() => onRemoveTask(task.id)}
                  onReset={() => onResetTask(task.id)}
                  onPreviewVideo={onPreviewVideo}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
