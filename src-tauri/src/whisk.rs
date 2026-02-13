use base64::Engine;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::Path;

const GENERATE_URL: &str = "https://aisandbox-pa.googleapis.com/v1/whisk:generateImage";
const WORKFLOW_URL: &str = "https://labs.google/fx/api/trpc/media.createOrUpdateWorkflow";
const SESSION_URL: &str = "https://labs.google/fx/api/auth/session";
const UPLOAD_URL: &str = "https://labs.google/fx/api/trpc/backbone.uploadImage";

fn default_headers() -> HeaderMap {
    let mut h = HeaderMap::new();
    h.insert("User-Agent", HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"));
    h.insert("Accept", HeaderValue::from_static("*/*"));
    h.insert("Accept-Language", HeaderValue::from_static("vi,en;q=0.9"));
    h.insert("Origin", HeaderValue::from_static("https://labs.google"));
    h.insert("Referer", HeaderValue::from_static("https://labs.google/"));
    h.insert(
        "sec-ch-ua",
        HeaderValue::from_static(
            "\"Google Chrome\";v=\"143\", \"Chromium\";v=\"143\", \"Not A(Brand\";v=\"24\"",
        ),
    );
    h.insert("sec-ch-ua-mobile", HeaderValue::from_static("?0"));
    h.insert(
        "sec-ch-ua-platform",
        HeaderValue::from_static("\"Windows\""),
    );
    h.insert("sec-fetch-dest", HeaderValue::from_static("empty"));
    h.insert("sec-fetch-mode", HeaderValue::from_static("cors"));
    h.insert("sec-fetch-site", HeaderValue::from_static("cross-site"));
    h.insert("x-browser-channel", HeaderValue::from_static("stable"));
    h.insert(
        "x-browser-copyright",
        HeaderValue::from_static("Copyright 2025 Google LLC. All Rights reserved."),
    );
    h.insert("x-browser-year", HeaderValue::from_static("2025"));
    h
}

fn session_id_now() -> String {
    let ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!(";{}", ms)
}

fn date_now_short() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let days = secs / 86400;
    let years = 1970 + days / 365;
    let day_of_year = days % 365;
    let month = day_of_year / 30 + 1;
    let day = day_of_year % 30 + 1;
    format!("{}/{}/{}", month, day, years % 100)
}

fn build_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .default_headers(default_headers())
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))
}

async fn fetch_bearer_token(cookies: &str) -> Result<Option<String>, String> {
    let client = build_client()?;
    let resp = client
        .get(SESSION_URL)
        .header("Cookie", cookies)
        .header("Content-Type", "application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Ok(None);
    }

    let data: Value = resp.json().await.map_err(|e| e.to_string())?;

    let token = data
        .get("accessToken")
        .and_then(|v| v.as_str())
        .or_else(|| data.get("access_token").and_then(|v| v.as_str()))
        .or_else(|| data.get("token").and_then(|v| v.as_str()))
        .or_else(|| {
            data.get("user")
                .and_then(|u| u.get("accessToken").and_then(|v| v.as_str()))
        })
        .or_else(|| {
            data.get("user")
                .and_then(|u| u.get("access_token").and_then(|v| v.as_str()))
        });

    Ok(token.map(|s| s.to_string()))
}

async fn create_workflow(
    client: &reqwest::Client,
    cookies: &str,
    session_id: &str,
) -> Option<String> {
    let body = json!({
        "json": {
            "clientContext": {
                "tool": "BACKBONE",
                "sessionId": session_id
            },
            "mediaGenerationIdsToCopy": [],
            "workflowMetadata": {
                "workflowName": format!("Whisk: {}", date_now_short())
            }
        }
    });

    let resp = client
        .post(WORKFLOW_URL)
        .header("Cookie", cookies)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .ok()?;

    if !resp.status().is_success() {
        return None;
    }

    let data: Value = resp.json().await.ok()?;
    data.get("result")?
        .get("data")?
        .get("json")?
        .get("result")?
        .get("workflowId")?
        .as_str()
        .map(|s| s.to_string())
}

async fn upload_reference_image(
    client: &reqwest::Client,
    cookies: &str,
    image_data: &[u8],
    mime: &str,
    workflow_id: &str,
    session_id: &str,
) -> Result<bool, String> {
    let engine = base64::engine::general_purpose::STANDARD;
    let b64 = engine.encode(image_data);
    let raw_bytes = format!("data:{};base64,{}", mime, b64);

    let body = json!({
        "json": {
            "clientContext": {
                "workflowId": workflow_id,
                "sessionId": session_id
            },
            "uploadMediaInput": {
                "mediaCategory": "MEDIA_CATEGORY_SUBJECT",
                "rawBytes": raw_bytes,
                "caption": "Reference image for Whisk"
            }
        }
    });

    let resp = client
        .post(UPLOAD_URL)
        .header("Cookie", cookies)
        .header("Content-Type", "application/json")
        .header(
            "Referer",
            format!("https://labs.google/fx/tools/whisk/project/{}", workflow_id),
        )
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    Ok(resp.status().is_success())
}

