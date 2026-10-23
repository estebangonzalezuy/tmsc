import { hash01 } from "@/lib/illus/drawers";

/* A title card: a flat field from the brand palette and the title set in
   type. The drawing that used to sit behind the words is gone — a cover is
   typography on a colour, which is also what a newsletter swatch is. */

const GROUNDS: { block: string; type: string }[] = [
  { block: "bg-accent", type: "text-white" },
  { block: "bg-accent-warm", type: "text-black" },
  { block: "bg-accent-soft", type: "text-black" },
];

export default function Cover({
  slug,
  title,
  className = "",
}: {
  slug: string;
  title: string;
  className?: string;
}) {
  const { block, type } = GROUNDS[Math.floor(hash01(slug) * 42) % GROUNDS.length];
  return (
    <div
      className={`relative flex aspect-square items-end p-5 ${block} ${type} ${className}`}
    >
      <p className="font-serif text-lg leading-[0.95] tracking-[-0.03em]">{title}</p>
    </div>
  );
}
