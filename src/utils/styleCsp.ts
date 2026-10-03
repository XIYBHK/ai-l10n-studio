/** Tauri adds a per-document nonce to bundled inline styles at load time. */
export function getStyleCsp(): { nonce: string } | undefined {
  const nonce = document.querySelector<HTMLStyleElement>('style[nonce]')?.nonce;
  return nonce ? { nonce } : undefined;
}
