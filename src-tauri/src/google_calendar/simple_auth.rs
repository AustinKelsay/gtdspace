use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use url::Url;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimpleAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
    pub auth_uri: String,
    pub token_uri: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: i64,
    pub refresh_token: Option<String>,
    pub scope: Option<String>,
}

impl SimpleAuthConfig {
    pub fn build_auth_url(
        &self,
        scopes: &[&str],
        state: &str,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let mut url = Url::parse(&self.auth_uri)?;

        {
            let mut query_params = url.query_pairs_mut();
            query_params.append_pair("client_id", &self.client_id);
            query_params.append_pair("redirect_uri", &self.redirect_uri);
            query_params.append_pair("response_type", "code");
            query_params.append_pair("scope", &scopes.join(" "));
            query_params.append_pair("state", state);
            query_params.append_pair("access_type", "offline");
            query_params.append_pair("prompt", "consent");
        }

        Ok(url.to_string())
    }

    pub async fn exchange_code(
        &self,
        code: &str,
    ) -> Result<TokenResponse, Box<dyn std::error::Error>> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()?;

        let mut params = HashMap::new();
        params.insert("client_id", self.client_id.as_str());
        params.insert("client_secret", self.client_secret.as_str());
        params.insert("code", code);
        params.insert("redirect_uri", self.redirect_uri.as_str());
        params.insert("grant_type", "authorization_code");

        let response = client.post(&self.token_uri).form(&params).send().await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(format!("Failed to exchange code: {}", error_text).into());
        }

        let token_response: TokenResponse = response.json().await?;
        Ok(token_response)
    }

    #[allow(dead_code)]
    pub async fn refresh_token(
        &self,
        refresh_token: &str,
    ) -> Result<TokenResponse, Box<dyn std::error::Error>> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()?;

        let mut params = HashMap::new();
        params.insert("client_id", self.client_id.as_str());
        params.insert("client_secret", self.client_secret.as_str());
        params.insert("refresh_token", refresh_token);
        params.insert("grant_type", "refresh_token");

        let response = client.post(&self.token_uri).form(&params).send().await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(format!("Failed to refresh token: {}", error_text).into());
        }

        let token_response: TokenResponse = response.json().await?;
        Ok(token_response)
    }
}

/// Error returned when all attempts to open the user's browser fail during OAuth.
///
/// This error intentionally formats/logs only a redacted version of the URL via `Display`.
/// The full, unredacted `auth_url` is available as a field for callers to access and
/// open manually, preserving the correct state parameter for OAuth completion.
#[derive(Debug)]
pub struct BrowserOpenError {
    /// Full OAuth authorization URL including the original state. DO NOT LOG.
    #[allow(dead_code)]
    pub auth_url: String,
    /// Redacted authorization URL with the state removed. Safe for logs.
    pub redacted_auth_url: String,
}

impl std::fmt::Display for BrowserOpenError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "Failed to open browser. Please visit this URL manually:\n{}",
            self.redacted_auth_url
        )
    }
}

impl std::error::Error for BrowserOpenError {}

// Simple function to start OAuth flow by opening browser
pub fn start_oauth_flow(config: &SimpleAuthConfig) -> Result<String, Box<dyn std::error::Error>> {
    // Generate a random state for security
    let state = general_purpose::URL_SAFE_NO_PAD.encode(uuid::Uuid::new_v4().as_bytes());

    // Build the authorization URL
    let auth_url = config.build_auth_url(
        &["https://www.googleapis.com/auth/calendar.readonly"],
        &state,
    )?;

    // Redact the state from the URL before printing to avoid leaking the CSRF token
    let redacted_auth_url = {
        let mut url = Url::parse(&auth_url).expect("URL parsing for redaction failed");
        let mut serializer = url::form_urlencoded::Serializer::new(String::new());
        for (key, value) in url.query_pairs() {
            if key == "state" {
                serializer.append_pair(key.as_ref(), "[REDACTED]");
            } else {
                serializer.append_pair(key.as_ref(), value.as_ref());
            }
        }
        url.set_query(Some(&serializer.finish()));
        url.to_string()
    };

    println!("[SimpleAuth] Opening browser to: {}", redacted_auth_url);
    println!(
        "[SimpleAuth] URL length: {} characters",
        redacted_auth_url.len()
    );

    // Try direct command execution on macOS first
    #[cfg(target_os = "macos")]
    {
        println!("[SimpleAuth] Attempting to open browser using macOS 'open' command...");
        match std::process::Command::new("open").arg(&auth_url).spawn() {
            Ok(mut child) => {
                // Wait a moment to see if it starts successfully
                std::thread::sleep(std::time::Duration::from_millis(100));
                match child.try_wait() {
                    Ok(Some(status)) => {
                        if status.success() {
                            println!("[SimpleAuth] Browser opened successfully with macOS 'open' command");
                            return Ok(state);
                        } else {
                            println!("[SimpleAuth] 'open' command failed with status: {}", status);
                        }
                    }
                    Ok(None) => {
                        // Process is still running, assume success
                        println!("[SimpleAuth] Browser opened successfully with macOS 'open' command (process running)");
                        return Ok(state);
                    }
                    Err(e) => {
                        println!("[SimpleAuth] Failed to check 'open' command status: {}", e);
                    }
                }
            }
            Err(e) => {
                println!("[SimpleAuth] Failed to execute 'open' command: {}", e);
            }
        }
    }

    // Try using the `open` crate (cross-platform)
    println!("[SimpleAuth] Attempting to open browser using 'open' crate...");
    match open::that(&auth_url) {
        Ok(()) => {
            println!("[SimpleAuth] Browser opened successfully with 'open' crate");
            return Ok(state);
        }
        Err(e) => {
            println!("[SimpleAuth] Failed to open with 'open' crate: {:?}", e);
        }
    }

    // Fallback to webbrowser crate
    println!("[SimpleAuth] Attempting to open browser using 'webbrowser' crate...");
    match webbrowser::open(&auth_url) {
        Ok(()) => {
            println!("[SimpleAuth] Browser opened successfully with 'webbrowser' crate");
            return Ok(state);
        }
        Err(e) => {
            println!("[SimpleAuth] Browser open failed with webbrowser: {:?}", e);
        }
    }

    // All methods failed - return error with URL for manual access
    println!("[SimpleAuth] All browser opening methods failed. Returning URL for manual access.");
    Err(Box::new(BrowserOpenError {
        auth_url: auth_url.clone(),
        redacted_auth_url: redacted_auth_url.clone(),
    }))
}
