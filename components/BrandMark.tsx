/** Marca do app: "$" num adesivo lima com borda e sombra duras. */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-xl border-2 border-black bg-lime-300 font-black text-neutral-900 shadow-[2px_2px_0_0_#000]"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      $
    </span>
  );
}
