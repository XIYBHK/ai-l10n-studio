import { open, save } from '@tauri-apps/plugin-dialog';
import type { POEntry } from '../types/tauri';
import { invoke } from './commandClient';
import { COMMANDS } from './commandKeys';

export const poFileCommands = {
  async parse(filePath: string): Promise<POEntry[]> {
    return invoke<POEntry[]>(COMMANDS.PO_PARSE, { filePath }, { errorMessage: '解析 PO 文件失败' });
  },

  async save(filePath: string, entries: POEntry[]): Promise<void> {
    return invoke<void>(COMMANDS.PO_SAVE, { filePath, entries }, { errorMessage: '保存 PO 文件失败' });
  },
};

export const fileFormatCommands = {
  async detect(filePath: string): Promise<string> {
    return invoke<string>(COMMANDS.FILE_FORMAT_DETECT, { filePath }, { errorMessage: '检测文件格式失败' });
  },

  async getMetadata(filePath: string): Promise<unknown> {
    return invoke<unknown>(COMMANDS.FILE_METADATA_GET, { filePath }, { errorMessage: '获取文件元数据失败' });
  },
};

export const dialogCommands = {
  async openFile(): Promise<string | null> {
    const result = await open({
      multiple: false,
      directory: false,
      filters: [
        { name: 'PO Files', extensions: ['po'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    return result as string | null;
  },

  async saveFile(): Promise<string | null> {
    const result = await save({
      filters: [
        { name: 'PO Files', extensions: ['po'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    return result as string | null;
  },
};
