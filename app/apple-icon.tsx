import { renderAppIcon } from '@/lib/app-icon';

// Ícone da tela de início do iPhone; o iOS arredonda os cantos sozinho.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return renderAppIcon(size.width, { bleed: true });
}
