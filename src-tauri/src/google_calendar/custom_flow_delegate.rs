use google_calendar3::oauth2::authenticator_delegate::InstalledFlowDelegate;
use std::future::Future;
use std::io::Write;
use std::pin::Pin;

/// Custom flow delegate that automatically opens the browser for OAuth authentication
pub struct BrowserOpeningFlowDelegate;

impl InstalledFlowDelegate for BrowserOpeningFlowDelegate {
    fn present_user_url<'a>(
        &'a self,
        url: &'a str,
        need_code: bool,
    ) -> Pin<Box<dyn Future<Output = Result<String, String>> + Send + 'a>> {
        Box::pin(async move {
            // First, try to open the browser automatically
            println!("[OAuth] Opening browser for authentication...");

            match open::that(url) {
                Ok(()) => {
                    println!("[OAuth] Browser opened successfully!");
                    println!("[OAuth] Please complete the authentication in your browser.");

                    if need_code {
                        // Interactive mode - user needs to paste code
                        println!(
                            "[OAuth] After authorizing, enter the code displayed in your browser:"
                        );
                        std::io::stdout().flush().unwrap();

                        let mut code = String::new();
                        std::io::stdin()
                            .read_line(&mut code)
                            .map_err(|e| format!("Failed to read code: {}", e))?;

                        Ok(code.trim().to_string())
                    } else {
                        // HTTPRedirect mode - the redirect will be handled automatically
                        println!("[OAuth] Waiting for redirect callback...");
                        Ok(String::new())
                    }
                }
                Err(e) => {
                    // Fallback: print URL for manual opening
                    println!("[OAuth] Failed to open browser automatically: {}", e);
                    println!("[OAuth] Please open this URL manually in your browser:");
                    println!("{}", url);

                    if need_code {
                        println!(
                            "[OAuth] After authorizing, enter the code displayed in your browser:"
                        );
                        std::io::stdout().flush().unwrap();

                        let mut code = String::new();
                        std::io::stdin()
                            .read_line(&mut code)
                            .map_err(|e| format!("Failed to read code: {}", e))?;

                        Ok(code.trim().to_string())
                    } else {
                        println!("[OAuth] Waiting for redirect callback...");
                        Ok(String::new())
                    }
                }
            }
        })
    }

    // Use default implementation for redirect_uri
    fn redirect_uri(&self) -> Option<&str> {
        None // Let the library use its default redirect URI
    }
}
