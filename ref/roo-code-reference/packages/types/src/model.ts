import { z } from "zod"

/**
 * ReasoningEffort
 */

export const reasoningEfforts = ["low", "medium", "high"] as const

export const reasoningEffortsSchema = z.enum(reasoningEfforts)

export type ReasoningEffort = z.infer<typeof reasoningEffortsSchema>

/**
 * ReasoningEffortWithMinimal
 */

export const reasoningEffortWithMinimalSchema = z.union([reasoningEffortsSchema, z.literal("minimal")])

export type ReasoningEffortWithMinimal = z.infer<typeof reasoningEffortWithMinimalSchema>

/**
 * Verbosity
 */

export const verbosityLevels = ["low", "medium", "high"] as const

export const verbosityLevelsSchema = z.enum(verbosityLevels)

export type VerbosityLevel = z.infer<typeof verbosityLevelsSchema>

/**
 * Service tiers (OpenAI Responses API)
 */
export const serviceTiers = ["default", "flex", "priority"] as const
export const serviceTierSchema = z.enum(serviceTiers)
export type ServiceTier = z.infer<typeof serviceTierSchema>

/**
 * ModelParameter
 */

export const modelParameters = ["max_tokens", "temperature", "reasoning", "include_reasoning"] as const

export const modelParametersSchema = z.enum(modelParameters)

export type ModelParameter = z.infer<typeof modelParametersSchema>

export const isModelParameter = (value: string): value is ModelParameter =>
	modelParameters.includes(value as ModelParameter)

/**
 * ModelInfo - 核心模型信息定义
 * 
 * ⭐⭐⭐ 这是整个多供应商系统的核心数据结构
 * 
 * 用途：描述一个AI模型的所有关键信息
 * - 技术参数（上下文窗口、最大输出等）
 * - 定价信息（输入/输出/缓存价格）
 * - 能力标识（是否支持图像、缓存、推理等）
 * - 分层定价（可选，用于不同规格/服务层级）
 */