async fn call_generate_api(
    client: &reqwest::Client,
    token: &str,
    prompt: &str,
    aspect_ratio: &str,
    seed: u32,
    workflow_id: &str,
    session_id: &str,
    extra_headers: Option<&HashMap<String, String>>,
) -> Result<Option<String>, String> {
    let body = json!({
        "clientContext": {
            "workflowId": workflow_id,
            "tool": "BACKBONE",
            "sessionId": session_id
        },
        "imageModelSettings": {
            "imageModel": "IMAGEN_3_5",
            "aspectRatio": aspect_ratio
        },
        "seed": seed,
        "prompt": prompt,
        "mediaCategory": "MEDIA_CATEGORY_BOARD"
    });

    let body_str = serde_json::to_string(&body).map_err(|e| e.to_string())?;

    let mut headers = HeaderMap::new();
    let token_clean = token.strip_prefix("Bearer ").unwrap_or(token);
    headers.insert(
        "Authorization",
        HeaderValue::from_str(&format!("Bearer {}", token_clean)).map_err(|e| e.to_string())?,
    );
    headers.insert(
        "Content-Type",
        HeaderValue::from_static("text/plain;charset=UTF-8"),
    );
    headers.insert("Accept", HeaderValue::from_static("*/*"));
    headers.insert("Accept-Language", HeaderValue::from_static("vi,en;q=0.9"));
    headers.insert("Referer", HeaderValue::from_static("https://labs.google/"));
    headers.insert("Priority", HeaderValue::from_static("u=1, i"));
    headers.insert(
        "sec-ch-ua",
        HeaderValue::from_static(
            "\"Google Chrome\";v=\"143\", \"Chromium\";v=\"143\", \"Not A(Brand\";v=\"24\"",
        ),
    );
    headers.insert("sec-ch-ua-mobile", HeaderValue::from_static("?0"));
    headers.insert(
        "sec-ch-ua-platform",
        HeaderValue::from_static("\"Windows\""),
    );
    headers.insert("sec-fetch-dest", HeaderValue::from_static("empty"));
    headers.insert("sec-fetch-mode", HeaderValue::from_static("cors"));
    headers.insert("sec-fetch-site", HeaderValue::from_static("cross-site"));
    headers.insert(
        "X-Browser-Validation",
        HeaderValue::from_static("UujAs0GAwdnCJ9nvrswZ+O+oco0="),
    );
    headers.insert(
        "X-Client-Data",
        HeaderValue::from_static("CJC2yQEIpbbJAQipncoBCLHhygEIk6HLAQiFoM0BCJGkzwEY86LPAQ=="),
    );

    if let Some(extra) = extra_headers {
        for (key, value) in extra {
            if let (Ok(name), Ok(val)) = (
                HeaderName::from_bytes(key.as_bytes()),
                HeaderValue::from_str(value),
            ) {
                headers.insert(name, val);
            }
        }
    } else {
        headers.insert("x-browser-channel", HeaderValue::from_static("stable"));
        headers.insert(
            "x-browser-copyright",
            HeaderValue::from_static("Copyright 2025 Google LLC. All Rights reserved."),
        );
        headers.insert("x-browser-year", HeaderValue::from_static("2025"));
    }

    let resp = client
        .post(GENERATE_URL)
        .headers(headers)
        .body(body_str)
        .send()
        .await
        .map_err(|e| format!("HTTP error: {}", e))?;

    let status = resp.status();
    let body_text = resp
        .text()
        .await
        .map_err(|e| format!("Read error: {}", e))?;

    if !status.is_success() {
        let preview: String = body_text.chars().take(300).collect();
        return Err(format!("HTTP {}: {}", status.as_u16(), preview));
    }

    let data: Value = serde_json::from_str(&body_text).map_err(|e| format!("JSON parse: {}", e))?;

    if let Some(b64) = extract_encoded_image(&data) {
        return Ok(Some(b64));
    }
    if let Some(b64) = find_base64_deep(&data) {
        return Ok(Some(b64));
    }

    let preview: String = body_text.chars().take(200).collect();
    Err(format!("No image in response: {}", preview))
}

fn extract_encoded_image(data: &Value) -> Option<String> {
    if let Some(panels) = data.get("imagePanels").and_then(|p| p.as_array()) {
        for panel in panels {
            if let Some(images) = panel.get("generatedImages").and_then(|i| i.as_array()) {
                for img in images {
                    if let Some(encoded) = img.get("encodedImage").and_then(|e| e.as_str()) {
                        if !encoded.is_empty() {
                            return Some(encoded.to_string());
                        }
                    }
                }
            }
            if let Some(encoded) = panel
                .get("generatedImage")
                .and_then(|g| g.get("encodedImage"))
                .and_then(|e| e.as_str())
            {
                if !encoded.is_empty() {
                    return Some(encoded.to_string());
                }
            }
        }
    }

    if let Some(encoded) = data.get("encodedImage").and_then(|e| e.as_str()) {
        if !encoded.is_empty() {
            return Some(encoded.to_string());
        }
    }

    None
}

