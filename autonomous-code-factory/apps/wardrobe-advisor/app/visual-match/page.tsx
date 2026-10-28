"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Camera, Download, Heart, ImagePlus, LoaderCircle, RotateCcw, ShieldCheck, SlidersHorizontal, Sparkles } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { PhotoCropper } from "@/components/photo-cropper";
import type { VisualMatchSelections } from "@/lib/visual-match";
import type { VisualMatchAnalysis } from "@/lib/visual-match-analysis";

type Choice = { value: string; label: string };
type ChoiceGroup = { key: keyof VisualMatchSelections; label: string; choices: Choice[] };

const groups: ChoiceGroup[] = [
  { key: "height", label: "Height beside you", choices: [
    { value: "ai", label: "AI decides" }, { value: "very-tall", label: "Very tall" }, { value: "tall", label: "Tall" },
    { value: "similar", label: "Similar" }, { value: "short", label: "Short" }, { value: "very-short", label: "Very short" },
  ] },
  { key: "build", label: "Body build", choices: [
    { value: "ai", label: "AI decides" }, { value: "slim", label: "Slim" }, { value: "average", label: "Average" },
    { value: "athletic", label: "Athletic" }, { value: "muscular", label: "Muscular" }, { value: "curvy", label: "Curvy" }, { value: "plus-size", label: "Plus-size" },
  ] },
  { key: "appearance", label: "Appearance", choices: [
    { value: "ai", label: "AI decides" }, { value: "east-asian", label: "East Asian" }, { value: "southeast-asian", label: "Southeast Asian" },
    { value: "south-asian", label: "South Asian" }, { value: "black", label: "Black" }, { value: "white", label: "White" },
    { value: "hispanic-latina", label: "Hispanic / Latina" }, { value: "middle-eastern", label: "Middle Eastern" }, { value: "mixed", label: "Mixed" },
  ] },
  { key: "age", label: "Apparent adult age", choices: [
    { value: "ai", label: "AI decides" }, { value: "similar-adult-age", label: "Similar age" },
    { value: "slightly-younger-adult", label: "Slightly younger" }, { value: "slightly-older-adult", label: "Slightly older" },
  ] },
  { key: "style", label: "Style", choices: [
    { value: "ai", label: "AI decides" }, { value: "casual", label: "Casual" }, { value: "elegant", label: "Elegant" },
    { value: "sporty", label: "Sporty" }, { value: "alternative", label: "Alternative" }, { value: "professional", label: "Professional" }, { value: "streetwear", label: "Streetwear" },
  ] },
  { key: "energy", label: "Energy", choices: [
    { value: "ai", label: "AI decides" }, { value: "warm", label: "Warm" }, { value: "confident", label: "Confident" },
    { value: "reserved", label: "Reserved" }, { value: "playful", label: "Playful" }, { value: "glamorous", label: "Glamorous" },
  ] },
  { key: "pose", label: "Couple pose", choices: [
    { value: "ai", label: "AI decides" }, { value: "standing-together", label: "Standing together" }, { value: "arm-around", label: "Arm around" },
    { value: "holding-hands", label: "Holding hands" }, { value: "seated", label: "Seated" }, { value: "laughing-candidly", label: "Laughing candidly" },
  ] },
  { key: "setting", label: "Outfit context", choices: [
    { value: "ai", label: "AI decides" }, { value: "cafe", label: "Café" }, { value: "city", label: "City" },
    { value: "beach", label: "Beach" }, { value: "formal-event", label: "Formal event" }, { value: "hiking", label: "Hiking" }, { value: "home", label: "At home" },
  ] },
  { key: "placement", label: "Place partner", choices: [
    { value: "right", label: "On my right" }, { value: "left", label: "On my left" },
  ] },
];

const aiSelections = Object.fromEntries(groups.map((group) => [group.key, group.choices[0].value])) as VisualMatchSelections;
const attributeGroups = groups.filter((group) => group.key !== "placement");

function loadBrowserImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("This photo could not be prepared for image generation."));
    element.src = source;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, type = "image/jpeg", quality = 0.94) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (value) => value ? resolve(value) : reject(new Error("The prepared photo could not be created.")),
    type,
    quality,
  ));
}

