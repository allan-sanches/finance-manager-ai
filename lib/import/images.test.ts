import { describe, expect, it } from 'vitest';

import { detectImageMime, toPromptImage } from '@/lib/import/images';

describe('detectImageMime', () => {
  it('reconhece PNG, JPEG e WebP pelos bytes', () => {
    expect(detectImageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png');
    expect(detectImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    expect(detectImageMime(webp)).toBe('image/webp');
  });

  it('recusa PDF e texto, mesmo com extensão de imagem', () => {
    expect(detectImageMime(new TextEncoder().encode('%PDF-1.7'))).toBeNull();
    expect(toPromptImage(new TextEncoder().encode('oi'))).toBeNull();
  });

  it('converte para base64', () => {
    expect(toPromptImage(new Uint8Array([0xff, 0xd8, 0xff]))).toEqual({ mimeType: 'image/jpeg', base64: '/9j/' });
  });
});
