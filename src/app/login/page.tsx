"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { Broom, ShieldCheck, Lightning } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn("password", {
        email,
        password,
        flow: isSignUp ? "signUp" : "signIn",
      });
      router.push("/");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign in failed");
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-bg flex min-h-dvh">
      {/* Brand panel — desktop only */}
      <div
        className="relative hidden w-[45%] max-w-xl flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex xl:max-w-2xl xl:p-14"
        style={{ paddingTop: "max(2.5rem, env(safe-area-inset-top))" }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
        <div className="relative">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
            <Broom size={26} weight="duotone" />
          </div>
          <h1 className="mt-8 text-3xl font-bold tracking-tight xl:text-4xl">
            Booking Broom
          </h1>
          <p className="mt-3 max-w-sm text-base leading-relaxed text-primary-foreground/80">
            Manage bookings from all your cleaning sites in one real-time dashboard.
          </p>
        </div>

        <ul className="relative space-y-4">
          {[
            { icon: Lightning, text: "Real-time sync from every site" },
            { icon: ShieldCheck, text: "Secure manager access only" },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-primary-foreground/90">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                <Icon size={18} weight="duotone" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      {/* Form panel */}
      <div
        className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6"
        style={{
          paddingTop: "max(2rem, env(safe-area-inset-top))",
          paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <Broom size={30} weight="duotone" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Booking Broom</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manager dashboard for your cleaning sites
            </p>
          </div>
        </div>

        <Card className="w-full max-w-[400px] border-border/80 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">{isSignUp ? "Create account" : "Welcome back"}</CardTitle>
            <CardDescription>
              {isSignUp
                ? "Set up your manager account (first-time only)"
                : "Sign in to manage your bookings"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                  className="h-11"
                  placeholder="manager@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  className="h-11"
                  minLength={8}
                />
              </div>
              <Button type="submit" className="h-11 w-full" disabled={loading}>
                {loading ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-10 w-full text-muted-foreground"
                onClick={() => setIsSignUp(!isSignUp)}
              >
                {isSignUp
                  ? "Already have an account? Sign in"
                  : "First time? Create manager account"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
