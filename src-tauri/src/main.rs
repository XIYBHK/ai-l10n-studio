//! Desktop entry point; the backend and application builder live in the library.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    po_translator_gui::run();
}
