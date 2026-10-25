"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, Camera, Eye, EyeOff, FlipHorizontal, ImagePlus, Lightbulb, LoaderCircle, RotateCcw, Sparkles } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { PoseGuide } from "@/components/pose-guide";
import type { PhotoCoachAnalysis } from "@/lib/photo-coach";

const demoAnalysis: PhotoCoachAnalysis = {
  personVisible: true,
  photoSummary: "The subject is clearly visible, while the straight-on camera position and central framing leave room for a more dynamic retake.",
  primarySuggestion: {
    title: "Try a three-quarter angle",
    instruction: "Turn your shoulders slightly away from the camera, then bring your face back toward the lens.",
    reason: "This introduces depth and gives the frame a stronger visual direction without changing who you are.",
  },
  tips: [
    { category: "Angle", title: "Lower the camera slightly", instruction: "Hold the camera around chest height and keep it level.", reason: "A modest height change can make the perspective feel more intentional." },
    { category: "Pose", title: "Create an easy weight shift", instruction: "Place most of your weight on the back leg and let the front knee relax.", reason: "The asymmetry creates a natural line and reduces stiffness." },
    { category: "Framing", title: "Leave space toward the turn", instruction: "Move slightly off-centre and leave more room in the direction your shoulders face.", reason: "Directional space helps the pose feel composed rather than crowded." },
  ],
  poseTemplate: "three-quarter",
  mirrorGuide: false,
  confidenceNote: "Demo advice only. Real analysis adapts suggestions to the visible camera angle, framing and light.",
};

