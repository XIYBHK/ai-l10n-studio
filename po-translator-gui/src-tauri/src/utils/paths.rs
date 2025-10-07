use std::path::PathBuf;

/// 获取翻译记忆库路径
/// 优先级：程序目录/data（绿色版） > 用户目录/.po-translator（备选）
pub fn get_translation_memory_path() -> PathBuf {
    // 1. 优先尝试程序目录（绿色便携模式）
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let portable_tm = exe_dir.join("data").join("translation_memory.json");
            
            // 检查程序目录是否可写
            if exe_dir.metadata().map(|m| !m.permissions().readonly()).unwrap_or(false) {
                // 可写，优先使用程序目录（首次运行时会自动创建data目录）
                return portable_tm;
            }
        }
    }
    
    // 2. 降级到用户目录（程序目录不可写，如安装在系统目录时）
    let mut path = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push(".po-translator");
    path.push("translation_memory.json");
    path
}

/// 确保翻译记忆库目录存在
pub fn ensure_tm_dir() -> std::io::Result<()> {
    let tm_path = get_translation_memory_path();
    if let Some(parent) = tm_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    Ok(())
}

