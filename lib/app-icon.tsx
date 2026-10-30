import { ImageResponse } from 'next/og';

// Mesmas cores do BrandMark: adesivo lima com "$", borda e sombra pretas.
const LIME = '#bef264';
const INK = '#0a0a0a';
/** Fundo dos ícones da tela inicial: o tom escuro do app, para o adesivo lima saltar. */
export const ICON_BACKGROUND = '#2e3138';

/**
 * Ícone do app em PNG.
 * `bleed`: fundo escuro ocupando tudo e o adesivo dentro da área segura (ícones de tela inicial,
 * que o Android e o iOS recortam em círculo ou squircle). Sem `bleed`, só o adesivo (favicon).
 */
export function renderAppIcon(size: number, { bleed }: { bleed: boolean }) {
  // 56% cabe no círculo seguro de 80% dos ícones "maskable" (diagonal ≈ 79%).
  const sticker = Math.round(size * (bleed ? 0.56 : 0.9));
  const border = Math.max(2, Math.round(sticker * 0.06));
  const shadow = Math.max(1, Math.round(sticker * 0.07));

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: bleed ? ICON_BACKGROUND : 'transparent',
        }}
      >
        <div
          style={{
            width: sticker,
            height: sticker,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: LIME,
            color: INK,
            border: `${border}px solid ${INK}`,
            borderRadius: Math.round(sticker * 0.24),
            boxShadow: `${shadow}px ${shadow}px 0 0 ${INK}`,
            fontSize: Math.round(sticker * 0.62),
            fontWeight: 900,
            lineHeight: 1,
          }}
        >
          $
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
