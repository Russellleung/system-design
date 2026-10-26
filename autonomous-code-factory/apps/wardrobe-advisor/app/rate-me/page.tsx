"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Camera, Check, ExternalLink, ImagePlus, LoaderCircle, RotateCcw, Search, ShieldCheck, Sparkles, Star } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { PhotoCropper } from "@/components/photo-cropper";
import type { AppearanceFeature, DatingPhotoRating } from "@/lib/rate-me";

const demoRating: DatingPhotoRating = {
  usableAsDatingPhoto: true,
  overallScore: 6.2,
  verdict: "The lighting is doing your face no favours, and the stiff pose makes the whole thing feel like an office ID photo. You look perfectly dateable; this particular shot is just leaving points on the table.",
  bestUse: "Supporting photo",
  attractivenessScore: 6.9,
  attractivenessVerdict: "You are visibly attractive: balanced features, good hair and a smile that lands. The photo makes you look flatter and more awkward than you need to, but that is the shot failing you—not your face.",
  apparentAge: {
    range: "25–34",
    note: "You read in this broad range here. The textured skin from the overhead light pushes older while the haircut and open expression pull younger; this is not your actual age.",
  },
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
  facialFeatures: [
    { feature: "Facial balance", observation: "Your features look fairly even head-on, although this flat angle hides some contour.", score: 7.4, appeal: "Attractive", kind: "Physical feature", friendTake: "Yes, I like the balance. Your face is naturally easy on the eye.", action: "Nothing anatomical to fix. A slight turn would simply show the existing contour better." },
    { feature: "Eyes & brows", observation: "Your eye shape is fairly narrow-looking and the brows are naturally full.", score: 6.6, appeal: "Attractive", kind: "Physical feature", friendTake: "The brows are strong and the eyes suit the face. The squint belongs in the separate expression score, not here.", action: "Nothing structural to change. Keep the brows tidy without thinning them." },
    { feature: "Nose & midface", observation: "Your nose reads straight and proportional through the centre of the face.", score: 7.0, appeal: "Attractive", kind: "Physical feature", friendTake: "Honestly, the nose suits your face. I like it; the ugly restaurant shadow is a lighting problem, not a nose problem.", action: "Nothing anatomical to fix. Use softer side light so the midface is not cut by a hard shadow." },
    { feature: "Mouth & lips", observation: "Your lips look moderately full with a naturally wide mouth shape.", score: 6.8, appeal: "Attractive", kind: "Physical feature", friendTake: "The mouth shape is attractive and fits the proportions of your face.", action: "Nothing anatomical to fix. Do not try to fake fuller lips; expression tension is scored separately." },
    { feature: "Jaw, chin & face shape", observation: "The face reads softly rectangular with a slender jaw and chin.", score: 5.8, appeal: "Mixed", kind: "Physical feature", friendTake: "Not a sharp movie-star jaw, but not ugly either. It is softer and more approachable than rugged.", action: "Nothing anatomical to fix. A three-quarter angle can show its existing structure more clearly." },
    { feature: "Ears", observation: "Your ears are moderately prominent and clearly visible beside the short sides.", score: 5.3, appeal: "Mixed", kind: "Physical feature", friendTake: "They stick out a little. I notice them, but they are not a deal-breaker.", action: "Nothing anatomical to fix. Slightly fuller hair at the sides would make them less visually dominant if you care." },
    { feature: "Skin appearance", observation: "Visible texture and shine appear across the face under the overhead light.", score: 4.8, appeal: "Mixed", kind: "Physical feature", friendTake: "The skin is not your strongest feature in this shot; the texture grabs attention, and the brutal light exaggerates it.", action: "Do not treat skin as an instant fix. For the photo, use soft window light and reduce surface shine rather than filtering your face." },
    { feature: "Hair & grooming", observation: "There is texture on top, but the fringe sits heavily across the forehead and the sides look bulky.", score: 6.0, appeal: "Mixed", kind: "Controllable presentation", friendTake: "The dark textured hair is attractive; the heavy fringe is not. It crowds your face.", action: "Keep texture on top, lighten the fringe and ask for cleaner—but not skin-tight—sides." },
    { feature: "Facial expression & tension", observation: "The smile reaches the cheeks, although the eyes narrow slightly with it.", score: 7.5, appeal: "Attractive", kind: "Controllable presentation", friendTake: "This smile works because it feels genuine. If it were stretched wider and tense, it would look forced; this one mostly lands.", action: "Keep the natural smile but relax the eyes and jaw instead of pushing the mouth wider." },
  ],
  bodyFeatures: [
    { feature: "Shoulder structure", observation: "The visible shoulder line looks moderately broad relative to the torso, although the crop limits certainty.", score: 6.5, appeal: "Attractive", kind: "Physical feature", friendTake: "The underlying shoulder structure is good. The tense posture was making it look worse than it is.", action: "Nothing anatomical to fix. Let the shoulders drop so their natural width reads properly." },
    { feature: "Torso & proportions", observation: "The visible torso reads fairly straight and proportionate in the current crop.", score: 6.0, appeal: "Mixed", kind: "Physical feature", friendTake: "The proportions look normal and balanced—not especially striking, but certainly not unattractive.", action: "Nothing anatomical to fix. Use a slight turn and a cleaner crop to reveal the proportions instead of flattening them." },
    { feature: "Overall silhouette", observation: "The visible body has a fairly straight silhouette, though the shirt conceals some shape.", score: 5.8, appeal: "Mixed", kind: "Physical feature", friendTake: "The natural silhouette is fine; the current outfit and front-on view just make it look blander than it probably is.", action: "Nothing structural to fix. Clothing with cleaner lines can show the existing silhouette more clearly." },
    { feature: "Posture & body pose", observation: "The shoulders are tense and the body faces the camera squarely with little asymmetry.", score: 4.1, appeal: "Unattractive", kind: "Controllable presentation", friendTake: "This pose is stiff and awkward. It looks like an employee badge, and that is entirely fixable.", action: "Drop the shoulders, turn the torso about 30 degrees and shift weight onto one side." },
    { feature: "Clothing fit", observation: "The shirt sits cleanly without obvious pulling or excess fabric.", score: 6.8, appeal: "Attractive", kind: "Controllable presentation", friendTake: "The fit is good and neat. The colour is safe to the point of forgettable, but the cut is doing its job.", action: "Keep this fit and try a richer colour or visible texture for more personality." },
  ],
  attractiveFeatures: ["The open smile softens the whole face and makes you look easy to talk to", "Your hair has enough volume to frame your face instead of disappearing into the background"],
  lessAttractiveFeatures: ["The overhead shadow makes the eye area look more tired than it probably does in person", "The rigid shoulders flatten your presence and make the pose feel guarded"],
  likelyLikes: ["Some women will like that the smile feels natural rather than rehearsed", "The clean, unfussy outfit reads as approachable and low-maintenance"],
  likelyDislikes: ["The passport-photo posture can read as low effort", "The flat setting gives almost no clue about your taste or how spending time with you might feel"],
  appearanceProfile: {
    faceShape: "Appears softly rectangular from this angle, though the straight-on camera flattens the jawline.",
    bodySilhouette: "A fairly straight silhouette in this outfit; the rigid stance hides the natural shoulder-to-waist shape.",
    colourDirection: "Muted navy, forest green, cream and rust should photograph with more richness than flat grey under soft daylight.",
    hairDirection: "Keep the texture and volume on top, with cleaner sides so the hair frames rather than widens the face.",
  },
  styleUpgrades: [
    { category: "Shirt / top", recommendation: "Try an open-collar textured overshirt in forest green or navy over a cream tee.", query: "men textured overshirt forest green cream t shirt", why: "The layers add shape and the deeper colour gives the face more contrast." },
    { category: "Pants / bottoms", recommendation: "Use tapered dark trousers or clean straight-leg denim rather than shapeless casual bottoms.", query: "dark tapered trousers clean straight leg jeans outfit", why: "A cleaner lower-half line will make the stance look deliberate instead of stiff." },
    { category: "Colour palette", recommendation: "Build around navy, forest green, cream and restrained rust accents.", query: "navy forest green cream rust outfit colour palette", why: "These colours add warmth and separation without overwhelming the face." },
    { category: "Haircut", recommendation: "Ask for textured length on top with tidier, softly tapered sides.", query: "textured top soft taper haircut rectangular face", why: "The shape keeps the good volume while giving the face a cleaner frame." },
  ],
  strengths: ["Your face is clearly visible", "The outfit fits the setting", "Nothing looks heavily filtered or fake"],
  improvements: ["Stop facing the camera like it is taking your passport photo", "Find window light and turn about 30 degrees", "Use a closer crop and give the background less real estate"],
  referenceSearches: [
    { title: "Hair and face framing", query: "textured hair warm smile window light portrait", why: "Copy the softer side light and the way the hair frames the forehead." },
    { title: "Relaxed body presence", query: "relaxed standing portrait fitted casual shirt pose", why: "Look for loose shoulders, asymmetrical stance and hands with something natural to do." },
    { title: "A setting with personality", query: "candid cafe portrait natural light dating profile", why: "Copy the environmental context and tighter composition, not the person." },
  ],
  confidenceNote: "Demo result. The score is one blunt subjective opinion about one image—not a scientific measure or a guarantee of matches.",
};

