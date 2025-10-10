use serde::{Deserialize, Serialize};

#[cfg(feature = "ts-rs")]
use ts_rs::TS;

/// 模型信息（简化版，适配翻译项目）
/// 
/// 参考：Roo-Code 的 ModelInfo 设计
/// 简化原则：跳过推理预算、分层定价等高级特性
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(feature = "ts-rs", ts(export, export_to = "../src/types/generated/"))]
pub struct ModelInfo {
    // ========== 基础信息 ==========
    
    /// 模型ID（如 "gpt-4o-mini"）
    pub id: String,
    
    /// 显示名称（如 "GPT-4o Mini"）
    pub name: String,
    
    /// 供应商（如 "OpenAI"）
    pub provider: String,
    
    // ========== 技术参数 ==========
    
    /// 上下文窗口大小（如 128000）
    pub context_window: usize,
    
    /// 最大输出 token 数（如 16384）
    pub max_output_tokens: usize,
    
    // ========== 定价（USD per million tokens）==========
    // 
    // ⚠️ 重要：所有价格单位统一为 USD per million tokens
    // 示例：0.15 = $0.15/1M = $0.00015/1K
    
    /// 输入价格（USD per 1M tokens）
    pub input_price: f64,
    
    /// 输出价格（USD per 1M tokens）
    pub output_price: f64,
    
    /// 缓存读取价格（可选，通常是输入价格的10%）
    pub cache_reads_price: Option<f64>,
    
    /// 缓存写入价格（可选，通常是输入价格的125%）
    pub cache_writes_price: Option<f64>,
    
    // ========== 能力标识 ==========
    
    /// 是否支持 Prompt 缓存
    pub supports_cache: bool,
    
    /// 是否支持图像输入（多模态）
    pub supports_images: bool,
    
    // ========== UI 展示 ==========
    
    /// 模型描述（可选）
    pub description: Option<String>,
    
    /// 是否推荐（标记为推荐模型）
    pub recommended: bool,
}

impl ModelInfo {
    /// 计算估算成本（简单版，不考虑缓存）
    /// 
    /// 用于批量翻译前的成本预估
    pub fn estimate_cost(&self, input_tokens: usize, output_tokens: usize) -> f64 {
        let input_cost = (input_tokens as f64 / 1_000_000.0) * self.input_price;
        let output_cost = (output_tokens as f64 / 1_000_000.0) * self.output_price;
        input_cost + output_cost
    }
    
    /// 获取价格显示文本（USD per 1M）
    /// 
    /// 示例：`"$0.15/M input · $0.60/M output"`
    pub fn price_display(&self) -> String {
        format!(
            "${:.2}/M input · ${:.2}/M output",
            self.input_price,
            self.output_price
        )
    }
    
    /// 获取缓存节省百分比（如果支持缓存）
    /// 
    /// 返回值：节省的百分比（如 90.0 表示节省90%）
    pub fn cache_savings_percentage(&self) -> Option<f64> {
        self.cache_reads_price.map(|cache_price| {
            ((self.input_price - cache_price) / self.input_price) * 100.0
        })
    }
    
}

#[cfg(test)]
mod tests {
    use super::*;
    
    fn create_test_model() -> ModelInfo {
        ModelInfo {
            id: "gpt-4o-mini".to_string(),
            name: "GPT-4o Mini".to_string(),
            provider: "OpenAI".to_string(),
            context_window: 128000,
            max_output_tokens: 16384,
            input_price: 0.15,
            output_price: 0.60,
            cache_reads_price: Some(0.075),
            cache_writes_price: Some(0.1875),
            supports_cache: true,
            supports_images: true,
            description: Some("性价比最高的小模型".to_string()),
            recommended: true,
        }
    }
    
    #[test]
    fn test_estimate_cost() {
        let model = create_test_model();
        
        // 测试：1000 input tokens + 500 output tokens
        // 期望成本：(1000/1M)*0.15 + (500/1M)*0.60 = 0.00015 + 0.0003 = 0.00045
        let cost = model.estimate_cost(1000, 500);
        assert!((cost - 0.00045).abs() < 0.000001);
    }
    
    #[test]
    fn test_price_display() {
        let model = create_test_model();
        let display = model.price_display();
        assert_eq!(display, "$0.15/M input · $0.60/M output");
    }
    
    #[test]
    fn test_cache_savings_percentage() {
        let model = create_test_model();
        let savings = model.cache_savings_percentage().unwrap();
        // (0.15 - 0.075) / 0.15 * 100 = 50%
        assert!((savings - 50.0).abs() < 0.1);
    }
    
}

