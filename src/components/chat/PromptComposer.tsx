"use client";

import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Images, Loader2, Undo2, Video, Wand2, X } from "lucide-react";
import { FAL_MODELS, getFalModel } from "@/lib/fal/models";
import type { AlbumPhoto } from "@/lib/album";
import { PhotoAlbum } from "@/components/chat/PhotoAlbum";
import type { AspectRatio, Generation } from "@/lib/types/domain";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Defaults picked so the common case needs no settings: text only -> Kling text-to-video,
// photo attached -> Kling image-to-video.
const TEXT_MODEL_ID = "kling-2.0";
const PHOTO_MODEL_ID = "kling-2.0-image";

const SHAPES: { value: AspectRatio; label: string; hint: string }[] = [
  { value: "9:16", label: "Tall", hint: "Reels, TikTok, Shorts" },
  { value: "1:1", label: "Square", hint: "Instagram feed" },
  { value: "16:9", label: "Wide", hint: "YouTube, Facebook" },
];

export function PromptComposer({
  projectId,
  onSubmitted,
}: {
  projectId: string;
  onSubmitted: (generation: Generation) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [prompt, setPrompt] = useState("");
  // What the user typed before "Improve" rewrote it, so they can go back.
  const [originalPrompt, setOriginalPrompt] = useState<string | null>(null);
  const [modelId, setModelId] = useState(TEXT_MODEL_ID);
  const [duration, setDuration] = useState(getFalModel(TEXT_MODEL_ID).durations[0]);
  // Tall by default: Reels, TikTok and Shorts are all 9:16.
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  // Photos are uploaded to the album when picked, so this is already a stored, public photo.
  const [referenceImage, setReferenceImage] = useState<AlbumPhoto | null>(null);
  const [albumOpen, setAlbumOpen] = useState(false);
  const [refining, setRefining] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Synchronous locks. `submitting`/`refining` state only changes on the next render, so two
  // Enter keydowns in the same moment (key auto-repeat, or keyboards/IMEs that fire Enter twice)
  // would both see "not busy" and start two videos. A ref flips immediately.
  const generateInFlight = useRef(false);
  const refineInFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // The textarea is disabled while refining, which drops keyboard focus. Put the cursor back at the
  // end of the improved text so pressing Enter goes straight to "Make video".
  const refocusAfterRefine = useRef(false);
  useEffect(() => {
    if (refining || !refocusAfterRefine.current) return;
    refocusAfterRefine.current = false;
    const el = textareaRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [refining]);

  const model = getFalModel(modelId);
  const busy = refining || submitting;
  const hasPrompt = prompt.trim().length > 0;
  const missingImage = !!model.requiresImage && !referenceImage;
  const canGenerate = hasPrompt && !busy && !missingImage;

  function selectModel(id: string) {
    setModelId(id);
    const next = getFalModel(id);
    if (!next.durations.includes(duration)) setDuration(next.durations[0]);
    if (next.aspectRatios && !next.aspectRatios.includes(aspectRatio)) {
      setAspectRatio(next.aspectRatios[0]);
    }
    if (!next.supportsImageToVideo) setReferenceImage(null);
  }

  function selectPhoto(photo: AlbumPhoto) {
    setReferenceImage(photo);
    if (!model.supportsImageToVideo) selectModel(PHOTO_MODEL_ID);
    setAlbumOpen(false);
  }

  function removePhoto() {
    setReferenceImage(null);
    if (model.requiresImage) selectModel(TEXT_MODEL_ID);
  }

  async function handleRefine() {
    if (!hasPrompt || busy || refineInFlight.current || generateInFlight.current) return;
    refineInFlight.current = true;
    setError(null);
    setRefining(true);
    try {
      const res = await fetch("/api/prompts/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          durationSeconds: duration,
          aspectRatio: model.aspectRatios ? aspectRatio : undefined,
          hasReferenceImage: !!referenceImage,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't improve the description. Please try again.");
      setOriginalPrompt(prompt);
      setPrompt(body.prompt);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      refocusAfterRefine.current = true;
      refineInFlight.current = false;
      setRefining(false);
    }
  }

  function undoRefine() {
    if (originalPrompt === null) return;
    setPrompt(originalPrompt);
    setOriginalPrompt(null);
  }

  async function handleGenerate() {
    if (!canGenerate || generateInFlight.current || refineInFlight.current) return;
    generateInFlight.current = true;
    setError(null);
    setSubmitting(true);

    try {
      const referenceImageUrl = referenceImage?.url;

      const res = await fetch("/api/fal/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          prompt,
          modelId,
          durationSeconds: duration,
          referenceImageUrl,
          aspectRatio: model.aspectRatios ? aspectRatio : undefined,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(
          body.error?.formErrors?.[0] ?? (typeof body.error === "string" ? body.error : null) ??
            "Couldn't start the video. Please try again."
        );
      }

      onSubmitted({
        id: body.generationId,
        project_id: projectId,
        owner_id: "",
        prompt,
        model: modelId,
        duration_seconds: duration,
        reference_image_url: referenceImageUrl ?? null,
        fal_request_id: body.falRequestId,
        status: "processing",
        video_url: null,
        thumbnail_url: null,
        error: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      setPrompt("");
      setOriginalPrompt(null);
      removePhoto();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      generateInFlight.current = false;
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter makes the video; Shift+Enter adds a new line.
    if (e.key !== "Enter" || e.shiftKey) return;
    // Enter that confirms an IME composition (e.g. Chinese input) isn't a submit.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    // Holding Enter auto-repeats keydown; only the first press counts.
    if (e.repeat) return;
    handleGenerate();
  }

  return (
    <Card>
      <CardContent className="space-y-5">
        <div>
          <Label htmlFor="video-idea" className="text-lg font-semibold">
            What should the video show?
          </Label>
          <p className="mt-1 text-muted-foreground">
            Describe it in your own words, e.g. &ldquo;a happy puppy eating from its bowl in the
            garden&rdquo;.
          </p>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
            <Textarea
              ref={textareaRef}
              id="video-idea"
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                if (originalPrompt !== null && e.target.value === "") setOriginalPrompt(null);
              }}
              onKeyDown={handleKeyDown}
              disabled={busy}
              placeholder="Type your idea here…"
              rows={4}
              className="min-h-28 flex-1 resize-none text-base md:text-base"
            />
            {hasPrompt && (
              <Button
                type="button"
                variant="outline"
                onClick={handleRefine}
                disabled={busy}
                className="h-auto min-h-11 shrink-0 px-4 py-2.5 text-base sm:w-44 sm:whitespace-normal"
              >
                {refining ? <Loader2 className="animate-spin" /> : <Wand2 />}
                {refining ? "Improving…" : "Improve my description"}
              </Button>
            )}
          </div>

          {refining && (
            <p className="mt-2 text-muted-foreground">
              Making your description more detailed so the video comes out better…
            </p>
          )}
          {!refining && originalPrompt !== null && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-foreground">
                Improved. Check it, then press <strong>Enter</strong> to make the video.
              </p>
              <Button variant="link" onClick={undoRefine} disabled={busy} className="h-auto p-0 text-base">
                <Undo2 /> Undo
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {referenceImage ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={referenceImage.url}
                alt="Your photo"
                className="h-20 w-20 rounded-lg object-cover ring-1 ring-border"
              />
              <div>
                <p className="font-medium">This photo will be brought to life.</p>
                <div className="flex flex-wrap gap-x-4">
                  <Button
                    variant="link"
                    onClick={() => setAlbumOpen(true)}
                    disabled={busy}
                    className="h-auto p-0 text-base"
                  >
                    <Images /> Change photo
                  </Button>
                  <Button variant="link" onClick={removePhoto} disabled={busy} className="h-auto p-0 text-base">
                    <X /> Remove photo
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            !albumOpen && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setAlbumOpen(true)}
                disabled={busy}
                className="h-11 px-4 text-base"
              >
                <ImageIcon /> Add a photo (optional)
              </Button>
            )
          )}
        </div>

        {albumOpen && (
          <PhotoAlbum
            selectedPath={referenceImage?.path ?? null}
            onSelect={selectPhoto}
            onClose={() => setAlbumOpen(false)}
            disabled={busy}
          />
        )}

        <div className="flex flex-wrap gap-x-8 gap-y-4">
          {model.aspectRatios ? (
            <ChoiceGroup
              label="Shape"
              value={aspectRatio}
              onChange={(v) => setAspectRatio(v as AspectRatio)}
              disabled={busy}
              options={SHAPES.filter((s) => model.aspectRatios!.includes(s.value))}
            />
          ) : (
            <div>
              <p className="font-medium">Shape</p>
              <p className="mt-1 text-muted-foreground">
                {model.supportsImageToVideo
                  ? "Same shape as your photo — use a tall photo for phone videos."
                  : "Wide only for this style."}
              </p>
            </div>
          )}
          {model.durations.length > 1 && (
            <ChoiceGroup
              label="Length"
              value={String(duration)}
              onChange={(v) => setDuration(Number(v))}
              disabled={busy}
              options={model.durations.map((d) => ({ value: String(d), label: `${d} seconds` }))}
            />
          )}
        </div>

        <details className="group">
          <summary className="cursor-pointer text-muted-foreground select-none hover:text-foreground">
            More settings
          </summary>
          <div className="mt-3 space-y-1.5">
            <Label>Video style (AI model)</Label>
            <Select
              value={modelId}
              onValueChange={(id) => id && selectModel(id)}
              items={FAL_MODELS.map((m) => ({ value: m.id, label: m.label }))}
              disabled={busy}
            >
              <SelectTrigger aria-label="AI model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FAL_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">{model.description}</p>
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-5">
          <Button onClick={handleGenerate} disabled={!canGenerate} className="h-12 px-6 text-lg">
            {submitting ? <Loader2 className="animate-spin" /> : <Video />}
            {submitting ? "Starting…" : "Make video"}
          </Button>
          <p className="text-muted-foreground">
            {missingImage
              ? "Add a photo to use this style."
              : "Or press Enter. It takes a few minutes."}
          </p>
        </div>

        {error && <p className="text-body-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

// Big, plain buttons instead of a dropdown: easier to see and tap.
function ChoiceGroup({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; hint?: string }[];
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label}>
      <p className="font-medium">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(o.value)}
              className={cn(
                "rounded-md border px-4 py-2 text-left transition-colors disabled:opacity-50",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input hover:bg-accent"
              )}
            >
              <span className="block font-medium">{o.label}</span>
              {o.hint && (
                <span
                  className={cn(
                    "block text-sm",
                    selected ? "text-primary-foreground/80" : "text-muted-foreground"
                  )}
                >
                  {o.hint}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
