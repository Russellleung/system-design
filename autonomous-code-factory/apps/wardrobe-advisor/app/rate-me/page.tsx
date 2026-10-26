"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Camera, Check, ExternalLink, ImagePlus, LoaderCircle, RotateCcw, Search, ShieldCheck, Sparkles, Star } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { PhotoCropper } from "@/components/photo-cropper";
import type { DatingPhotoRating } from "@/lib/rate-me";

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
    { feature: "Facial balance", observation: "Your features look fairly even head-on, although this flat angle hides most of the natural contour.", appeal: "Attractive", friendTake: "Yes, I like the balance. Your face is easy on the eye; the boring straight-on angle is the problem, not your structure." },
    { feature: "Eyes & brows", observation: "Your eyes look slightly narrowed while the brows are naturally full and tidy.", appeal: "Mixed", friendTake: "The brows are good—keep them. The squint is not cute, though; it makes you look guarded when the smile says the opposite." },
    { feature: "Nose & midface", observation: "Your nose reads straight and proportional, with a hard overhead shadow beneath it.", appeal: "Attractive", friendTake: "Honestly, the nose suits your face. I like it. The ugly bit is that restaurant shadow making the middle of your face look harsher than it is." },
    { feature: "Mouth & expression", observation: "You have a broad, genuine smile that shows the upper teeth and reaches the cheeks.", appeal: "Attractive", friendTake: "This expression works because it looks genuine, not because teeth are automatically attractive. It is properly cute and makes you look fun immediately." },
    { feature: "Jaw, chin & face shape", observation: "The jaw looks softly rectangular, but the front-facing lens and forward posture flatten its edges.", appeal: "Mixed", friendTake: "Not ugly, just underwhelming here. You do have shape, but this angle turns it soft and passport-like. Turn slightly and give the jaw a chance." },
    { feature: "Ears", observation: "Your ears are clearly visible because the hair is shorter at the sides.", appeal: "Mixed", friendTake: "They stick out a little. I do notice them, but they are not a deal-breaker; the short sides simply put them on display more than necessary." },
    { feature: "Skin presentation", observation: "The overhead light picks up shine and visible texture across the face.", appeal: "Unattractive", friendTake: "I don't like how the skin photographs here. The shine and texture grab attention, but I blame this brutal lighting more than your actual skin." },
    { feature: "Hair & grooming", observation: "There is useful texture on top, but the heavy fringe sits flat across the forehead and the sides look bulky.", appeal: "Mixed", friendTake: "The dark textured hair is attractive; the heavy fringe is not. It crowds your face and makes the whole cut look flatter and more boyish than it needs to." },
  ],
  bodyFeatures: [
    { feature: "Shoulders & posture", observation: "The shoulders are square but held a little tensely.", appeal: "Unattractive", friendTake: "This posture is stiff and awkward. Relax your shoulders—right now you look like someone told you to sit still for an employee badge." },
    { feature: "Torso & proportions", observation: "The straight-on shirt creates one uniform line through the torso.", appeal: "Mixed", friendTake: "Nothing bad is happening, but nothing hot is happening either. A small body turn would give you shape instead of this flat rectangle." },
    { feature: "Overall silhouette", observation: "Both sides of the body are presented almost identically in a static pose.", appeal: "Unattractive", friendTake: "Too rigid. The silhouette looks dull because there is no movement or confident asymmetry—not because your body is unattractive." },
    { feature: "Clothing fit", observation: "The shirt sits cleanly without obvious pulling or excess fabric.", appeal: "Attractive", friendTake: "The fit is good and I like that it looks neat. The colour is safe to the point of forgettable, but at least the shirt itself is doing its job." },
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

  function appealClass(appeal: DatingPhotoRating["facialFeatures"][number]["appeal"]) {
    if (appeal === "Attractive") return "bg-[#dcebdd] text-[#23452f]";
    if (appeal === "Unattractive") return "bg-[#ead7df] text-[#6b2945]";
    if (appeal === "Mixed") return "bg-[#eee1bd] text-[#654d12]";
    return "bg-[#e4e4e1] text-[#555951]";
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

        {rating && <section className="mt-5 rounded-[1.7rem] border border-[#20251f]/10 bg-white p-7 sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#57477d]">Face, feature by feature</p><h2 className="mt-3 font-serif text-4xl tracking-[-0.04em]">Here’s my actual opinion.</h2><div className="mt-6 grid gap-4 sm:grid-cols-2">{rating.facialFeatures.map((item) => <article key={item.feature} className="rounded-2xl bg-[#f4f0e7] p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{item.feature}</h3><span className={`rounded-full px-3 py-1 text-xs font-bold ${appealClass(item.appeal)}`}>{item.appeal}</span></div><p className="mt-3 text-sm leading-6 text-[#625b67]">{item.observation}</p><p className="mt-4 border-l-2 border-[#57477d] pl-3 font-semibold leading-6">{item.friendTake}</p></article>)}</div></section>}

        {rating && <section className="mt-5 rounded-[1.7rem] border border-[#20251f]/10 bg-[#e8ede5] p-7 sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2d4a3e]">Body and presence, feature by feature</p><div className="mt-5 grid gap-4 sm:grid-cols-2">{rating.bodyFeatures.map((item) => <article key={item.feature} className="rounded-2xl bg-white/70 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{item.feature}</h3><span className={`rounded-full px-3 py-1 text-xs font-bold ${appealClass(item.appeal)}`}>{item.appeal}</span></div><p className="mt-3 text-sm leading-6 text-[#556157]">{item.observation}</p><p className="mt-4 border-l-2 border-[#2d4a3e] pl-3 font-semibold leading-6">{item.friendTake}</p></article>)}</div></section>}

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
