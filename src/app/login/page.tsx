"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, PawPrint } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/brand/Logo";
import { SketchDoodle } from "@/components/brand/SketchDoodle";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          // Read by the handle_new_user trigger (supabase/schema.sql) when it creates the profile,
          // so it's saved even when email confirmation means there's no session yet.
          options: {
            data: businessName ? { business_name: businessName } : undefined,
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });
        if (signUpError) {
          setError(explainAuthError(signUpError.message));
          return;
        }
        if (!data.session) {
          // "Confirm email" is on in Supabase (the default): the account exists but can't be used
          // until the link in the confirmation email is clicked.
          setNotice(
            `Check ${email} for a confirmation link, then sign in here. (No email? See the troubleshooting section in the README.)`
          );
          setMode("login");
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          setError(explainAuthError(signInError.message));
          return;
        }
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(explainAuthError((err as Error).message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-6">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="relative mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-4 py-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
        <SketchDoodle className="absolute -top-16 right-0 hidden w-96 lg:block" />

        <section className="relative">
          <Badge variant="highlight" className="h-6 px-2.5 text-xs">
            <PawPrint /> AI ad studio for dog food brands
          </Badge>
          <h1 className="mt-6 font-display text-heading-sm font-extrabold sm:text-heading lg:text-heading-lg">
            Scroll-stopping <span className="highlight-marker">ads</span>, fetched in minutes.
          </h1>
          <p className="mt-6 max-w-xl text-body text-foreground/85">
            Generate short video ads, trim them into one cut, and get captions written for Reels,
            TikTok, Shorts and Facebook — all in your brand&apos;s voice.
          </p>
        </section>

        <Card className="relative w-full max-w-md justify-self-center lg:justify-self-end">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              {mode === "login" ? "Welcome back" : "Create your studio"}
            </CardTitle>
            <CardDescription>
              {mode === "login" ? "Sign in to your ad studio." : "Set up your account in seconds."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="businessName">Business name</Label>
                  <Input
                    id="businessName"
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Marcel's Dog Kitchen"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              {notice && (
                <p className="rounded-md bg-sticky-note-mint p-3 text-sm text-forest-ink">{notice}</p>
              )}

              <Button type="submit" size="lg" disabled={loading} className="h-10 w-full">
                {!loading && <ArrowRight />}
                {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Just an email and password. No credit card.
              </p>
            </form>

            <Button
              variant="link"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError(null);
                setNotice(null);
              }}
              className="mt-2 w-full justify-center text-muted-foreground"
            >
              {mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

// Supabase's raw messages are terse; add the likely fix for the common setup problems.
function explainAuthError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("database error saving new user")) {
    return `${message}. The profile trigger failed. Run supabase/schema.sql, then supabase/policies.sql, in the Supabase SQL editor.`;
  }
  if (m.includes("invalid api key") || m.includes("no api key")) {
    return `${message}. Check NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then restart npm run dev.`;
  }
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed")) {
    return `Couldn't reach Supabase. Check NEXT_PUBLIC_SUPABASE_URL in .env.local (https://<project>.supabase.co), then restart npm run dev.`;
  }
  if (m.includes("email not confirmed")) {
    return "Confirm your email first — click the link Supabase sent you, then sign in.";
  }
  if (m.includes("rate limit")) {
    return `${message}. Supabase's built-in email sender only allows a few emails per hour. Wait, or turn off "Confirm email" while developing (see README).`;
  }
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) {
    return `${message}. Enable sign-ups in Supabase: Authentication → Sign In / Providers.`;
  }
  return message;
}
