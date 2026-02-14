using System.Text.Json.Serialization;

namespace PromptToolCSharp.Models;

public class HistoryEntry
{
    [JsonPropertyName("time")]
    public string Time { get; set; } = "";

    [JsonPropertyName("tab")]
    public string Tab { get; set; } = "";

    [JsonPropertyName("input")]
    public string Input { get; set; } = "";

    [JsonPropertyName("output")]
    public List<string> Output { get; set; } = new();

    [JsonPropertyName("output_count")]
    public int OutputCount { get; set; }
}
