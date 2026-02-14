import { useState } from 'react';
import { Task } from './AutoWhiskTab';
import { TaskRow } from './TaskRow';

interface Props {
  tasks: Task[];
  selectedCount: number;
  runnableCount: number;
  runningTaskIds: Set<string>;
  accountEmails: Record<string, string>;
  onAddTask: () => void;
  onShowBulkModal: () => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onRemoveTask: (id: string) => void;
  onResetTask: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onDeleteSelected: () => void;
  onRunSelected: () => void;
  onRunAll: () => void;
  onStop: () => void;
  isRunning: boolean;
  onPreviewImage: (url: string, taskOrder: number) => void;
  onGlobalSettingsChange?: (ratio: '16:9' | '9:16' | '1:1', count: number) => void;
  onDownloadSelected?: () => void;
  onShowRefModal?: () => void;
  refImageCount?: number;
}

export function TaskTable({
  tasks,
  selectedCount,
  runnableCount,
  runningTaskIds,
  accountEmails,
  onAddTask,
  onShowBulkModal,
  onUpdateTask,
  onRemoveTask,
  onResetTask,
  onToggleAll,
  onDeleteSelected,
  onRunSelected,
  onRunAll,
  onStop,
  isRunning,
  onPreviewImage,
  onGlobalSettingsChange,
  onDownloadSelected,
  onShowRefModal,
  refImageCount = 0,
}: Props) {
  const [globalCount, setGlobalCount] = useState<number>(2);
  const [globalRatio, setGlobalRatio] = useState<'16:9' | '9:16' | '1:1'>('9:16');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const allSelected = tasks.length > 0 && tasks.every(t => t.selected);
  const hasRunnable = runnableCount > 0;
  const hasRunnableAll = tasks.some(t => ['pending', 'done', 'error'].includes(t.status) && t.prompt.trim());
  const hasRunningTasks = isRunning || runningTaskIds.size > 0 || tasks.some(t => ['queued', 'generating'].includes(t.status));

  const handleGlobalCountChange = (count: number) => {
    setGlobalCount(count);
    tasks.filter(t => !['queued', 'generating'].includes(t.status)).forEach(t => {
      onUpdateTask(t.id, { count });
    });
    onGlobalSettingsChange?.(globalRatio, count);
  };

  const handleGlobalRatioChange = (ratio: '16:9' | '9:16' | '1:1') => {
    setGlobalRatio(ratio);
    tasks.filter(t => !['queued', 'generating'].includes(t.status)).forEach(t => {
      onUpdateTask(t.id, { ratio });
    });
    onGlobalSettingsChange?.(ratio, globalCount);
  };

  // Filter tasks by status
  const filteredTasks = filterStatus === 'all' ? tasks : tasks.filter(t => t.status === filterStatus);
  const statusCounts = {
    all: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    done: tasks.filter(t => t.status === 'done').length,
    error: tasks.filter(t => t.status === 'error').length,
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-40 bg-[#12121a] border-b border-gray-800">
        <div className="flex items-center gap-2 px-3 py-2 flex-nowrap overflow-x-auto">
          <button onClick={onAddTask} className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors shrink-0">
            ➕ Thêm
          </button>
          <button onClick={onShowBulkModal} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors shrink-0">
            📝 Hàng loạt
          </button>

          <div className="flex items-center gap-2 pl-2 border-l border-gray-700 shrink-0">
            <span className="text-xs text-gray-500">SL:</span>
            <select value={globalCount} onChange={e => handleGlobalCountChange(parseInt(e.target.value))} className="px-2 py-1 bg-[#1a1a2a] border border-gray-700 rounded text-xs cursor-pointer focus:outline-none focus:border-cyan-500">
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </div>

          <div className="flex items-center gap-2 pl-2 border-l border-gray-700">
            <span className="text-xs text-gray-500">Ratio:</span>
            <select value={globalRatio} onChange={e => handleGlobalRatioChange(e.target.value as '16:9' | '9:16' | '1:1')} className="px-2 py-1 bg-[#1a1a2a] border border-gray-700 rounded text-xs cursor-pointer focus:outline-none focus:border-cyan-500">
              <option value="9:16">9:16</option>
              <option value="16:9">16:9</option>
              <option value="1:1">1:1</option>
            </select>
          </div>

          <div className="flex items-center gap-2 pl-2 border-l border-gray-700">
            <span className="text-xs text-gray-500">Filter:</span>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-2 py-1 bg-[#1a1a2a] border border-gray-700 rounded text-xs cursor-pointer focus:outline-none focus:border-cyan-500">
              <option value="all">Tất cả ({statusCounts.all})</option>
              <option value="pending">Pending ({statusCounts.pending})</option>
              <option value="done">Done ({statusCounts.done})</option>
              <option value="error">Error ({statusCounts.error})</option>
            </select>
          </div>

          <div className="flex-1" />

          <button
            onClick={onShowRefModal}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 hover:opacity-80"
            style={{ backgroundColor: '#ffbd59', color: '#000' }}
          >
            🖼️ Fill Ref {refImageCount > 0 ? `(${refImageCount}/3)` : ''}
          </button>

          {hasRunningTasks ? (
            <button onClick={onStop} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors shrink-0">
              ⏹️ Dừng
            </button>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={onRunSelected} disabled={!hasRunnable} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors shrink-0">
                ▶️ Chạy ({runnableCount})
              </button>
              <button onClick={onRunAll} disabled={!hasRunnableAll} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors shrink-0">
                Tất cả
              </button>
            </div>
          )}
        </div>

        {selectedCount > 0 && (
          <div className="flex items-center gap-3 px-3 pb-2">
            <span className="text-sm text-cyan-400 font-medium">{selectedCount} selected</span>
            <button onClick={onDownloadSelected} className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:opacity-80 flex items-center gap-1.5" style={{ backgroundColor: '#737373' }}>
              ⬇️ Download ({selectedCount})
            </button>
            <button onClick={onDeleteSelected} disabled={hasRunningTasks} className="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5">
              🗑️ Xóa
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-5xl mb-4">📭</div>
            <div className="text-lg">Chưa có task nào</div>
            <div className="text-sm mt-2 text-gray-600">Nhấn "Thêm" hoặc "Hàng loạt" để bắt đầu</div>
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
                  onPreviewImage={onPreviewImage}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
