"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Camera, Check, ImagePlus, LoaderCircle, RotateCcw, ShieldCheck, Sparkles, Star } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import type { DatingPhotoRating } from "@/lib/rate-me";

const demoRating: DatingPhotoRating = {
  usableAsDatingPhoto: true,
  overallScore: 6.2,
  verdict: "The lighting is doing your face no favours, and the stiff pose makes the whole thing feel like an office ID photo. You look perfectly dateable; this particular shot is just leaving points on the table.",
  bestUse: "Supporting photo",
  firstImpressions: [
    "Okay, the smile is genuinely warm—that is the first thing making you feel approachable.",
    "Your hair has shape and volume instead of sitting flat. Keep that.",
    "That shirt fits cleanly, but the safe colour is not giving anyone a reason to remember it.",
    "The overhead light is exaggerating skin texture and putting shadows under your eyes.",
  ],
  dimensions: [
    { name: "Face", score: 6.8, note: "Good raw material, but the flat light and straight-on angle make your features look less defined." },
    { name: "Body & presence", score: 5.5, note: "The outfit is fine; the rigid posture is what drains the presence out of it." },
    { name: "Style", score: 6.5, note: "Clean and presentable, but safe enough to be forgettable." },
    { name: "Photo quality", score: 6, note: "Usable focus, mediocre light, and too much dead background." },
    { name: "Dating appeal", score: 6.2, note: "Not a disaster, not a lead photo, and definitely replaceable with one better afternoon." },
  ],
  strengths: ["Your face is clearly visible", "The outfit fits the setting", "Nothing looks heavily filtered or fake"],
  improvements: ["Stop facing the camera like it is taking your passport photo", "Find window light and turn about 30 degrees", "Use a closer crop and give the background less real estate"],
  confidenceNote: "Demo result. The score is one blunt subjective opinion about one image—not a scientific measure or a guarantee of matches.",
};

