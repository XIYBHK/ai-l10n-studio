import type { MessageInstance } from 'antd/es/message/interface';

let currentMessage: MessageInstance | undefined;

export function bindUiFeedback(message: MessageInstance): () => void {
  currentMessage = message;
  return () => {
    if (currentMessage === message) currentMessage = undefined;
  };
}

/** Startup failures use the bootstrap error screen until the App context mounts. */
export function reportUiError(text: string): void {
  void currentMessage?.error(text);
}
