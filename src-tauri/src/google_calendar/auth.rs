use google_calendar3::{
    hyper, hyper_rustls,
    oauth2::{
        authenticator::Authenticator, ApplicationSecret, InstalledFlowAuthenticator,
        InstalledFlowReturnMethod,
    },
    CalendarHub,
};
use hyper::client::HttpConnector;
use log::info;
use std::sync::Arc;

use super::{
    custom_flow_delegate::BrowserOpeningFlowDelegate, storage::TokenStorage, GoogleCalendarConfig,
};

pub struct GoogleAuthManager {
    client_id: String,
    client_secret: String,
    token_storage: Arc<TokenStorage>,
    authenticator: Option<Authenticator<hyper_rustls::HttpsConnector<HttpConnector>>>,
    pub config: GoogleCalendarConfig,
}

impl GoogleAuthManager {
    pub async fn new(
        client_id: String,
        client_secret: String,
        token_storage: Arc<TokenStorage>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let config = GoogleCalendarConfig {
            client_id: client_id.clone(),
            client_secret: client_secret.clone(),
        };

        let mut manager = Self {
            client_id,
            client_secret,
            token_storage,
            authenticator: None,
            config,
        };

        // Try to load existing authenticator if token exists
        if manager.token_storage.has_token().await {
            manager.load_authenticator().await?;
        }

        Ok(manager)
    }

    pub async fn authenticate(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        info!("[GoogleAuth] Starting authentication process...");

        // Force fresh authentication by deleting existing tokens
        // This ensures account selection prompt appears
        if self.token_storage.has_token().await {
            info!("[GoogleAuth] Existing tokens found, deleting to force account selection...");
            self.token_storage.delete_token().await?;
            self.authenticator = None;
        }

        // Create OAuth2 secret with v2 endpoints
        info!("[GoogleAuth] Creating OAuth2 secret");
        let auth_uri = "https://accounts.google.com/o/oauth2/v2/auth".to_string();
        let token_uri = "https://oauth2.googleapis.com/token".to_string();

        info!("  auth_uri: {}", auth_uri);
        info!("  token_uri: {}", token_uri);
        info!("  redirect_uris: [http://localhost, http://127.0.0.1]");

        let secret = ApplicationSecret {
            client_id: self.client_id.clone(),
            client_secret: self.client_secret.clone(),
            auth_uri,
            token_uri,
            redirect_uris: vec![
                "http://localhost".to_string(),
                "http://127.0.0.1".to_string(),
            ],
            ..Default::default()
        };

        // Create authenticator with installed flow using dynamic port (0 = choose available port)
        info!("[GoogleAuth] Building InstalledFlowAuthenticator with dynamic port...");
        let auth = InstalledFlowAuthenticator::builder(
            secret,
            InstalledFlowReturnMethod::HTTPPortRedirect(0),
        )
        .persist_tokens_to_disk(self.token_storage.get_token_path())
        .flow_delegate(Box::new(BrowserOpeningFlowDelegate))
        .build()
        .await
        .map_err(|e| {
            info!("[GoogleAuth] Failed to build authenticator: {}", e);
            Box::new(e) as Box<dyn std::error::Error>
        })?;

        // Request a token to trigger the authentication flow
        info!("[GoogleAuth] Requesting token - this should open your browser...");
        let token_result = auth
            .token(
                &["https://www.googleapis.com/auth/calendar.readonly"]
                    .iter()
                    .map(|s| s.to_string())
                    .collect::<Vec<_>>(),
            )
            .await;

        match &token_result {
            Ok(_) => info!("[GoogleAuth] Token obtained successfully!"),
            Err(e) => info!("[GoogleAuth] Failed to obtain token: {}", e),
        }

        token_result.map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;

        // The authentication flow will automatically open the browser via the InstalledFlowAuthenticator
        info!("[GoogleAuth] Authentication flow completed");

        // Token is already persisted by InstalledFlowAuthenticator via persist_tokens_to_disk
        // No need for manual save - removing duplicate persistence
        self.authenticator = Some(auth);

        info!("[GoogleAuth] Authentication successful!");
        Ok(())
    }

    pub async fn load_authenticator(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        if self.token_storage.has_token().await {
            // Use v2 OAuth endpoints
            let auth_uri = "https://accounts.google.com/o/oauth2/v2/auth".to_string();
            let token_uri = "https://oauth2.googleapis.com/token".to_string();

            let secret = ApplicationSecret {
                client_id: self.client_id.clone(),
                client_secret: self.client_secret.clone(),
                auth_uri,
                token_uri,
                redirect_uris: vec![
                    "http://localhost".to_string(),
                    "http://127.0.0.1".to_string(),
                ],
                ..Default::default()
            };

            let auth = InstalledFlowAuthenticator::builder(
                secret,
                InstalledFlowReturnMethod::HTTPPortRedirect(0),
            )
            .persist_tokens_to_disk(self.token_storage.get_token_path())
            .flow_delegate(Box::new(BrowserOpeningFlowDelegate))
            .build()
            .await?;

            self.authenticator = Some(auth);
        }

        Ok(())
    }

    pub async fn revoke_token(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(_auth) = &self.authenticator {
            // The Google Calendar API client doesn't directly support revocation,
            // so we'll just clear the stored token
            self.token_storage.delete_token().await?;
            self.authenticator = None;
        }
        Ok(())
    }

    pub async fn is_authenticated(&self) -> bool {
        self.authenticator.is_some() && self.token_storage.has_token().await
    }

    pub async fn get_calendar_hub(
        &self,
    ) -> Result<CalendarHub<hyper_rustls::HttpsConnector<HttpConnector>>, Box<dyn std::error::Error>>
    {
        let auth = self
            .authenticator
            .as_ref()
            .ok_or("Not authenticated")?
            .clone();

        let hub = CalendarHub::new(
            hyper::Client::builder().build(
                hyper_rustls::HttpsConnectorBuilder::new()
                    .with_native_roots()?
                    .https_or_http()
                    .enable_http1()
                    .build(),
            ),
            auth,
        );

        Ok(hub)
    }

    #[allow(dead_code)]
    pub async fn refresh_token_if_needed(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(auth) = &self.authenticator {
            // The authenticator handles token refresh automatically
            // We just need to ensure the token is still valid
            let _ = auth
                .token(
                    &["https://www.googleapis.com/auth/calendar.readonly"]
                        .iter()
                        .map(|s| s.to_string())
                        .collect::<Vec<_>>(),
                )
                .await?;

            // Token is already persisted by InstalledFlowAuthenticator via persist_tokens_to_disk
            // No need for manual save - removing duplicate persistence
        }
        Ok(())
    }
}
