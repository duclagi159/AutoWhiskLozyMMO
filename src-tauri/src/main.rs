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
    ref_images: Option<Vec<String>>,
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
        ref_images,
        existing_workflow_id,
    )
    .await;

    match result {
        Ok(val) => Ok(val),
        Err(e) => Err(e.to_string()),
    }
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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            generate_image,
            list_accounts,
            add_account,
            delete_account,
            choose_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
