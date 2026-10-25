"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Camera, Check, ChevronRight, ImagePlus, LoaderCircle, Lock, Plus, RotateCcw, ShoppingBag, Sparkles, X } from "lucide-react";

type Garment = { id: string; category: string; colour: string; style: string };
type Gap = { name: string; reason: string; priority: "High" | "Useful"; query: string };
type Analysis = { styleName: string; styleSummary: string; palette: string[]; garments: Garment[]; gaps: Gap[]; confidenceNote: string };

const demoAnalysis: Analysis = {
  styleName: "Relaxed minimal",
  styleSummary: "Your visible wardrobe leans toward clean, easy layers in navy, white and muted neutrals. It is strong for casual days but has fewer smart-casual options.",
  palette: ["#18243a", "#ece8df", "#8b7666", "#b7b8b3", "#f6f4ef"],
  garments: [
    { id: "g1", category: "T-shirt", colour: "White", style: "Basic" },
    { id: "g2", category: "Shirt", colour: "Navy", style: "Casual" },
    { id: "g3", category: "Jeans", colour: "Blue", style: "Straight" },
    { id: "g4", category: "Jacket", colour: "Taupe", style: "Lightweight" },
    { id: "g5", category: "Sneakers", colour: "White", style: "Minimal" },
  ],
  gaps: [
    { name: "Unstructured blazer", reason: "Adds a smart layer while still working with your tees, jeans and sneakers.", priority: "High", query: "unstructured navy blazer relaxed fit Australia" },
    { name: "Textured knit", reason: "Introduces depth without moving away from your muted palette.", priority: "Useful", query: "neutral textured knit crew neck Australia" },
    { name: "Dark tailored trousers", reason: "Creates more polished combinations with the shirts already visible.", priority: "High", query: "dark tailored trousers straight fit Australia" },
  ],
  confidenceNote: "Based on one wardrobe photo. Items behind other clothes or outside the frame may change these suggestions.",
};

