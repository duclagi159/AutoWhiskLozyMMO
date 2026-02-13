use base64::Engine;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::Path;

mod whisk_session;
use whisk_session::*;

pub async fn generate_image_async(
    cookies: &str,
    bearer_token: &str,
    prompt: &str,
    aspect_ratio: &str,
    count: u32,
    save_folder: Option<&str>,
    extra_headers: Option<&HashMap<String, String>>,
    ref_images: Option<&[String]>,
) -> Result<Value, String> {
    let mut diag = String::new();

    let api_ratio = map_aspect_ratio(aspect_ratio);
    let session_id = whisk_session::session_id_now();

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .default_headers(whisk_session::default_headers())
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let mut token = bearer_token.to_string();
    if token.is_empty() || !token.starts_with("ya29.") {
        diag.push_str("[No bearer token, trying auto-fetch from session...] ");
        if !cookies.is_empty() {
            match fetch_bearer_token(cookies).await {
                Ok(Some(t)) => {
                    diag.push_str("[Auto-fetch bearer OK] ");
                    token = t;
                }
                Ok(None) => {
                    diag.push_str("[Auto-fetch: no token in response] ");
                }
                Err(e) => {
                    diag.push_str(&format!("[Auto-fetch error: {}] ", e));
                }
            }
        }
    }

    if token.is_empty() || !token.starts_with("ya29.") {
        return Ok(json!({
            "success": false,
            "error": format!("❌ Không có Bearer token hợp lệ. {}", diag)
        }));
    }

    let token_end = &token[token.len().saturating_sub(6)..];
    diag.push_str(&format!("[Token: ya29...{}, {} chars] ", token_end, token.len()));

    let mut workflow_id = uuid::Uuid::new_v4().to_string();
    if !cookies.is_empty() {
        diag.push_str("[Workflow creating...] ");
        if let Some(wf_id) = create_workflow(&client, cookies, &session_id).await {
            diag.push_str(&format!("[Workflow OK: {}...] ", &wf_id[..8.min(wf_id.len())]));
            workflow_id = wf_id;
        } else {
            diag.push_str("[Workflow failed, using fallback] ");
        }
    }

    if let Some(refs) = ref_images {
        for ref_path in refs {
            if !ref_path.is_empty() && Path::new(ref_path).exists() {
                match upload_reference_image(&client, cookies, ref_path, &workflow_id, &session_id).await {
                    Ok(true) => diag.push_str("[Ref image uploaded] "),
                    Ok(false) => diag.push_str("[Ref image upload failed] "),
                    Err(e) => diag.push_str(&format!("[Ref upload error: {}] ", e)),
                }
            }
        }
    }

    let seed_base: u32 = {
        use rand::Rng;
        rand::thread_rng().gen_range(100000..999999u32)
    };

    diag.push_str(&format!("[API start: ratio={}, count={}] ", api_ratio, count));

    let mut tasks = Vec::new();
    for i in 0..count {
        let seed = seed_base + i;
        let client = client.clone();
        let token = token.clone();
        let prompt = prompt.to_string();
        let ratio = api_ratio.to_string();
        let wf_id = workflow_id.clone();
        let sess_id = session_id.clone();
        let hdrs = extra_headers.cloned();

        tasks.push(tokio::spawn(async move {
            call_generate_api(
                &client, &token, &prompt, &ratio,
                seed, &wf_id, &sess_id, hdrs.as_ref(),
            ).await
        }));
    }

    let results = futures::future::join_all(tasks).await;

    let mut images = Vec::new();
    let engine = base64::engine::general_purpose::STANDARD;

    for (idx, result) in results.into_iter().enumerate() {
        let img_result = match result {
            Ok(Ok(Some(b64))) => Some(b64),
            Ok(Ok(None)) => None,
            Ok(Err(e)) => {
                if images.is_empty() {
                    diag.push_str(&format!("[Error #{}: {}] ", idx + 1, e));
                }
                None
            }
            Err(e) => {
                diag.push_str(&format!("[Task error #{}: {}] ", idx + 1, e));
                None
            }
        };

        if let Some(b64) = img_result {
            let mut saved_path: Option<String> = None;
            let encoded_image = format!("data:image/jpeg;base64,{}", b64);

            if let Some(folder) = save_folder {
                if let Ok(bytes) = engine.decode(&b64) {
                    let _ = std::fs::create_dir_all(folder);
                    let now = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs();
                    let file_name = format!("whisk_{}_{}.png", now, idx + 1);
                    let path = Path::new(folder).join(&file_name);

                    if let Ok(img) = image::load_from_memory(&bytes) {
                        let _ = img.save_with_format(&path, image::ImageFormat::Png);
                        saved_path = Some(path.to_string_lossy().to_string());
                    } else if std::fs::write(&path, &bytes).is_ok() {
                        saved_path = Some(path.to_string_lossy().to_string());
                    }
                }
            }

            images.push(json!({
                "savedPath": saved_path,
                "encodedImage": saved_path.as_deref().unwrap_or(&encoded_image)
            }));
        }
    }

    diag.push_str("[API done] ");

    if images.is_empty() {
        return Ok(json!({
            "success": false,
            "error": format!("No images generated | {}", diag)
        }));
    }

    Ok(json!({
        "success": true,
        "images": images,
        "projectLink": format!("https://labs.google/fx/tools/whisk/project/{}", workflow_id),
        "diagInfo": diag
    }))
}
