import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { App as AntApp, ConfigProvider } from 'antd';
import { SWRConfig } from 'swr';
import '../i18n/config';

export function TestProviders({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider>
      <AntApp>
        <SWRConfig
          value={{
            provider: () => new Map(),
            dedupingInterval: 0,
            focusThrottleInterval: 0,
          }}
        >
          {children}
        </SWRConfig>
      </AntApp>
    </ConfigProvider>
  );
}

export function renderWithProviders(ui: ReactElement) {
  return render(ui, { wrapper: TestProviders });
}
