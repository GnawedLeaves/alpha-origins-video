"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { BrandVoice } from "@/lib/types/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function BrandVoiceConfig({
  userId,
  initial,
}: {
  userId: string;
  initial: BrandVoice;
}) {
  const supabase = createClient();
  const [voice, setVoice] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await supabase.from("profiles").update({ brand_voice: voice }).eq("id", userId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function updateList(key: "pillars" | "avoid" | "default_hashtags", value: string) {
    setVoice((v) => ({ ...v, [key]: value.split(",").map((s) => s.trim()).filter(Boolean) }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Brand voice</CardTitle>
        <CardDescription>
          Shapes every caption the AI writes. Keep it specific to your brand.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Field label="Tone">
            <Input
              value={voice.tone}
              onChange={(e) => setVoice((v) => ({ ...v, tone: e.target.value }))}
            />
          </Field>
          <Field label="Brand pillars (comma separated)">
            <Input
              value={voice.pillars.join(", ")}
              onChange={(e) => updateList("pillars", e.target.value)}
            />
          </Field>
          <Field label="Avoid (comma separated)">
            <Input
              value={voice.avoid.join(", ")}
              onChange={(e) => updateList("avoid", e.target.value)}
            />
          </Field>
          <Field label="Default hashtags (comma separated)">
            <Input
              value={voice.default_hashtags.join(", ")}
              onChange={(e) => updateList("default_hashtags", e.target.value)}
            />
          </Field>
          <Field label="Default CTA">
            <Input
              value={voice.default_cta}
              onChange={(e) => setVoice((v) => ({ ...v, default_cta: e.target.value }))}
            />
          </Field>
        </div>

        <Button variant="secondary" onClick={handleSave} disabled={saving} className="mt-4">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saved ? "Saved" : "Save brand voice"}
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
