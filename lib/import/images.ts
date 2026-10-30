import type { PromptImage } from '@/lib/ai-prompt';

// Tipo real da imagem pelos primeiros bytes (a extensão/Content-Type do upload não é confiável).
export function detectImageMime(bytes: Uint8Array): PromptImage['mimeType'] | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg';
  // RIFF....WEBP
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  return null;
}

export function toPromptImage(bytes: Uint8Array): PromptImage | null {
  const mimeType = detectImageMime(bytes);
  return mimeType ? { mimeType, base64: Buffer.from(bytes).toString('base64') } : null;
}
