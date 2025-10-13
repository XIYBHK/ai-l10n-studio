import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EditorPane } from '../../components/EditorPane';
import { eventDispatcher } from '../../services/eventDispatcher';
import { useSessionStore } from '../../store';
import { POEntry } from '../../types/tauri';

// Mock antd components and other dependencies
vi.mock('antd', async () => {
  const antd = await vi.importActual('antd');
  return {
    ...antd,
    message: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  };
});

// Mock stores and hooks
vi.mock('../../store', () => ({
  useSessionStore: vi.fn(),
}));

vi.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ colors: {} }),
}));

// Mock the event dispatcher
vi.spyOn(eventDispatcher, 'emit');

describe('Term Library Activation Feature', () => {
  const mockEntry: POEntry = {
    comments: [],
    msgctxt: '',
    msgid: 'Hello World',
    msgstr: '',
    line_start: 1,
  };

  const mockOnEntryUpdate = vi.fn();

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    // Mock the session store state needed by the component
    (useSessionStore as any).getState = () => ({
      entries: [mockEntry],
    });
  });

  it('should emit "term:updated" event when user manually saves a translation', async () => {
    // 1. Render the component
    render(<EditorPane entry={mockEntry} onEntryUpdate={mockOnEntryUpdate} apiKey="test-key" />);

    // 2. Simulate user typing a new translation
    const translationInput = screen.getByPlaceholderText('请输入翻译内容...');
    fireEvent.change(translationInput, { target: { value: '你好，世界' } });

    // 3. Simulate user clicking the save button
    const saveButton = screen.getByText('保存译文 (Ctrl+Enter)');
    fireEvent.click(saveButton);

    // 4. Assert that the event was emitted
    // We use waitFor to give the component time to process the save logic
    await waitFor(() => {
      expect(eventDispatcher.emit).toHaveBeenCalledWith('term:updated', {
        source: 'manual_save', // 事件参数从 reason 改为 source
      });
    });

    // Also assert that the update function was called, as a sanity check
    expect(mockOnEntryUpdate).toHaveBeenCalledWith(0, {
      msgstr: '你好，世界',
      needsReview: false,
    });
  });
});
