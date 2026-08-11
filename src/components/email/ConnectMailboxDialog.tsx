"use client";

import { useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";
import type { EmailSiteForConnect } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface ConnectMailboxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: (mailboxId: string) => void;
}

export function ConnectMailboxDialog({
  open,
  onOpenChange,
  onConnected,
}: ConnectMailboxDialogProps) {
  const sitesRaw = useQuery(api.email.listSitesForConnect, open ? {} : "skip");
  const sites = (sitesRaw ?? []) as EmailSiteForConnect[];
  const connect = useAction(api.emailActions.connectMailbox);

  const [siteId, setSiteId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPassword("");
    if (sites.length === 1) {
      setSiteId(sites[0]!.id);
      setEmail(sites[0]!.contact_email ?? "");
    } else if (!siteId && sites[0]) {
      setSiteId(sites[0].id);
      setEmail(sites[0].contact_email ?? "");
    }
  }, [open, sites, siteId]);

  const handleSiteChange = (id: string) => {
    setSiteId(id);
    const site = sites.find((s) => s.id === id);
    if (site?.contact_email) setEmail(site.contact_email);
  };

  const handleConnect = async () => {
    if (!siteId || !email.trim() || !password || busy) return;
    setBusy(true);
    try {
      const result = await connect({
        siteId: siteId as Id<"sites">,
        email: email.trim(),
        password,
      });
      if (result.syncError) {
        toast.warning("Connected, but first sync had an issue", {
          description: result.syncError,
        });
      } else {
        toast.success(
          `Connected · synced ${result.synced} message${result.synced === 1 ? "" : "s"}`
        );
      }
      onOpenChange(false);
      onConnected?.(result.mailboxId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to connect mailbox");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Connect SpaceMail</SheetTitle>
          <SheetDescription>
            Use the full mailbox address and password. IMAP/SMTP must be enabled
            in Spacemail Manager (mail.spacemail.com).
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
          {sites.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              All sites already have a mailbox connected, or no sites are seeded
              yet.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="email-site">Site</Label>
                <Select
                  value={siteId}
                  onValueChange={(v) => v && handleSiteChange(v)}
                >
                  <SelectTrigger id="email-site">
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-addr">Mailbox email</Label>
                <Input
                  id="email-addr"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hello@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-pass">Mailbox password</Label>
                <Input
                  id="email-pass"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </>
          )}
        </div>

        <SheetFooter className="border-t border-border">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={busy || sites.length === 0 || !siteId || !email || !password}
          >
            {busy ? "Testing & saving…" : "Test & save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
