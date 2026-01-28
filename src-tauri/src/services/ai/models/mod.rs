// 各供应商的模型定义

pub mod deepseek;
pub mod minimax;
pub mod moonshot;
pub mod openai;
pub mod zhipuai;

// 重新导出
pub use deepseek::get_deepseek_models;
pub use minimax::get_minimax_models;
pub use moonshot::get_moonshot_models;
pub use openai::get_openai_models;
pub use zhipuai::get_zhipuai_models;
