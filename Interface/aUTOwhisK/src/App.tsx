import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AccountSection, SelectedAccount } from './components/AccountSection';
import { TaskTable } from './components/TaskTable';
import { LogPanel } from './components/LogPanel';
import { VideoGallery } from './components/VideoGallery';

const STORAGE_KEY = 'veo3-tasks';
const ACCOUNTS_KEY = 'veo3-selected-accounts';
const ORDER_KEY = 'veo3-order-counter';

export interface VideoOperation {
  operation_name: string;
  scene_id: string;
  status: string;
  media_url?: string;
}

export interface Task {
  id: string;
  order: number;
  selected: boolean;
  prompt: string;
  type: 'text-to-video' | 'image-to-video';
  ratio: '16:9' | '9:16';
  count: number;
  startImage?: string;
  endImage?: string;
  status: 'pending' | 'queued' | 'getting-token' | 'uploading' | 'generating' | 'polling' | 'done' | 'error';
  statusText?: string;
  results: string[];
  operations?: VideoOperation[];
  error?: string;
  accountId?: string;
}

export interface LogEntry {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'step';
}

export default function App() {
  const [selectedAccounts, setSelectedAccounts] = useState<SelectedAccount[]>(() => {
    try {
      const saved = localStorage.getItem(ACCOUNTS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [runningTaskIds, setRunningTaskIds] = useState<Set<string>>(new Set());
  const [previewVideo, setPreviewVideo] = useState<{ url: string; taskOrder: number } | null>(null);
  const [accountEmails, setAccountEmails] = useState<Record<string, string>>({});
  const stopFlag = useRef(false);
  const orderCounter = useRef<number>((() => {
    try {
      const saved = localStorage.getItem(ORDER_KEY);
      return saved ? parseInt(saved, 10) : 1;
    } catch { return 1; }
  })());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      const maxOrder = tasks.reduce((max, t) => Math.max(max, t.order), 0);
      if (maxOrder >= orderCounter.current) orderCounter.current = maxOrder + 1;
      localStorage.setItem(ORDER_KEY, String(orderCounter.current));
    } catch (e) { console.error('Failed to save tasks:', e); }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(selectedAccounts));
    } catch (e) { console.error('Failed to save accounts:', e); }
  }, [selectedAccounts]);

  const log = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    setLogs(prev => [...prev, { time, message, type }]);
  }, []);

  const addTask = () => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      order: orderCounter.current++,
      selected: false,
      prompt: '',
      type: 'text-to-video',
      ratio: '16:9',
      count: 2,
      status: 'pending',
      results: [],
    };
    localStorage.setItem(ORDER_KEY, String(orderCounter.current));
    setTasks(prev => [...prev, newTask]);
  };

  const addBulkTasks = () => {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) return;
    const startOrder = orderCounter.current;
    const newTasks: Task[] = lines.map((prompt, i) => ({
      id: `task-${Date.now()}-${i}`,
      order: startOrder + i,
      selected: false,
      prompt,
      type: 'text-to-video' as const,
      ratio: '16:9' as const,
      count: 2,
      status: 'pending' as const,
      results: [],
    }));
    orderCounter.current = startOrder + lines.length;
    localStorage.setItem(ORDER_KEY, String(orderCounter.current));
    setTasks(prev => [...prev, ...newTasks]);
    log(`Added ${newTasks.length} tasks`, 'success');
    setBulkText('');
    setShowBulkModal(false);
  };

  const fillBulkImages = async (type: 'start' | 'end') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length === 0) return;
      const pendingTasks = tasks.filter(t => t.status === 'pending');
      let filled = 0;
      for (let i = 0; i < Math.min(files.length, pendingTasks.length); i++) {
        const file = files[i];
        const task = pendingTasks[i];
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          setTasks(prev => prev.map(t =>
            t.id === task.id ? { ...t, [type === 'start' ? 'startImage' : 'endImage']: base64 } : t
          ));
        };
        reader.readAsDataURL(file);
        filled++;
      }
      log(`Filled ${filled} ${type} images`, 'success');
    };
    input.click();
  };

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const removeTask = (id: string) => {
    setTasks(prev => {
      const remaining = prev.filter(t => t.id !== id);
      // Re-number remaining tasks starting from 1
      const renumbered = remaining.map((t, idx) => ({ ...t, order: idx + 1 }));
      orderCounter.current = renumbered.length + 1;
      localStorage.setItem(ORDER_KEY, String(orderCounter.current));
      return renumbered;
    });
  };

  const resetTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'pending' as const, statusText: undefined, results: [], operations: undefined, error: undefined, selected: false, accountId: undefined } : t));
    log(`Reset task`, 'info');
  };

  const toggleAll = (checked: boolean) => {
    setTasks(prev => prev.map(t => ({ ...t, selected: checked })));
  };

  const deleteSelected = () => {
    const selectedIds = tasks.filter(t => t.selected).map(t => t.id);
    if (selectedIds.length === 0) return;
    const remaining = tasks.filter(t => !t.selected);
    // Re-number remaining tasks starting from 1
    const renumbered = remaining.map((t, idx) => ({ ...t, order: idx + 1 }));
    setTasks(renumbered);
    // Reset order counter
    orderCounter.current = renumbered.length + 1;
    localStorage.setItem(ORDER_KEY, String(orderCounter.current));
    log(`Deleted ${selectedIds.length} tasks`, 'info');
  };

  const pollTaskStatus = async (task: Task, accountId: string): Promise<void> => {
    const POLL_INTERVAL = 5000;
    const MAX_POLLS = 120;
    let currentOps = task.operations || [];

    for (let pollCount = 1; pollCount <= MAX_POLLS; pollCount++) {
      if (stopFlag.current) {
        log(`[Task #${task.order}] Stopped by user`, 'info');
        updateTask(task.id, { status: 'error', statusText: 'Stopped', operations: currentOps, selected: false });
        return;
      }

      const pendingOps = currentOps.filter(
        op => op.status !== 'MEDIA_GENERATION_STATUS_SUCCESSFUL' && op.status !== 'MEDIA_GENERATION_STATUS_FAILED'
      );

      if (pendingOps.length === 0) {
        const successOps = currentOps.filter(op => op.status === 'MEDIA_GENERATION_STATUS_SUCCESSFUL');
        const videoUrls = successOps.map(op => op.media_url).filter(Boolean) as string[];
        log(`[Task #${task.order}] Done ${successOps.length}/${currentOps.length}`, 'success');
        updateTask(task.id, { status: 'done', statusText: `${successOps.length} done`, results: videoUrls, operations: currentOps, selected: false });
        return;
      }

      log(`[Task #${task.order}] Polling (${pollCount}) - ${pendingOps.length} pending`, 'step');
      updateTask(task.id, { status: 'polling', statusText: `Processing ${pendingOps.length}... (${pollCount})` });

      try {
        const result = await Promise.race([
          invoke<{ operations: VideoOperation[]; remaining_credits?: number }>('check_video_status', {
            accountId,
            operations: currentOps,
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Poll timeout')), 30000))
        ]);

        if (result.operations?.length) {
          currentOps = currentOps.map(op => {
            const updated = result.operations.find(r => r.scene_id === op.scene_id);
            return updated || op;
          });
          setTasks(prev => prev.map(t => t.id === task.id ? { ...t, operations: currentOps } : t));

          const allDone = currentOps.every(
            op => op.status === 'MEDIA_GENERATION_STATUS_SUCCESSFUL' || op.status === 'MEDIA_GENERATION_STATUS_FAILED'
          );

          if (allDone) {
            const successOps = currentOps.filter(op => op.status === 'MEDIA_GENERATION_STATUS_SUCCESSFUL');
            const videoUrls = successOps.map(op => op.media_url).filter(Boolean) as string[];
            log(`[Task #${task.order}] Done ${successOps.length}/${currentOps.length}`, 'success');
            updateTask(task.id, {
              status: successOps.length > 0 ? 'done' : 'error',
              statusText: successOps.length > 0 ? `${successOps.length} done` : 'All failed',
              results: videoUrls,
              operations: currentOps,
              selected: false,
            });
            return;
          }
        }
      } catch (e: unknown) {
        log(`[Task #${task.order}] Poll error: ${e}`, 'error');
      }

      await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }

    log(`[Task #${task.order}] Timeout after ${MAX_POLLS} polls`, 'error');
    updateTask(task.id, { status: 'error', statusText: 'Timeout', operations: currentOps, selected: false });
  };

  const processTask = async (task: Task, accountId: string): Promise<VideoOperation[] | null> => {
    setRunningTaskIds(prev => new Set(prev).add(task.id));
    updateTask(task.id, { status: 'queued', statusText: 'Waiting...', accountId });

    try {
      const isI2V = !!(task.startImage || task.endImage);
      const videoType = isI2V ? 'image-to-video' : 'text-to-video';
      log(`[Task #${task.order}] ${videoType === 'image-to-video' ? 'I2V' : 'T2V'} - ${task.prompt.substring(0, 40)}... (${accountId.slice(-8)})`, 'step');

      if (isI2V) {
        updateTask(task.id, { status: 'uploading', statusText: 'Uploading...' });
      } else {
        updateTask(task.id, { status: 'getting-token', statusText: 'Getting token...' });
      }

      const result = await invoke<{ success: boolean; operations?: VideoOperation[]; error?: string }>('generate_video', {
          accountId,
          request: {
            prompt: task.prompt,
            video_type: videoType,
            aspect_ratio: task.ratio === '9:16' ? 'portrait' : 'landscape',
            count: task.count,
            image_start: task.startImage,
            image_end: task.endImage,
          },
        });

      if (result.success && result.operations?.length) {
        const opCount = result.operations.length;
        log(`[Task #${task.order}] Sent ${opCount} requests → PENDING`, 'success');
        updateTask(task.id, { status: 'polling', statusText: `Processing ${opCount}...`, operations: result.operations });
        return result.operations;
      } else {
        log(`[Task #${task.order}] Error: ${result.error}`, 'error');
        updateTask(task.id, { status: 'error', statusText: result.error || 'Unknown error', error: result.error, selected: false });
        return null;
      }
    } catch (e: unknown) {
      log(`[Task #${task.order}] Error: ${e}`, 'error');
      updateTask(task.id, { status: 'error', statusText: String(e), error: String(e), selected: false });
      return null;
    } finally {
      setRunningTaskIds(prev => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  };

  const runTasks = async (tasksToRun: Task[]) => {
    if (selectedAccounts.length === 0) { log('Chọn ít nhất 1 account!', 'error'); return; }
    const runnableStatuses = ['pending', 'done', 'error'];
    const validTasks = tasksToRun.filter(t => runnableStatuses.includes(t.status) && t.prompt.trim());
    if (validTasks.length === 0) { log('Không có task hợp lệ!', 'error'); return; }
    
    validTasks.forEach(t => {
      updateTask(t.id, { status: 'pending', statusText: undefined, results: [], operations: undefined, error: undefined });
    });

    // Check GPM first
    log('🔍 Kiểm tra GPM-Login...', 'step');
    try {
      const gpmCheck = await invoke<{ success: boolean; message?: string }>('check_gpm');
      if (!gpmCheck.success) {
        log(`❌ GPM-Login chưa mở! Vui lòng mở GPM-Login trước.`, 'error');
        return;
      }
      log('✅ GPM-Login đang chạy', 'success');
    } catch (e) {
      log(`❌ Không thể kết nối GPM: ${e}`, 'error');
      return;
    }

    setIsRunning(true);
    stopFlag.current = false;
    const totalThreads = selectedAccounts.reduce((sum, a) => sum + a.threads, 0);
    log(`🚀 Chạy ${validTasks.length} tasks với ${selectedAccounts.length} accounts (${totalThreads} total threads)`, 'info');

    // Initialize sessions for all accounts FIRST
    log('🔧 Khởi tạo sessions...', 'step');
    const accountsWithSessions: string[] = [];
    for (const acc of selectedAccounts) {
      try {
        log(`🔧 Init session cho ${acc.id.slice(-8)}...`, 'step');
        await invoke('init_session', { accountId: acc.id });
        accountsWithSessions.push(acc.id);
        log(`✅ Session ready: ${acc.id.slice(-8)}`, 'success');
      } catch (e) {
        log(`❌ Init session failed for ${acc.id.slice(-8)}: ${e}`, 'error');
      }
    }

    if (accountsWithSessions.length === 0) {
      log('❌ Không có account nào init session thành công!', 'error');
      setIsRunning(false);
      return;
    }

    // Build thread pool: mỗi account có N threads
    const threadPool: { accountId: string; threadIdx: number }[] = [];
    for (const acc of selectedAccounts) {
      if (!accountsWithSessions.includes(acc.id)) continue;
      for (let i = 0; i < acc.threads; i++) {
        threadPool.push({ accountId: acc.id, threadIdx: i });
      }
    }

    log(`📋 Thread pool: ${threadPool.length} threads`, 'info');

    // Task queue
    const taskQueue = [...validTasks];
    const tasksWithOps: { task: Task; accountId: string; operations: VideoOperation[] }[] = [];

    // Worker function: lấy task từ queue, gửi API, trả về ngay (không đợi poll)
    const worker = async (accountId: string, threadIdx: number): Promise<void> => {
      while (taskQueue.length > 0 && !stopFlag.current) {
        const task = taskQueue.shift();
        if (!task) break;

        log(`[Thread ${accountId.slice(-8)}-${threadIdx}] Processing task #${task.order}`, 'step');
        const operations = await processTask(task, accountId);
        
        if (operations) {
          tasksWithOps.push({ task, accountId, operations });
        }

        // Small delay between tasks on same thread
        await new Promise(r => setTimeout(r, 300));
      }
    };

    // Start all workers in parallel
    const workerPromises = threadPool.map(({ accountId, threadIdx }) => 
      worker(accountId, threadIdx)
    );

    // Wait for all workers to finish sending requests
    await Promise.all(workerPromises);

    log(`✅ Đã gửi ${tasksWithOps.length} tasks, bắt đầu poll status...`, 'success');

    // Now poll all tasks in parallel
    const pollPromises = tasksWithOps.map(({ task, accountId, operations }) => 
      pollTaskStatus({ ...task, operations }, accountId)
    );

    await Promise.all(pollPromises);

    // Close all sessions after done
    log('🧹 Đóng sessions...', 'step');
    try {
      await invoke('close_all_sessions');
      log('✅ Sessions closed', 'success');
    } catch (e) {
      log(`⚠️ Close sessions error: ${e}`, 'error');
    }

    setIsRunning(false);
    if (stopFlag.current) {
      log('⏹️ Đã dừng!', 'info');
      stopFlag.current = false;
    } else {
      log('✅ Hoàn thành tất cả tasks!', 'success');
    }
  };

  const stopTasks = async () => {
    stopFlag.current = true;
    log('⏹️ Đang dừng...', 'info');
    try {
      await invoke('close_all_sessions');
    } catch {}
  };

  const runSelected = () => runTasks(tasks.filter(t => t.selected));
  const runAll = () => runTasks(tasks);

  const handlePreviewVideo = (url: string, taskOrder: number) => {
    setPreviewVideo({ url, taskOrder });
  };

  const allVideos = tasks.flatMap(t =>
    (t.results || []).map((url, i) => ({ url, taskOrder: t.order, index: i }))
  );

  const selectedCount = tasks.filter(t => t.selected).length;
  const runnableCount = tasks.filter(t => t.selected && ['pending', 'done', 'error'].includes(t.status)).length;
  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const totalThreads = selectedAccounts.reduce((sum, a) => sum + a.threads, 0);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-200 flex flex-col">
      <header className="sticky top-0 z-50 bg-[#0a0a0f]/95 backdrop-blur border-b border-gray-800 px-4 py-3 shrink-0">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent flex items-center gap-2">
            <span className="text-2xl">🎬</span> VEO3 Batch Tool
          </h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500">{tasks.length} tasks | {pendingCount} pending | {totalThreads} threads</span>
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 flex flex-col gap-4 overflow-hidden">
        <div className="shrink-0">
          <AccountSection selectedAccounts={selectedAccounts} onSelectAccounts={setSelectedAccounts} onLog={log} onAccountsLoaded={setAccountEmails} />
        </div>

        <div className="flex-1 flex gap-4 min-h-0">
          <div className="flex-[2] bg-[#12121a] rounded-xl border border-gray-800 overflow-hidden flex flex-col min-w-0">
            <TaskTable
              tasks={tasks}
              selectedCount={selectedCount}
              runnableCount={runnableCount}
              runningTaskIds={runningTaskIds}
              accountEmails={accountEmails}
              onAddTask={addTask}
              onShowBulkModal={() => setShowBulkModal(true)}
              onFillBulkImages={fillBulkImages}
              onUpdateTask={updateTask}
              onRemoveTask={removeTask}
              onResetTask={resetTask}
              onToggleAll={toggleAll}
              onDeleteSelected={deleteSelected}
              onRunSelected={runSelected}
              onRunAll={runAll}
              onStop={stopTasks}
              isRunning={isRunning}
              onPreviewVideo={handlePreviewVideo}
            />
          </div>

          <div className="flex-1 flex flex-col gap-4 min-w-[300px]">
            <div className="flex-1 bg-[#12121a] rounded-xl border border-gray-800 overflow-hidden flex flex-col min-h-[200px]">
              <div className="px-3 py-2 bg-[#1a1a2a] border-b border-gray-800 shrink-0">
                <span className="text-xs text-gray-400">🎬 Videos ({allVideos.length})</span>
              </div>
              <div className="flex-1 overflow-auto p-2">
                <VideoGallery videos={allVideos} onPreviewVideo={handlePreviewVideo} />
              </div>
            </div>

            <div className="flex-1 bg-[#12121a] rounded-xl border border-gray-800 overflow-hidden flex flex-col min-h-[200px]">
              <LogPanel logs={logs} onClear={() => setLogs([])} />
            </div>
          </div>
        </div>
      </div>

      {showBulkModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#12121a] rounded-xl w-full max-w-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-500/10">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <span>📝</span> Bulk Add Prompts
              </h3>
              <button
                onClick={() => { setShowBulkModal(false); setBulkText(''); }}
                className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-5">
              <textarea
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder="One prompt per line..."
                rows={12}
                className="w-full px-4 py-3 bg-[#1a1a2a] border border-gray-700 rounded-lg text-sm resize-none focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 placeholder-gray-600"
                autoFocus
              />
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-gray-500">
                  {bulkText.split('\n').filter(l => l.trim()).length} prompts
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowBulkModal(false); setBulkText(''); }}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addBulkTasks}
                    disabled={bulkText.split('\n').filter(l => l.trim()).length === 0}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                  >
                    Add {bulkText.split('\n').filter(l => l.trim()).length} tasks
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewVideo && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setPreviewVideo(null)}>
          <div className="bg-[#12121a] rounded-xl max-w-4xl w-full border border-gray-700 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-800">
              <span className="text-sm text-gray-300">🎬 Video - Task #{previewVideo.taskOrder}</span>
              <button onClick={() => setPreviewVideo(null)} className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white">
                ✕
              </button>
            </div>
            <div className="p-4">
              <video src={previewVideo.url} controls autoPlay className="w-full rounded-lg max-h-[70vh]" />
              <div className="mt-3 flex gap-2">
                <a href={previewVideo.url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-xs font-medium transition-colors">
                  🔗 Open
                </a>
                <a href={previewVideo.url} download={`video-task-${previewVideo.taskOrder}.mp4`} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-xs font-medium transition-colors">
                  ⬇️ Download
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
