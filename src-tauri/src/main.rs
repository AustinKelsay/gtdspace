//! Main entry point for the GTD Space Tauri application
//!
//! This module serves as the binary entry point that calls the library function.

// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    gtdspace_lib::run();
}