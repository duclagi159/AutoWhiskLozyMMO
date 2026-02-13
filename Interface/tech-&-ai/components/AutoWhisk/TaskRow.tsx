import type { Task } from './AutoWhiskTab';

interface Props {
  task: Task;
  isCurrentTask: boolean;
  accountEmail?: string;
  onUpdate: (updates: Partial<Task>) => void;
  onRemove: () => void;
  onPreviewImage: (url: string, taskOrder: number) => void;
  onReset: () => void;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  pending: { bg: 'bg-gray-700/50', text: 'text-gray-300', label: 'Chờ', icon: '⏳' },
  queued: { bg: 'bg-yellow-600/30', text: 'text-yellow-300', label: 'Hàng đợi', icon: '📋' },
  generating: { bg: 'bg-cyan-600/30', text: 'text-cyan-300', label: 'Tạo', icon: '🎨' },
  done: { bg: 'bg-green-600/30', text: 'text-green-300', label: 'Xong', icon: '✅' },
  error: { bg: 'bg-red-600/30', text: 'text-red-300', label: 'Lỗi', icon: '❌' },
};

const DEFAULT_STATUS = { bg: 'bg-gray-700/50', text: 'text-gray-300', label: '?', icon: '❓' };

export function TaskRow({ task, isCurrentTask, accountEmail, onUpdate, onRemove, onPreviewImage, onReset }: Props) {
  const isRunning = ['queued', 'generating'].includes(task.status);
  const editDisabled = task.status !== 'pending';
  const statusConfig = STATUS_CONFIG[task.status] || DEFAULT_STATUS;

  const renderResultSlots = () => {
    const slots = [];
    for (let i = 0; i < task.count; i++) {
      const imageUrl = task.results?.[i];

      if (imageUrl) {
        slots.push(
          <div
            key={i}
            onClick={() => onPreviewImage(imageUrl, task.order)}
            className="w-12 h-12 rounded overflow-hidden cursor-pointer border-2 border-green-500/50 hover:border-green-400 transition-all hover:scale-105"
            title="Click để xem ảnh"
          >
            <img src={imageUrl} className="w-full h-full object-cover" alt={`Result ${i + 1}`} />
          </div>
        );
      } else if (task.status === 'generating') {
        slots.push(
          <div key={i} className="w-12 h-12 rounded bg-cyan-900/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 animate-pulse" title="Đang tạo">🎨</div>
        );
      } else if (task.status === 'error') {
        slots.push(
          <div key={i} className="w-12 h-12 rounded bg-red-900/30 border border-red-500/50 flex items-center justify-center text-red-400" title="Thất bại">✗</div>
        );
      } else {
        slots.push(
          <div key={i} className="w-12 h-12 rounded bg-gray-800/50 border border-gray-700/50 flex items-center justify-center text-gray-600">{i + 1}</div>
        );
      }
    }
    return slots;
  };

  return (
    <tr className={`border-b border-gray-800/50 transition-colors ${isCurrentTask ? 'bg-cyan-500/10' : 'hover:bg-[#1a1a2a]/50'}`}>
      <td className="p-2 text-center">
        <input
          type="checkbox"
          checked={task.selected}
          onChange={e => onUpdate({ selected: e.target.checked })}
          disabled={isRunning}
          className="w-4 h-4 cursor-pointer accent-cyan-500 rounded disabled:cursor-not-allowed disabled:opacity-50"
        />
      </td>

      <td className="p-2 text-center">
        <span className="text-gray-500 font-mono text-xs">{task.order}</span>
        {accountEmail && (
          <div className="text-[9px] text-cyan-400 truncate max-w-[60px]" title={accountEmail}>
            {accountEmail.split('@')[0]}
          </div>
        )}
      </td>

      <td className="p-2">
        <div className="flex gap-2 items-start">
          <textarea
            value={task.prompt}
            onChange={e => onUpdate({ prompt: e.target.value })}
            disabled={editDisabled}
            placeholder="Nhập prompt..."
            rows={2}
            className="flex-1 px-2 py-1.5 bg-[#1a1a2a] border border-gray-700 rounded-lg text-sm resize-none focus:outline-none focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed placeholder-gray-600"
          />
          <div className="flex flex-col items-center gap-1 min-w-[32px]">
            {task.status === 'pending' ? (
              <select
                value={task.count}
                onChange={e => onUpdate({ count: parseInt(e.target.value) })}
                className="w-10 px-1 py-1 bg-[#1a1a2a] border border-gray-700 rounded text-[10px] text-center cursor-pointer focus:outline-none focus:border-cyan-500"
                title="Số lượng ảnh"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
            ) : (
              <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded" title="Số lượng ảnh">×{task.count}</span>
            )}
          </div>
        </div>
      </td>

      <td className="p-2 text-center">
        <div className="flex flex-col items-center gap-0.5">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${statusConfig.bg} ${statusConfig.text}`}>
            <span>{statusConfig.icon}</span>
            <span>{statusConfig.label}</span>
          </span>
          {task.statusText && task.status !== 'pending' && (
            <span className="text-[9px] text-gray-500 max-w-[80px] truncate" title={task.statusText}>{task.statusText}</span>
          )}
        </div>
      </td>

      <td className="p-2">
        <div className="flex gap-1 justify-center items-center">
          {renderResultSlots()}
          {task.projectLink && (
            <a
              href={task.projectLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded bg-blue-600/30 border border-blue-500/50 hover:bg-blue-600/60 flex items-center justify-center text-blue-400 transition-colors ml-1"
              title={`Mở project: ${task.projectLink}`}
            >🔗</a>
          )}
        </div>
      </td>

      <td className="p-2 text-center">
        <div className="flex gap-1 justify-center">
          {(task.status === 'done' || task.status === 'error') && (
            <button onClick={onReset} className="w-7 h-7 bg-yellow-600/50 hover:bg-yellow-600 rounded text-xs transition-colors flex items-center justify-center" title="Reset để chạy lại">🔄</button>
          )}
          <button onClick={onRemove} className="w-7 h-7 bg-red-600/50 hover:bg-red-600 rounded text-xs transition-colors flex items-center justify-center">🗑️</button>
        </div>
      </td>
    </tr>
  );
}
