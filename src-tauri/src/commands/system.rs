// Phase 6: 系统相关命令
use crate::app_log;
use crate::utils::paths;
use std::process::Command;

/// 检测系统语言
/// 返回 BCP 47 语言标签（如 "zh-CN", "en-US"）
#[tauri::command]
pub fn get_system_language() -> Result<String, String> {
    app_log!("[系统语言] 检测系统语言...");

    // 使用 sys-locale 检测系统语言
    match sys_locale::get_locale() {
        Some(locale) => {
            app_log!("[系统语言] 检测到: {}", locale);

            // 规范化语言代码
            let normalized = normalize_locale(&locale);
            app_log!("[系统语言] 规范化为: {}", normalized);

            Ok(normalized)
        }
        None => {
            app_log!("[系统语言] 无法检测，使用默认语言 zh-CN");
            Ok("zh-CN".to_string())
        }
    }
}

/// 规范化语言代码
/// 将系统语言代码转换为应用支持的标准格式
fn normalize_locale(locale: &str) -> String {
    // 转换为小写并处理
    let lower = locale.to_lowercase();

    // 常见语言映射
    if lower.starts_with("zh") {
        if lower.contains("hans") || lower.contains("cn") || lower.contains("sg") {
            return "zh-CN".to_string(); // 简体中文
        } else if lower.contains("hant") || lower.contains("tw") || lower.contains("hk") {
            return "zh-TW".to_string(); // 繁体中文
        }
        return "zh-CN".to_string(); // 默认简体
    }

    if lower.starts_with("en") {
        return "en-US".to_string();
    }

    if lower.starts_with("ja") {
        return "ja-JP".to_string();
    }

    if lower.starts_with("ko") {
        return "ko-KR".to_string();
    }

    if lower.starts_with("fr") {
        return "fr-FR".to_string();
    }

    if lower.starts_with("de") {
        return "de-DE".to_string();
    }

    if lower.starts_with("es") {
        return "es-ES".to_string();
    }

    if lower.starts_with("ru") {
        return "ru-RU".to_string();
    }

    if lower.starts_with("ar") {
        return "ar-SA".to_string();
    }

    // 未知语言，返回原值或默认中文
    if locale.len() >= 2 {
        locale.to_string()
    } else {
        "zh-CN".to_string()
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_locale_chinese() {
        assert_eq!(normalize_locale("zh-CN"), "zh-CN");
        assert_eq!(normalize_locale("zh-Hans-CN"), "zh-CN");
        assert_eq!(normalize_locale("zh-TW"), "zh-TW");
        assert_eq!(normalize_locale("zh-Hant-TW"), "zh-TW");
        assert_eq!(normalize_locale("zh"), "zh-CN");
    }

    #[test]
    fn test_normalize_locale_other() {
        assert_eq!(normalize_locale("en-US"), "en-US");
        assert_eq!(normalize_locale("en-GB"), "en-US");
        assert_eq!(normalize_locale("ja-JP"), "ja-JP");
        assert_eq!(normalize_locale("ja"), "ja-JP");
    }
}

/// 打开日志目录
/// 获取日志目录路径
#[tauri::command]
pub fn get_log_directory_path() -> Result<String, String> {
    let log_dir = paths::app_logs_dir()
        .map_err(|e| format!("获取日志目录路径失败: {}", e))?;
    
    // 确保目录存在
    paths::ensure_dir(&log_dir)
        .map_err(|e| format!("创建日志目录失败: {}", e))?;
    
    Ok(log_dir.to_string_lossy().to_string())
}

/// 在系统文件管理器中打开应用日志目录
#[tauri::command]
pub fn open_log_directory() -> Result<(), String> {
    app_log!("[系统] 打开日志目录...");

    // 获取日志目录路径
    let log_dir = paths::app_logs_dir()
        .map_err(|e| format!("获取日志目录路径失败: {}", e))?;

    app_log!("[系统] 日志目录路径: {:?}", log_dir);

    // 确保目录存在
    paths::ensure_dir(&log_dir)
        .map_err(|e| format!("创建日志目录失败: {}", e))?;

    // 根据操作系统打开文件管理器
    #[cfg(target_os = "windows")]
    {
        app_log!("[系统] 使用 Windows Explorer 打开...");
        Command::new("explorer")
            .arg(&log_dir)
            .spawn()
            .map_err(|e| format!("打开文件管理器失败: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        app_log!("[系统] 使用 macOS Finder 打开...");
        Command::new("open")
            .arg(&log_dir)
            .spawn()
            .map_err(|e| format!("打开文件管理器失败: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        app_log!("[系统] 使用 Linux 文件管理器打开...");
        Command::new("xdg-open")
            .arg(&log_dir)
            .spawn()
            .map_err(|e| format!("打开文件管理器失败: {}", e))?;
    }

    app_log!("[系统] ✅ 日志目录已打开");
    Ok(())
}

/// 获取系统主题（原生API）
/// 直接从操作系统获取主题设置，避免 webview 环境的检测问题
#[tauri::command]
pub fn get_native_system_theme() -> Result<String, String> {
    app_log!("[系统主题] 🔍 使用原生API检测系统主题...");

    // Windows 系统主题检测
    #[cfg(target_os = "windows")]
    {
        // 使用 Windows Registry 检测系统主题
        use std::process::Command;
        
        // 查询注册表中的系统主题设置
        // AppsUseLightTheme = 0 表示深色模式，1 表示浅色模式
        let output = Command::new("reg")
            .args(&["query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize", "/v", "AppsUseLightTheme"])
            .output();
            
        match output {
            Ok(result) => {
                let stdout = String::from_utf8_lossy(&result.stdout);
                app_log!("[系统主题] 注册表查询结果: {}", stdout);
                
                // 解析输出，查找 AppsUseLightTheme 的值
                if stdout.contains("AppsUseLightTheme") {
                    if stdout.contains("0x0") || stdout.contains("REG_DWORD    0") {
                        app_log!("[系统主题] ✅ Windows原生检测: 深色模式");
                        return Ok("dark".to_string());
                    } else if stdout.contains("0x1") || stdout.contains("REG_DWORD    1") {
                        app_log!("[系统主题] ✅ Windows原生检测: 浅色模式");
                        return Ok("light".to_string());
                    }
                }
                
                app_log!("[系统主题] ⚠️  无法解析注册表输出，使用默认浅色");
                Ok("light".to_string())
            },
            Err(e) => {
                app_log!("[系统主题] ❌ 注册表查询失败: {}", e);
                Err(format!("Windows注册表查询失败: {}", e))
            }
        }
    }

    // macOS 系统主题检测
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        
        let output = Command::new("defaults")
            .args(&["read", "-g", "AppleInterfaceStyle"])
            .output();
            
        match output {
            Ok(result) => {
                let stdout = String::from_utf8_lossy(&result.stdout).trim().to_lowercase();
                app_log!("[系统主题] macOS系统主题: {}", stdout);
                
                if stdout.contains("dark") {
                    app_log!("[系统主题] ✅ macOS原生检测: 深色模式");
                    Ok("dark".to_string())
                } else {
                    app_log!("[系统主题] ✅ macOS原生检测: 浅色模式");
                    Ok("light".to_string())
                }
            },
            Err(_) => {
                // 如果命令失败（通常表示使用浅色模式）
                app_log!("[系统主题] ✅ macOS原生检测: 浅色模式（默认）");
                Ok("light".to_string())
            }
        }
    }

    // Linux 系统主题检测
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        
        // 尝试检测 GNOME 主题
        let output = Command::new("gsettings")
            .args(&["get", "org.gnome.desktop.interface", "gtk-theme"])
            .output();
            
        match output {
            Ok(result) => {
                let stdout = String::from_utf8_lossy(&result.stdout).trim().to_lowercase();
                app_log!("[系统主题] Linux系统主题: {}", stdout);
                
                if stdout.contains("dark") || stdout.contains("adwaita-dark") {
                    app_log!("[系统主题] ✅ Linux原生检测: 深色模式");
                    Ok("dark".to_string())
                } else {
                    app_log!("[系统主题] ✅ Linux原生检测: 浅色模式");
                    Ok("light".to_string())
                }
            },
            Err(e) => {
                app_log!("[系统主题] ❌ Linux主题检测失败: {}", e);
                Err(format!("Linux主题检测失败: {}", e))
            }
        }
    }

    // 其他平台：回退到默认值
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        app_log!("[系统主题] ⚠️  不支持的平台，使用默认浅色主题");
        Ok("light".to_string())
    }
}
