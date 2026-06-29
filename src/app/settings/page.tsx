"use client";

import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <AppShell connectionState="live">
      <div className="mx-auto max-w-lg space-y-4">
        <h2 className="text-2xl font-bold">Settings</h2>
        <Card>
          <CardHeader>
            <CardTitle>Install app</CardTitle>
            <CardDescription>
              Add Booking Broom to your home screen for quick access on iPhone, iPad, or Android.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">iPhone/iPad:</strong> Tap Share → Add to Home Screen
            </p>
            <p>
              <strong className="text-foreground">Android:</strong> Tap menu → Install app or Add to Home screen
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Your sites</CardTitle>
            <CardDescription>
              Sanford, Deltona, Haines City, Celebration, and more — managed from one dashboard.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </AppShell>
  );
}
