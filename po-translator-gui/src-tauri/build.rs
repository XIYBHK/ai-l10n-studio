fn main() {
    // 跳过图标检查，直接构建
    println!("cargo:rerun-if-changed=tauri.conf.json");
    println!("cargo:rerun-if-changed=src/main.rs");
    println!("cargo:rerun-if-changed=src/commands/");
    println!("cargo:rerun-if-changed=src/services/");
}
