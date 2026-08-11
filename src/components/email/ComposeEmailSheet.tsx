"use client";

import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import type { EmailMailbox } from "@/lib/types";
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

interface ComposeEmailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mailboxes: EmailMailbox[];
  defaultMailboxId?: string | null;
  /** When true, From is fixed to defaultMailboxId (no picker). */
  lockMailbox?: boolean;
  onSent: (threadId: string) => void;
}

export function ComposeEmailSheet({
  open,
  onOpenChange,
  mailboxes,
  defaultMailboxId,
  lockMailbox = false,
  onSent,
}: ComposeEmailSheetProps) {
  const sendNew = useAction(api.emailActions.sendNew);
  const [mailboxId, setMailboxId] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const preferred =
      (defaultMailboxId &&
      mailboxes.some((m) => m.id === defaultMailboxId)
        ? defaultMailboxId
        : null) ??
      mailboxes[0]?.id ??
      "";
    setMailboxId(preferred);
    setTo("");
    setSubject("");
    setBody("");
  }, [open, defaultMailboxId, mailboxes]);

  const lockedMailbox = mailboxes.find((m) => m.id === mailboxId) ?? null;

  const handleSend = async () => {
    if (!mailboxId || sending) return;
    const recipients = to
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (recipients.length === 0) {
      toast.error("Enter a recipient");
      return;
    }
    if (!body.trim()) {
      toast.error("Enter a message");
      return;
    }
    setSending(true);
    try {
      const result = await sendNew({
        mailboxId: mailboxId as Id<"emailMailboxes">,
        to: recipients,
        subject: subject.trim() || "(no subject)",
        text: body.trim(),
      });
      toast.success("Email sent");
      onOpenChange(false);
      onSent(result.threadId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New email</SheetTitle>
          <SheetDescription>
            {lockMailbox && lockedMailbox
              ? `Sending as ${lockedMailbox.site_name || lockedMailbox.email}`
              : "Send from a connected SpaceMail mailbox."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
          <div className="space-y-2">
            <Label>From</Label>
            {lockMailbox && lockedMailbox ? (
              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                <p className="text-sm font-medium text-foreground">
                  {lockedMailbox.site_name || lockedMailbox.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lockedMailbox.email}
                </p>
              </div>
            ) : (
              <Select
                value={mailboxId}
                onValueChange={(v) => v && setMailboxId(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select mailbox" />
                </SelectTrigger>
                <SelectContent>
                  {mailboxes.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {(m.site_name || m.email) + ` · ${m.email}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-to">To</Label>
            <Input
              id="email-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="customer@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-subject">Subject</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-body">Message</Label>
            <Textarea
              id="email-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder="Write your email…"
              className="min-h-[180px]"
            />
          </div>
        </div>

        <SheetFooter className="border-t border-border">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !mailboxId}
            className="gap-1.5"
          >
            <PaperPlaneTilt size={16} weight="fill" />
            {sending ? "Sending…" : "Send"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