fn find_base64_deep(value: &Value) -> Option<String> {
    match value {
        Value::String(s) if s.len() > 1000 => Some(s.clone()),
        Value::Object(map) => {
            for (_, v) in map {
                if let Some(result) = find_base64_deep(v) {
                    return Some(result);
                }
            }
            None
        }
        Value::Array(arr) => {
            for v in arr {
                if let Some(result) = find_base64_deep(v) {
                    return Some(result);
                }
            }
            None
        }
        _ => None,
    }
}

fn map_aspect_ratio(ratio: &str) -> &str {
    match ratio {
        "16:9" => "IMAGE_ASPECT_RATIO_LANDSCAPE",
        "9:16" => "IMAGE_ASPECT_RATIO_PORTRAIT",
        "1:1" => "IMAGE_ASPECT_RATIO_SQUARE",
        _ => "IMAGE_ASPECT_RATIO_LANDSCAPE",
    }
}

pub async fn generate_image_async(
    cookies: &str,
    bearer_token: &str,
    prompt: &str,
    aspect_ratio: &str,
    count: u32,
    save_folder: Option<&str>,
    extra_headers: Option<&HashMap<String, String>>,
    ref_images: Option<Vec<String>>,
) -> Result<Value, String> {
    let mut diag = String::new();

    let api_ratio = map_aspect_ratio(aspect_ratio);
    let session_id = session_id_now();
    let client = build_client()?;

    let mut token = bearer_token.to_string();
    if token.is_empty() || !token.starts_with("ya29.") {
        diag.push_str("[No bearer token, trying auto-fetch...] ");
        if !cookies.is_empty() {
            match fetch_bearer_token(cookies).await {
                Ok(Some(t)) => {
                    diag.push_str("[Auto-fetch bearer OK] ");
                    token = t;
                }
                Ok(None) => diag.push_str("[Auto-fetch: no token] "),
                Err(e) => diag.push_str(&format!("[Auto-fetch error: {}] ", e)),
            }
        }
    }

    if token.is_empty() || !token.starts_with("ya29.") {
        return Ok(json!({
            "success": false,
            "error": format!("❌ Không có Bearer token hợp lệ. Hãy tạo 1 ảnh trên Whisk web trước rồi bắt lại cookie. {}", diag)
        }));
    }

    let token_end = &token[token.len().saturating_sub(6)..];
    diag.push_str(&format!(
        "[Token: ya29...{}, {} chars] ",
        token_end,
        token.len()
    ));

    let mut workflow_id = uuid::Uuid::new_v4().to_string();
    if !cookies.is_empty() {
        diag.push_str("[Workflow creating...] ");
        if let Some(wf_id) = create_workflow(&client, cookies, &session_id).await {
            diag.push_str(&format!(
                "[Workflow OK: {}...] ",
                &wf_id[..8.min(wf_id.len())]
            ));
            workflow_id = wf_id;
        } else {
            diag.push_str("[Workflow failed, using fallback] ");
        }
    }

    if let Some(refs) = &ref_images {
        for ref_url in refs {
            if ref_url.starts_with("data:") {
                if let Some(pos) = ref_url.find(",") {
                    let header = &ref_url[..pos];
                    let b64_data = &ref_url[pos + 1..];
                    let mime = header.replace("data:", "").replace(";base64", "");
                    let engine = base64::engine::general_purpose::STANDARD;
                    if let Ok(bytes) = engine.decode(b64_data) {
                        match upload_reference_image(
                            &client,
                            cookies,
                            &bytes,
                            &mime,
                            &workflow_id,
                            &session_id,
                        )
                        .await
                        {
                            Ok(true) => diag.push_str("[Ref image uploaded] "),
                            Ok(false) => diag.push_str("[Ref upload failed] "),
                            Err(e) => diag.push_str(&format!("[Ref error: {}] ", e)),
                        }
                    }
                }
            } else if Path::new(ref_url).exists() {
                if let Ok(bytes) = std::fs::read(ref_url) {
                    let ext = Path::new(ref_url)
                        .extension()
                        .and_then(|e| e.to_str())
                        .unwrap_or("png")
                        .to_lowercase();
                    let mime = match ext.as_str() {
                        "jpg" | "jpeg" => "image/jpeg",
                        "webp" => "image/webp",
                        _ => "image/png",
                    };
                    match upload_reference_image(
                        &client,
                        cookies,
                        &bytes,
                        mime,
                        &workflow_id,
                        &session_id,
                    )
                    .await
                    {
                        Ok(true) => diag.push_str("[Ref image uploaded] "),
                        Ok(false) => diag.push_str("[Ref upload failed] "),
                        Err(e) => diag.push_str(&format!("[Ref error: {}] ", e)),
                    }
                }
            }
        }
    }

    let seed_base: u32 = {
        use rand::Rng;
        rand::thread_rng().gen_range(100000..999999u32)
    };

    diag.push_str(&format!(
        "[API start: inputRatio={}, ratio={}, count={}] ",
        aspect_ratio, api_ratio, count
    ));

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
                &client,
                &token,
                &prompt,
                &ratio,
                seed,
                &wf_id,
                &sess_id,
                hdrs.as_ref(),
            )
            .await
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
