import useSWR from 'swr';
import type { FileFormat, FileMetadata } from '../types/fileFormat';
import { fileFormatCommands } from '../services/commands';

export function useFileFormat(filePath: string | null | undefined) {
  const key = filePath ? `file_format:${filePath}` : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => fileFormatCommands.detect(filePath!),
    {
      keepPreviousData: true,
      revalidateOnFocus: false, // 文件格式不会变，无需聚焦刷新
      revalidateOnReconnect: false,
      dedupingInterval: 5000, // 5秒内去重
    }
  );
  return {
    format: (data as FileFormat | undefined) ?? undefined,
    isLoading: !!isLoading,
    error,
    refresh: () => mutate(),
    mutate,
  } as const;
}

export function useFileMetadata(filePath: string | null | undefined) {
  const key = filePath ? `file_metadata:${filePath}` : null;
  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => fileFormatCommands.getMetadata(filePath!),
    {
      keepPreviousData: true,
      revalidateOnFocus: false, // 文件元数据不会变（除非保存），无需聚焦刷新
      revalidateOnReconnect: false,
      dedupingInterval: 5000, // 5秒内去重
    }
  );
  return {
    metadata: (data as FileMetadata | undefined) ?? undefined,
    isLoading: !!isLoading,
    error,
    refresh: () => mutate(),
    mutate,
  } as const;
}
