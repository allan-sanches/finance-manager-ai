'use client';

const MAX_SIDE = 1600;
const QUALITY = 0.85;

/**
 * Reduz um print do celular antes do upload: no máximo 1600 px no lado maior, em JPEG.
 * Um PNG de 2–3 MB vira ~200–400 KB — cabe vários por requisição e gasta menos tokens da IA.
 * Se o navegador não conseguir decodificar (ex.: HEIC fora do Safari), devolve o arquivo original.
 */
export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const canvas = await drawScaled(file, MAX_SIDE);
    if (!canvas) return file;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

const THUMB_SIDE = 480;
const THUMB_QUALITY = 0.78;

/**
 * Miniatura em data URL (JPEG, até 480 px) para guardar junto do item — fica em ~20–50 KB.
 * null se o navegador não conseguir abrir a imagem.
 */
export async function imageThumbnail(file: File): Promise<string | null> {
  if (!file.type.startsWith('image/')) return null;
  try {
    const canvas = await drawScaled(file, THUMB_SIDE);
    return canvas ? canvas.toDataURL('image/jpeg', THUMB_QUALITY) : null;
  } catch {
    return null;
  }
}

async function drawScaled(file: File, maxSide: number): Promise<HTMLCanvasElement | null> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return null;
  }
  // Fundo branco: prints com transparência viram JPEG sem partes pretas.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}
