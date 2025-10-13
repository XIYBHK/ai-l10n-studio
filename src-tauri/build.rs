fn main() {
    // 变更跟踪
    println!("cargo:rerun-if-changed=tauri.conf.json");
    println!("cargo:rerun-if-changed=src/main.rs");
    println!("cargo:rerun-if-changed=src/commands/");
    println!("cargo:rerun-if-changed=src/services/");

    // 嵌入 Windows 清单（含 comctl32 v6），避免 TaskDialogIndirect 等入口点问题
    tauri_build::build();
}