export const modelInfoSchema = z.object({
	// ==================== 技术参数 ====================
	
	/**
	 * 最大输出 token 数
	 * 
	 * 说明：模型单次生成的最大token数
	 * 示例：8192, 16384, 128000
	 */
	maxTokens: z.number().nullish(),
	
	/**
	 * 最大推理 token 数（仅推理模型）
	 * 
	 * 说明：模型内部推理过程的最大token数
	 * 适用：o1, o3, Claude with reasoning 等
	 */
	maxThinkingTokens: z.number().nullish(),
	
	/**
	 * 上下文窗口大小
	 * 
	 * 说明：模型能处理的输入+输出总token数
	 * 示例：128000, 200000, 1000000
	 * 重要：这是选择模型的关键指标
	 */
	contextWindow: z.number(),
	
	// ==================== 能力标识 ====================
	
	/**
	 * 是否支持图像输入
	 * 
	 * 说明：模型是否能处理图像（多模态）
	 * 翻译场景：可用于处理带截图的上下文
	 */
	supportsImages: z.boolean().optional(),
	
	/**
	 * 是否支持计算机操作（Computer Use）
	 * 
	 * 说明：Claude特有功能，能操作GUI
	 * 翻译场景：一般用不上
	 */
	supportsComputerUse: z.boolean().optional(),
	
	/**
	 * 是否支持 Prompt 缓存
	 * 
	 * ⭐⭐⭐ 重要：缓存能大幅降低成本
	 * 
	 * 说明：系统提示词和历史消息可被缓存
	 * 效果：缓存命中后只需支付缓存读取费用（通常是输入价格的10%）
	 * 适用：批量翻译场景，缓存命中率可达30%+
	 */
	supportsPromptCache: z.boolean(),
	
	/**
	 * 是否支持输出冗余度控制
	 * 
	 * 说明：GPT-5等新模型支持控制输出详细程度
	 * 翻译场景：可能用不上
	 */
	supportsVerbosity: z.boolean().optional(),
	
	/**
	 * 是否支持推理预算（Reasoning Budget）
	 * 
	 * 说明：控制推理模型的推理深度
	 * 适用：o1, o3, Claude reasoning 等
	 */
	supportsReasoningBudget: z.boolean().optional(),
	
	/**
	 * 是否支持温度参数
	 * 
	 * 说明：控制输出的随机性
	 * 翻译场景：通常设置低温度（0.3）保证一致性
	 */
	supportsTemperature: z.boolean().optional(),
	
	/**
	 * 是否必须启用推理
	 * 
	 * 说明：某些模型（如o1）强制使用推理模式
	 */
	requiredReasoningBudget: z.boolean().optional(),
	
	/**
	 * 是否支持推理努力参数
	 * 
	 * 说明：类似推理预算，但更细粒度
	 */
	supportsReasoningEffort: z.boolean().optional(),
	
	/**
	 * 支持的参数列表
	 * 
	 * 说明：枚举模型支持的所有参数
	 */
	supportedParameters: z.array(modelParametersSchema).optional(),
	
	// ==================== 定价信息 ⭐⭐⭐ ====================
	
	/**
	 * 输入价格（USD per million tokens）
	 * 
	 * ⭐ 关键指标：决定翻译成本
	 * 
	 * 示例：
	 * - 3.0 = $3.00 per 1M tokens = $0.003 per 1K tokens
	 * - 0.56 = $0.56 per 1M tokens = $0.00056 per 1K tokens
	 * 
	 * 注意：
	 * - 所有价格单位统一为 "USD per million tokens"
	 * - 这是标准层/默认层价格
	 * - 分层定价见 tiers 字段
	 */
	inputPrice: z.number().optional(),
	
	/**
	 * 输出价格（USD per million tokens）
	 * 
	 * ⭐ 关键指标：输出通常比输入贵
	 * 
	 * 示例：
	 * - 15.0 = $15 per 1M tokens（通常是输入价格的5倍）
	 * - 1.68 = $1.68 per 1M tokens
	 */
	outputPrice: z.number().optional(),
	
	/**
	 * 缓存写入价格（USD per million tokens）
	 * 
	 * 说明：首次缓存内容的费用
	 * 通常：略高于输入价格（如输入价格的125%）
	 * 示例：inputPrice=3.0 → cacheWritesPrice=3.75
	 */
	cacheWritesPrice: z.number().optional(),
	
	/**
	 * 缓存读取价格（USD per million tokens）
	 * 
	 * ⭐⭐ 重要：这是成本优化的关键
	 * 
	 * 说明：从缓存读取内容的费用
	 * 通常：只有输入价格的10%
	 * 示例：inputPrice=3.0 → cacheReadsPrice=0.3
	 * 
	 * 效果：
	 * - 30%缓存命中率 → 节省约27%输入成本
	 * - 50%缓存命中率 → 节省约45%输入成本
	 */
	cacheReadsPrice: z.number().optional(),
	
	// ==================== UI 展示 ====================
	
	/**
	 * 模型描述
	 * 
	 * 说明：给用户看的简短描述
	 * 示例："GPT-5: The best model for coding and agentic tasks"
	 */
	description: z.string().optional(),
	
	/**
	 * 默认推理努力
	 * 
	 * 说明：推理模型的默认配置
	 */
	reasoningEffort: reasoningEffortsSchema.optional(),
	
	// ==================== 缓存配置（特定供应商）====================
	
	/**
	 * 每个缓存点的最小 token 数
	 * 
	 * 说明：某些供应商（如AWS Bedrock）要求缓存块最小大小
	 * 示例：1024 tokens
	 */
	minTokensPerCachePoint: z.number().optional(),
	
	/**
	 * 最大缓存点数量
	 * 
	 * 说明：某些供应商限制缓存点数量
	 * 示例：AWS Bedrock 最多4个缓存点
	 */
	maxCachePoints: z.number().optional(),
	
	/**
	 * 可缓存字段
	 * 
	 * 说明：哪些API字段可以被缓存
	 * 示例：["system", "messages", "tools"]
	 */
	cachableFields: z.array(z.string()).optional(),
	
	// ==================== 状态标识 ====================
	
	/**
	 * 是否已废弃
	 * 
	 * 说明：标记旧版本模型，不推荐使用
	 */
	deprecated: z.boolean().optional(),
	
	// ==================== 分层定价 ⭐⭐ ====================
	
	/**
	 * 服务层级定价
	 * 
	 * ⭐ 用途：支持不同规格/服务层级的差异化定价
	 * 
	 * 使用场景：
	 * 
	 * 场景1：OpenAI 服务层级
	 * - default: 标准价格
	 * - flex: 更便宜，但可能延迟
	 * - priority: 更贵，但优先处理
	 * 
	 * 场景2：上下文窗口分层（Gemini/Claude）
	 * - ≤200K: 低价
	 * - >200K: 高价
	 * 
	 * 场景3：特殊功能（1M上下文）
	 * - 标准200K: 基础价格
	 * - 扩展1M: 价格翻倍
	 * 
	 * 示例：
	 * tiers: [
	 *   { 
	 *     name: "flex",           // 服务层级名称
	 *     contextWindow: 400000,  // 可能与主字段不同
	 *     inputPrice: 0.625,      // 覆盖主字段价格
	 *     outputPrice: 5.0,
	 *     cacheReadsPrice: 0.0625
	 *   },
	 *   { 
	 *     name: "priority",
	 *     contextWindow: 400000,
	 *     inputPrice: 2.5,        // 4倍于flex
	 *     outputPrice: 20.0
	 *   }
	 * ]
	 * 
	 * 使用：
	 * 1. 根据用户选择的层级（name）或使用量（contextWindow）
	 * 2. 找到匹配的 tier
	 * 3. 使用 tier 的价格覆盖主字段价格
	 * 4. 如果 tier 的价格为 undefined，回退到主字段
	 */
	tiers: z
		.array(
			z.object({
				/**
				 * 服务层级名称
				 * 
				 * 可选值："default" | "flex" | "priority"
				 * 用于 OpenAI 服务层级区分
				 */
				name: serviceTierSchema.optional(),
				
				/**
				 * 该层级的上下文窗口
				 * 
				 * 用途：
				 * - OpenAI服务层级：通常相同
				 * - Gemini/Claude：用于区分不同窗口大小的价格
				 */
				contextWindow: z.number(),
				
				/**
				 * 该层级的输入价格
				 * 
				 * 说明：覆盖主字段 inputPrice
				 * undefined = 使用主字段价格
				 */
				inputPrice: z.number().optional(),
				
				/**
				 * 该层级的输出价格
				 */
				outputPrice: z.number().optional(),
				
				/**
				 * 该层级的缓存写入价格
				 */
				cacheWritesPrice: z.number().optional(),
				
				/**
				 * 该层级的缓存读取价格
				 */
				cacheReadsPrice: z.number().optional(),
			}),
		)
		.optional(),
})

export type ModelInfo = z.infer<typeof modelInfoSchema>

