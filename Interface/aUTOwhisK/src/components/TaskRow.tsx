import { useRef } from 'react';
import type { Task } from '../App';

interface Props {
  task: Task;
  isCurrentTask: boolean;
  accountEmail?: string;
  onUpdate: (updates: Partial<Task>) => void;
  onRemove: () => void;
  onPreviewVideo: (url: string, taskOrder: number) => void;
  onReset: () => void;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  pending: { bg: 'bg-gray-700/50', text: 'text-gray-300', label: 'Chờ', icon: '⏳' },
  queued: { bg: 'bg-yellow-600/30', text: 'text-yellow-300', label: 'Hàng đợi', icon: '📋' },
  'getting-token': { bg: 'bg-blue-600/30', text: 'text-blue-300', label: 'Token', icon: '🔐' },
  uploading: { bg: 'bg-purple-600/30', text: 'text-purple-300', label: 'Upload', icon: '📤' },
  generating: { bg: 'bg-cyan-600/30', text: 'text-cyan-300', label: 'Tạo', icon: '🎬' },
  polling: { bg: 'bg-indigo-600/30', text: 'text-indigo-300', label: 'Chờ', icon: '⏱️' },
  done: { bg: 'bg-green-600/30', text: 'text-green-300', label: 'Xong', icon: '✅' },
  error: { bg: 'bg-red-600/30', text: 'text-red-300', label: 'Lỗi', icon: '❌' },
  running: { bg: 'bg-blue-600/30', text: 'text-blue-300', label: 'Chạy', icon: '🔄' },
};

const DEFAULT_STATUS = { bg: 'bg-gray-700/50', text: 'text-gray-300', label: '?', icon: '❓' };

export function TaskRow({ task, isCurrentTask, accountEmail, onUpdate, onRemove, onPreviewVideo, onReset }: Props) {
  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (type: 'start' | 'end', file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      onUpdate(type === 'start' ? { startImage: base64 } : { endImage: base64 });
    };
    reader.readAsDataURL(file);
  };

  const isRunning = ['queued', 'getting-token', 'uploading', 'generating', 'polling'].includes(task.status);
  const editDisabled = task.status !== 'pending';
  const statusConfig = STATUS_CONFIG[task.status] || DEFAULT_STATUS;
  const hasImages = task.startImage || task.endImage;

  const renderResultSlots = () => {
    const slots = [];
    for (let i = 0; i < 4; i++) {
      const op = task.operations?.[i];
      const videoUrl = task.results?.[i] || op?.media_url;
      const isSuccess = op?.status === 'MEDIA_GENERATION_STATUS_SUCCESSFUL';
      const isFailed = op?.status === 'MEDIA_GENERATION_STATUS_FAILED';
      const isPending = op && !isSuccess && !isFailed;

      if (videoUrl) {
        slots.push(
          <div
            key={i}
            onClick={() => onPreviewVideo(videoUrl, task.order)}
            className="w-12 h-12 rounded overflow-hidden cursor-pointer border-2 border-green-500/50 hover:border-green-400 transition-all hover:scale-105"
            title="Click để xem video"
          >
            <video src={videoUrl} className="w-full h-full object-cover" muted preload="metadata" />
          </div>
        );
      } else if (isFailed) {
        slots.push(
          <div key={i} className="w-12 h-12 rounded bg-red-900/30 border border-red-500/50 flex items-center justify-center text-red-400" title="Thất bại">✗</div>
        );
      } else if (isPending) {
        slots.push(
          <div key={i} className="w-12 h-12 rounded bg-yellow-900/20 border border-yellow-500/30 flex items-center justify-center text-yellow-400 animate-pulse" title="Đang xử lý">⏳</div>
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
        <textarea
          value={task.prompt}
          onChange={e => onUpdate({ prompt: e.target.value })}
          disabled={editDisabled}
          placeholder="Nhập prompt..."
          rows={2}
          className="w-full px-2 py-1.5 bg-[#1a1a2a] border border-gray-700 rounded-lg text-sm resize-none focus:outline-none focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed placeholder-gray-600"
        />
      </td>

      <td className="p-2">
        <input ref={startInputRef} type="file" accept="image/*" onChange={e => handleFileChange('start', e.target.files?.[0] || null)} className="hidden" />
        <input ref={endInputRef} type="file" accept="image/*" onChange={e => handleFileChange('end', e.target.files?.[0] || null)} className="hidden" />
        <div className="flex gap-1 justify-center">
          {task.startImage ? (
            <div className="relative group">
              <img src={task.startImage} alt="S" className="w-10 h-10 object-cover rounded cursor-pointer border border-pink-500/50 hover:border-pink-400" onClick={() => !editDisabled && startInputRef.current?.click()} />
              {!editDisabled && <button onClick={() => onUpdate({ startImage: undefined })} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] opacity-0 group-hover:opacity-100">×</button>}
            </div>
          ) : (
            <div onClick={() => !editDisabled && startInputRef.current?.click()} className={`w-10 h-10 border border-dashed border-pink-500/50 rounded flex items-center justify-center text-pink-400 text-[10px] cursor-pointer hover:bg-pink-500/10 ${editDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>S</div>
          )}
          {task.endImage ? (
            <div className="relative group">
              <img src={task.endImage} alt="E" className="w-10 h-10 object-cover rounded cursor-pointer border border-gray-500/50 hover:border-gray-400" onClick={() => !editDisabled && endInputRef.current?.click()} />
              {!editDisabled && <button onClick={() => onUpdate({ endImage: undefined })} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] opacity-0 group-hover:opacity-100">×</button>}
            </div>
          ) : (
            <div onClick={() => !editDisabled && endInputRef.current?.click()} className={`w-10 h-10 border border-dashed border-gray-600 rounded flex items-center justify-center text-gray-500 text-[10px] cursor-pointer hover:bg-gray-500/10 ${editDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>E</div>
          )}
        </div>
        {hasImages && <div className="text-[9px] text-center text-cyan-400 mt-0.5">I2V</div>}
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
        <div className="flex gap-1 justify-center">{renderResultSlots()}</div>
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
