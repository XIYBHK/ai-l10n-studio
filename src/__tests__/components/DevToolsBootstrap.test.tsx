import { act, screen } from '@testing-library/react';
import ReactDOM from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import i18n from '../../i18n/config';

vi.mock('../../store/useAppStore', () => ({
  loadPersistedState: vi.fn().mockRejectedValue(new Error('preferences unavailable')),
  useAppStore: { getState: () => ({ language: 'zh-CN' }) },
}));
vi.mock('../../components/DevToolsThemeProvider', () => ({
  DevToolsThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../pages/DevToolsPage', () => ({ DevToolsPage: () => <div>log monitor</div> }));

it('shows a recoverable error instead of a blank or default log window when preferences fail', async () => {
  await i18n.changeLanguage('zh-CN');
  const container = document.createElement('div');
  container.id = 'devtools-root';
  document.body.appendChild(container);
  let root: Root | undefined;
  const createRoot = ReactDOM.createRoot;
  const spy = vi.spyOn(ReactDOM, 'createRoot').mockImplementation((element, options) => {
    root = createRoot(element, options);
    return root;
  });
  try {
    await act(async () => {
      await import('../../devtools');
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('preferences unavailable');
    expect(screen.getByRole('button', { name: /重\s*试/ })).toBeEnabled();
    expect(screen.queryByText('log monitor')).not.toBeInTheDocument();
  } finally {
    act(() => root?.unmount());
    container.remove();
    spy.mockRestore();
  }
});
