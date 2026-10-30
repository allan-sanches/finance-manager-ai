import { renderAppIcon } from '@/lib/app-icon';

export const contentType = 'image/png';

// /icon/32 é o favicon; /icon/192 e /icon/512 são usados pelo manifest (tela inicial do Android).
const SIZES = [32, 192, 512] as const;

export function generateImageMetadata() {
  return SIZES.map((size) => ({ id: String(size), size: { width: size, height: size }, contentType }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const size = Number(await id);
  return renderAppIcon(size, { bleed: size > 32 });
}
