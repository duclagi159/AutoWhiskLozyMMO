using System.Diagnostics;
using System.Net.Http;
using System.Text;
using System.Text.Json;

namespace LogicAutoWhisk
{
    /// <summary>
    /// Service chính xử lý gọi API Whisk/Veo để tạo video
    /// Thay thế mock invoke trong frontend
    /// </summary>
    public class WhiskService
    {
        private static readonly HttpClient _httpClient = new()
        {
            Timeout = TimeSpan.FromSeconds(120)
        };

        /// <summary>
        /// Gọi API tạo video
        /// TODO: Thay bằng API thật của Whisk/Veo
        /// </summary>
        public async Task<GenerateVideoResult> GenerateVideoAsync(GenerateVideoRequest request, Action<string>? onLog = null)
        {
            try
            {
                onLog?.Invoke($"[WhiskService] Bắt đầu tạo video: {request.Prompt[..Math.Min(40, request.Prompt.Length)]}...");
                onLog?.Invoke($"[WhiskService] Type: {request.VideoType} | Ratio: {request.Ratio} | Count: {request.Count}");

                // TODO: Thay bằng logic thật
                // Bước 1: Lấy token cho account
                // Bước 2: Upload ảnh nếu image-to-video
                // Bước 3: Gọi API tạo video
                // Bước 4: Return operations

                // ===== MOCK - Xóa khi có API thật =====
                await Task.Delay(1500);
                var operations = new List<VideoOperation>();
                for (int i = 0; i < request.Count; i++)
                {
                    operations.Add(new VideoOperation
                    {
                        OperationName = $"op-{Guid.NewGuid():N}",
                        SceneId = $"scene-{Guid.NewGuid():N}",
                        Status = "MEDIA_GENERATION_STATUS_PENDING"
                    });
                }

                onLog?.Invoke($"[WhiskService] Đã gửi {operations.Count} requests → PENDING");
                return new GenerateVideoResult
                {
                    Success = true,
                    Operations = operations
                };
                // ===== END MOCK =====
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[WhiskService] Error: {ex.Message}");
                return new GenerateVideoResult
                {
                    Success = false,
                    Error = ex.Message
                };
            }
        }

        /// <summary>
        /// Check trạng thái video đã tạo
        /// TODO: Thay bằng API thật
        /// </summary>
        public async Task<CheckStatusResult> CheckVideoStatusAsync(List<VideoOperation> operations, string accountId, Action<string>? onLog = null)
        {
            try
            {
                onLog?.Invoke($"[WhiskService] Checking {operations.Count} operations...");

                // TODO: Thay bằng logic thật
                // Gọi API check status cho từng operation
                // Return kết quả với media_url nếu done

                // ===== MOCK - Xóa khi có API thật =====
                await Task.Delay(1000);
                var updatedOps = operations.Select(op => new VideoOperation
                {
                    OperationName = op.OperationName,
                    SceneId = op.SceneId,
                    Status = "MEDIA_GENERATION_STATUS_SUCCEEDED",
                    MediaUrl = "https://www.w3schools.com/html/mov_bbb.mp4"
                }).ToList();

                return new CheckStatusResult
                {
                    Operations = updatedOps,
                    RemainingCredits = 100,
                    AllDone = true
                };
                // ===== END MOCK =====
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[WhiskService] CheckStatus Error: {ex.Message}");
                return new CheckStatusResult
                {
                    Operations = operations,
                    AllDone = false
                };
            }
        }

        /// <summary>
        /// Download video về máy
        /// </summary>
        public async Task<string?> DownloadVideoAsync(string mediaUrl, string savePath, Action<string>? onLog = null)
        {
            try
            {
                onLog?.Invoke($"[WhiskService] Downloading video...");
                var response = await _httpClient.GetAsync(mediaUrl);
                response.EnsureSuccessStatusCode();

                var bytes = await response.Content.ReadAsByteArrayAsync();
                await File.WriteAllBytesAsync(savePath, bytes);

                onLog?.Invoke($"[WhiskService] Saved: {savePath} ({bytes.Length / 1024} KB)");
                return savePath;
            }
            catch (Exception ex)
            {
                onLog?.Invoke($"[WhiskService] Download Error: {ex.Message}");
                return null;
            }
        }
    }
}