async function prepareOpenAIReference(source: File) {
  const sourceUrl = URL.createObjectURL(source);
  try {
    const image = await loadBrowserImage(sourceUrl);
    const scale = Math.min(1, 1536 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(16, Math.floor(image.naturalWidth * scale / 16) * 16);
    canvas.height = Math.max(16, Math.floor(image.naturalHeight * scale / 16) * 16);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot prepare the photo.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await canvasBlob(canvas);
    const baseName = source.name.replace(/\.[^.]+$/, "") || "visual-match";
    return new File([blob], `${baseName}-reference.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

async function createPlacementMask(source: File, placement: VisualMatchSelections["placement"], widthPercent: number) {
  const sourceUrl = URL.createObjectURL(source);
  try {
    const image = await loadBrowserImage(sourceUrl);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot prepare the edit area.");
    context.fillStyle = "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const editWidth = Math.round(canvas.width * widthPercent / 100);
    context.clearRect(placement === "right" ? canvas.width - editWidth : 0, 0, editWidth, canvas.height);
    const blob = await canvasBlob(canvas, "image/png");
    return {
      file: new File([blob], "visual-match-mask.png", { type: "image/png", lastModified: Date.now() }),
      size: `${canvas.width}x${canvas.height}`,
    };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export default function VisualMatchPage() {
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropPreview, setCropPreview] = useState<string | null>(null);
  const [selections, setSelections] = useState<VisualMatchSelections>(aiSelections);
  const [tuning, setTuning] = useState(false);
  const [confirmedAdult, setConfirmedAdult] = useState(false);
  const [confirmedClearZone, setConfirmedClearZone] = useState(false);
  const [maskWidthPercent, setMaskWidthPercent] = useState(46);
  const [result, setResult] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<VisualMatchAnalysis | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [analysisMessage, setAnalysisMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => () => { if (cropPreview) URL.revokeObjectURL(cropPreview); }, [cropPreview]);

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (!chosen) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(chosen.type) || chosen.size > 10 * 1024 * 1024) {
      setStatus("error");
      setMessage("Choose a JPEG, PNG or WebP image under 10 MB.");
      return;
    }
    if (cropPreview) URL.revokeObjectURL(cropPreview);
    setCropFile(chosen);
    setCropPreview(URL.createObjectURL(chosen));
    setStatus("idle");
    setMessage("");
  }

  async function applyCrop(nextFile: File) {
    try {
      const preparedFile = await prepareOpenAIReference(nextFile);
      if (preview) URL.revokeObjectURL(preview);
      setFile(preparedFile);
      setPreview(URL.createObjectURL(preparedFile));
      setCropFile(null);
      setCropPreview(null);
      setResult(null);
      setConfirmedAdult(false);
      setConfirmedClearZone(false);
      setStatus("idle");
      setMessage("");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "The photo could not be prepared.");
    }
  }

  function setChoice(key: keyof VisualMatchSelections, value: string) {
    setSelections((current) => ({ ...current, [key]: value } as VisualMatchSelections));
    if (key === "placement") {
      setConfirmedClearZone(false);
      setResult(null);
      setAnalysis(null);
      setAnalysisStatus("idle");
    }
  }

  function useAiChoices() {
    setSelections((current) => ({ ...aiSelections, placement: current.placement }));
    setTuning(false);
  }

  function changeMaskWidth(widthPercent: number) {
    setMaskWidthPercent(widthPercent);
    setConfirmedClearZone(false);
    setResult(null);
    setAnalysis(null);
    setAnalysisStatus("idle");
    setStatus("idle");
  }

  async function generate() {
    if (!file || !confirmedAdult || !confirmedClearZone) return;
    setStatus("generating");
    setMessage("");
    setAnalysis(null);
    setAnalysisStatus("idle");
    setAnalysisMessage("");
    const form = new FormData();
    form.append("image", file);
    form.append("adultConfirmed", "true");
    for (const [key, value] of Object.entries(selections)) form.append(key, value);
    try {
      const mask = await createPlacementMask(file, selections.placement, maskWidthPercent);
      form.append("mask", mask.file);
      form.append("outputSize", mask.size);
      const response = await fetch("/api/visual-match", { method: "POST", body: form });
      const payload = await response.json() as { imageBase64?: string; mimeType?: string; error?: string; requestId?: string };
      if (!response.ok || !payload.imageBase64) {
        throw new Error(`${payload.error ?? "Visual Match is unavailable."}${payload.requestId ? ` Reference: ${payload.requestId}` : ""}`);
      }
      const generated = `data:${payload.mimeType ?? "image/png"};base64,${payload.imageBase64}`;
      setResult(generated);
      setStatus("done");
      void analyseGeneratedMatch(generated);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Visual Match is unavailable.");
    }
  }

  async function analyseGeneratedMatch(generated: string) {
    setAnalysisStatus("loading");
    setAnalysisMessage("");
    try {
      const blob = await fetch(generated).then((response) => response.blob());
      const form = new FormData();
      form.append("image", new File([blob], "visual-match.png", { type: blob.type || "image/png" }));
      const response = await fetch("/api/visual-match-summary", { method: "POST", body: form });
      const payload = await response.json() as VisualMatchAnalysis & { error?: string; requestId?: string };
      if (!response.ok || !payload.headline) {
        throw new Error(`${payload.error ?? "The visual summary is unavailable."}${payload.requestId ? ` Reference: ${payload.requestId}` : ""}`);
      }
      setAnalysis(payload);
      setAnalysisStatus("done");
    } catch (error) {
      setAnalysisStatus("error");
      setAnalysisMessage(error instanceof Error ? error.message : "The visual summary is unavailable.");
    }
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(null); setResult(null); setAnalysis(null); setAnalysisStatus("idle"); setAnalysisMessage(""); setConfirmedAdult(false); setConfirmedClearZone(false); setStatus("idle"); setMessage("");
  }

  return <main className="min-h-screen bg-[#fbf8f2] text-[#20251f]">
    <AppNav active="visual-match" />
    {cropFile && cropPreview && <PhotoCropper sourceFile={cropFile} sourceUrl={cropPreview} onApply={applyCrop} onCancel={() => { URL.revokeObjectURL(cropPreview); setCropFile(null); setCropPreview(null); }}/>} 

    <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9f3d61]">Visual Match</p>
        <h1 className="mt-3 font-serif text-5xl tracking-[-0.045em] sm:text-6xl">Picture the chemistry.</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-[#626960]">Add a fictional adult partner beside you. Let AI direct the look, or tune the visual details yourself.</p>
      </div>

      {!preview && <div className="mt-10 rounded-[2rem] border border-dashed border-[#9f3d61]/35 bg-[#f3e6eb] p-8 sm:p-12">
        <Heart className="text-[#9f3d61]" size={34}/><h2 className="mt-5 font-serif text-4xl tracking-[-0.035em]">Start with a clear photo of you</h2>
        <p className="mt-3 max-w-xl leading-6 text-[#6a5960]">A solo, well-lit portrait with some space around you gives the model room to add another person naturally.</p>
        <div className="mt-7 flex flex-wrap gap-3"><button onClick={() => cameraInput.current?.click()} className="flex items-center gap-2 rounded-full bg-[#9f3d61] px-5 py-3 font-semibold text-white"><Camera size={17}/> Take photo</button><button onClick={() => libraryInput.current?.click()} className="flex items-center gap-2 rounded-full bg-white px-5 py-3 font-semibold text-[#7d2f4c]"><ImagePlus size={17}/> Choose photo</button></div>
      </div>}

      {preview && <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)]">
        <div className="min-w-0">
          <div className="relative min-h-[520px] overflow-hidden rounded-[2rem] bg-[#282126]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result ?? preview} alt={result ? "AI-generated visual match" : "Selected source portrait"} className="absolute inset-0 h-full w-full object-contain"/>
            {!result && <div style={{ width: `${maskWidthPercent}%` }} className={`pointer-events-none absolute inset-y-0 ${selections.placement === "right" ? "right-0 border-l" : "left-0 border-r"} border-dashed border-white/75 bg-[#9f3d61]/20`}><span className="absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/75 px-3 py-1 text-xs font-semibold text-white">AI can redraw this area</span></div>}
            <div className="absolute bottom-4 left-4 flex flex-wrap gap-2"><button onClick={() => libraryInput.current?.click()} className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold"><ImagePlus size={15}/> Choose another</button>{result && <a href={result} download="closet-compass-visual-match.jpg" className="flex items-center gap-2 rounded-full bg-[#9f3d61] px-4 py-2 text-sm font-semibold text-white"><Download size={15}/> Download</a>}</div>
          </div>
          {result && <div className="mt-3 rounded-2xl bg-[#f3e6eb] p-4 text-sm leading-6 text-[#6d3b4d]"><strong>Fictional AI-generated partner.</strong> This is a visual concept, not a prediction of who would suit you in real life.</div>}
          {result && <div className="mt-3 rounded-2xl border border-[#20251f]/10 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9f3d61]">Why this pairing works</p>
            {analysisStatus === "loading" && <p className="mt-3 flex items-center gap-2 text-sm text-[#667168]"><LoaderCircle className="animate-spin" size={16}/> Reading the visual chemistry…</p>}
            {analysisStatus === "error" && <div className="mt-3 text-sm leading-6 text-[#782d47]"><p>{analysisMessage}</p><button onClick={() => void analyseGeneratedMatch(result)} className="mt-2 font-semibold underline underline-offset-4">Try the summary again</button></div>}
            {analysis && <div className="mt-3 space-y-4 text-sm leading-6 text-[#566057]"><div><h3 className="font-serif text-2xl text-[#20251f]">{analysis.headline}</h3><p className="mt-1">{analysis.summary}</p></div><div className="grid gap-3 sm:grid-cols-2"><p><strong className="block text-[#20251f]">Presentation balance</strong>{analysis.presentationMatch}</p><p><strong className="block text-[#20251f]">Style and colour</strong>{analysis.styleAndColour}</p><p><strong className="block text-[#20251f]">Body language</strong>{analysis.bodyLanguage}</p><p><strong className="block text-[#20251f]">Photo coherence</strong>{analysis.photoCoherence}</p></div><p className="border-t border-[#20251f]/10 pt-3 text-xs leading-5 text-[#777168]">{analysis.limitation}</p></div>}
          </div>}
        </div>

        <div className="min-w-0 rounded-[2rem] bg-[#fffdf9] p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.17em] text-[#9f3d61]">Creative direction</p><h2 className="mt-2 font-serif text-4xl tracking-[-0.035em]">Who stands beside you?</h2></div>{tuning && <button onClick={useAiChoices} className="flex items-center gap-2 rounded-full border border-[#20251f]/15 px-4 py-2 text-sm font-semibold"><Sparkles size={15}/> Reset to AI</button>}</div>
          <div className="mt-6 grid grid-cols-2 rounded-2xl bg-[#f3e6eb] p-1"><button onClick={useAiChoices} className={`rounded-xl px-4 py-3 text-sm font-bold ${!tuning ? "bg-[#9f3d61] text-white" : "text-[#754257]"}`}>AI chooses</button><button onClick={() => setTuning(true)} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${tuning ? "bg-[#9f3d61] text-white" : "text-[#754257]"}`}><SlidersHorizontal size={15}/> Tune it</button></div>

          {!tuning ? <div className="mt-6 rounded-2xl border border-[#9f3d61]/15 bg-[#fbf4f6] p-5 text-sm leading-6 text-[#6a5960]">OpenAI will add a fictional adult partner inside the marked edit area. It is directed to create a believable visual peer with comparable attractiveness, age, grooming and photographic polish—not a generic fashion model. Keep your entire head and body outside the pink area so Sunburst can preserve you through its edit mask. It will not match ethnicity or claim real compatibility.</div> : <div className="mt-6 grid gap-5 sm:grid-cols-2">{attributeGroups.map((group) => <label key={group.key} className="text-sm font-semibold">{group.label}<select value={selections[group.key]} onChange={(event) => setChoice(group.key, event.target.value)} className="mt-2 w-full rounded-xl border border-[#20251f]/15 bg-white px-3 py-3 font-normal outline-none focus:border-[#9f3d61]">{group.choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select></label>)}</div>}

          <fieldset className="mt-6"><legend className="text-sm font-semibold">Where is the empty space?</legend><p className="mt-1 text-xs leading-5 text-[#777168]">Choose the side that does not cover any part of you in pink.</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setChoice("placement", "left")} className={`rounded-xl px-4 py-3 text-sm font-bold ${selections.placement === "left" ? "bg-[#20251f] text-white" : "border border-[#20251f]/15 bg-white"}`}>Add partner left</button><button type="button" onClick={() => setChoice("placement", "right")} className={`rounded-xl px-4 py-3 text-sm font-bold ${selections.placement === "right" ? "bg-[#20251f] text-white" : "border border-[#20251f]/15 bg-white"}`}>Add partner right</button></div></fieldset>

          <label className="mt-5 block text-sm font-semibold">Move the partner closer
            <span className="float-right text-xs font-medium text-[#777168]">Edit area: {maskWidthPercent}%</span>
            <input type="range" min="36" max="50" step="1" value={maskWidthPercent} onChange={(event) => changeMaskWidth(Number(event.target.value))} className="mt-3 w-full accent-[#9f3d61]"/>
            <span className="mt-1 flex justify-between text-xs font-normal text-[#777168]"><span>More distance</span><span>Closer</span></span>
          </label>

          <label className="mt-6 flex cursor-pointer gap-3 rounded-2xl bg-[#f2eee7] p-4 text-sm leading-5"><input type="checkbox" checked={confirmedAdult} onChange={(event) => setConfirmedAdult(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#9f3d61]"/><span>I confirm that the person in my photo is 18+ and has consented to this AI image edit.</span></label>
          <label className="mt-3 flex cursor-pointer gap-3 rounded-2xl bg-[#f5dfe5] p-4 text-sm font-medium leading-5 text-[#6d3b4d]"><input type="checkbox" checked={confirmedClearZone} onChange={(event) => setConfirmedClearZone(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#9f3d61]"/><span>I adjusted the boundary and confirm the pink edit area does not cover any part of my head or body. If it does, I will reduce the edit area, switch sides or choose another photo.</span></label>
          <p className="mt-4 text-xs leading-5 text-[#777168]">Your reference photo is first sent to the configured vision service to calibrate visible attractiveness, grooming and photographic polish. It and the edit mask are then sent to OpenAI and are not stored by Closet Compass. GPT Image edits the marked side and returns one coherent frame; exact preservation outside the mask is model-controlled. Generation uses the paid OpenAI API and may stop if the account reaches its billing limit.</p>
          <button type="button" aria-busy={status === "generating"} disabled={!confirmedAdult || !confirmedClearZone || status === "generating"} onClick={generate} className="relative isolate mt-6 flex min-h-13 w-full overflow-hidden rounded-full bg-[#9f3d61] px-5 py-3.5 font-bold text-white disabled:opacity-45">
            <span className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap">{status === "generating" ? <><Sparkles aria-hidden="true" size={18}/> Creating visual match…</> : <><Heart aria-hidden="true" size={18}/> Create visual match</>}</span>
          </button>
          {status === "error" && <p className="mt-4 rounded-2xl bg-[#f5dfe5] p-4 text-sm leading-6 text-[#782d47]">{message}</p>}
          {result && <button onClick={() => { setResult(null); setAnalysis(null); setAnalysisStatus("idle"); setStatus("idle"); }} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-[#20251f]/15 px-5 py-3 text-sm font-semibold"><RotateCcw size={16}/> Try different choices</button>}
        </div>
      </div>}

      <aside className="mt-8 rounded-[1.7rem] border border-[#20251f]/10 bg-[#f1ede5] p-6 sm:p-8"><p className="flex items-center gap-2 font-semibold"><ShieldCheck size={18}/> What this does—and does not mean</p><p className="mt-3 max-w-4xl text-sm leading-6 text-[#667168]">The generated woman is fictional. The result explores how two people might look in one photograph; it does not measure attraction, personality, relationship success or real compatibility. AI-chosen traits are composition choices, not judgments about which race, body or age “belongs” with you.</p></aside>

      <input ref={cameraInput} type="file" accept="image/*" capture="user" onChange={choosePhoto} className="sr-only"/>
      <input ref={libraryInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} className="sr-only"/>
      {preview && <button onClick={reset} className="mt-6 text-sm font-semibold text-[#7d2f4c] underline underline-offset-4">Clear photo and result</button>}
    </section>
  </main>;
}
