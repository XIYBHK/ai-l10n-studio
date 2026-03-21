use crate::app_log;
use crate::utils::paths;
use std::process::Command;

#[tauri::command]
pub fn get_system_language() -> Result<String, String> {
    app_log!("[系统语言] 检测系统语言...");

    let locale = sys_locale::get_locale()
        .map(|l| {
            app_log!("[系统语言] 检测到: {}", l);
            l
        })
        .unwrap_or_else(|| {
            app_log!("[系统语言] 无法检测，使用默认语言 zh-CN");
            "zh-CN".to_string()
        });

    let normalized = normalize_locale(&locale);
    app_log!("[系统语言] 规范化为: {}", normalized);
    Ok(normalized)
}

fn normalize_locale(locale: &str) -> String {
    let lower = locale.to_lowercase();

    // 中文变体
    if lower.starts_with("zh") {
        if lower.contains("hant") || lower.contains("tw") || lower.contains("hk") {
            return "zh-TW".to_string();
        }
        return "zh-CN".to_string();
    }

    // 其他语言映射
    let lang = lower.split('-').next().unwrap_or(&lower);
    let region = match lang {
        "en" => "en-US",
        "ja" => "ja-JP",
        "ko" => "ko-KR",
        "fr" => "fr-FR",
        "de" => "de-DE",
        "es" => "es-ES",
        "ru" => "ru-RU",
        "ar" => "ar-SA",
        _ if locale.len() >= 2 => locale,
        _ => "zh-CN",
    };

    region.to_string()
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

#[tauri::command]
pub fn get_log_directory_path() -> Result<String, String> {
    let log_dir = paths::app_logs_dir().map_err(|e| format!("获取日志目录路径失败: {}", e))?;
    paths::ensure_dir(&log_dir).map_err(|e| format!("创建日志目录失败: {}", e))?;
    Ok(log_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_log_directory() -> Result<(), String> {
    app_log!("[系统] 打开日志目录...");

    let log_dir = paths::app_logs_dir().map_err(|e| format!("获取日志目录路径失败: {}", e))?;
    app_log!("[系统] 日志目录路径: {:?}", log_dir);
    paths::ensure_dir(&log_dir).map_err(|e| format!("创建日志目录失败: {}", e))?;

    open_in_file_manager(&log_dir)?;
    app_log!("[系统] 日志目录已打开");
    Ok(())
}

fn open_in_file_manager(path: &std::path::Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        app_log!("[系统] 使用 Windows Explorer 打开...");
        Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|e| format!("打开文件管理器失败: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        app_log!("[系统] 使用 macOS Finder 打开...");
        Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("打开文件管理器失败: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        app_log!("[系统] 使用 Linux 文件管理器打开...");
        Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("打开文件管理器失败: {}", e))?;
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        return Err("不支持的平台".to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn get_native_system_theme() -> Result<String, String> {
    app_log!("[系统主题] 使用原生API检测系统主题...");

    #[cfg(target_os = "windows")]
    {
        detect_windows_theme()
    }

    #[cfg(target_os = "macos")]
    {
        detect_macos_theme()
    }

    #[cfg(target_os = "linux")]
    {
        detect_linux_theme()
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        app_log!("[系统主题] 不支持的平台，使用默认浅色主题");
        Ok("light".to_string())
    }
}

#[cfg(target_os = "windows")]
fn detect_windows_theme() -> Result<String, String> {
    use std::process::Command;

    let output = Command::new("reg")
        .args(&[
            "query",
            "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize",
            "/v",
            "AppsUseLightTheme",
        ])
        .output();

    match output {
        Ok(result) => {
            let stdout = String::from_utf8_lossy(&result.stdout);
            app_log!("[系统主题] 注册表查询结果: {}", stdout);

            if stdout.contains("AppsUseLightTheme") {
                if stdout.contains("0x0") || stdout.contains("REG_DWORD    0") {
                    app_log!("[系统主题] Windows原生检测: 深色模式");
                    Ok("dark".to_string())
                } else {
                    app_log!("[系统主题] Windows原生检测: 浅色模式");
                    Ok("light".to_string())
                }
            } else {
                app_log!("[系统主题] 无法解析注册表输出，使用默认浅色");
                Ok("light".to_string())
            }
        }
        Err(e) => {
            app_log!("[系统主题] 注册表查询失败: {}", e);
            Err(format!("Windows注册表查询失败: {}", e))
        }
    }
}

#[cfg(target_os = "macos")]
fn detect_macos_theme() -> Result<String, String> {
    use std::process::Command;

    let output = Command::new("defaults")
        .args(&["read", "-g", "AppleInterfaceStyle"])
        .output();

    match output {
        Ok(result) => {
            let stdout = String::from_utf8_lossy(&result.stdout)
                .trim()
                .to_lowercase();
            app_log!("[系统主题] macOS系统主题: {}", stdout);

            if stdout.contains("dark") {
                app_log!("[系统主题] macOS原生检测: 深色模式");
                Ok("dark".to_string())
            } else {
                app_log!("[系统主题] macOS原生检测: 浅色模式");
                Ok("light".to_string())
            }
        }
        Err(_) => {
            app_log!("[系统主题] macOS原生检测: 浅色模式（默认）");
            Ok("light".to_string())
        }
    }
}

#[cfg(target_os = "linux")]
fn detect_linux_theme() -> Result<String, String> {
    use std::process::Command;

    let output = Command::new("gsettings")
        .args(&["get", "org.gnome.desktop.interface", "gtk-theme"])
        .output();

    match output {
        Ok(result) => {
            let stdout = String::from_utf8_lossy(&result.stdout)
                .trim()
                .to_lowercase();
            app_log!("[系统主题] Linux系统主题: {}", stdout);

            if stdout.contains("dark") || stdout.contains("adwaita-dark") {
                app_log!("[系统主题] Linux原生检测: 深色模式");
                Ok("dark".to_string())
            } else {
                app_log!("[系统主题] Linux原生检测: 浅色模式");
                Ok("light".to_string())
            }
        }
        Err(e) => {
            app_log!("[系统主题] Linux主题检测失败: {}", e);
            Err(format!("Linux主题检测失败: {}", e))
        }
    }
}