export default function PhotoCoachPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<PhotoCoachAnalysis | null>(null);
  const [status, setStatus] = useState<"idle" | "analysing" | "review" | "error">("idle");
  const [message, setMessage] = useState("");
  const [showGuide, setShowGuide] = useState(true);
  const [guideMirrored, setGuideMirrored] = useState(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    if (!chosen) return;
    if (!chosen.type.startsWith("image/")) {
      setStatus("error");
      setMessage("Please choose a photo from your camera or photo library.");
      return;
    }
    if (chosen.size > 10 * 1024 * 1024) {
      setStatus("error");
      setMessage("Please choose an image under 10 MB.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(chosen);
    setPreview(URL.createObjectURL(chosen));
    setAnalysis(null);
    setStatus("idle");
    setMessage("");
    setShowGuide(true);
  }

  async function analysePhoto() {
    if (!file) return;
    setStatus("analysing");
    setMessage("");
    const form = new FormData();
    form.append("image", file);
    try {
      const response = await fetch("/api/photo-coach", { method: "POST", body: form });
      const payload = (await response.json()) as PhotoCoachAnalysis & { error?: string; requestId?: string };
      if (!response.ok) {
        const reference = payload.requestId ? ` Reference: ${payload.requestId}` : "";
        throw new Error(`${payload.error ?? "Photo coaching is unavailable."}${reference}`);
      }
      setAnalysis(payload);
      setGuideMirrored(payload.mirrorGuide);
      setShowGuide(payload.personVisible && payload.poseTemplate !== "none");
      setStatus("review");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Photo coaching is unavailable.");
    }
  }

  function useDemo() {
    setAnalysis(demoAnalysis);
    setGuideMirrored(demoAnalysis.mirrorGuide);
    setShowGuide(true);
    setStatus("review");
    setMessage("");
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setAnalysis(null);
    setStatus("idle");
    setMessage("");
    setShowGuide(true);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <main className="min-h-screen bg-[#f4f0e7] text-[#20251f]">
      <AppNav active="photo-coach" />

      <section className="mx-auto max-w-6xl px-5 pb-12 pt-12 sm:px-8 sm:pt-20">
        <div className="grid items-end gap-8 lg:grid-cols-[1.1fr_.9fr]">
          <div><p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#b25536]">A better retake, without changing you</p><h1 className="max-w-3xl font-serif text-[clamp(3.1rem,8vw,6.5rem)] leading-[0.92] tracking-[-0.055em]">Coach the camera, not your body.</h1></div>
          <p className="max-w-lg pb-2 text-lg leading-7 text-[#556157]">Upload a photo to get practical ideas for angle, pose, framing and light—plus an optional dotted pose guide for your next shot.</p>
        </div>
      </section>

      <section className="border-y border-[#20251f]/10 bg-[#fbf9f3]">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
          <div className="mb-7 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#556157]">Photo coach · prototype</p>
            {preview && <button onClick={reset} className="flex items-center gap-2 text-sm text-[#556157]"><RotateCcw size={15}/> Start over</button>}
          </div>

          {!preview && <button onClick={() => inputRef.current?.click()} className="group min-h-[430px] w-full rounded-[2rem] border border-dashed border-[#d95d39]/40 bg-[#f5e6dd] p-8 text-left transition hover:bg-[#f2ded3] sm:p-12">
            <span className="mb-20 grid h-16 w-16 place-items-center rounded-full bg-[#d95d39] text-white"><Camera size={28}/></span>
            <h2 className="max-w-xl font-serif text-5xl tracking-[-0.04em]">Choose a portrait or full-body photo</h2>
            <p className="mt-4 max-w-lg leading-6 text-[#667168]">A clear photo with the person fully visible gives the coach more options for composition and pose suggestions.</p>
            <span className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#20251f] px-5 py-3 text-sm font-semibold text-white">Open camera <ArrowRight size={16}/></span>
          </button>}

          {preview && <div className="grid gap-7 lg:grid-cols-[1.08fr_.92fr]">
            <div className="relative min-h-[560px] overflow-hidden rounded-[2rem] bg-[#252925]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Selected photo for coaching" className="absolute inset-0 h-full w-full object-contain"/>
              {analysis && showGuide && <PoseGuide template={analysis.poseTemplate} mirrored={guideMirrored}/>} 
              <button onClick={() => inputRef.current?.click()} className="absolute bottom-5 left-5 flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold shadow-sm"><ImagePlus size={15}/> Choose another</button>
              {analysis?.personVisible && analysis.poseTemplate !== "none" && <div className="absolute bottom-5 right-5 flex gap-2">
                <button onClick={() => setShowGuide((visible) => !visible)} className="grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow-sm" aria-label={showGuide ? "Hide pose guide" : "Show pose guide"}>{showGuide ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
                <button onClick={() => setGuideMirrored((mirrored) => !mirrored)} className="grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow-sm" aria-label="Mirror pose guide"><FlipHorizontal size={16}/></button>
              </div>}
            </div>

            <div className="flex flex-col rounded-[2rem] bg-[#d95d39] p-8 text-[#fff8ef] sm:p-10">
              {!analysis && <>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">Photo ready</p>
                <h2 className="mt-5 font-serif text-4xl tracking-[-0.035em]">Find one stronger way to retake it.</h2>
                <p className="mt-4 leading-6 opacity-90">Advice is limited to photographic technique. We do not score attractiveness or infer identity, age, gender, ethnicity, health, weight or body shape.</p>
                <p className="mt-3 text-xs leading-5 opacity-70">Free prototype: this photo is sent to Google Gemini and may be used by Google to improve its products. Closet Compass does not store it.</p>
                <button disabled={status === "analysing"} onClick={analysePhoto} className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-[#fff8ef] px-5 py-3.5 font-semibold text-[#913e27] disabled:opacity-70">{status === "analysing" ? <><LoaderCircle className="animate-spin" size={18}/> Coaching photo…</> : <><Sparkles size={18}/> Coach this photo</>}</button>
                {status === "error" && <div className="mt-5 rounded-2xl bg-black/15 p-4 text-sm leading-5"><p>{message}</p><button onClick={useDemo} className="mt-3 font-semibold underline underline-offset-4">Preview clearly labelled demo advice</button></div>}
              </>}

              {analysis && <>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">Best next experiment</p>
                <p className="mt-4 text-sm leading-6 opacity-80">{analysis.photoSummary}</p>
                <h2 className="mt-5 font-serif text-4xl tracking-[-0.035em]">{analysis.primarySuggestion.title}</h2>
                <p className="mt-5 text-lg leading-7">{analysis.primarySuggestion.instruction}</p>
                <p className="mt-4 text-sm leading-6 opacity-80">{analysis.primarySuggestion.reason}</p>
                {analysis.personVisible && analysis.poseTemplate !== "none" ? <div className="mt-auto pt-8"><p className="flex items-center gap-2 text-sm font-semibold"><Lightbulb size={16}/> Dotted guide: {analysis.poseTemplate.replaceAll("-", " ")}</p><p className="mt-2 text-xs leading-5 opacity-70">The overlay is an illustrative retake guide, not a measurement or assessment of your body. Use the eye and mirror controls on the photo.</p></div> : <p className="mt-8 rounded-2xl bg-black/10 p-4 text-sm">No clearly visible person was detected. Try a photo where the subject is more fully in frame.</p>}
              </>}
            </div>
          </div>}

          {analysis && <div className="mt-8">
            <div className="mb-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b25536]">Three things to try</p><h2 className="mt-2 font-serif text-4xl tracking-[-0.035em]">Small changes, clearer intention</h2></div>
            <div className="grid gap-4 md:grid-cols-3">{analysis.tips.map((tip, index) => <article key={`${tip.category}-${index}`} className="rounded-[1.7rem] border border-[#20251f]/10 bg-white p-6"><div className="flex items-center justify-between"><span className="font-serif text-3xl text-[#d95d39]">0{index + 1}</span><span className="rounded-full bg-[#f5e6dd] px-3 py-1 text-xs font-semibold text-[#913e27]">{tip.category}</span></div><h3 className="mt-7 text-xl font-semibold">{tip.title}</h3><p className="mt-3 leading-6 text-[#455149]">{tip.instruction}</p><p className="mt-4 border-t border-[#20251f]/10 pt-4 text-sm leading-6 text-[#718076]">{tip.reason}</p></article>)}</div>
            <p className="mt-5 text-xs leading-5 text-[#718076]">{analysis.confidenceNote}</p>
          </div>}

          <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={choosePhoto} className="sr-only"/>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 py-8 text-xs leading-5 text-[#718076] sm:px-8">Photo Coach offers optional photography techniques, not judgments about a person. Photos are not stored by Closet Compass.</footer>
    </main>
  );
}