function appealClass(appeal: AppearanceFeature["appeal"]) {
  if (appeal === "Attractive") return "bg-[#dcebdd] text-[#23452f]";
  if (appeal === "Unattractive") return "bg-[#ead7df] text-[#6b2945]";
  if (appeal === "Mixed") return "bg-[#eee1bd] text-[#654d12]";
  return "bg-[#e4e4e1] text-[#555951]";
}

function FeatureGrid({ items, tone }: { items: AppearanceFeature[]; tone: "face" | "body" }) {
  return <div className="mt-4 grid gap-4 sm:grid-cols-2">{items.map((item) => <article key={item.feature} className={`rounded-2xl p-5 ${tone === "face" ? "bg-[#f4f0e7]" : "bg-white/70"}`}><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{item.feature}</h3><span className={`rounded-full px-3 py-1 text-xs font-bold ${appealClass(item.appeal)}`}>{item.score === 0 ? "N/A" : `${item.score.toFixed(1)}/10`} · {item.appeal}</span></div><p className={`mt-3 text-sm leading-6 ${tone === "face" ? "text-[#625b67]" : "text-[#556157]"}`}>{item.observation}</p><p className={`mt-4 border-l-2 pl-3 font-semibold leading-6 ${tone === "face" ? "border-[#57477d]" : "border-[#2d4a3e]"}`}>{item.friendTake}</p><div className="mt-4 rounded-xl bg-white/65 p-3"><p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#667168]">{item.kind === "Physical feature" ? "What can change in the photo" : "What to change"}</p><p className="mt-1 text-sm leading-5">{item.action}</p></div></article>)}</div>;
}

export default function RateMePage() {
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cropSourceFile, setCropSourceFile] = useState<File | null>(null);
  const [cropSourcePreview, setCropSourcePreview] = useState<string | null>(null);
  const [rating, setRating] = useState<DatingPhotoRating | null>(null);
  const [confirmedAdult, setConfirmedAdult] = useState(false);
  const [status, setStatus] = useState<"idle" | "analysing" | "review" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => () => { if (cropSourcePreview) URL.revokeObjectURL(cropSourcePreview); }, [cropSourcePreview]);

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    if (!chosen) return;
    if (!chosen.type.startsWith("image/") || chosen.size > 10 * 1024 * 1024) {
      setStatus("error");
      setMessage("Choose a JPEG, PNG or WebP image under 10 MB.");
      return;
    }
    if (cropSourcePreview) URL.revokeObjectURL(cropSourcePreview);
    setCropSourceFile(chosen);
    setCropSourcePreview(URL.createObjectURL(chosen));
    setStatus("idle");
    setMessage("");
    event.target.value = "";
  }

  function applyCrop(croppedFile: File) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(croppedFile);
    setPreview(URL.createObjectURL(croppedFile));
    setCropSourceFile(null);
    setCropSourcePreview(null);
    setRating(null);
    setConfirmedAdult(false);
    setStatus("idle");
    setMessage("");
  }

  function cancelCrop() {
    if (cropSourcePreview) URL.revokeObjectURL(cropSourcePreview);
    setCropSourceFile(null);
    setCropSourcePreview(null);
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
    if (cropSourcePreview) URL.revokeObjectURL(cropSourcePreview);
    setFile(null); setPreview(null); setRating(null); setConfirmedAdult(false); setStatus("idle"); setMessage("");
    setCropSourceFile(null); setCropSourcePreview(null);
    if (libraryInputRef.current) libraryInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  function googleImagesUrl(query: string) {
    return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
  }

  function unsplashUrl(query: string) {
    return `https://unsplash.com/s/photos/${encodeURIComponent(query.trim().replaceAll(" ", "-"))}`;
  }

  function googleShoppingUrl(query: string) {
    return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`;
  }

  return <main className="min-h-screen bg-[#f4f0e7] text-[#20251f]">
    <AppNav active="rate-me" />
    {cropSourceFile && cropSourcePreview && <PhotoCropper sourceFile={cropSourceFile} sourceUrl={cropSourcePreview} onApply={applyCrop} onCancel={cancelCrop}/>}
    <section className="mx-auto max-w-6xl px-5 pb-12 pt-12 sm:px-8 sm:pt-20">
      <div className="grid items-end gap-8 lg:grid-cols-[1.1fr_.9fr]">
        <div><p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#57477d]">No-copium dating review · consenting adults only</p><h1 className="max-w-3xl font-serif text-[clamp(3.1rem,8vw,6.5rem)] leading-[0.92] tracking-[-0.055em]">Fine. Let’s judge it.</h1></div>
        <p className="max-w-lg pb-2 text-lg leading-7 text-[#556157]">Face, body presence, style, photo quality and overall dating appeal—scored by the blunt friend who tells you when the picture is doing you dirty.</p>
      </div>
    </section>

    <section className="border-y border-[#20251f]/10 bg-[#fbf9f3]">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-7 flex items-center justify-between"><p className="text-sm font-semibold text-[#556157]">Brutally subjective · prototype</p>{preview && <button onClick={reset} className="flex items-center gap-2 text-sm text-[#556157]"><RotateCcw size={15}/> Start over</button>}</div>

        {!preview && <div className="min-h-[430px] w-full rounded-[2rem] border border-dashed border-[#57477d]/40 bg-[#ece7f4] p-8 text-left sm:p-12">
          <span className="mb-20 grid h-16 w-16 place-items-center rounded-full bg-[#57477d] text-white"><Camera size={28}/></span>
          <h2 className="max-w-xl font-serif text-5xl tracking-[-0.04em]">Add a dating-profile photo</h2>
          <p className="mt-4 max-w-lg leading-6 text-[#667168]">Take a new photo or choose one from Photos or local files. You can crop it before anything is analysed.</p>
          <div className="mt-8 flex flex-wrap gap-3"><button type="button" onClick={() => cameraInputRef.current?.click()} className="flex items-center gap-2 rounded-full bg-[#57477d] px-5 py-3 font-semibold text-white"><Camera size={17}/> Take photo</button><button type="button" onClick={() => libraryInputRef.current?.click()} className="flex items-center gap-2 rounded-full bg-white px-5 py-3 font-semibold text-[#49396d] shadow-sm"><ImagePlus size={17}/> Choose from photos or files</button></div>
        </div>}

        {preview && <div className="grid gap-7 lg:grid-cols-[1.02fr_.98fr]">
          <div className="relative min-h-[560px] overflow-hidden rounded-[2rem] bg-[#252429]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Selected dating-profile candidate" className="absolute inset-0 h-full w-full object-contain"/>
            <div className="absolute bottom-5 left-5 flex flex-wrap gap-2"><button type="button" onClick={() => cameraInputRef.current?.click()} className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold shadow-sm"><Camera size={15}/> Retake</button><button type="button" onClick={() => libraryInputRef.current?.click()} className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold shadow-sm"><ImagePlus size={15}/> Choose another</button></div>
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
              <div className="flex justify-end"><span className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">{rating.bestUse}</span></div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-black/15 p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#d8cfea]">Physical attractiveness</p><p className="mt-2 font-serif text-6xl leading-none">{rating.attractivenessScore === 0 ? "N/A" : rating.attractivenessScore.toFixed(1)}</p><p className="mt-1 text-xs text-[#d8cfea]">out of 10</p></div>
                <div className="rounded-2xl bg-black/15 p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#d8cfea]">Dating-photo effectiveness</p><p className="mt-2 font-serif text-6xl leading-none">{rating.overallScore.toFixed(1)}</p><p className="mt-1 text-xs text-[#d8cfea]">out of 10</p></div>
              </div>
              <div className="mt-5 rounded-2xl bg-white/10 p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#d8cfea]">The person</p><p className="mt-2 text-sm leading-6">{rating.attractivenessVerdict}</p></div>
              <div className="mt-3 rounded-2xl bg-white/10 p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#d8cfea]">The photo</p><p className="mt-2 text-sm leading-6">{rating.verdict}</p></div>
              <div className="mt-3 rounded-2xl border border-white/15 p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#d8cfea]">How old you look here · {rating.apparentAge.range}</p><p className="mt-2 text-sm leading-5 text-[#eee9f7]">{rating.apparentAge.note}</p></div>
              <div className="mt-7 grid gap-2">{rating.dimensions.map((dimension) => <div key={dimension.name} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-xl bg-black/10 px-4 py-3"><span className="text-sm font-semibold">{dimension.name}</span><strong>{dimension.score === 0 ? "N/A" : dimension.score.toFixed(1)}</strong><p className="col-span-2 text-sm leading-5 text-[#eee9f7]">{dimension.note}</p></div>)}</div>
              <p className="mt-auto pt-7 text-xs leading-5 text-[#d8cfea]">{rating.confidenceNote}</p>
            </>}
          </div>
        </div>}

        {rating && <div className="mt-8 rounded-[1.7rem] border border-[#20251f]/10 bg-[#20251f] p-7 text-white sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c9d2c8]">What people will notice first</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{rating.firstImpressions.map((item) => <p key={item} className="rounded-2xl bg-white/10 p-4 text-sm leading-6">{item}</p>)}</div></div>}

        {rating && <section className="mt-5 rounded-[1.7rem] border border-[#20251f]/10 bg-white p-7 sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#57477d]">Face, feature by feature</p><h2 className="mt-3 font-serif text-4xl tracking-[-0.04em]">Structure is not the same as expression.</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-[#625b67]">Physical features are judged as visible—not presented as defects to fix. Controllable presentation covers what you can actually change for the next photo.</p><h3 className="mt-7 text-sm font-bold uppercase tracking-[0.14em] text-[#57477d]">Physical features · no anatomical “fixes”</h3><FeatureGrid items={rating.facialFeatures.filter((item) => item.kind === "Physical feature")} tone="face"/><h3 className="mt-8 text-sm font-bold uppercase tracking-[0.14em] text-[#57477d]">Controllable presentation · expression, hair and grooming</h3><FeatureGrid items={rating.facialFeatures.filter((item) => item.kind === "Controllable presentation")} tone="face"/></section>}

        {rating && <section className="mt-5 rounded-[1.7rem] border border-[#20251f]/10 bg-[#e8ede5] p-7 sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2d4a3e]">Body and presence, feature by feature</p><h3 className="mt-6 text-sm font-bold uppercase tracking-[0.14em] text-[#2d4a3e]">Physical features · proportions and silhouette</h3><FeatureGrid items={rating.bodyFeatures.filter((item) => item.kind === "Physical feature")} tone="body"/><h3 className="mt-8 text-sm font-bold uppercase tracking-[0.14em] text-[#2d4a3e]">Controllable presentation · posture, pose and clothes</h3><FeatureGrid items={rating.bodyFeatures.filter((item) => item.kind === "Controllable presentation")} tone="body"/></section>}

        {rating && <div className="mt-5 grid gap-5 md:grid-cols-2">
          <article className="rounded-[1.7rem] border border-[#20251f]/10 bg-white p-7"><p className="flex items-center gap-2 text-sm font-semibold text-[#2d4a3e]"><Check size={16}/> What genuinely works</p><ul className="mt-5 space-y-3">{rating.strengths.map((item) => <li key={item} className="rounded-xl bg-[#e8ede5] p-4 text-sm leading-6">{item}</li>)}</ul></article>
          <article className="rounded-[1.7rem] border border-[#20251f]/10 bg-white p-7"><p className="flex items-center gap-2 text-sm font-semibold text-[#57477d]"><Sparkles size={16}/> The hard truth</p><ul className="mt-5 space-y-3">{rating.improvements.map((item) => <li key={item} className="rounded-xl bg-[#ece7f4] p-4 text-sm leading-6">{item}</li>)}</ul></article>
        </div>}

        {rating && <div className="mt-5 grid gap-5 md:grid-cols-2">
          <article className="rounded-[1.7rem] border border-[#20251f]/10 bg-[#e8ede5] p-7"><h3 className="font-serif text-3xl tracking-[-0.03em]">Your attractive features</h3><ul className="mt-5 space-y-3">{rating.attractiveFeatures.map((item) => <li key={item} className="rounded-xl bg-white/70 p-4 text-sm leading-6">{item}</li>)}</ul></article>
          <article className="rounded-[1.7rem] border border-[#20251f]/10 bg-[#ece7f4] p-7"><h3 className="font-serif text-3xl tracking-[-0.03em]">What is less attractive here</h3><ul className="mt-5 space-y-3">{rating.lessAttractiveFeatures.map((item) => <li key={item} className="rounded-xl bg-white/70 p-4 text-sm leading-6">{item}</li>)}</ul></article>
        </div>}

        {rating && <div className="mt-5 grid gap-5 md:grid-cols-2">
          <article className="rounded-[1.7rem] border border-[#20251f]/10 bg-white p-7"><h3 className="font-serif text-3xl tracking-[-0.03em]">What may work with women</h3><ul className="mt-5 space-y-3">{rating.likelyLikes.map((item) => <li key={item} className="border-l-2 border-[#2d4a3e] pl-4 text-sm leading-6">{item}</li>)}</ul></article>
          <article className="rounded-[1.7rem] border border-[#20251f]/10 bg-white p-7"><h3 className="font-serif text-3xl tracking-[-0.03em]">What may put some women off</h3><ul className="mt-5 space-y-3">{rating.likelyDislikes.map((item) => <li key={item} className="border-l-2 border-[#57477d] pl-4 text-sm leading-6">{item}</li>)}</ul><p className="mt-5 text-xs leading-5 text-[#667168]">Women are not a single audience. These are possible reactions to this photo, not facts about every viewer.</p></article>
        </div>}

        {rating && <section className="mt-5 rounded-[1.7rem] border border-[#20251f]/10 bg-white p-7 sm:p-8"><p className="text-sm font-semibold text-[#57477d]">Your visual type · tentative from one photo</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-[#f4f0e7] p-5"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#776b59]">Face shape</p><p className="mt-2 text-sm leading-6">{rating.appearanceProfile.faceShape}</p></div><div className="rounded-2xl bg-[#f4f0e7] p-5"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#776b59]">Body silhouette</p><p className="mt-2 text-sm leading-6">{rating.appearanceProfile.bodySilhouette}</p></div><div className="rounded-2xl bg-[#f4f0e7] p-5"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#776b59]">Colour direction</p><p className="mt-2 text-sm leading-6">{rating.appearanceProfile.colourDirection}</p></div><div className="rounded-2xl bg-[#f4f0e7] p-5"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#776b59]">Hair direction</p><p className="mt-2 text-sm leading-6">{rating.appearanceProfile.hairDirection}</p></div></div><p className="mt-4 text-xs leading-5 text-[#667168]">Camera angle, loose clothing and lighting can distort face shape, silhouette and colour. Treat these as ideas to test, not fixed labels.</p></section>}

        {rating && <section className="mt-5 rounded-[1.7rem] bg-[#2d4a3e] p-7 text-white sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c8d8d0]">Specific upgrades</p><h2 className="mt-3 font-serif text-4xl tracking-[-0.04em]">What to wear—or ask your barber for.</h2><div className="mt-6 grid gap-4 sm:grid-cols-2">{rating.styleUpgrades.map((upgrade) => <article key={upgrade.category} className="rounded-2xl bg-white/10 p-5"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#c8d8d0]">{upgrade.category}</p><h3 className="mt-2 font-semibold leading-6">{upgrade.recommendation}</h3><p className="mt-3 text-sm leading-6 text-[#e4ece7]">{upgrade.why}</p><p className="mt-3 text-xs text-[#c8d8d0]">Search: {upgrade.query}</p><div className="mt-4 flex flex-wrap gap-2"><a href={googleImagesUrl(upgrade.query)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#2d4a3e]">See examples <ExternalLink size={12}/></a>{upgrade.category !== "Haircut" && <a href={googleShoppingUrl(upgrade.query)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-white/30 px-3 py-2 text-xs font-semibold">Shop options <ExternalLink size={12}/></a>}</div></article>)}</div><p className="mt-5 text-xs leading-5 text-[#c8d8d0]">Opening a link shares only the displayed search words with Google, never your uploaded photo.</p></section>}

        {rating && <section className="mt-5 rounded-[1.7rem] bg-[#d9c7a8] p-7 sm:p-8"><p className="flex items-center gap-2 text-sm font-semibold"><Search size={17}/> Reference pictures to study</p><h2 className="mt-3 max-w-2xl font-serif text-4xl tracking-[-0.04em]">Borrow the setup, not somebody else’s face.</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-[#4e493f]">These searches use generic visible descriptors. Your uploaded photo is not sent to Google Images or Unsplash; only the search words are shared after you open a link.</p><div className="mt-6 grid gap-4 lg:grid-cols-3">{rating.referenceSearches.map((search) => <article key={search.title} className="rounded-2xl bg-[#fbf9f3] p-5"><h3 className="font-semibold">{search.title}</h3><p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#776b59]">{search.query}</p><p className="mt-3 text-sm leading-6 text-[#625b50]">{search.why}</p><div className="mt-5 flex flex-wrap gap-2"><a href={googleImagesUrl(search.query)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[#20251f] px-3 py-2 text-xs font-semibold text-white">Google Images <ExternalLink size={12}/></a><a href={unsplashUrl(search.query)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-[#20251f]/20 px-3 py-2 text-xs font-semibold">Unsplash <ExternalLink size={12}/></a></div></article>)}</div></section>}

        <aside className="mt-8 rounded-[1.7rem] border border-[#20251f]/10 bg-[#f4f0e7] p-6 sm:p-8"><p className="flex items-center gap-2 font-semibold"><ShieldCheck size={18}/> Blunt, not scientific</p><p className="mt-3 max-w-3xl text-sm leading-6 text-[#667168]">The face and body scores are one model’s subjective read of one consenting adult’s photo. They are not measurements of worth and cannot represent what all women—or any group—find attractive. Public dating-app guidance supports the photo-quality part: clear face, good light, recent solo image, minimal filtering. The only real performance test is rotating photos with actual opt-in match data.</p><div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold"><a className="underline underline-offset-4" href="https://support.bumble.com/hc/articles/28523708029341-Uploading-profile-photos" target="_blank" rel="noreferrer">Bumble guidance</a><a className="underline underline-offset-4" href="https://au.tinderpressroom.com/introducing-smart-photos-for-the-most-swipeworthy-you" target="_blank" rel="noreferrer">Tinder Smart Photos</a></div></aside>
        <input ref={libraryInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={choosePhoto} className="sr-only"/>
        <input ref={cameraInputRef} type="file" accept="image/*" capture="user" onChange={choosePhoto} className="sr-only"/>
      </div>
    </section>
  </main>;
}
