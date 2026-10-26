"use client";

import { useState } from "react";
import { Check, LoaderCircle, X } from "lucide-react";

type PhotoCropperProps = {
  sourceFile: File;
  sourceUrl: string;
  onApply: (file: File) => void;
  onCancel: () => void;
};

const aspectOptions = [
  { label: "Portrait 4:5", value: 4 / 5 },
  { label: "Square 1:1", value: 1 },
] as const;

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("This image could not be opened."));
    image.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The crop could not be created.")), "image/jpeg", 0.92);
  });
}

export function PhotoCropper({ sourceFile, sourceUrl, onApply, onCancel }: PhotoCropperProps) {
  const [aspect, setAspect] = useState(4 / 5);
  const [zoom, setZoom] = useState(1);
  const [horizontal, setHorizontal] = useState(50);
  const [vertical, setVertical] = useState(50);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function applyCrop() {
    setBusy(true);
    setError("");
    try {
      const image = await loadImage(sourceUrl);
      const sourceAspect = image.naturalWidth / image.naturalHeight;
      let coverWidth: number;
      let coverHeight: number;

      if (sourceAspect > aspect) {
        coverHeight = image.naturalHeight;
        coverWidth = coverHeight * aspect;
      } else {
        coverWidth = image.naturalWidth;
        coverHeight = coverWidth / aspect;
      }

      const cropWidth = coverWidth / zoom;
      const cropHeight = coverHeight / zoom;
      const cropX = (image.naturalWidth - cropWidth) * (horizontal / 100);
      const cropY = (image.naturalHeight - cropHeight) * (vertical / 100);
      const outputHeight = aspect < 1 ? 1600 : Math.round(1600 / aspect);
      const outputWidth = Math.round(outputHeight * aspect);
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Cropping is not supported in this browser.");
      context.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, outputWidth, outputHeight);
      const blob = await canvasBlob(canvas);
      const baseName = sourceFile.name.replace(/\.[^.]+$/, "") || "dating-photo";
      onApply(new File([blob], `${baseName}-cropped.jpg`, { type: "image/jpeg", lastModified: Date.now() }));
    } catch (cropError) {
      setError(cropError instanceof Error ? cropError.message : "The crop could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-4 sm:p-8" role="dialog" aria-modal="true" aria-labelledby="crop-photo-title">
    <div className="mx-auto max-w-4xl rounded-[2rem] bg-[#fbf9f3] p-5 shadow-2xl sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#57477d]">Before analysis</p><h2 id="crop-photo-title" className="mt-2 font-serif text-4xl tracking-[-0.04em]">Frame the photo</h2><p className="mt-2 text-sm leading-6 text-[#667168]">Choose a dating-app crop, zoom in, then move the focal point horizontally or vertically.</p></div>
        <button type="button" onClick={onCancel} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#20251f]/15" aria-label="Cancel cropping"><X size={18}/></button>
      </div>

      <div className="mt-6 grid items-start gap-7 lg:grid-cols-[1fr_18rem]">
        <div className="mx-auto w-full max-w-xl overflow-hidden rounded-[1.5rem] bg-[#20251f]" style={{ aspectRatio: aspect }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sourceUrl} alt="Photo crop preview" className="h-full w-full object-cover" style={{ objectPosition: `${horizontal}% ${vertical}%`, transform: `scale(${zoom})`, transformOrigin: `${horizontal}% ${vertical}%` }}/>
        </div>

        <div>
          <fieldset><legend className="text-sm font-semibold">Shape</legend><div className="mt-3 grid grid-cols-2 gap-2">{aspectOptions.map((option) => <button key={option.label} type="button" onClick={() => setAspect(option.value)} className={`rounded-xl px-3 py-2 text-sm font-semibold ${aspect === option.value ? "bg-[#57477d] text-white" : "border border-[#20251f]/15 bg-white"}`}>{option.label}</button>)}</div></fieldset>
          <label className="mt-6 block text-sm font-semibold">Zoom <span className="font-normal text-[#667168]">{zoom.toFixed(1)}×</span><input className="mt-3 w-full accent-[#57477d]" type="range" min="1" max="3" step="0.1" value={zoom} onChange={(event) => setZoom(Number(event.target.value))}/></label>
          <label className="mt-5 block text-sm font-semibold">Move left / right<input className="mt-3 w-full accent-[#57477d]" type="range" min="0" max="100" value={horizontal} onChange={(event) => setHorizontal(Number(event.target.value))}/></label>
          <label className="mt-5 block text-sm font-semibold">Move up / down<input className="mt-3 w-full accent-[#57477d]" type="range" min="0" max="100" value={vertical} onChange={(event) => setVertical(Number(event.target.value))}/></label>
          {error && <p className="mt-4 rounded-xl bg-[#f4dddd] p-3 text-sm text-[#722d2d]">{error}</p>}
          <div className="mt-6 grid gap-2"><button type="button" disabled={busy} onClick={applyCrop} className="flex items-center justify-center gap-2 rounded-full bg-[#20251f] px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? <><LoaderCircle className="animate-spin" size={17}/> Creating crop…</> : <><Check size={17}/> Use this crop</>}</button><button type="button" disabled={busy} onClick={() => onApply(sourceFile)} className="rounded-full border border-[#20251f]/15 bg-white px-5 py-3 text-sm font-semibold disabled:opacity-50">Use original instead</button><button type="button" onClick={onCancel} className="rounded-full px-5 py-3 text-sm font-semibold text-[#667168]">Cancel</button></div>
        </div>
      </div>
    </div>
  </div>;
}
