"use client";

import { useBookings } from "@/lib/hooks/useBookings";
import { AppShell } from "@/components/layout/AppShell";
import { SiteSidebar } from "@/components/layout/SiteSidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DeviceMobile,
  Globe,
  House,
  Info,
} from "@phosphor-icons/react";

export default function SettingsPage() {
  const { sites, allBookings, connectionState } = useBookings();

  const counts: Record<string, number> = {};
  allBookings.forEach((b) => {
    const slug = b.site?.slug;
    if (slug) counts[slug] = (counts[slug] ?? 0) + 1;
  });

  return (
    <AppShell
      connectionState={connectionState}
      pageTitle="Settings"
      sidebar={<SiteSidebar sites={sites} counts={counts} totalCount={allBookings.length} />}
    >
      <div className="space-y-6">
        <div className="hidden md:block">
          <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            App preferences and connected sites
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <DeviceMobile size={20} weight="duotone" />
                </div>
                <div>
                  <CardTitle>Install app</CardTitle>
                  <CardDescription>Add to your home screen for quick access</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-lg bg-muted/50 px-4 py-3">
                <p className="font-medium text-foreground">iPhone / iPad</p>
                <p className="mt-1 text-muted-foreground">
                  Safari → Share → Add to Home Screen
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 px-4 py-3">
                <p className="font-medium text-foreground">Android</p>
                <p className="mt-1 text-muted-foreground">
                  Chrome → Menu → Install app or Add to Home screen
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  <Globe size={20} weight="duotone" />
                </div>
                <div>
                  <CardTitle>Connected sites</CardTitle>
                  <CardDescription>
                    {sites.length} cleaning websites sending bookings
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {sites.map((site) => (
                  <li
                    key={site.slug}
                    className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5"
                  >
                    <span className="flex min-w-0 items-center gap-2.5 text-sm font-medium">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: site.accent_color }}
                      />
                      <span className="truncate">{site.name}</span>
                    </span>
                    <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex">
                      <House size={14} />
                      {site.domain}
                    </span>
                  </li>
                ))}
                {sites.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No sites configured yet.
                  </p>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="border-dashed shadow-sm">
          <CardContent className="flex items-start gap-3 pt-6">
            <Info size={20} className="mt-0.5 shrink-0 text-muted-foreground" weight="duotone" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">About Booking Broom</p>
              <p className="mt-1 leading-relaxed">
                Bookings arrive in real time from Sanford, Deltona, Haines City, Celebration,
                and any future sites you connect. Use the sidebar to filter by site.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
