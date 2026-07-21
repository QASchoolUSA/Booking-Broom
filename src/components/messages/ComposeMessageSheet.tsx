"use client";

import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "convex/_generated/api";
import { toast } from "sonner";
import { MagicWand, PaperPlaneTilt } from "@phosphor-icons/react";
import type { SmsDid } from "@/lib/types";
import { didDisplayLabel } from "@/lib/smsLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface ComposeMessageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dids: SmsDid[];
  defaultDid?: string | null;
  onSent: (did: string, contact: string) => void;
}

export function ComposeMessageSheet({
  open,
  onOpenChange,
  dids,
  defaultDid,
  onSent,
}: ComposeMessageSheetProps) {
  const sendMessage = useAction(api.voipmsActions.sendMessage);
  const rewriteDraft = useAction(api.smsRewrite.rewriteSmsDraft);
  const [fromDid, setFromDid] = useState("");
  const [toRaw, setToRaw] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [rewriting, setRewriting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const preferred =
      (defaultDid && dids.some((d) => d.did === defaultDid)
        ? defaultDid
        : null) ??
      dids[0]?.did ??
      "";
    setFromDid(preferred);
    setToRaw("");
    setBody("");
  }, [open, defaultDid, dids]);

  const handleRewrite = async () => {
    const text = body.trim();
    if (!text || rewriting || sending) return;
    setRewriting(true);
    try {
      const result = await rewriteDraft({ text });
      const previous = body;
      setBody(result.text.slice(0, 160));
      toast.success("Draft rewritten", {
        action: {
          label: "Undo",
          onClick: () => setBody(previous),
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rewrite failed");
    } finally {
      setRewriting(false);
    }
  };

  const handleSend = async () => {
    if (!fromDid || sending) return;
    const message = body.trim();
    if (!message) {
      toast.error("Enter a message");
      return;
    }
    if (message.length > 160) {
      toast.error("SMS is limited to 160 characters");
      return;
    }
    setSending(true);
    try {
      await sendMessage({
        did: fromDid,
        contact: toRaw,
        message,
      });
      // Normalize the same way the action does for the thread key.
      const digits = toRaw.replace(/\D/g, "");
      const contact =
        digits.length === 11 && digits.startsWith("1")
          ? digits.slice(1)
          : digits.slice(-10);
      toast.success("Message sent");
      onOpenChange(false);
      onSent(fromDid, contact);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New message</SheetTitle>
          <SheetDescription>
            Start a conversation from one of your Voip.ms numbers.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-2">
          <div className="space-y-1.5">
            <Label htmlFor="compose-from">From</Label>
            {dids.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sync numbers first.
              </p>
            ) : (
              <Select
                value={fromDid}
                onValueChange={(v) => v && setFromDid(v)}
              >
                <SelectTrigger id="compose-from" className="h-11 w-full">
                  <SelectValue placeholder="Select a number" />
                </SelectTrigger>
                <SelectContent>
                  {dids.map((did) => (
                    <SelectItem key={did.id} value={did.did}>
                      {didDisplayLabel(did)} · {did.formatted}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="compose-to">To</Label>
            <Input
              id="compose-to"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(407) 555-0100"
              value={toRaw}
              onChange={(e) => setToRaw(e.target.value)}
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="compose-body">Message</Label>
            <Textarea
              id="compose-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message…"
              rows={4}
              maxLength={160}
              className="min-h-[96px] resize-none text-base md:text-sm"
              disabled={rewriting}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">
                {body.length}/160
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={rewriting || sending || !body.trim()}
                onClick={() => void handleRewrite()}
              >
                <MagicWand
                  size={14}
                  weight="duotone"
                  className={rewriting ? "animate-pulse" : undefined}
                />
                {rewriting ? "Rewriting…" : "Rewrite"}
              </Button>
            </div>
          </div>
        </div>

        <SheetFooter className="flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1 gap-1.5"
            onClick={() => void handleSend()}
            disabled={
              sending ||
              rewriting ||
              !fromDid ||
              !toRaw.trim() ||
              !body.trim() ||
              dids.length === 0
            }
          >
            <PaperPlaneTilt size={16} weight="fill" />
            {sending ? "Sending…" : "Send"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
