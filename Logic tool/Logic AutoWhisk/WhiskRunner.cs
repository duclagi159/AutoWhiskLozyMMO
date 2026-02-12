using System.Diagnostics;
using System.Text.Json;

namespace LogicAutoWhisk
{
    /// <summary>
    /// Runner xử lý hàng đợi task AutoWhisk
    /// Quản lý việc chạy nhiều task song song theo threads
    /// </summary>
    public class WhiskRunner
    {
        private readonly WhiskService _whiskService;
        private bool _stopRequested = false;
        private bool _isRunning = false;

        // Event để gửi log/status về MainForm → frontend  
        public event Action<string, string>? OnLog; // (message, type: info/success/error/step)
        public event Action<string, string, object?>? OnTaskUpdate; // (taskId, status, data)

        public bool IsRunning => _isRunning;

        public WhiskRunner()
        {
            _whiskService = new WhiskService();
        }

        /// <summary>
        /// Chạy danh sách tasks với các accounts đã chọn
        /// </summary>
        public async Task RunTasksAsync(List<WhiskTask> tasks, List<string> accountIds, int threadsPerAccount = 3)
        {
            if (_isRunning)
            {
                OnLog?.Invoke("Runner đang chạy!", "error");
                return;
            }

            if (accountIds.Count == 0)
            {
                OnLog?.Invoke("Chọn ít nhất 1 account!", "error");
                return;
            }

            var validTasks = tasks.Where(t => !string.IsNullOrWhiteSpace(t.Prompt)).ToList();
            if (validTasks.Count == 0)
            {
                OnLog?.Invoke("Không có task hợp lệ!", "error");
                return;
            }

            _isRunning = true;
            _stopRequested = false;
            OnLog?.Invoke($"🚀 Bắt đầu chạy {validTasks.Count} tasks với {accountIds.Count} accounts ({threadsPerAccount} threads/account)", "info");

            try
            {
                // Tạo queue tasks
                var taskQueue = new Queue<WhiskTask>(validTasks);
                var semaphore = new SemaphoreSlim(accountIds.Count * threadsPerAccount);
                var runningTasks = new List<Task>();

                while (taskQueue.Count > 0 && !_stopRequested)
                {
                    await semaphore.WaitAsync();
                    if (_stopRequested) break;

                    var whiskTask = taskQueue.Dequeue();
                    var accountId = accountIds[runningTasks.Count % accountIds.Count];

                    var task = ProcessSingleTaskAsync(whiskTask, accountId, semaphore);
                    runningTasks.Add(task);
                }

                // Đợi tất cả tasks hoàn thành
                await Task.WhenAll(runningTasks);
            }
            catch (Exception ex)
            {
                OnLog?.Invoke($"Runner Error: {ex.Message}", "error");
            }
            finally
            {
                _isRunning = false;
                OnLog?.Invoke("✅ Runner hoàn thành", "success");
            }
        }

        /// <summary>
        /// Xử lý 1 task
        /// </summary>
        private async Task ProcessSingleTaskAsync(WhiskTask task, string accountId, SemaphoreSlim semaphore)
        {
            try
            {
                OnTaskUpdate?.Invoke(task.Id, "queued", new { statusText = "Đang chờ...", accountId });
                OnLog?.Invoke($"[Task #{task.Order}] Bắt đầu - {task.Prompt[..Math.Min(40, task.Prompt.Length)]}...", "step");

                // Bước 1: Tạo video
                OnTaskUpdate?.Invoke(task.Id, "generating", new { statusText = "Đang tạo video..." });

                var request = new GenerateVideoRequest
                {
                    AccountId = accountId,
                    Prompt = task.Prompt,
                    VideoType = task.Type,
                    Ratio = task.Ratio,
                    Count = task.Count,
                    StartImage = task.StartImage,
                    EndImage = task.EndImage
                };

                var result = await _whiskService.GenerateVideoAsync(request, msg => OnLog?.Invoke(msg, "step"));

                if (!result.Success || result.Operations.Count == 0)
                {
                    OnTaskUpdate?.Invoke(task.Id, "error", new { statusText = result.Error ?? "Lỗi không xác định", error = result.Error });
                    OnLog?.Invoke($"[Task #{task.Order}] ❌ Lỗi: {result.Error}", "error");
                    return;
                }

                // Bước 2: Polling chờ video hoàn thành
                OnTaskUpdate?.Invoke(task.Id, "polling", new { statusText = $"Đang xử lý {result.Operations.Count} videos...", operations = result.Operations });

                var statusResult = await PollUntilDoneAsync(task, result.Operations, accountId);

                if (statusResult != null && statusResult.AllDone)
                {
                    var mediaUrls = statusResult.Operations
                        .Where(op => !string.IsNullOrEmpty(op.MediaUrl))
                        .Select(op => op.MediaUrl!)
                        .ToList();

                    OnTaskUpdate?.Invoke(task.Id, "done", new { statusText = $"Hoàn thành {mediaUrls.Count} videos", results = mediaUrls, operations = statusResult.Operations });
                    OnLog?.Invoke($"[Task #{task.Order}] ✅ Hoàn thành - {mediaUrls.Count} videos", "success");
                }
                else
                {
                    OnTaskUpdate?.Invoke(task.Id, "error", new { statusText = "Timeout hoặc lỗi khi polling" });
                    OnLog?.Invoke($"[Task #{task.Order}] ❌ Timeout polling", "error");
                }
            }
            catch (Exception ex)
            {
                OnTaskUpdate?.Invoke(task.Id, "error", new { statusText = ex.Message, error = ex.Message });
                OnLog?.Invoke($"[Task #{task.Order}] ❌ Error: {ex.Message}", "error");
            }
            finally
            {
                semaphore.Release();
            }
        }

        /// <summary>
        /// Polling chờ video xong
        /// </summary>
        private async Task<CheckStatusResult?> PollUntilDoneAsync(WhiskTask task, List<VideoOperation> operations, string accountId)
        {
            const int POLL_INTERVAL_MS = 5000;
            const int MAX_POLLS = 120; // 10 phút max

            for (int i = 1; i <= MAX_POLLS; i++)
            {
                if (_stopRequested)
                {
                    OnLog?.Invoke($"[Task #{task.Order}] ⏹ Dừng bởi user", "info");
                    OnTaskUpdate?.Invoke(task.Id, "error", new { statusText = "Đã dừng" });
                    return null;
                }

                await Task.Delay(POLL_INTERVAL_MS);
                OnLog?.Invoke($"[Task #{task.Order}] Polling ({i}/{MAX_POLLS})...", "step");

                var result = await _whiskService.CheckVideoStatusAsync(operations, accountId, msg => OnLog?.Invoke(msg, "step"));

                if (result.AllDone)
                {
                    return result;
                }

                // Cập nhật operations mới nhất
                operations = result.Operations;
                OnTaskUpdate?.Invoke(task.Id, "polling", new { statusText = $"Polling {i}/{MAX_POLLS}...", operations = result.Operations });
            }

            return null;
        }

        /// <summary>
        /// Dừng tất cả tasks
        /// </summary>
        public void Stop()
        {
            _stopRequested = true;
            OnLog?.Invoke("⏹ Đang dừng...", "info");
        }
    }
}
