use base64::{engine::general_purpose, Engine as _};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
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
        code_verifier: &str,
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
        params.insert("code_verifier", code_verifier);

        let response = client
            .post(&self.token_uri)
            .form(&params)
            .send()
            .await?
            .error_for_status()?;

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

        let response = client
            .post(&self.token_uri)
            .form(&params)
            .send()
            .await?
            .error_for_status()?;

        let token_response: TokenResponse = response.json().await?;
        Ok(token_response)
    }
}

/// Error returned when all attempts to open the user's browser fail during OAuth.
///
/// This error intentionally formats/logs only a redacted version of the URL via `Display`.
/// The full, unredacted `auth_url` is available as a field for callers to access and
/// open manually, preserving the correct state parameter for OAuth completion.
pub struct BrowserOpenError {
    /// Full OAuth authorization URL including the original state. DO NOT LOG.
    #[allow(dead_code)]
    auth_url: String,
    /// Original state value required to validate the OAuth callback.
    #[allow(dead_code)]
    state: String,
    /// PKCE code_verifier value required for token exchange. DO NOT LOG.
    #[allow(dead_code)]
    code_verifier: String,
    /// Redacted authorization URL with the state removed. Safe for logs.
    pub redacted_auth_url: String,
}

impl std::fmt::Display for BrowserOpenError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "Failed to open browser. The URL below is redacted for logs; the app should present the full authorization URL to open manually:\n{}",
            self.redacted_auth_url
        )
    }
}

impl std::error::Error for BrowserOpenError {}

impl BrowserOpenError {
    /// Full OAuth URL for manual copy/paste. DO NOT LOG.
    #[allow(dead_code)]
    pub fn auth_url(&self) -> &str {
        &self.auth_url
    }

    /// CSRF state (required to validate callback). DO NOT LOG.
    #[allow(dead_code)]
    pub fn state(&self) -> &str {
        &self.state
    }

    /// PKCE verifier for token exchange. DO NOT LOG.
    #[allow(dead_code)]
    pub fn code_verifier(&self) -> &str {
        &self.code_verifier
    }
}

impl std::fmt::Debug for BrowserOpenError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("BrowserOpenError")
            .field("redacted_auth_url", &self.redacted_auth_url)
            .finish()
    }
}

/// Result of starting the OAuth flow. Contains the CSRF `state` (DO NOT LOG),
/// PKCE `code_verifier` (DO NOT LOG), and a `redacted_auth_url` safe for display/logging.
pub struct StartOAuthFlowResult {
    pub state: String,
    pub code_verifier: String,
    pub redacted_auth_url: String,
}

// Simple function to start OAuth flow by opening browser
pub fn start_oauth_flow(
    config: &SimpleAuthConfig,
) -> Result<StartOAuthFlowResult, Box<dyn std::error::Error>> {
    // Generate a random state for security
    let state = general_purpose::URL_SAFE_NO_PAD.encode(uuid::Uuid::new_v4().as_bytes());

    // Generate PKCE code_verifier (cryptographically random, 43-128 chars)
    let mut code_verifier_bytes = [0u8; 64];
    OsRng.fill_bytes(&mut code_verifier_bytes);
    let code_verifier = general_purpose::URL_SAFE_NO_PAD.encode(code_verifier_bytes);

    // Compute S256 code_challenge (SHA256 then URL_SAFE_NO_PAD base64)
    let mut hasher = Sha256::new();
    hasher.update(code_verifier.as_bytes());
    let code_challenge = general_purpose::URL_SAFE_NO_PAD.encode(hasher.finalize());

    // Build the authorization URL with PKCE parameters
    let auth_url = config.build_auth_url(
        &["https://www.googleapis.com/auth/calendar.readonly"],
        &state,
    )?;

    // Add PKCE parameters to the URL
    let mut url = Url::parse(&auth_url)?;
    url.query_pairs_mut()
        .append_pair("code_challenge", &code_challenge)
        .append_pair("code_challenge_method", "S256");
    let auth_url = url.to_string();

    // Redact the state and code_challenge from the URL before printing to avoid leaking
    let redacted_auth_url = {
        match Url::parse(&auth_url) {
            Ok(mut url) => {
                let mut serializer = url::form_urlencoded::Serializer::new(String::new());
                for (key, value) in url.query_pairs() {
                    if key == "state" || key == "code_challenge" {
                        serializer.append_pair(key.as_ref(), "[REDACTED]");
                    } else {
                        serializer.append_pair(key.as_ref(), value.as_ref());
                    }
                }
                url.set_query(Some(&serializer.finish()));
                url.to_string()
            }
            Err(e) => {
                // If we can't parse the URL for redaction, return an error
                #[allow(clippy::all)]
                return Err(Box::new(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    format!("Failed to parse authorization URL for redaction: {}", e),
                )));
            }
        }
    };

    // Do not print raw state or full auth_url; caller may log redacted_auth_url if needed.

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
                            return Ok(StartOAuthFlowResult {
                                state,
                                code_verifier: code_verifier.clone(),
                                redacted_auth_url,
                            });
                        } else {
                            println!("[SimpleAuth] 'open' command failed with status: {}", status);
                        }
                    }
                    Ok(None) => {
                        // Process is still running, assume success
                        println!("[SimpleAuth] Browser opened successfully with macOS 'open' command (process running)");
                        return Ok(StartOAuthFlowResult {
                            state,
                            code_verifier: code_verifier.clone(),
                            redacted_auth_url,
                        });
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
            return Ok(StartOAuthFlowResult {
                state,
                code_verifier: code_verifier.clone(),
                redacted_auth_url,
            });
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
            return Ok(StartOAuthFlowResult {
                state,
                code_verifier: code_verifier.clone(),
                redacted_auth_url,
            });
        }
        Err(e) => {
            println!("[SimpleAuth] Browser open failed with webbrowser: {:?}", e);
        }
    }

    // All methods failed - return error with URL for manual access
    println!("[SimpleAuth] All browser opening methods failed. Returning URL for manual access.");
    Err(Box::new(BrowserOpenError {
        auth_url: auth_url.clone(),
        state,
        code_verifier,
        redacted_auth_url: redacted_auth_url.clone(),
    }))
}
