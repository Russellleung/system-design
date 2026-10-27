import { Brain, Camera, Heart, Shirt, Sparkles, Star } from "lucide-react";
import Link from "next/link";

type AppTab = "wardrobe" | "photo-coach" | "rate-me" | "visual-match" | "digital-twin";

const tabs = [
  { id: "wardrobe", href: "/", label: "Wardrobe", icon: Shirt, activeClass: "bg-[#2d4a3e] text-white" },
  { id: "photo-coach", href: "/photo-coach", label: "Photo coach", icon: Camera, activeClass: "bg-[#d95d39] text-white" },
  { id: "rate-me", href: "/rate-me", label: "Rate me", icon: Star, activeClass: "bg-[#57477d] text-white" },
  { id: "visual-match", href: "/visual-match", label: "Visual match", icon: Heart, activeClass: "bg-[#9f3d61] text-white" },
  { id: "digital-twin", href: "/digital-twin", label: "Digital twin", icon: Brain, activeClass: "bg-[#1d5961] text-white" },
] as const;

export function AppNav({ active }: { active: AppTab }) {
  return (
    <nav className="border-b border-[#20251f]/10 bg-[#f4f0e7]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-[-0.02em]">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#2d4a3e] text-[#fffaf0]"><Sparkles size={17}/></span>
          Closet Compass
        </Link>
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-[#20251f]/10 bg-white/70 p-1 text-sm font-semibold">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return <Link key={tab.id} href={tab.href} aria-current={active === tab.id ? "page" : undefined} className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 ${active === tab.id ? tab.activeClass : "text-[#556157]"}`}><Icon size={15}/> {tab.label}</Link>;
          })}
        </div>
      </div>
    </nav>
  );
}
