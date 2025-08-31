// Compatibility with different Rust versions

use serde::Deserialize;
use std::sync::Arc;
use tokio::sync::{oneshot, Mutex};
use warp::{http::StatusCode, Filter};

#[derive(Debug, Deserialize)]
struct OAuthCallback {
    code: Option<String>,
    #[allow(dead_code)]
    state: Option<String>,
    error: Option<String>,
}

pub struct OAuthCallbackServer {
    port: u16,
    received_code: Arc<Mutex<Option<String>>>,
}

impl OAuthCallbackServer {
    pub fn new(port: u16) -> Self {
        Self {
            port,
            received_code: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn start_and_wait_for_code_with_state(
        &self,
        expected_state: Option<String>,
    ) -> Result<String, Box<dyn std::error::Error>> {
        // Clear any stale code from previous runs
        {
            let mut code_guard = self.received_code.lock().await;
            *code_guard = None;
        }

        let received_code = self.received_code.clone();
        let port = self.port;
        let expected_state_for_route = expected_state.clone();

        // Create the callback route
        let callback = warp::path("callback")
            .and(warp::path::end())
            .and(warp::query::<OAuthCallback>())
            .then(move |params: OAuthCallback| {
                let received_code = received_code.clone();
                let expected_state_for_request = expected_state_for_route.clone();
                async move {
                    // Validate state if an expected value was provided
                    if let Some(expected) = expected_state_for_request {
                        match &params.state {
                            Some(state_value) if *state_value == expected => {
                                // OK
                            }
                            _ => {
                                println!("[OAuthServer] State mismatch or missing. Rejecting request.");
                                return warp::reply::with_status(
                                    warp::reply::html(
                                        r#"
                                    <!DOCTYPE html>
                                    <html>
                                    <head>
                                        <title>Authentication Failed - GTD Space</title>
                                        <style>
                                            /* Light mode colors matching GTD Space theme */
                                            :root {
                                                --background: 255 255 255;
                                                --foreground: 23 23 23;
                                                --card: 255 255 255;
                                                --primary: 24 24 27;
                                                --secondary: 244 244 245;
                                                --muted: 244 244 245;
                                                --border: 228 228 231;
                                                --error: 239 68 68;
                                            }

                                            /* Dark mode detection */
                                            @media (prefers-color-scheme: dark) {
                                                :root {
                                                    --background: 9 9 11;
                                                    --foreground: 250 250 250;
                                                    --card: 18 18 20;
                                                    --primary: 250 250 250;
                                                    --secondary: 39 39 42;
                                                    --muted: 39 39 42;
                                                    --border: 39 39 42;
                                                    --error: 239 68 68;
                                                }
                                            }

                                            * {
                                                margin: 0;
                                                padding: 0;
                                                box-sizing: border-box;
                                            }

                                            body {
                                                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                                                display: flex;
                                                justify-content: center;
                                                align-items: center;
                                                min-height: 100vh;
                                                background-color: rgb(var(--background));
                                                color: rgb(var(--foreground));
                                            }

                                            .container {
                                                text-align: center;
                                                padding: 3rem;
                                                background-color: rgb(var(--card));
                                                border-radius: 12px;
                                                border: 1px solid rgb(var(--border));
                                                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                                                max-width: 480px;
                                                width: 90%;
                                            }

                                            .error-icon {
                                                width: 64px;
                                                height: 64px;
                                                margin: 0 auto 1.5rem;
                                                background-color: rgb(var(--error));
                                                border-radius: 50%;
                                                display: flex;
                                                align-items: center;
                                                justify-content: center;
                                            }

                                            .error-icon svg {
                                                width: 32px;
                                                height: 32px;
                                                stroke: white;
                                                stroke-width: 3;
                                                fill: none;
                                                stroke-linecap: round;
                                                stroke-linejoin: round;
                                            }

                                            h1 {
                                                font-size: 1.75rem;
                                                font-weight: 600;
                                                margin-bottom: 0.75rem;
                                                color: rgb(var(--foreground));
                                            }

                                            .error-message {
                                                font-size: 0.875rem;
                                                color: rgb(var(--error));
                                                background-color: rgb(var(--secondary));
                                                padding: 0.75rem 1rem;
                                                border-radius: 6px;
                                                margin: 1.5rem 0;
                                                font-family: monospace;
                                            }

                                            .subtitle {
                                                font-size: 1rem;
                                                color: rgb(var(--foreground));
                                                opacity: 0.7;
                                            }

                                            .brand {
                                                position: absolute;
                                                bottom: 2rem;
                                                left: 50%;
                                                transform: translateX(-50%);
                                                font-size: 0.875rem;
                                                color: rgb(var(--foreground));
                                                opacity: 0.5;
                                                font-weight: 500;
                                            }
                                        </style>
                                    </head>
                                    <body>
                                        <div class="container">
                                            <div class="error-icon">
                                                <svg viewBox="0 0 24 24">
                                                    <path d="M6 18L18 6M6 6l12 12"></path>
                                                </svg>
                                            </div>
                                            <h1>Authentication Failed</h1>
                                            <div class="error-message">Invalid state parameter</div>
                                            <p class="subtitle">Please return to GTD Space and try again.</p>
                                        </div>
                                        <div class="brand">GTD Space</div>
                                    </body>
                                    </html>
                                    "#
                                        .to_string(),
                                    ),
                                    StatusCode::BAD_REQUEST,
                                );
                            }
                        }
                    }

                    if let Some(code) = params.code {
                        println!("[OAuthServer] Received authorization code!");
                        *received_code.lock().await = Some(code);

                        // Return a success HTML page with GTD Space theme
                        warp::reply::with_status(
                            warp::reply::html(
                                r#"
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <title>Authentication Successful - GTD Space</title>
                                <style>
                                    /* Light mode colors matching GTD Space theme */
                                    :root {
                                        --background: 255 255 255;
                                        --foreground: 23 23 23;
                                        --card: 255 255 255;
                                        --primary: 24 24 27;
                                        --secondary: 244 244 245;
                                        --muted: 244 244 245;
                                        --border: 228 228 231;
                                        --success: 34 197 94;
                                    }

                                    /* Dark mode detection */
                                    @media (prefers-color-scheme: dark) {
                                        :root {
                                            --background: 9 9 11;
                                            --foreground: 250 250 250;
                                            --card: 18 18 20;
                                            --primary: 250 250 250;
                                            --secondary: 39 39 42;
                                            --muted: 39 39 42;
                                            --border: 39 39 42;
                                            --success: 34 197 94;
                                        }
                                    }

                                    * {
                                        margin: 0;
                                        padding: 0;
                                        box-sizing: border-box;
                                    }

                                    body {
                                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                                        display: flex;
                                        justify-content: center;
                                        align-items: center;
                                        min-height: 100vh;
                                        background-color: rgb(var(--background));
                                        color: rgb(var(--foreground));
                                    }

                                    .container {
                                        text-align: center;
                                        padding: 3rem;
                                        background-color: rgb(var(--card));
                                        border-radius: 12px;
                                        border: 1px solid rgb(var(--border));
                                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                                        max-width: 480px;
                                        width: 90%;
                                    }

                                    .success-icon {
                                        width: 64px;
                                        height: 64px;
                                        margin: 0 auto 1.5rem;
                                        background-color: rgb(var(--success));
                                        border-radius: 50%;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        animation: scaleIn 0.5s ease-out;
                                    }

                                    .success-icon svg {
                                        width: 32px;
                                        height: 32px;
                                        stroke: white;
                                        stroke-width: 3;
                                        fill: none;
                                        stroke-linecap: round;
                                        stroke-linejoin: round;
                                        animation: drawCheck 0.5s ease-out 0.5s both;
                                    }

                                    @keyframes scaleIn {
                                        from {
                                            transform: scale(0);
                                            opacity: 0;
                                        }
                                        to {
                                            transform: scale(1);
                                            opacity: 1;
                                        }
                                    }

                                    @keyframes drawCheck {
                                        from {
                                            stroke-dasharray: 50;
                                            stroke-dashoffset: 50;
                                        }
                                        to {
                                            stroke-dasharray: 50;
                                            stroke-dashoffset: 0;
                                        }
                                    }

                                    h1 {
                                        font-size: 1.75rem;
                                        font-weight: 600;
                                        margin-bottom: 0.75rem;
                                        color: rgb(var(--foreground));
                                    }

                                    .subtitle {
                                        font-size: 1.125rem;
                                        color: rgb(var(--foreground));
                                        opacity: 0.8;
                                        margin-bottom: 1.5rem;
                                        line-height: 1.5;
                                    }

                                    .instruction {
                                        font-size: 0.9rem;
                                        color: rgb(var(--foreground));
                                        opacity: 0.6;
                                        font-style: italic;
                                    }

                                    .brand {
                                        position: absolute;
                                        bottom: 2rem;
                                        left: 50%;
                                        transform: translateX(-50%);
                                        font-size: 0.875rem;
                                        color: rgb(var(--foreground));
                                        opacity: 0.5;
                                        font-weight: 500;
                                    }
                                </style>
                            </head>
                            <body>
                                <div class="container">
                                    <div class="success-icon">
                                        <svg viewBox="0 0 24 24">
                                            <path d="M5 13l4 4L19 7"></path>
                                        </svg>
                                    </div>
                                    <h1>Authentication Successful!</h1>
                                    <p class="subtitle">Your Google Calendar is now connected to GTD Space.</p>
                                    <p class="instruction">You can close this window now.</p>
                                </div>
                                <div class="brand">GTD Space</div>
                            </body>
                            </html>
                            "#
                                .to_string(),
                            ),
                            StatusCode::OK,
                        )
                    } else if let Some(error) = params.error {
                        println!("[OAuthServer] Authentication error: {}", error);
                        warp::reply::with_status(
                            warp::reply::html(
                                format!(
                                r#"
                                <!DOCTYPE html>
                                <html>
                                <head>
                                    <title>Authentication Failed - GTD Space</title>
                                    <style>
                                        /* Light mode colors matching GTD Space theme */
                                        :root {{
                                            --background: 255 255 255;
                                            --foreground: 23 23 23;
                                            --card: 255 255 255;
                                            --primary: 24 24 27;
                                            --secondary: 244 244 245;
                                            --muted: 244 244 245;
                                            --border: 228 228 231;
                                            --error: 239 68 68;
                                        }}

                                        /* Dark mode detection */
                                        @media (prefers-color-scheme: dark) {{
                                            :root {{
                                                --background: 9 9 11;
                                                --foreground: 250 250 250;
                                                --card: 18 18 20;
                                                --primary: 250 250 250;
                                                --secondary: 39 39 42;
                                                --muted: 39 39 42;
                                                --border: 39 39 42;
                                                --error: 239 68 68;
                                            }}
                                        }}

                                        * {{
                                            margin: 0;
                                            padding: 0;
                                            box-sizing: border-box;
                                        }}

                                        body {{
                                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                                            display: flex;
                                            justify-content: center;
                                            align-items: center;
                                            min-height: 100vh;
                                            background-color: rgb(var(--background));
                                            color: rgb(var(--foreground));
                                        }}

                                        .container {{
                                            text-align: center;
                                            padding: 3rem;
                                            background-color: rgb(var(--card));
                                            border-radius: 12px;
                                            border: 1px solid rgb(var(--border));
                                            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                                            max-width: 480px;
                                            width: 90%;
                                        }}

                                        .error-icon {{
                                            width: 64px;
                                            height: 64px;
                                            margin: 0 auto 1.5rem;
                                            background-color: rgb(var(--error));
                                            border-radius: 50%;
                                            display: flex;
                                            align-items: center;
                                            justify-content: center;
                                        }}

                                        .error-icon svg {{
                                            width: 32px;
                                            height: 32px;
                                            stroke: white;
                                            stroke-width: 3;
                                            fill: none;
                                            stroke-linecap: round;
                                            stroke-linejoin: round;
                                        }}

                                        h1 {{
                                            font-size: 1.75rem;
                                            font-weight: 600;
                                            margin-bottom: 0.75rem;
                                            color: rgb(var(--foreground));
                                        }}

                                        .error-message {{
                                            font-size: 0.875rem;
                                            color: rgb(var(--error));
                                            background-color: rgb(var(--secondary));
                                            padding: 0.75rem 1rem;
                                            border-radius: 6px;
                                            margin: 1.5rem 0;
                                            font-family: monospace;
                                        }}

                                        .subtitle {{
                                            font-size: 1rem;
                                            color: rgb(var(--foreground));
                                            opacity: 0.7;
                                        }}

                                        .brand {{
                                            position: absolute;
                                            bottom: 2rem;
                                            left: 50%;
                                            transform: translateX(-50%);
                                            font-size: 0.875rem;
                                            color: rgb(var(--foreground));
                                            opacity: 0.5;
                                            font-weight: 500;
                                        }}
                                    </style>
                                </head>
                                <body>
                                    <div class="container">
                                        <div class="error-icon">
                                            <svg viewBox="0 0 24 24">
                                                <path d="M6 18L18 6M6 6l12 12"></path>
                                            </svg>
                                        </div>
                                        <h1>Authentication Failed</h1>
                                        <div class="error-message">{}</div>
                                        <p class="subtitle">Please return to GTD Space and try again.</p>
                                    </div>
                                    <div class="brand">GTD Space</div>
                                </body>
                                </html>
                                "#,
                                    error
                                ),
                            ),
                            StatusCode::BAD_REQUEST,
                        )
                    } else {
                        warp::reply::with_status(
                            warp::reply::html("Invalid callback parameters".to_string()),
                            StatusCode::BAD_REQUEST,
                        )
                    }
                }
            });

        // Start the server with graceful shutdown
        let server = warp::serve(callback);
        let addr = ([127, 0, 0, 1], port);

        println!(
            "[OAuthServer] Starting callback server on http://localhost:{}",
            port
        );

        // Create a oneshot channel to trigger graceful shutdown
        let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

        // Run server in background with graceful shutdown
        let bound_result = server.try_bind_with_graceful_shutdown(addr, async move {
            let _ = shutdown_rx.await;
        });

        let (_bound_addr, server_future) = match bound_result {
            Ok(bound) => bound,
            Err(e) => {
                eprintln!(
                    "[OAuthServer] Failed to bind server to port {}: {}",
                    port, e
                );
                return Err(Box::new(std::io::Error::new(
                    std::io::ErrorKind::AddrInUse,
                    format!("Failed to start OAuth callback server on port {}: {}. The port may already be in use.", port, e)
                )));
            }
        };

        let server_handle = tokio::spawn(server_future);

        // Wait for code to be received (with timeout)
        let timeout = tokio::time::Duration::from_secs(300); // 5 minutes
        let start = tokio::time::Instant::now();

        loop {
            if let Some(code) = self.received_code.lock().await.clone() {
                println!("[OAuthServer] Code received, shutting down server");
                let _ = shutdown_tx.send(());
                let _ = server_handle.await;
                return Ok(code);
            }

            if start.elapsed() > timeout {
                let _ = shutdown_tx.send(());
                let _ = server_handle.await;
                return Err(Box::new(std::io::Error::new(
                    std::io::ErrorKind::TimedOut,
                    "OAuth callback timeout"
                )));
            }

            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        }
    }

    #[allow(dead_code)]
    pub async fn start_and_wait_for_code(&self) -> Result<String, Box<dyn std::error::Error>> {
        self.start_and_wait_for_code_with_state(None).await
    }
}

// Async function to start server and get code
pub async fn run_oauth_server(
    expected_state: Option<String>,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    println!("[OAuthServer] Setting up OAuth callback server...");

    let server = OAuthCallbackServer::new(9898);

    server
        .start_and_wait_for_code_with_state(expected_state)
        .await
        .map_err(|e| -> Box<dyn std::error::Error + Send + Sync> {
            Box::new(std::io::Error::other(e.to_string()))
        })
}
