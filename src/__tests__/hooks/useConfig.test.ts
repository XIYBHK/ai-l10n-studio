import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { useActiveAIConfig } from '../../hooks/useConfig';

const { getModelConfiguration, getAppConfig, getSystemPrompt } = vi.hoisted(() => ({
  getModelConfiguration: vi.fn(),
  getAppConfig: vi.fn(),
  getSystemPrompt: vi.fn(),
}));
vi.mock('../../services/configCommands', () => ({ configCommands: { get: getAppConfig } }));
vi.mock('../../services/aiCommands', () => ({
  modelConfigurationCommands: { get: getModelConfiguration },
  systemPromptCommands: { get: getSystemPrompt },
}));

describe('useActiveAIConfig', () => {
  beforeEach(() => {
    getModelConfiguration.mockReset();
  });

  it('reads only model_configuration and derives the active model', async () => {
    getModelConfiguration.mockResolvedValue({
      providers: [
        {
          profile: { id: 'openai', displayName: 'OpenAI', catalogProviderId: 'openai' },
          hasApiKey: true,
        },
      ],
      defaultModel: { providerId: 'openai', modelId: 'gpt-5' },
    });
    const { result } = renderHook(() => useActiveAIConfig(), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(
          SWRConfig,
          { value: { provider: () => new Map(), dedupingInterval: 0 } },
          children
        ),
    });
    await waitFor(() => expect(result.current.activeAIConfig?.model).toBe('gpt-5'));
    expect(getModelConfiguration).toHaveBeenCalledOnce();
    expect(getAppConfig).not.toHaveBeenCalled();
    expect(getSystemPrompt).not.toHaveBeenCalled();
  });
});
