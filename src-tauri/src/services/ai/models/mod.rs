// 各供应商的模型定义

pub mod openai;
pub mod moonshot;
pub mod deepseek;

// 重新导出
pub use openai::get_openai_models;
pub use moonshot::get_moonshot_models;
pub use deepseek::get_deepseek_models;