const newGarment = (): Garment => ({ id: crypto.randomUUID(), category: "New item", colour: "Unknown", style: "" });

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "analysing" | "review" | "error">("idle");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const step = status === "review" ? 3 : preview ? 2 : 1;
  const shoppingLinks = useMemo(() => (analysis?.gaps ?? []).map((gap) => ({ ...gap, href: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(gap.query)}` })), [analysis]);

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    if (!chosen) return;
    if (!chosen.type.startsWith("image/")) { setMessage("Please choose a photo from your camera or photo library."); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(chosen); setPreview(URL.createObjectURL(chosen)); setAnalysis(null); setStatus("idle"); setMessage("");
  }

  async function analysePhoto() {
    if (!file) return;
    setStatus("analysing"); setMessage("");
    const form = new FormData(); form.append("image", file);
    try {
      const response = await fetch("/api/analyse", { method: "POST", body: form });
      const payload = (await response.json()) as Analysis & { error?: string; requestId?: string };
      if (!response.ok) {
        const reference = payload.requestId ? ` Reference: ${payload.requestId}` : "";
        throw new Error(`${payload.error ?? "Analysis is unavailable."}${reference}`);
      }
      setAnalysis(payload); setStatus("review");
    } catch (error) {
      setStatus("error"); setMessage(error instanceof Error ? error.message : "Analysis is unavailable.");
    }
  }

  function useDemo() { setAnalysis(demoAnalysis); setStatus("review"); setMessage(""); }
  function updateGarment(id: string, key: "category" | "colour", value: string) {
    if (analysis) setAnalysis({ ...analysis, garments: analysis.garments.map((g) => g.id === id ? { ...g, [key]: value } : g) });
  }
  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null); setFile(null); setAnalysis(null); setStatus("idle"); setMessage("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <main className="min-h-screen bg-[#f4f0e7] text-[#20251f]">
      <nav className="border-b border-[#20251f]/10 bg-[#f4f0e7]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <a href="#top" className="flex items-center gap-2 font-semibold tracking-[-0.02em]"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#2d4a3e] text-[#fffaf0]"><Sparkles size={17}/></span>Closet Compass</a>
          <span className="flex items-center gap-1.5 text-xs text-[#556157]"><Lock size={13}/> Photo analysed securely</span>
        </div>
      </nav>

      <section id="top" className="mx-auto max-w-6xl px-5 pb-14 pt-12 sm:px-8 sm:pt-20">
        <div className="grid items-end gap-9 lg:grid-cols-[1.12fr_.88fr]">
          <div><p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#b25536]">Your wardrobe, made more useful</p><h1 className="max-w-3xl font-serif text-[clamp(3.1rem,8vw,6.7rem)] leading-[0.91] tracking-[-0.055em]">Shop what your wardrobe needs.</h1></div>
          <div className="max-w-lg pb-2 lg:justify-self-end"><p className="text-lg leading-7 text-[#556157]">Take one clear photo. We’ll map the clothes we can see, describe your style and suggest versatile pieces—not more of the same.</p><div className="mt-6 flex items-center gap-3 text-sm font-medium"><span>1 · Photograph</span><ChevronRight size={14}/><span>2 · Review</span><ChevronRight size={14}/><span>3 · Discover</span></div></div>
        </div>
      </section>

      <section className="border-y border-[#20251f]/10 bg-[#fbf9f3]">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
          <div className="mb-7 flex items-center justify-between">
            <div className="flex items-center gap-3">{[1,2,3].map((item) => <span key={item} className={`grid h-8 w-8 place-items-center rounded-full text-sm font-semibold ${step >= item ? "bg-[#2d4a3e] text-white" : "border border-[#2d4a3e]/20 text-[#718076]"}`}>{step > item ? <Check size={15}/> : item}</span>)}</div>
            {preview && <button onClick={reset} className="flex items-center gap-2 text-sm text-[#556157]"><RotateCcw size={15}/> Start over</button>}
          </div>

          {!preview && <div className="grid gap-6 lg:grid-cols-[1fr_310px]">
            <button onClick={() => inputRef.current?.click()} className="group min-h-[390px] rounded-[2rem] border border-dashed border-[#2d4a3e]/35 bg-[#e8ede5] p-8 text-left transition hover:bg-[#e1e9df] sm:p-12">
              <span className="mb-16 grid h-16 w-16 place-items-center rounded-full bg-[#2d4a3e] text-white"><Camera size={28}/></span><h2 className="font-serif text-4xl tracking-[-0.035em]">Photograph your wardrobe</h2><p className="mt-3 max-w-md leading-6 text-[#556157]">Stand back, open the doors and include as many hanging clothes, shelves and shoes as possible.</p><span className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#20251f] px-5 py-3 text-sm font-semibold text-white">Open camera <ArrowRight size={16}/></span>
            </button>
            <aside className="rounded-[2rem] bg-[#d95d39] p-7 text-[#fff8ef] sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">For a better read</p><ol className="mt-10 space-y-8">{["Use natural light", "Keep colours visible", "Take a second photo later for drawers"].map((tip,index) => <li key={tip} className="flex gap-4"><span className="font-serif text-3xl opacity-50">0{index+1}</span><span className="pt-2 leading-5">{tip}</span></li>)}</ol></aside>
          </div>}

          {preview && status !== "review" && <div className="grid gap-7 lg:grid-cols-[1.15fr_.85fr]">
            <div className="relative min-h-[440px] overflow-hidden rounded-[2rem] bg-[#d8d8d2]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Your selected wardrobe" className="absolute inset-0 h-full w-full object-cover"/>
              <button onClick={() => inputRef.current?.click()} className="absolute bottom-5 left-5 flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold shadow-sm"><ImagePlus size={15}/> Choose another</button>
            </div>
            <div className="flex flex-col justify-center rounded-[2rem] bg-[#2d4a3e] p-8 text-white sm:p-10"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#bfcfc4]">Photo ready</p><h2 className="mt-5 font-serif text-4xl tracking-[-0.035em]">Let’s see what works together.</h2><p className="mt-4 leading-6 text-[#d7e0da]">We only assess visible clothing. You’ll review every detected item before recommendations are made.</p><button disabled={status === "analysing"} onClick={analysePhoto} className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-[#fff8ef] px-5 py-3.5 font-semibold text-[#2d4a3e] disabled:opacity-70">{status === "analysing" ? <><LoaderCircle className="animate-spin" size={18}/> Analysing photo…</> : <><Sparkles size={18}/> Analyse my wardrobe</>}</button>{status === "error" && <div className="mt-5 rounded-2xl bg-black/15 p-4 text-sm leading-5"><p>{message}</p><button onClick={useDemo} className="mt-3 font-semibold underline underline-offset-4">Preview clearly labelled demo results</button></div>}</div>
          </div>}

          {analysis && status === "review" && <div className="space-y-8">
            <div className="grid gap-6 lg:grid-cols-[.72fr_1.28fr]">
              <article className="rounded-[2rem] bg-[#2d4a3e] p-8 text-white sm:p-10"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#bfcfc4]">Your visible style</p><h2 className="mt-5 font-serif text-5xl leading-none tracking-[-0.04em]">{analysis.styleName}</h2><p className="mt-6 leading-6 text-[#d7e0da]">{analysis.styleSummary}</p><div className="mt-8 flex gap-2" aria-label="Detected colour palette">{analysis.palette.map((colour) => <span key={colour} className="h-9 w-9 rounded-full border border-white/20" style={{backgroundColor:colour}}/>)}</div></article>
              <article className="rounded-[2rem] border border-[#20251f]/10 bg-white p-6 sm:p-8"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b25536]">Check the inventory</p><h2 className="mt-2 font-serif text-3xl tracking-[-0.03em]">What we could see</h2></div><button onClick={() => setAnalysis({...analysis, garments:[...analysis.garments,newGarment()]})} className="grid h-10 w-10 place-items-center rounded-full border border-[#20251f]/15" aria-label="Add garment"><Plus size={17}/></button></div>
                <div className="mt-6 space-y-3">{analysis.garments.map((garment) => <div key={garment.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-2xl bg-[#f4f0e7] p-2"><input aria-label="Garment category" value={garment.category} onChange={(e)=>updateGarment(garment.id,"category",e.target.value)} className="min-w-0 rounded-xl bg-white px-3 py-2.5 text-sm outline-none"/><input aria-label="Garment colour" value={garment.colour} onChange={(e)=>updateGarment(garment.id,"colour",e.target.value)} className="min-w-0 rounded-xl bg-white px-3 py-2.5 text-sm outline-none"/><button onClick={()=>setAnalysis({...analysis,garments:analysis.garments.filter((g)=>g.id!==garment.id)})} aria-label={`Remove ${garment.category}`} className="grid h-10 w-10 place-items-center rounded-xl text-[#718076]"><X size={16}/></button></div>)}</div><p className="mt-5 text-xs leading-5 text-[#718076]">{analysis.confidenceNote}</p>
              </article>
            </div>
            <div><div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b25536]">Fill useful gaps</p><h2 className="mt-2 font-serif text-4xl tracking-[-0.035em]">Three pieces that unlock more outfits</h2></div><span className="text-sm text-[#718076]">Shopping searches open in a new tab</span></div><div className="grid gap-4 md:grid-cols-3">{shoppingLinks.map((gap,index) => <article key={gap.name} className="flex min-h-[290px] flex-col rounded-[1.7rem] border border-[#20251f]/10 bg-white p-6"><div className="flex items-center justify-between"><span className="font-serif text-3xl text-[#b25536]">0{index+1}</span><span className={`rounded-full px-3 py-1 text-xs font-semibold ${gap.priority === "High" ? "bg-[#f9dfd5] text-[#913e27]" : "bg-[#e8ede5] text-[#2d4a3e]"}`}>{gap.priority} priority</span></div><h3 className="mt-8 text-xl font-semibold">{gap.name}</h3><p className="mt-3 text-sm leading-6 text-[#667168]">{gap.reason}</p><a href={gap.href} target="_blank" rel="noreferrer" className="mt-auto flex items-center justify-between border-t border-[#20251f]/10 pt-5 text-sm font-semibold">Browse online <ShoppingBag size={17}/></a></article>)}</div></div>
          </div>}
          <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={choosePhoto} className="sr-only"/>
        </div>
      </section>
      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-xs text-[#718076] sm:flex-row sm:justify-between sm:px-8"><p>Closet Compass · Recommendations are suggestions, not rules.</p><p>We never infer your body, gender, age or identity from a wardrobe photo.</p></footer>
    </main>
  );
}
