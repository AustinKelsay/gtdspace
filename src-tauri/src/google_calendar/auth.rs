use google_calendar3::{
    hyper, hyper_rustls,
    oauth2::{
        authenticator::Authenticator, 
        InstalledFlowAuthenticator,
        InstalledFlowReturnMethod,
        ApplicationSecret,
    },
    CalendarHub,
};
use hyper::client::HttpConnector;
use std::sync::Arc;

use super::{storage::TokenStorage, GoogleCalendarConfig};

pub struct GoogleAuthManager {
    config: GoogleCalendarConfig,
    token_storage: Arc<TokenStorage>,
    authenticator: Option<Authenticator<hyper_rustls::HttpsConnector<HttpConnector>>>,
}

impl GoogleAuthManager {
    pub async fn new(
        config: GoogleCalendarConfig,
        token_storage: Arc<TokenStorage>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let mut manager = Self {
            config,
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
        
        // Create OAuth2 secret
        println!("[GoogleAuth] Creating OAuth2 secret");
        println!("  auth_uri: {}", self.config.auth_uri);
        println!("  token_uri: {}", self.config.token_uri);
        println!("  redirect_uri: {}", self.config.redirect_uri);
        
        let secret = ApplicationSecret {
            client_id: self.config.client_id.clone(),
            client_secret: self.config.client_secret.clone(),
            auth_uri: self.config.auth_uri.clone(),
            token_uri: self.config.token_uri.clone(),
            redirect_uris: vec![self.config.redirect_uri.clone()],
            ..Default::default()
        };

        // Create authenticator with installed flow
        println!("[GoogleAuth] Building InstalledFlowAuthenticator...");
        let auth = InstalledFlowAuthenticator::builder(
            secret,
            InstalledFlowReturnMethod::HTTPRedirect,
        )
        .persist_tokens_to_disk(self.token_storage.get_token_path())
        .build()
        .await
        .map_err(|e| {
            println!("[GoogleAuth] Failed to build authenticator: {}", e);
            e
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
        
        token_result?;

        // The authentication flow will automatically open the browser via the InstalledFlowAuthenticator
        println!("[GoogleAuth] Authentication flow completed");

        // Save token after successful authentication
        println!("[GoogleAuth] Saving token to disk...");
        self.token_storage.save_authenticator(&auth).await?;
        
        self.authenticator = Some(auth);

        println!("[GoogleAuth] Authentication successful!");
        Ok(())
    }

    pub async fn load_authenticator(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        if self.token_storage.has_token().await {
            let secret = ApplicationSecret {
                client_id: self.config.client_id.clone(),
                client_secret: self.config.client_secret.clone(),
                auth_uri: self.config.auth_uri.clone(),
                token_uri: self.config.token_uri.clone(),
                redirect_uris: vec![self.config.redirect_uri.clone()],
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
            
            // Save the potentially refreshed token
            self.token_storage.save_authenticator(auth).await?;
        }
        Ok(())
    }
}