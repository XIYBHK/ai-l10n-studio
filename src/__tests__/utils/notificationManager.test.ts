import { NotificationManager } from '../../utils/notificationManager';
import type { AppStoreData } from '../../store/tauriStore';

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
  permission: vi.fn(),
  request: vi.fn(),
  send: vi.fn(),
}));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true }));
vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: mocks.permission,
  requestPermission: mocks.request,
  sendNotification: mocks.send,
}));
vi.mock('../../store/tauriStore', () => ({
  tauriStore: { getPreferences: mocks.load, updatePreferences: mocks.save },
}));

describe('notification preferences and permission boundary', () => {
  let preferences: AppStoreData['preferences']['notifications'];
  beforeEach(() => {
    vi.clearAllMocks();
    preferences = { enabled: true, onComplete: true, onError: true, onProgress: false };
    mocks.load.mockImplementation(async () => ({ notifications: { ...preferences } }));
    mocks.save.mockImplementation(async (updates) => {
      preferences = { ...updates.notifications };
    });
    mocks.permission.mockResolvedValue(true);
    mocks.request.mockResolvedValue('granted');
  });
  it('persists a disabled setting and uses it before sending after restart', async () => {
    const first = new NotificationManager();
    await first.setEnabled(false);
    const restarted = new NotificationManager();
    await restarted.translationComplete(3, 3, 0);
    expect(restarted.isEnabled()).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('sends localized completion and error messages only for enabled events', async () => {
    const manager = new NotificationManager();
    await manager.translationComplete(3, 2, 1);
    expect(mocks.send).toHaveBeenCalledWith({
      title: '翻译完成（部分失败）',
      body: '成功 2 / 3 条，失败 1 条。',
    });
    await manager.setNotificationPreferences({ onError: false });
    await manager.translationError('network error');
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });
  it('skips sending without permission and requests it only through the explicit action', async () => {
    mocks.permission.mockResolvedValue(false);
    const manager = new NotificationManager();
    await manager.translationComplete(1, 1, 0);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
    expect(await manager.requestPermission()).toBe(true);
    expect(mocks.request).toHaveBeenCalledOnce();
  });
  it('does not report an unsaved setting as applied when persistence fails', async () => {
    mocks.save.mockRejectedValue(new Error('storage unavailable'));
    const manager = new NotificationManager();
    await expect(manager.setEnabled(false)).rejects.toThrow('storage unavailable');
    expect(manager.isEnabled()).toBe(true);
  });
});
