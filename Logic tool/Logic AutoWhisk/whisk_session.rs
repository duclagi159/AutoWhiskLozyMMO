use base64::Engine;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::Path;

const API_BASE: &str = "https://aisandbox-pa.googleapis.com/v1";
const LABS_API: &str = "https://labs.google/fx/api";
const GENERATE_URL: &str = "https://aisandbox-pa.googleapis.com/v1/whisk:generateImage";
const WORKFLOW_URL: &str = "https://labs.google/fx/api/trpc/media.createOrUpdateWorkflow";
const AUTH_TEST_URL: &str = "https://labs.google/fx/api/trpc/general.fetchUserPreferences";
const SESSION_URL: &str = "https://labs.google/fx/api/auth/session";
const UPLOAD_URL: &str = "https://labs.google/fx/api/trpc/backbone.uploadImage";

fn default_headers() -> HeaderMap {
    let mut h = HeaderMap::new();
    h.insert("User-Agent", HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"));
    h.insert("Accept", HeaderValue::from_static("*/*"));
    h.insert("Accept-Language", HeaderValue::from_static("vi,en;q=0.9"));
    h.insert("Origin", HeaderValue::from_static("https://labs.google"));
    h.insert("Referer", HeaderValue::from_static("https://labs.google/"));
    h.insert("sec-ch-ua", HeaderValue::from_static("\"Google Chrome\";v=\"143\", \"Chromium\";v=\"143\", \"Not A(Brand\";v=\"24\""));
    h.insert("sec-ch-ua-mobile", HeaderValue::from_static("?0"));
    h.insert("sec-ch-ua-platform", HeaderValue::from_static("\"Windows\""));
    h.insert("sec-fetch-dest", HeaderValue::from_static("empty"));
    h.insert("sec-fetch-mode", HeaderValue::from_static("cors"));
    h.insert("sec-fetch-site", HeaderValue::from_static("cross-site"));
    h.insert("x-browser-channel", HeaderValue::from_static("stable"));
    h.insert("x-browser-copyright", HeaderValue::from_static("Copyright 2025 Google LLC. All Rights reserved."));
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

pub async fn test_auth(cookies: &str) -> Result<bool, String> {
    let client = build_client()?;
    let resp = client
        .get(AUTH_TEST_URL)
        .header("Cookie", cookies)
        .header("Content-Type", "application/json")
        .query(&[("input", r#"{"json":null,"meta":{"values":["undefined"]}}"#)])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    Ok(resp.status().is_success())
}

pub async fn fetch_bearer_token(cookies: &str) -> Result<Option<String>, String> {
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

    let token = data.get("accessToken").and_then(|v| v.as_str())
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

pub async fn create_workflow(
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

pub async fn upload_reference_image(
    client: &reqwest::Client,
    cookies: &str,
    image_path: &str,
    workflow_id: &str,
    session_id: &str,
) -> Result<bool, String> {
    let image_data = std::fs::read(image_path).map_err(|e| e.to_string())?;

    let ext = Path::new(image_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        _ => "image/png",
    };

    let engine = base64::engine::general_purpose::STANDARD;
    let b64 = engine.encode(&image_data);
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
        .header("Referer", format!("https://labs.google/fx/tools/whisk/project/{}", workflow_id))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    Ok(resp.status().is_success())
}

pub async fn call_generate_api(
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
    headers.insert("Content-Type", HeaderValue::from_static("text/plain;charset=UTF-8"));
    headers.insert("Accept", HeaderValue::from_static("*/*"));
    headers.insert("Accept-Language", HeaderValue::from_static("vi,en;q=0.9"));
    headers.insert("Referer", HeaderValue::from_static("https://labs.google/"));
    headers.insert("Priority", HeaderValue::from_static("u=1, i"));
    headers.insert("sec-ch-ua", HeaderValue::from_static("\"Google Chrome\";v=\"143\", \"Chromium\";v=\"143\", \"Not A(Brand\";v=\"24\""));
    headers.insert("sec-ch-ua-mobile", HeaderValue::from_static("?0"));
    headers.insert("sec-ch-ua-platform", HeaderValue::from_static("\"Windows\""));
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
    let body_text = resp.text().await.map_err(|e| format!("Read error: {}", e))?;

    if !status.is_success() {
        let preview = if body_text.len() > 300 { &body_text[..300] } else { &body_text };
        return Err(format!("HTTP {}: {}", status.as_u16(), preview));
    }

    let data: Value = serde_json::from_str(&body_text).map_err(|e| format!("JSON parse: {}", e))?;

    if let Some(b64) = extract_encoded_image(&data) {
        return Ok(Some(b64));
    }
    if let Some(b64) = find_base64_deep(&data) {
        return Ok(Some(b64));
    }

    let preview = if body_text.len() > 200 { &body_text[..200] } else { &body_text };
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

pub fn map_aspect_ratio(ratio: &str) -> &str {
    match ratio {
        "16:9" => "IMAGE_ASPECT_RATIO_LANDSCAPE",
        "9:16" => "IMAGE_ASPECT_RATIO_PORTRAIT",
        "1:1" => "IMAGE_ASPECT_RATIO_SQUARE",
        _ => "IMAGE_ASPECT_RATIO_LANDSCAPE",
    }
}

pub fn parse_cookie_input(raw: &str) -> String {
    let raw = raw.trim();
    if raw.is_empty() {
        return String::new();
    }

    if raw.starts_with("eyJ") {
        return raw.to_string();
    }

    if let Ok(data) = serde_json::from_str::<Value>(raw) {
        if let Some(obj) = data.as_object() {
            if let Some(cookies) = obj.get("http").and_then(|h| h.get("cookies")).and_then(|c| c.as_object()) {
                if let Some(token) = cookies.get("__Secure-next-auth.session-token").and_then(|v| v.as_str()) {
                    return token.to_string();
                }
            }
            if let Some(cookies) = obj.get("cookies").and_then(|c| c.as_object()) {
                if let Some(token) = cookies.get("__Secure-next-auth.session-token").and_then(|v| v.as_str()) {
                    return token.to_string();
                }
            }
            for key in ["session_cookie", "session_token", "__Secure-next-auth.session-token"] {
                if let Some(val) = obj.get(key).and_then(|v| v.as_str()) {
                    return val.to_string();
                }
            }
        }
        if let Some(arr) = data.as_array() {
            for item in arr {
                if let Some(name) = item.get("name").and_then(|v| v.as_str()) {
                    if name == "__Secure-next-auth.session-token" {
                        if let Some(val) = item.get("value").and_then(|v| v.as_str()) {
                            return val.to_string();
                        }
                    }
                }
            }
        }
    }

    raw.to_string()
}
