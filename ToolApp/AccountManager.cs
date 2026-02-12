using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace ToolApp;

using System.Text.Json.Serialization;

public class Account
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [JsonPropertyName("email")]
    public string Email { get; set; } = "";

    [JsonPropertyName("credits")]
    public int Credits { get; set; }

    [JsonPropertyName("has_cookies")]
    public bool HasCookies { get; set; }

    [JsonPropertyName("expires_in")]
    public string? ExpiresIn { get; set; }

    [JsonPropertyName("is_expired")]
    public bool IsExpired { get; set; }

    // Internal use for backend
    [JsonIgnore]
    public string? CookieData { get; set; }

    [JsonIgnore]
    public DateTime LastUpdated { get; set; }
}

public static class AccountManager
{
    private static readonly string FilePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "accounts.json");
    private static List<Account> _accounts = new();

    static AccountManager()
    {
        LoadAccounts();
    }

    public static void LoadAccounts()
    {
        try
        {
            if (File.Exists(FilePath))
            {
                var json = File.ReadAllText(FilePath);
                _accounts = JsonSerializer.Deserialize<List<Account>>(json) ?? new List<Account>();
            }
        }
        catch { _accounts = new List<Account>(); }
    }

    public static void SaveAccounts()
    {
        try
        {
            var json = JsonSerializer.Serialize(_accounts, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(FilePath, json);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error saving accounts: {ex.Message}");
        }
    }

    public static List<Account> GetAccounts()
    {
        return _accounts;
    }

    public static Account? GetAccount(string id)
    {
        return _accounts.FirstOrDefault(a => a.Id == id);
    }

    public static void AddAccount(Account account)
    {
        var existing = _accounts.FirstOrDefault(a => a.Email.Equals(account.Email, StringComparison.OrdinalIgnoreCase));
        if (existing != null)
        {
            // Update existing?
            existing.Credits = account.Credits;
            existing.HasCookies = account.HasCookies;
            existing.IsExpired = account.IsExpired;
            existing.ExpiresIn = account.ExpiresIn;
            existing.CookieData = account.CookieData;
            existing.LastUpdated = DateTime.Now;
        }
        else
        {
            if (string.IsNullOrEmpty(account.Id)) account.Id = Guid.NewGuid().ToString();
            account.LastUpdated = DateTime.Now;
            _accounts.Add(account);
        }
        SaveAccounts();
    }

    public static bool DeleteAccount(string id)
    {
        var acc = GetAccount(id);
        if (acc != null)
        {
            _accounts.Remove(acc);
            SaveAccounts();
            return true;
        }
        return false;
    }
}
