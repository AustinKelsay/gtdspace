use google_calendar3::{
    hyper, hyper_rustls,
    oauth2::{
        authenticator::Authenticator, ApplicationSecret, InstalledFlowAuthenticator,
        InstalledFlowReturnMethod,
    },
    CalendarHub,
};
use hyper::client::HttpConnector;
use std::sync::Arc;

use super::storage::TokenStorage;

pub struct GoogleAuthManager {
    client_id: String,
    client_secret: String,
    token_storage: Arc<TokenStorage>,
    authenticator: Option<Authenticator<hyper_rustls::HttpsConnector<HttpConnector>>>,
}

impl GoogleAuthManager {
    pub async fn new(
        client_id: String,
        client_secret: String,
        token_storage: Arc<TokenStorage>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let mut manager = Self {
            client_id,
            client_secret,
            token_storage,
            authenticator: None,
        };

        // Try to load existing authenticator if token exists
        if manager.token_storage.has_token().await {
            manager.load_authenticator().await?;
        }

        Ok(manager)
    }

    pub async fn authenticate(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        println!("[GoogleAuth] Starting authentication process...");

        // Create OAuth2 secret with v2 endpoints
        println!("[GoogleAuth] Creating OAuth2 secret");
        let auth_uri = "https://accounts.google.com/o/oauth2/v2/auth".to_string();
        let token_uri = "https://oauth2.googleapis.com/token".to_string();
        let redirect_uri = "http://localhost:9898/callback".to_string();

        println!("  auth_uri: {}", auth_uri);
        println!("  token_uri: {}", token_uri);
        println!("  redirect_uri: {}", redirect_uri);

        let secret = ApplicationSecret {
            client_id: self.client_id.clone(),
            client_secret: self.client_secret.clone(),
            auth_uri,
            token_uri,
            redirect_uris: vec![redirect_uri],
            ..Default::default()
        };

        // Create authenticator with installed flow
        println!("[GoogleAuth] Building InstalledFlowAuthenticator...");
        let auth =
            InstalledFlowAuthenticator::builder(secret, InstalledFlowReturnMethod::HTTPRedirect)
                .persist_tokens_to_disk(self.token_storage.get_token_path())
                .build()
                .await
                .map_err(|e| {
                    println!("[GoogleAuth] Failed to build authenticator: {}", e);
                    Box::new(e) as Box<dyn std::error::Error>
                })?;

        // Request a token to trigger the authentication flow
        println!("[GoogleAuth] Requesting token - this should open your browser...");
        let token_result = auth
            .token(
                &["https://www.googleapis.com/auth/calendar.readonly"]
                    .iter()
                    .map(|s| s.to_string())
                    .collect::<Vec<_>>(),
            )
            .await;

        match &token_result {
            Ok(_) => println!("[GoogleAuth] Token obtained successfully!"),
            Err(e) => println!("[GoogleAuth] Failed to obtain token: {}", e),
        }

        token_result.map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;

        // The authentication flow will automatically open the browser via the InstalledFlowAuthenticator
        println!("[GoogleAuth] Authentication flow completed");

        // Token is already persisted by InstalledFlowAuthenticator via persist_tokens_to_disk
        // No need for manual save - removing duplicate persistence
        self.authenticator = Some(auth);

        println!("[GoogleAuth] Authentication successful!");
        Ok(())
    }

    pub async fn load_authenticator(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        if self.token_storage.has_token().await {
            // Use v2 OAuth endpoints
            let auth_uri = "https://accounts.google.com/o/oauth2/v2/auth".to_string();
            let token_uri = "https://oauth2.googleapis.com/token".to_string();
            let redirect_uri = "http://localhost:9898/callback".to_string();

            let secret = ApplicationSecret {
                client_id: self.client_id.clone(),
                client_secret: self.client_secret.clone(),
                auth_uri,
                token_uri,
                redirect_uris: vec![redirect_uri],
                ..Default::default()
            };

            let auth = InstalledFlowAuthenticator::builder(
                secret,
                InstalledFlowReturnMethod::HTTPRedirect,
            )
            .persist_tokens_to_disk(self.token_storage.get_token_path())
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
