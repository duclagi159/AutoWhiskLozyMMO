use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Account {
    pub id: String,
    pub email: String,
    #[serde(default)]
    pub credits: i32,
    #[serde(default, rename = "hasCookies")]
    pub has_cookies: bool,
    #[serde(default, rename = "isExpired")]
    pub is_expired: bool,
    #[serde(default, rename = "expiresIn")]
    pub expires_in: Option<String>,
    #[serde(default, rename = "cookieData")]
    pub cookie_data: Option<String>,
    #[serde(default, rename = "bearerToken")]
    pub bearer_token: Option<String>,
    #[serde(default)]
    pub headers: Option<HashMap<String, String>>,
}

fn get_accounts_path() -> PathBuf {
    let exe = std::env::current_exe().unwrap_or_default();
    let dir = exe.parent().unwrap_or(std::path::Path::new("."));
    dir.join("accounts.json")
}

fn load_accounts() -> Vec<Account> {
    let path = get_accounts_path();
    if !path.exists() {
        return Vec::new();
    }
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

fn save_accounts(accounts: &[Account]) -> Result<(), String> {
    let path = get_accounts_path();
    let json = serde_json::to_string_pretty(accounts).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| format!("Failed to save: {}", e))
}

pub fn get_accounts() -> Result<Value, String> {
    let accounts = load_accounts();
    serde_json::to_value(&accounts).map_err(|e| e.to_string())
}

pub fn add_account(
    email: &str,
    cookies: &str,
    bearer_token: Option<&str>,
    headers: Option<&HashMap<String, String>>,
) -> Result<Value, String> {
    let mut accounts = load_accounts();

    let id = format!(
        "acc-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );

    let account = Account {
        id: id.clone(),
        email: email.to_string(),
        credits: 0,
        has_cookies: !cookies.is_empty(),
        is_expired: false,
        expires_in: None,
        cookie_data: Some(cookies.to_string()),
        bearer_token: bearer_token.map(|s| s.to_string()),
        headers: headers.cloned(),
    };

    accounts.push(account.clone());
    save_accounts(&accounts)?;

    serde_json::to_value(&account).map_err(|e| e.to_string())
}

pub fn delete_account(id: &str) -> Result<bool, String> {
    let mut accounts = load_accounts();
    let original_len = accounts.len();
    accounts.retain(|a| a.id != id);

    if accounts.len() < original_len {
        save_accounts(&accounts)?;
        Ok(true)
    } else {
        Ok(false)
    }
}
