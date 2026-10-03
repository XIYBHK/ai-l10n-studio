import i18n from '../i18n/config';
import { open, save } from '@tauri-apps/plugin-dialog';
import type { PODocument } from '../types/tauri';
import type { FileFormat, FileMetadata } from '../types/fileFormat';
import { invoke } from './apiClient';

export const poFileCommands = {
  async parse(filePath: string): Promise<PODocument> {
    return invoke<PODocument>(
      'parse_po_file',
      { filePath },
      { errorMessage: i18n.t('errors.ipc.parsePo') }
    );
  },

  async save(filePath: string, document: PODocument): Promise<void> {
    return invoke<void>(
      'save_po_file',
      { filePath, document },
      { errorMessage: i18n.t('errors.ipc.savePo') }
    );
  },
};

export const fileFormatCommands = {
  async detect(filePath: string): Promise<FileFormat> {
    return invoke<FileFormat>(
      'detect_file_format',
      { filePath },
      { errorMessage: i18n.t('errors.ipc.detectFormat') }
    );
  },

  async getMetadata(filePath: string): Promise<FileMetadata> {
    return invoke<FileMetadata>(
      'get_file_metadata',
      { filePath },
      { errorMessage: i18n.t('errors.ipc.fileMetadata') }
    );
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
