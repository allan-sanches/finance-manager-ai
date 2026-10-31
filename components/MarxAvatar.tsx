'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { useFinanceStore } from '@/lib/store';

// Foto do Marx (public/marx.jpg, 1200×799) já com o brilho vermelho nos olhos.
// - Parado: em cinza, o brilho vira o "branco do olho" e as pupilas seguem o mouse/dedo.
// - Gasto novo lançado (em qualquer tela): o vermelho volta, com laser e contorno neon por uns segundos.

const SRC = '/marx.jpg';
// Recorte quadrado do rosto na foto (px da imagem original) e os olhos dentro dele (fração do recorte).
const IMAGE = { width: 1200, height: 799 };
const CROP = { x: 330, y: 70, size: 520 };
const EYES = [
  { x: (500 - CROP.x) / CROP.size, y: (287 - CROP.y) / CROP.size },
  { x: (670 - CROP.x) / CROP.size, y: (287 - CROP.y) / CROP.size },
];
const LASER_MS = 2800;
/** Lançamento criado agora neste aparelho (os que chegam do servidor têm createdAt antigo). */
const FRESH_MS = 10_000;

const photoStyle: CSSProperties = {
  backgroundImage: `url(${SRC})`,
  backgroundSize: `${(IMAGE.width / CROP.size) * 100}% auto`,
  backgroundPosition: `${(CROP.x / (IMAGE.width - CROP.size)) * 100}% ${(CROP.y / (IMAGE.height - CROP.size)) * 100}%`,
};

/** Liga o laser por alguns segundos quando entra uma despesa nova no store. */
function useLaserOnNewExpense(): boolean {
  const [laser, setLaser] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useFinanceStore.subscribe((state, prev) => {
      if (state.transactions === prev.transactions || !prev.hydrated) return;
      const known = new Set(prev.transactions.map((t) => t.id));
      const now = Date.now();
      const fresh = state.transactions.some(
        (t) =>
          !known.has(t.id) &&
          t.type === 'expense' &&
          t.createdAt !== undefined &&
          now - new Date(t.createdAt).getTime() < FRESH_MS,
      );
      if (!fresh) return;
      setLaser(true);
      clearTimeout(timer);
      timer = setTimeout(() => setLaser(false), LASER_MS);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);
  return laser;
}

/** Desloca as pupilas na direção do ponteiro (mouse ou dedo), sem re-renderizar o React. */
function useEyesFollowPointer(box: React.RefObject<HTMLSpanElement | null>) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    function onMove(event: PointerEvent) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = box.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        // Quanto a pupila anda dentro do olho, em px do avatar.
        const reach = rect.width * 0.035;
        el.querySelectorAll<HTMLElement>('[data-pupil]').forEach((pupil, i) => {
          const cx = rect.left + EYES[i].x * rect.width;
          const cy = rect.top + EYES[i].y * rect.height;
          const angle = Math.atan2(event.clientY - cy, event.clientX - cx);
          const pull = Math.min(1, Math.hypot(event.clientX - cx, event.clientY - cy) / 120);
          pupil.style.transform = `translate(calc(-50% + ${Math.cos(angle) * reach * pull}px), calc(-50% + ${Math.sin(angle) * reach * pull}px))`;
        });
      });
    }
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
    };
  }, [box]);
}

export function MarxAvatar({ size = 44, className = '' }: { size?: number; className?: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const laser = useLaserOnNewExpense();
  useEyesFollowPointer(box);

  return (
    <span
      aria-hidden
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
      data-laser={laser || undefined}
    >
      {/* Laser: sai dos olhos para os lados, por fora do círculo. */}
      {laser &&
        EYES.map((eye, i) => (
          <span
            key={i}
            className="marx-laser pointer-events-none absolute z-10 h-[3px] w-[260%] rounded-full"
            style={{ left: `${eye.x * 100}%`, top: `${eye.y * 100}%` }}
          />
        ))}
      <span
        ref={box}
        className={`marx-ring relative block h-full w-full overflow-hidden rounded-full border-2 ${
          laser ? 'marx-ring-laser border-red-500' : 'border-black'
        }`}
      >
        <span
          className={`absolute inset-0 transition-[filter] duration-300 ${laser ? '' : 'grayscale contrast-125'}`}
          style={photoStyle}
        />
        {EYES.map((eye, i) =>
          laser ? (
            <span
              key={i}
              className="marx-eye-glow absolute rounded-full"
              style={{ left: `${eye.x * 100}%`, top: `${eye.y * 100}%`, width: '26%', height: '26%' }}
            />
          ) : (
            <span
              key={i}
              data-pupil
              className="absolute rounded-full bg-neutral-950 transition-transform duration-75"
              style={{
                left: `${eye.x * 100}%`,
                top: `${eye.y * 100}%`,
                width: '7%',
                height: '7%',
                transform: 'translate(-50%, -50%)',
              }}
            />
          ),
        )}
      </span>
    </span>
  );
}
