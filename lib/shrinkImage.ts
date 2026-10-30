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
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // Fundo branco: prints com transparência viram JPEG sem partes pretas.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
