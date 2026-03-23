use clap::Parser;

#[derive(Debug, Parser)]
#[command(name = "gtdspace-mcp", about = "GTD Space MCP stdio server")]
struct Args {
    #[arg(long)]
    workspace: Option<String>,
    #[arg(long, default_value_t = false)]
    read_only: bool,
    #[arg(long, default_value = "info")]
    log_level: String,
}

#[tokio::main]
async fn main() {
    let args = Args::parse();
    init_logger(&args.log_level);

    let service =
        match gtdspace_lib::backend::GtdWorkspaceService::new(args.workspace, args.read_only) {
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
