"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Brain, Camera, Download, FileText, LoaderCircle, LockKeyhole, Plus, Sparkles, Trash2 } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { portraitToMarkdown, type TwinInputEntry, type TwinPortrait } from "@/lib/digital-twin";
import { clearTwinEntries, deleteTwinEntry, listTwinEntries, saveTwinEntry, type StoredTwinEntry } from "@/lib/digital-twin-store";

const demoPortrait: TwinPortrait = {
  title: "A day shaped by curiosity and forward motion",
  snapshot: "Today’s entries suggest someone balancing practical progress with reflection. You seem to notice friction quickly, but you also turn it into questions and possible experiments rather than leaving it unresolved.",
  themes: ["Making tangible progress", "Looking for better systems", "Protecting time and attention"],
  valuesInAction: ["Curiosity appears in the questions you chose to record.", "Practicality appears in the next actions attached to those questions."],
  recurringPatterns: ["You move between observation and problem-solving.", "You appear to prefer concrete experiments over abstract certainty."],
  openQuestions: ["Which activity gave you the most energy today?", "What deserves another day of attention, and what can be dropped?"],
  evidenceNote: "Demo reflection only. A real portrait should remain provisional because one day of selected notes cannot define a person.",
};

function EntryPhoto({ blob, name }: { blob: Blob; name?: string }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => {
    return () => URL.revokeObjectURL(url);
  }, [url]);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={name ? `Saved moment: ${name}` : "Saved moment"} className="h-24 w-24 rounded-xl object-cover"/>;
}

