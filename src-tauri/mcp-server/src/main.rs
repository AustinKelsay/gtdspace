use clap::Parser;

#[derive(Debug, Parser)]
#[command(name = "gtdspace-mcp", about = "GTD Space MCP stdio server")]
struct Args {
    #[arg(long)]
    workspace: Option<String>,
    #[arg(long, num_args = 0..=1, default_missing_value = "true")]
    read_only: Option<bool>,
    #[arg(long)]
    log_level: Option<String>,
}

#[tokio::main]
async fn main() {
    let args = Args::parse();
    let saved_defaults = gtdspace_lib::backend::mcp_workspace::load_mcp_server_launch_settings();
    let log_level = args.log_level.unwrap_or(saved_defaults.log_level);
    let read_only = args.read_only.unwrap_or(saved_defaults.read_only);
    init_logger(&log_level);

    let service =
        match gtdspace_lib::backend::GtdWorkspaceService::new(args.workspace, read_only) {
            Ok(service) => service,
            Err(error) => {
                eprintln!("Failed to initialize GTD Space MCP service: {}", error);
                std::process::exit(1);
            }
        };

    let server = gtdspace_lib::mcp_server::GtdMcpServer::new(service);
    if let Err(error) = server.serve_stdio().await {
        eprintln!("GTD Space MCP server exited with error: {}", error);
        std::process::exit(1);
    }
}

fn init_logger(level: &str) {
    let env = env_logger::Env::default().filter_or("RUST_LOG", level);
    let _ = env_logger::Builder::from_env(env).is_test(false).try_init();
}
