use anyhow::Result;
use std::sync::{Arc, Mutex};

// 从主 crate 导入我们需要的模块
// 注意：我们需要在 po-translator-gui crate 的 Cargo.toml 中将这些模块设为 pub，以便在集成测试中访问
// 或者，我们直接在测试中重新定义一个简化的 AITranslator 模拟版本。
// 为了简单起见，我们假设可以访问这些模块。
use po_translator_gui::services::{AIConfig, AITranslator, ProviderType, TranslationMemory};

// 模拟一个 AIConfig
fn create_mock_config() -> AIConfig {
    AIConfig {
        provider: ProviderType::OpenAI, // 使用任意提供商
        api_key: "test_key".to_string(),
        base_url: None,
        model: None,
        proxy: None,
    }
}

#[tokio::test]
async fn test_progress_callback_is_monotonic() -> Result<()> {
    // --- 1. 设置 ---

    // 创建一个 AITranslator 实例
    // 我们需要一个可修改的 AITranslator，但 new_with_config 返回的是 Result
    // 为了测试，我们假设可以成功创建
    let config = create_mock_config();
    let mut translator = AITranslator::new_with_config(config, true, None, Some("en".to_string()))?;

    // 设置一个包含内置短语的翻译记忆库 (TM)
    if let Some(tm) = translator.get_translation_memory_mut() {
        tm.add_translation("Hello".to_string(), "你好".to_string());
        tm.add_translation("World".to_string(), "世界".to_string());
    }

    // 准备一个混合了 TM 命中和非命中项的列表
    let texts_to_translate = vec![
        "Hello".to_string(),  // TM 命中 (index 0)
        "Apple".to_string(),  // AI 翻译 (index 1)
        "World".to_string(),  // TM 命中 (index 2)
        "Banana".to_string(), // AI 翻译 (index 3)
        "Orange".to_string(), // AI 翻译 (index 4)
    ];

    // 用于记录回调接收到的索引顺序
    let received_indices = Arc::new(Mutex::new(Vec::<usize>::new()));

    // 定义进度回调
    let received_indices_clone = Arc::clone(&received_indices);
    let progress_callback = Box::new(move |index: usize, _translation: String| {
        let mut indices = received_indices_clone.lock().unwrap();
        indices.push(index);
    });

    // --- 2. 执行 ---

    // 调用我们修改过的函数
    // 注意：translate_batch_internal 是私有的，我们需要通过公有方法调用它
    // 我们将使用 translate_batch，它内部会调用 internal 方法
    let _ = translator
        .translate_batch(texts_to_translate, Some(progress_callback))
        .await?;

    // --- 3. 断言 ---

    let final_indices = received_indices.lock().unwrap();
    println!("收到的索引顺序: {:?}", *final_indices);

    // 验证收到的索引数量是否正确 (所有条目都应该有一次进度回调)
    assert_eq!(final_indices.len(), 5, "应该收到5个进度回调");

    // 验证索引是否是严格单调递增的
    let is_monotonic = final_indices.windows(2).all(|w| w[0] < w[1]);
    assert!(is_monotonic, "进度回调的索引必须是单调递增的");

    // 也可以直接验证期望的顺序
    let expected_indices: Vec<usize> = (0..5).collect();
    assert_eq!(*final_indices, expected_indices, "回调索引的顺序不正确");

    Ok(())
}
