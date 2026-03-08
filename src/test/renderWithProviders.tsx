import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { App as AntApp, ConfigProvider } from 'antd';
import { SWRConfig } from 'swr';

export function renderWithProviders(ui: ReactElement) {
  return render(
    <ConfigProvider>
      <AntApp>
        <SWRConfig
          value={{
            provider: () => new Map(),
            dedupingInterval: 0,
            focusThrottleInterval: 0,
          }}
        >
          {ui}
        </SWRConfig>
      </AntApp>
    </ConfigProvider>
  );
}
