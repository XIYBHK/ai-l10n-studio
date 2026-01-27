/**
 * 动态供应商功能测试工具
 *
 * 用于验证 Phase 2 的动态供应商系统是否正常工作
 */

import { aiProviderCommands } from '../services/commands';
import { createModuleLogger } from './logger';

const log = createModuleLogger('TestDynamicProviders');

export interface TestResult {
  success: boolean;
  message: string;
  data?: any;
}

export async function testGetAllProviders(): Promise<TestResult> {
    log.info('🧪 测试获取所有供应商...');
    const providers = await aiProviderCommands.getAll();

    if (!Array.isArray(providers)) {
      return {
        success: false,
        message: '返回数据不是数组',
        data: providers,
      };
    }

    if (providers.length === 0) {
      return {
        success: false,
        message: '供应商列表为空',
        data: providers,
      };
    }

    for (const provider of providers) {
      if (
        !provider.id ||
        !provider.display_name ||
        !provider.default_url ||
        !provider.default_model
      ) {
        return {
          success: false,
          message: `供应商结构不完整: ${JSON.stringify(provider)}`,
          data: providers,
        };
      }
    }

    log.info(
      `成功获取 ${providers.length} 个供应商:`,
      providers.map((p) => p.id)
    );
    return {
      success: true,
      message: `成功获取 ${providers.length} 个供应商`,
      data: providers,
    };
  } catch (error) {
    log.error('获取供应商失败:', error);
    return {
      success: false,
      message: `API调用失败: ${error}`,
    };
  }
}

export async function testGetAllModels(): Promise<TestResult> {
  try {
    log.info('测试获取所有模型...');
    const models = await aiProviderCommands.getAllModels();

    if (!Array.isArray(models)) {
      return {
        success: false,
        message: '返回数据不是数组',
        data: models,
      };
    }

    if (models.length === 0) {
      return {
        success: false,
        message: '模型列表为空',
        data: models,
      };
    }

    log.info(`成功获取 ${models.length} 个模型`);
    return {
      success: true,
      message: `成功获取 ${models.length} 个模型`,
      data: models,
    };
  } catch (error) {
    log.error('获取模型失败:', error);
    return {
      success: false,
      message: `API调用失败: ${error}`,
    };
  }
}

export async function testFindProviderForModel(modelId: string): Promise<TestResult> {
  try {
    log.info(`测试查找模型 "${modelId}" 的供应商...`);
    const provider = await aiProviderCommands.findProviderForModel(modelId);

    if (!provider) {
      return {
        success: false,
        message: `未找到模型 "${modelId}" 对应的供应商`,
      };
    }

    log.info(`找到模型 "${modelId}" 对应的供应商: ${provider.id}`);
    return {
      success: true,
      message: `成功找到供应商: ${provider.display_name}`,
      data: provider,
    };
  } catch (error) {
    log.error(`查找模型 "${modelId}" 的供应商失败:`, error);
    return {
      success: false,
      message: `API调用失败: ${error}`,
    };
  }
}

export async function runDynamicProviderTests(): Promise<{
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  log.info('开始运行动态供应商测试套件...');

  const results: TestResult[] = [];

  const providersTest = await testGetAllProviders();
  results.push(providersTest);

  const modelsTest = await testGetAllModels();
  results.push(modelsTest);

  const findTest1 = await testFindProviderForModel('deepseek-chat');
  results.push(findTest1);

  const findTest2 = await testFindProviderForModel('kimi-latest');
  results.push(findTest2);

  const findTest3 = await testFindProviderForModel('nonexistent-model');
  results.push(findTest3);

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  log.info(`测试完成: ${passed} 通过, ${failed} 失败`);

  return { passed, failed, results };
}

export function runTestsInConsole() {
  if (typeof window !== 'undefined') {
    (window as any).testDynamicProviders = {
      testGetAllProviders,
      testGetAllModels,
      testFindProviderForModel,
      runDynamicProviderTests,
    };

    console.log('动态供应商测试工具已加载到控制台！');
    console.log('使用方法:');
    console.log('  window.testDynamicProviders.runDynamicProviderTests()');
    console.log('  window.testDynamicProviders.testGetAllProviders()');
    console.log('  window.testDynamicProviders.testGetAllModels()');
    console.log('  window.testDynamicProviders.testFindProviderForModel("deepseek-chat")');
  }
}
