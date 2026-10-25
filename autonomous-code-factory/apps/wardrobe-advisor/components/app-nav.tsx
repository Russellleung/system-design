import { Camera, Shirt, Sparkles } from "lucide-react";
import Link from "next/link";

export function AppNav({ active }: { active: "wardrobe" | "photo-coach" }) {
  return (
    <nav className="border-b border-[#20251f]/10 bg-[#f4f0e7]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-[-0.02em]">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#2d4a3e] text-[#fffaf0]"><Sparkles size={17}/></span>
          Closet Compass
        </Link>
        <div className="flex w-fit gap-1 rounded-full border border-[#20251f]/10 bg-white/70 p-1 text-sm font-semibold">
          <Link href="/" aria-current={active === "wardrobe" ? "page" : undefined} className={`flex items-center gap-2 rounded-full px-4 py-2 ${active === "wardrobe" ? "bg-[#2d4a3e] text-white" : "text-[#556157]"}`}><Shirt size={15}/> Wardrobe</Link>
          <Link href="/photo-coach" aria-current={active === "photo-coach" ? "page" : undefined} className={`flex items-center gap-2 rounded-full px-4 py-2 ${active === "photo-coach" ? "bg-[#d95d39] text-white" : "text-[#556157]"}`}><Camera size={15}/> Photo coach</Link>
        </div>
      </div>
    </nav>
  );
}
