import { convertKeysToSnakeCase, convertKeysToCamelCase } from '../../utils/paramConverter';

describe('paramConverter', () => {
  describe('convertKeysToSnakeCase', () => {
    it('应该转换顶层键', () => {
      const input = { apiKey: 'test', baseUrl: 'url' };
      const output = convertKeysToSnakeCase(input);
      expect(output).toEqual({ api_key: 'test', base_url: 'url' });
    });

    it('应该递归转换嵌套对象的键', () => {
      const input = {
        apiKey: 'test',
        proxyConfig: {
          hostName: 'localhost',
          portNumber: 8080,
          isEnabled: true
        }
      };
      const output = convertKeysToSnakeCase(input);
      expect(output).toEqual({
        api_key: 'test',
        proxy_config: {
          host_name: 'localhost',
          port_number: 8080,
          is_enabled: true
        }
      });
    });

    it('应该保持数组不变', () => {
      const input = { items: [{ itemName: 'test' }] };
      const output = convertKeysToSnakeCase(input);
      expect(output).toEqual({ items: [{ itemName: 'test' }] });
    });

    it('应该处理 undefined 值', () => {
      const input = { apiKey: undefined, baseUrl: 'test' };
      const output = convertKeysToSnakeCase(input);
      expect(output).toEqual({ api_key: undefined, base_url: 'test' });
    });
  });

  describe('convertKeysToCamelCase', () => {
    it('应该转换顶层键', () => {
      const input = { api_key: 'test', base_url: 'url' };
      const output = convertKeysToCamelCase(input);
      expect(output).toEqual({ apiKey: 'test', baseUrl: 'url' });
    });

    it('应该递归转换嵌套对象的键', () => {
      const input = {
        api_key: 'test',
        proxy_config: {
          host_name: 'localhost',
          port_number: 8080,
          is_enabled: true
        }
      };
      const output = convertKeysToCamelCase(input);
      expect(output).toEqual({
        apiKey: 'test',
        proxyConfig: {
          hostName: 'localhost',
          portNumber: 8080,
          isEnabled: true
        }
      });
    });
  });
});