export default function RateMePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [rating, setRating] = useState<DatingPhotoRating | null>(null);
  const [confirmedAdult, setConfirmedAdult] = useState(false);
  const [status, setStatus] = useState<"idle" | "analysing" | "review" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    if (!chosen) return;
    if (!chosen.type.startsWith("image/") || chosen.size > 10 * 1024 * 1024) {
      setStatus("error");
      setMessage("Choose a JPEG, PNG or WebP image under 10 MB.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(chosen);
    setPreview(URL.createObjectURL(chosen));
    setRating(null);
    setStatus("idle");
    setMessage("");
  }

  async function ratePhoto() {
    if (!file || !confirmedAdult) return;
    setStatus("analysing");
    setMessage("");
    const form = new FormData();
    form.append("image", file);
    form.append("adultConfirmed", "true");
    try {
      const response = await fetch("/api/rate-me", { method: "POST", body: form });
      const payload = (await response.json()) as DatingPhotoRating & { error?: string; requestId?: string };
      if (!response.ok) throw new Error(`${payload.error ?? "Rating is unavailable."}${payload.requestId ? ` Reference: ${payload.requestId}` : ""}`);
      setRating(payload);
      setStatus("review");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Rating is unavailable.");
    }
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(null); setRating(null); setConfirmedAdult(false); setStatus("idle"); setMessage("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return <main className="min-h-screen bg-[#f4f0e7] text-[#20251f]">
    <AppNav active="rate-me" />
    <section className="mx-auto max-w-6xl px-5 pb-12 pt-12 sm:px-8 sm:pt-20">
      <div className="grid items-end gap-8 lg:grid-cols-[1.1fr_.9fr]">
        <div><p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#57477d]">No-copium dating review · consenting adults only</p><h1 className="max-w-3xl font-serif text-[clamp(3.1rem,8vw,6.5rem)] leading-[0.92] tracking-[-0.055em]">Fine. Let’s judge it.</h1></div>
        <p className="max-w-lg pb-2 text-lg leading-7 text-[#556157]">Face, body presence, style, photo quality and overall dating appeal—scored by the blunt friend who tells you when the picture is doing you dirty.</p>
      </div>
    </section>

    <section className="border-y border-[#20251f]/10 bg-[#fbf9f3]">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-7 flex items-center justify-between"><p className="text-sm font-semibold text-[#556157]">Brutally subjective · prototype</p>{preview && <button onClick={reset} className="flex items-center gap-2 text-sm text-[#556157]"><RotateCcw size={15}/> Start over</button>}</div>

        {!preview && <button onClick={() => inputRef.current?.click()} className="min-h-[430px] w-full rounded-[2rem] border border-dashed border-[#57477d]/40 bg-[#ece7f4] p-8 text-left transition hover:bg-[#e7e0f2] sm:p-12">
          <span className="mb-20 grid h-16 w-16 place-items-center rounded-full bg-[#57477d] text-white"><Camera size={28}/></span>
          <h2 className="max-w-xl font-serif text-5xl tracking-[-0.04em]">Choose a dating-profile photo</h2>
          <p className="mt-4 max-w-lg leading-6 text-[#667168]">Solo portraits work best. Group photos can be reviewed, but the score will reflect how hard it is to identify the profile owner.</p>
        </button>}

        {preview && <div className="grid gap-7 lg:grid-cols-[1.02fr_.98fr]">
          <div className="relative min-h-[560px] overflow-hidden rounded-[2rem] bg-[#252429]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Selected dating-profile candidate" className="absolute inset-0 h-full w-full object-contain"/>
            <button onClick={() => inputRef.current?.click()} className="absolute bottom-5 left-5 flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold shadow-sm"><ImagePlus size={15}/> Choose another</button>
          </div>
          <div className="flex flex-col rounded-[2rem] bg-[#57477d] p-8 text-white sm:p-10">
            {!rating ? <>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d8cfea]">Photo ready</p>
              <h2 className="mt-5 font-serif text-4xl tracking-[-0.035em]">You asked for the truth. Here it comes.</h2>
              <p className="mt-4 leading-6 text-[#eee9f7]">This will directly rate the visible face, body presentation, clothes and overall pull of the photo. Expect blunt feedback, not reassurance.</p>
              <label className="mt-7 flex cursor-pointer gap-3 rounded-2xl bg-black/15 p-4 text-sm leading-5"><input type="checkbox" checked={confirmedAdult} onChange={(event) => setConfirmedAdult(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#fff8ef]"/><span>I confirm everyone shown is 18+ and has consented to blunt appearance feedback.</span></label>
              <p className="mt-4 text-xs leading-5 text-[#d8cfea]">The photo is sent to Google Gemini for this analysis and is not stored by Closet Compass. Free-tier submissions may be used by Google to improve its products.</p>
              <button disabled={!confirmedAdult || status === "analysing"} onClick={ratePhoto} className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-[#fff8ef] px-5 py-3.5 font-semibold text-[#49396d] disabled:opacity-50">{status === "analysing" ? <><LoaderCircle className="animate-spin" size={18}/> Rating photo…</> : <><Star size={18}/> Rate this photo</>}</button>
              {status === "error" && <div className="mt-5 rounded-2xl bg-black/15 p-4 text-sm"><p>{message}</p><button onClick={() => { setRating(demoRating); setStatus("review"); setMessage(""); }} className="mt-3 font-semibold underline underline-offset-4">Preview labelled demo rating</button></div>}
            </> : <>
              <div className="flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d8cfea]">Overall pull</p><p className="mt-3 font-serif text-8xl leading-none">{rating.overallScore.toFixed(1)}</p></div><span className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">{rating.bestUse}</span></div>
              <p className="mt-7 text-lg leading-7">{rating.verdict}</p>
              <div className="mt-7 grid gap-2">{rating.dimensions.map((dimension) => <div key={dimension.name} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-xl bg-black/10 px-4 py-3"><span className="text-sm font-semibold">{dimension.name}</span><strong>{dimension.score === 0 ? "N/A" : dimension.score.toFixed(1)}</strong><p className="col-span-2 text-sm leading-5 text-[#eee9f7]">{dimension.note}</p></div>)}</div>
              <p className="mt-auto pt-7 text-xs leading-5 text-[#d8cfea]">{rating.confidenceNote}</p>
            </>}
          </div>
        </div>}

        {rating && <div className="mt-8 rounded-[1.7rem] border border-[#20251f]/10 bg-[#20251f] p-7 text-white sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c9d2c8]">What people will notice first</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{rating.firstImpressions.map((item) => <p key={item} className="rounded-2xl bg-white/10 p-4 text-sm leading-6">{item}</p>)}</div></div>}

        {rating && <div className="mt-5 grid gap-5 md:grid-cols-2">
          <article className="rounded-[1.7rem] border border-[#20251f]/10 bg-white p-7"><p className="flex items-center gap-2 text-sm font-semibold text-[#2d4a3e]"><Check size={16}/> What genuinely works</p><ul className="mt-5 space-y-3">{rating.strengths.map((item) => <li key={item} className="rounded-xl bg-[#e8ede5] p-4 text-sm leading-6">{item}</li>)}</ul></article>
          <article className="rounded-[1.7rem] border border-[#20251f]/10 bg-white p-7"><p className="flex items-center gap-2 text-sm font-semibold text-[#57477d]"><Sparkles size={16}/> The hard truth</p><ul className="mt-5 space-y-3">{rating.improvements.map((item) => <li key={item} className="rounded-xl bg-[#ece7f4] p-4 text-sm leading-6">{item}</li>)}</ul></article>
        </div>}

        <aside className="mt-8 rounded-[1.7rem] border border-[#20251f]/10 bg-[#f4f0e7] p-6 sm:p-8"><p className="flex items-center gap-2 font-semibold"><ShieldCheck size={18}/> Blunt, not scientific</p><p className="mt-3 max-w-3xl text-sm leading-6 text-[#667168]">The face and body scores are one model’s subjective read of one consenting adult’s photo. They are not measurements of worth and cannot represent what all women—or any group—find attractive. Public dating-app guidance supports the photo-quality part: clear face, good light, recent solo image, minimal filtering. The only real performance test is rotating photos with actual opt-in match data.</p><div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold"><a className="underline underline-offset-4" href="https://support.bumble.com/hc/articles/28523708029341-Uploading-profile-photos" target="_blank" rel="noreferrer">Bumble guidance</a><a className="underline underline-offset-4" href="https://au.tinderpressroom.com/introducing-smart-photos-for-the-most-swipeworthy-you" target="_blank" rel="noreferrer">Tinder Smart Photos</a></div></aside>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" capture="environment" onChange={choosePhoto} className="sr-only"/>
      </div>
    </section>
  </main>;
}
