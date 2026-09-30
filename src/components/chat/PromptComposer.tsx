"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Sparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FAL_MODELS, getFalModel } from "@/lib/fal/models";
import type { Generation } from "@/lib/types/domain";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

export function PromptComposer({
  projectId,
  onSubmitted,
}: {
  projectId: string;
  onSubmitted: (generation: Generation) => void;
}) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prompt, setPrompt] = useState("");
  const [modelId, setModelId] = useState(FAL_MODELS[0].id);
  const [duration, setDuration] = useState(FAL_MODELS[0].durations[0]);
  const [referenceImage, setReferenceImage] = useState<{ file: File; previewUrl: string } | null>(
    null
  );
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const model = getFalModel(modelId);

  function handleModelChange(id: string) {
    setModelId(id);
    const next = getFalModel(id);
    setDuration(next.durations[0]);
    if (!next.supportsImageToVideo) {
      setReferenceImage(null);
    }
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReferenceImage({ file, previewUrl: URL.createObjectURL(file) });
  }

  async function uploadReferenceImage(): Promise<string | undefined> {
    if (!referenceImage) return undefined;
    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const ext = referenceImage.file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("reference-images")
        .upload(path, referenceImage.file, { upsert: false });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("reference-images").getPublicUrl(path);
      return data.publicUrl;
    } finally {
      setUploading(false);
    }
  }

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setError(null);
    setSubmitting(true);

    try {
      const referenceImageUrl = await uploadReferenceImage();

      const res = await fetch("/api/fal/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          prompt,
          modelId,
          durationSeconds: duration,
          referenceImageUrl,
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.formErrors?.[0] ?? body.error ?? "Request failed");

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
      setReferenceImage(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || uploading;
  const missingImage = !!model.requiresImage && !referenceImage;

  return (
    <Card>
      <CardContent>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the ad — e.g. 'A golden retriever puppy eagerly eating from a bowl of kibble in a sunlit kitchen, warm and joyful, product bag visible in the background'"
          rows={3}
          className="resize-none"
        />

        {referenceImage && (
          <div className="mt-3 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={referenceImage.previewUrl}
              alt="Reference"
              className="h-16 w-16 rounded-lg object-cover"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setReferenceImage(null)}
            >
              <X size={16} />
            </Button>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFilePick}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={!model.supportsImageToVideo}
            title={
              model.supportsImageToVideo
                ? "Attach a reference image"
                : "This model doesn't support image-to-video"
            }
          >
            <ImageIcon size={14} /> Attach image
          </Button>

          <Select value={modelId} onValueChange={(id) => id && handleModelChange(id)}>
            <SelectTrigger size="sm">
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

          <Select
            value={String(duration)}
            onValueChange={(v) => v && setDuration(Number(v))}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {model.durations.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d}s
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleGenerate}
            disabled={busy || !prompt.trim() || missingImage}
            className="ml-auto"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Generate
          </Button>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">{model.description}</p>
        {missingImage && (
          <p className="mt-1 text-xs text-muted-foreground">Attach an image to use this model.</p>
        )}
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
