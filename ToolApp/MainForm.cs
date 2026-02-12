using System;
using System.Drawing;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.WinForms;
using Microsoft.Web.WebView2.Core;

namespace ToolApp;

public class MainForm : Form
{
    private WebView2 webView;

    public MainForm()
    {
        // Window setup
        this.Text = "Tech & AI - Lozy MMO";
        this.Width = 1400;
        this.Height = 900;
        this.StartPosition = FormStartPosition.CenterScreen;
        this.BackColor = Color.FromArgb(9, 9, 11); // Zinc 950
        this.MinimumSize = new Size(1000, 600);

        // WebView2 setup
        webView = new WebView2();
        webView.Dock = DockStyle.Fill;
        this.Controls.Add(webView);

        this.Load += MainForm_Load;
    }

    private async void MainForm_Load(object? sender, EventArgs e)
    {
        try
        {
            // Initialize WebView2
            var env = await CoreWebView2Environment.CreateAsync(
                null,
                Path.Combine(Path.GetTempPath(), "TechAI_WebView2")
            );
            await webView.EnsureCoreWebView2Async(env);

            // Subscribe to web messages
            webView.WebMessageReceived += WebView_WebMessageReceived;

            // Configure WebView2 settings
            webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            webView.CoreWebView2.Settings.IsZoomControlEnabled = false;
            webView.CoreWebView2.Settings.AreBrowserAcceleratorKeysEnabled = false;

            // Set dark background to prevent white flash
            webView.DefaultBackgroundColor = Color.FromArgb(9, 9, 11);

            // Load the React app from local wwwroot folder
            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            string wwwrootPath = Path.Combine(appDir, "wwwroot");
            string indexPath = Path.Combine(wwwrootPath, "index.html");

            if (File.Exists(indexPath))
            {
                // Virtual host mapping allows proper loading of CSS/JS assets
                webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "techai.local",
                    wwwrootPath,
                    CoreWebView2HostResourceAccessKind.Allow
                );

                webView.CoreWebView2.Navigate("https://techai.local/index.html");
            }
            else
            {
                webView.CoreWebView2.NavigateToString($@"
                    <html>
                    <body style='background:#09090b;color:#e4e4e7;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0'>
                        <div style='text-align:center'>
                            <h1>UI files not found</h1>
                            <p>wwwroot folder is missing at:<br/><code>{wwwrootPath}</code></p>
                        </div>
                    </body>
                    </html>");
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Failed to initialize WebView2:\n{ex.Message}\n\nPlease ensure Microsoft Edge WebView2 Runtime is installed.",
                "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private async void WebView_WebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            var json = e.WebMessageAsJson;
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("type", out var typeProp))
            {
                var type = typeProp.GetString();
                if (type == "check_update")
                {
                    await HandleCheckUpdate();
                }
                else if (type == "start_update")
                {
                    await HandleStartUpdate();
                }
                else if (type == "list_accounts")
                {
                    HandleListAccounts();
                }
                else if (type == "add_account")
                {
                    HandleAddAccount();
                }
                else if (type == "delete_account")
                {
                    if (doc.RootElement.TryGetProperty("id", out var idProp))
                    {
                        HandleDeleteAccount(idProp.GetString() ?? "");
                    }
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error handling web message: {ex.Message}");
        }
    }

    private void HandleListAccounts()
    {
        var accounts = AccountManager.GetAccounts();
        SendEvent("accounts_list", accounts);
    }

    private void HandleAddAccount()
    {
        // Mock add account logic for now
        var newAcc = new Account
        {
            Email = $"demo_{DateTime.Now.Ticks % 1000}@gmail.com",
            Credits = 100,
            HasCookies = true,
            IsExpired = false,
            ExpiresIn = "30 days"
        };
        AccountManager.AddAccount(newAcc);
        SendEvent("account_added", newAcc);
        HandleListAccounts(); // Refresh list
    }

    private void HandleDeleteAccount(string id)
    {
        if (AccountManager.DeleteAccount(id))
        {
            HandleListAccounts(); // Refresh list
        }
    }

    private async Task HandleCheckUpdate()
    {
        SendEvent("update_status", new { status = "checking" });
        try
        {
            var info = await UpdateManager.CheckForUpdateAsync();
            if (info.Available)
            {
                SendEvent("update_status", new
                {
                    status = "available",
                    version = info.RemoteVersion,
                    releaseNotes = info.Body
                });
            }
            else
            {
                SendEvent("update_status", new
                {
                    status = "uptodate",
                    version = info.CurrentVersion
                });
            }
        }
        catch (Exception ex)
        {
            SendEvent("update_status", new { status = "error", message = ex.Message });
        }
    }

    private async Task HandleStartUpdate()
    {
        SendEvent("update_status", new { status = "downloading", progress = 0, message = "Starting download..." });
        try
        {
            await UpdateManager.PerformUpdateAsync((msg) =>
            {
                if (msg.StartsWith("Downloading:"))
                {
                    // Parse percentage: "Downloading: 45% (675 KB / 1500 KB)"
                    var parts = msg.Split('%');
                    if (parts.Length > 0)
                    {
                        var numStr = parts[0].Replace("Downloading:", "").Trim();
                        if (int.TryParse(numStr, out var pct))
                        {
                            SendEvent("update_status", new { status = "downloading", progress = pct, message = msg });
                            return;
                        }
                    }
                    SendEvent("update_status", new { status = "downloading", message = msg });
                }
                else if (msg.Contains("Download complete", StringComparison.OrdinalIgnoreCase))
                    SendEvent("update_status", new { status = "downloading", progress = 100, message = msg });
                else if (msg.Contains("Extracting", StringComparison.OrdinalIgnoreCase))
                    SendEvent("update_status", new { status = "installing", message = msg });
                else if (msg.Contains("Restarting", StringComparison.OrdinalIgnoreCase))
                    SendEvent("update_status", new { status = "restarting", message = msg });
                else if (msg.Contains("Error", StringComparison.OrdinalIgnoreCase))
                    SendEvent("update_status", new { status = "error", message = msg });
                else if (msg.Contains("Downloading", StringComparison.OrdinalIgnoreCase))
                    SendEvent("update_status", new { status = "downloading", message = msg });
            });
        }
        catch (Exception ex)
        {
            SendEvent("update_status", new { status = "error", message = ex.Message });
        }
    }

    private void SendEvent(string type, object data)
    {
        if (webView != null && webView.CoreWebView2 != null)
        {
            var payload = new { type, data };
            var json = System.Text.Json.JsonSerializer.Serialize(payload);
            webView.CoreWebView2.PostWebMessageAsJson(json);
        }
    }
}
