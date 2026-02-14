// Prevent additional console window on Windows
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod accounts;
mod whisk;

use tauri_plugin_dialog::DialogExt;

#[tauri::command]
async fn generate_image(
    cookies: Option<String>,
    bearer_token: Option<String>,
    prompt: String,
    aspect_ratio: Option<String>,
    count: Option<u32>,
    save_folder: Option<String>,
    headers: Option<std::collections::HashMap<String, String>>,
    existing_workflow_id: Option<String>,
) -> Result<serde_json::Value, String> {
    println!(
        "[generate_image] aspect_ratio={:?}, count={:?}",
        aspect_ratio, count
    );
    let ratio = aspect_ratio.unwrap_or_else(|| "16:9".to_string());
    let cnt = count.unwrap_or(1);
    let c = cookies.unwrap_or_default();
    let t = bearer_token.unwrap_or_default();
    println!("[generate_image] resolved ratio={}, count={}", ratio, cnt);

    let result = whisk::generate_image_async(
        &c,
        &t,
        &prompt,
        &ratio,
        cnt,
        save_folder.as_deref(),
        headers.as_ref(),
        existing_workflow_id,
    )
    .await;

    match result {
        Ok(val) => Ok(val),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn upload_ref_images(
    cookies: String,
    ref_images: Vec<String>,
    existing_workflow_id: Option<String>,
) -> Result<serde_json::Value, String> {
    whisk::upload_ref_images_async(&cookies, ref_images, existing_workflow_id).await
}

#[tauri::command]
fn list_accounts() -> Result<serde_json::Value, String> {
    accounts::get_accounts().map_err(|e| e.to_string())
}

#[tauri::command]
fn add_account(
    email: String,
    cookies: String,
    bearer_token: Option<String>,
    headers: Option<std::collections::HashMap<String, String>>,
) -> Result<serde_json::Value, String> {
    accounts::add_account(&email, &cookies, bearer_token.as_deref(), headers.as_ref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_account(id: String) -> Result<bool, String> {
    accounts::delete_account(&id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn choose_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let folder = app
        .dialog()
        .file()
        .set_title("Chọn thư mục lưu ảnh")
        .blocking_pick_folder();

    match folder {
        Some(path) => Ok(Some(path.to_string())),
        None => Ok(None),
    }
}

#[tauri::command]
async fn check_update() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .user_agent("AutoWhisk")
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get("https://api.github.com/repos/duclagi159/AutoWhiskLozyMMO/releases/latest")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("GitHub API error: {}", resp.status()));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
async fn download_update(url: String, _app: tauri::AppHandle) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("AutoWhisk")
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("Download failed: {}", resp.status()));
    }

    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;

    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    let dir = exe_path.parent().ok_or("Cannot get exe dir")?;
    let save_path = dir.join("autowhisk_update.exe");

    std::fs::write(&save_path, &bytes).map_err(|e| e.to_string())?;

    Ok(save_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn delete_ref_image(cookies: String, media_names: Vec<String>) -> Result<bool, String> {
    whisk::delete_reference_image(&cookies, media_names).await
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            generate_image,
            upload_ref_images,
            list_accounts,
            add_account,
            delete_account,
            choose_folder,
            check_update,
            download_update,
            delete_ref_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
