using System.Text.Json.Serialization;

namespace LogicAutoWhisk
{
    /// <summary>
    /// Request gửi từ frontend để tạo video
    /// </summary>
    public class GenerateVideoRequest
    {
        [JsonPropertyName("account_id")]
        public string AccountId { get; set; } = "";

        [JsonPropertyName("prompt")]
        public string Prompt { get; set; } = "";

        [JsonPropertyName("video_type")]
        public string VideoType { get; set; } = "text-to-video"; // "text-to-video" | "image-to-video"

        [JsonPropertyName("ratio")]
        public string Ratio { get; set; } = "16:9";

        [JsonPropertyName("count")]
        public int Count { get; set; } = 2;

        [JsonPropertyName("start_image")]
        public string? StartImage { get; set; }

        [JsonPropertyName("end_image")]
        public string? EndImage { get; set; }
    }

    /// <summary>
    /// Kết quả trả về khi tạo video
    /// </summary>
    public class GenerateVideoResult
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }

        [JsonPropertyName("operations")]
        public List<VideoOperation> Operations { get; set; } = new();

        [JsonPropertyName("error")]
        public string? Error { get; set; }
    }

    /// <summary>
    /// Thông tin một operation (1 lần tạo video)
    /// </summary>
    public class VideoOperation
    {
        [JsonPropertyName("operation_name")]
        public string OperationName { get; set; } = "";

        [JsonPropertyName("scene_id")]
        public string SceneId { get; set; } = "";

        [JsonPropertyName("status")]
        public string Status { get; set; } = "PENDING";

        [JsonPropertyName("media_url")]
        public string? MediaUrl { get; set; }
    }

    /// <summary>
    /// Kết quả khi check status video
    /// </summary>
    public class CheckStatusResult
    {
        [JsonPropertyName("operations")]
        public List<VideoOperation> Operations { get; set; } = new();

        [JsonPropertyName("remaining_credits")]
        public int RemainingCredits { get; set; }

        [JsonPropertyName("all_done")]
        public bool AllDone { get; set; }
    }

    /// <summary>
    /// Task info gửi từ frontend
    /// </summary>
    public class WhiskTask
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";

        [JsonPropertyName("order")]
        public int Order { get; set; }

        [JsonPropertyName("prompt")]
        public string Prompt { get; set; } = "";

        [JsonPropertyName("type")]
        public string Type { get; set; } = "text-to-video";

        [JsonPropertyName("ratio")]
        public string Ratio { get; set; } = "16:9";

        [JsonPropertyName("count")]
        public int Count { get; set; } = 2;

        [JsonPropertyName("start_image")]
        public string? StartImage { get; set; }

        [JsonPropertyName("end_image")]
        public string? EndImage { get; set; }

        [JsonPropertyName("account_id")]
        public string? AccountId { get; set; }
    }
}