export default function DigitalTwinPage() {
  const photoRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<StoredTwinEntry[]>([]);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [portrait, setPortrait] = useState<TwinPortrait | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "generating" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    listTwinEntries().then((saved) => { setEntries(saved); setStatus("ready"); }).catch(() => { setStatus("error"); setMessage("This browser could not open private local storage."); });
  }, []);

  const inputs = useMemo<TwinInputEntry[]>(() => entries.map((entry) => ({ id: entry.id, kind: entry.kind, text: entry.text, createdAt: entry.createdAt, hasPhoto: Boolean(entry.photo), photoName: entry.photoName })), [entries]);
  const markdown = useMemo(() => portrait ? portraitToMarkdown(portrait, inputs) : "", [portrait, inputs]);

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    if (selected && (!selected.type.startsWith("image/") || selected.size > 10 * 1024 * 1024)) {
      setMessage("Choose an image under 10 MB."); setStatus("error"); return;
    }
    setPhoto(selected); setMessage(""); if (status === "error") setStatus("ready");
  }

  async function addEntry() {
    if (!text.trim() && !photo) return;
    setStatus("saving");
    const entry: StoredTwinEntry = { id: crypto.randomUUID(), kind: photo ? "moment" : "thought", text: text.trim(), createdAt: new Date().toISOString(), photo: photo ?? undefined, photoName: photo?.name };
    try {
      await saveTwinEntry(entry);
      setEntries((current) => [entry, ...current]);
      setText(""); setPhoto(null); setPortrait(null); setStatus("ready");
      if (photoRef.current) photoRef.current.value = "";
    } catch { setStatus("error"); setMessage("The entry could not be saved in this browser."); }
  }

  async function removeEntry(id: string) {
    await deleteTwinEntry(id);
    setEntries((current) => current.filter((entry) => entry.id !== id));
    setPortrait(null);
  }

  async function removeEverything() {
    if (!window.confirm("Delete every Digital Twin entry stored in this browser? This cannot be undone.")) return;
    await clearTwinEntries();
    setEntries([]); setPortrait(null); setMessage(""); setStatus("ready");
  }

  async function generatePortrait() {
    if (inputs.length < 2) return;
    setStatus("generating"); setMessage("");
    try {
      const response = await fetch("/api/digital-twin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries: inputs }) });
      const payload = (await response.json()) as TwinPortrait & { error?: string; requestId?: string };
      if (!response.ok) throw new Error(`${payload.error ?? "Reflection is unavailable."}${payload.requestId ? ` Reference: ${payload.requestId}` : ""}`);
      setPortrait(payload); setStatus("ready");
    } catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "Reflection is unavailable."); }
  }

  function downloadMarkdown() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `digital-twin-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return <main className="min-h-screen bg-[#f4f0e7] text-[#20251f]">
    <AppNav active="digital-twin" />
    <section className="mx-auto max-w-6xl px-5 pb-12 pt-12 sm:px-8 sm:pt-20">
      <div className="grid items-end gap-8 lg:grid-cols-[1.1fr_.9fr]">
        <div><p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#1d5961]">Private daily memory · on this device</p><h1 className="max-w-4xl font-serif text-[clamp(3.1rem,8vw,6.5rem)] leading-[0.92] tracking-[-0.055em]">Build a twin you can disagree with.</h1></div>
        <p className="max-w-lg pb-2 text-lg leading-7 text-[#556157]">Collect moments and thoughts through the day. Turn your own words into an editable Markdown reflection—not a permanent verdict about who you are.</p>
      </div>
    </section>

    <section className="border-y border-[#20251f]/10 bg-[#fbf9f3]">
      <div className="mx-auto grid max-w-6xl gap-7 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-[.92fr_1.08fr]">
        <div className="space-y-6">
          <article className="rounded-[2rem] bg-[#1d5961] p-7 text-white sm:p-9">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b9d5d6]">Capture an entry</p>
            <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} placeholder="What happened? What did you notice, want, avoid or decide? If you add a photo, explain what it means to you." className="mt-5 min-h-40 w-full resize-y rounded-2xl border border-white/15 bg-white/10 p-4 leading-6 text-white outline-none placeholder:text-[#b9d5d6] focus:border-white/50"/>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={() => photoRef.current?.click()} className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold"><Camera size={16}/> {photo ? "Change photo" : "Add photo"}</button>
              {photo && <span className="max-w-52 truncate text-xs text-[#d7e8e8]">{photo.name}</span>}
              <button disabled={(!text.trim() && !photo) || status === "saving"} onClick={addEntry} className="ml-auto flex items-center gap-2 rounded-full bg-[#fff8ef] px-5 py-2.5 text-sm font-semibold text-[#164950] disabled:opacity-50">{status === "saving" ? <LoaderCircle className="animate-spin" size={16}/> : <Plus size={16}/>} Save</button>
            </div>
            <input ref={photoRef} type="file" accept="image/*" capture="environment" onChange={choosePhoto} className="sr-only"/>
          </article>

          <aside className="rounded-[1.7rem] border border-[#1d5961]/15 bg-[#e6efee] p-6 text-sm leading-6 text-[#365d60]"><p className="flex items-center gap-2 font-semibold text-[#164950]"><LockKeyhole size={17}/> Local-first privacy</p><p className="mt-2">Entries and photos stay in this browser’s IndexedDB. When you generate a reflection, only your written entries and photo filenames—not the photo files—are sent to the selected AI provider. Clearing browser data can erase them.</p></aside>

          <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1d5961]">Today’s trail</p><p className="mt-1 text-sm text-[#718076]">{entries.length} {entries.length === 1 ? "entry" : "entries"} saved</p></div>{entries.length > 0 && <button onClick={removeEverything} className="flex items-center gap-2 text-sm text-[#a04632]"><Trash2 size={15}/> Clear all</button>}</div>
          <div className="space-y-3">{entries.map((entry) => <article key={entry.id} className="flex gap-4 rounded-2xl border border-[#20251f]/10 bg-white p-4">{entry.photo && <EntryPhoto blob={entry.photo} name={entry.photoName}/>}<div className="min-w-0 flex-1"><p className="text-xs text-[#718076]">{new Date(entry.createdAt).toLocaleString("en-AU")}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{entry.text || "Photo saved without a caption. Add a caption next time if you want it reflected in the twin."}</p></div><button onClick={() => removeEntry(entry.id)} aria-label="Delete entry" className="h-fit p-2 text-[#9a6a61]"><Trash2 size={15}/></button></article>)}{status === "loading" && <p className="py-8 text-center text-sm text-[#718076]">Opening your private journal…</p>}{status !== "loading" && entries.length === 0 && <div className="rounded-2xl border border-dashed border-[#20251f]/20 p-8 text-center text-sm text-[#718076]">Your first saved thought or moment will appear here.</div>}</div>
        </div>

        <div className="h-fit rounded-[2rem] bg-[#20251f] p-7 text-[#fff8ef] sm:p-9 lg:sticky lg:top-6">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#aeb9b0]">Working self-portrait</p><h2 className="mt-3 font-serif text-4xl tracking-[-0.035em]">{portrait?.title ?? "Not enough evidence yet"}</h2></div><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#1d5961]"><Brain size={21}/></span></div>
          {!portrait ? <>
            <p className="mt-5 leading-7 text-[#d7e0da]">Add at least two meaningful entries. The reflection will look for themes and patterns while preserving uncertainty.</p>
            <button disabled={inputs.length < 2 || status === "generating"} onClick={generatePortrait} className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-[#fff8ef] px-5 py-3.5 font-semibold text-[#20251f] disabled:opacity-40">{status === "generating" ? <><LoaderCircle className="animate-spin" size={18}/> Reflecting…</> : <><Sparkles size={18}/> Generate my reflection</>}</button>
            {status === "error" && <div className="mt-5 rounded-2xl bg-white/10 p-4 text-sm leading-5"><p>{message}</p>{inputs.length >= 2 && <button onClick={() => { setPortrait(demoPortrait); setStatus("ready"); setMessage(""); }} className="mt-3 font-semibold underline underline-offset-4">Preview labelled demo reflection</button>}</div>}
          </> : <>
            <p className="mt-5 leading-7 text-[#d7e0da]">{portrait.snapshot}</p>
            <div className="mt-7 grid gap-5"><section><h3 className="text-sm font-semibold text-[#b9d5d6]">Themes</h3><ul className="mt-2 space-y-2">{portrait.themes.map((item) => <li key={item} className="rounded-xl bg-white/7 p-3 text-sm">{item}</li>)}</ul></section><section><h3 className="text-sm font-semibold text-[#b9d5d6]">Patterns worth noticing</h3><ul className="mt-2 space-y-2">{portrait.recurringPatterns.map((item) => <li key={item} className="text-sm leading-6 text-[#d7e0da]">— {item}</li>)}</ul></section><section><h3 className="text-sm font-semibold text-[#b9d5d6]">Questions for tomorrow</h3><ul className="mt-2 space-y-2">{portrait.openQuestions.map((item) => <li key={item} className="text-sm leading-6 text-[#d7e0da]">— {item}</li>)}</ul></section></div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row"><button onClick={downloadMarkdown} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#fff8ef] px-5 py-3 font-semibold text-[#20251f]"><Download size={17}/> Download .md</button><button onClick={generatePortrait} className="flex items-center justify-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold"><Sparkles size={16}/> Regenerate</button></div>
            <p className="mt-5 text-xs leading-5 text-[#aeb9b0]">{portrait.evidenceNote}</p>
          </>}
          <div className="mt-8 flex items-start gap-3 border-t border-white/10 pt-5 text-xs leading-5 text-[#aeb9b0]"><FileText className="mt-0.5 shrink-0" size={15}/><p>The Markdown export includes the generated reflection and your source text. Photos remain in this browser and are listed by filename only.</p></div>
        </div>
      </div>
    </section>
  </main>;
}
