"use client";

import { useEffect, useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  CaretLeft,
  DotsThreeVertical,
  MagicWand,
  NotePencil,
  PaperPlaneTilt,
  Trash,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { SmsMessage, SmsThread } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ConversationViewProps {
  thread: SmsThread | null;
  messages: SmsMessage[] | undefined;
  onBack?: () => void;
  onConversationDeleted?: () => void;
  className?: string;
}

export function ConversationView({
  thread,
  messages,
  onBack,
  onConversationDeleted,
  className,
}: ConversationViewProps) {
  const sendMessage = useAction(api.voipmsActions.sendMessage);
  const rewriteDraft = useAction(api.smsRewrite.rewriteSmsDraft);
  const deleteMessage = useAction(api.voipmsActions.deleteMessage);
  const deleteConversation = useAction(api.voipmsActions.deleteConversation);
  const upsertMeta = useMutation(api.sms.upsertConversationMeta);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingThread, setDeletingThread] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, thread?.contact, thread?.did]);

  useEffect(() => {
    setDraft("");
    setMetaOpen(false);
  }, [thread?.did, thread?.contact]);

  useEffect(() => {
    if (metaOpen && thread) {
      setLabelDraft(thread.label ?? "");
      setNoteDraft(thread.note ?? "");
    }
  }, [metaOpen, thread?.label, thread?.note, thread]);

  if (!thread) {
    return (
      <div
        className={cn(
          "hidden flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground md:flex",
          className
        )}
      >
        Select a conversation to view messages
      </div>
    );
  }

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    if (text.length > 160) {
      toast.error("SMS is limited to 160 characters");
      return;
    }
    setSending(true);
    try {
      await sendMessage({
        did: thread.did,
        contact: thread.contact,
        message: text,
      });
      setDraft("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const handleRewrite = async () => {
    const text = draft.trim();
    if (!text || rewriting || sending) return;
    setRewriting(true);
    try {
      const result = await rewriteDraft({ text });
      const previous = draft;
      setDraft(result.text.slice(0, 160));
      toast.success("Draft rewritten", {
        action: {
          label: "Undo",
          onClick: () => setDraft(previous),
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rewrite failed");
    } finally {
      setRewriting(false);
    }
  };

  const handleSaveMeta = async () => {
    setSavingMeta(true);
    try {
      await upsertMeta({
        did: thread.did,
        contact: thread.contact,
        label: labelDraft,
        note: noteDraft,
      });
      toast.success("Conversation updated");
      setMetaOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingMeta(false);
    }
  };

  const handleDeleteMessage = async (msg: SmsMessage) => {
    if (
      !confirm(
        "Delete this message from your inbox? We’ll also try to remove it from Voip.ms."
      )
    ) {
      return;
    }
    setDeletingId(msg.id);
    try {
      await deleteMessage({ messageId: msg.id as Id<"smsMessages"> });
      toast.success("Message deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteConversation = async () => {
    if (
      !confirm(
        "Delete this entire conversation from your inbox? We’ll also try to remove messages from Voip.ms. This cannot be undone."
      )
    ) {
      return;
    }
    setDeletingThread(true);
    try {
      await deleteConversation({
        did: thread.did,
        contact: thread.contact,
      });
      toast.success("Conversation deleted");
      onConversationDeleted?.();
      onBack?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeletingThread(false);
    }
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col bg-card", className)}>
      <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-2.5 md:px-4">
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mr-0.5 h-9 w-9 shrink-0 md:hidden"
            onClick={onBack}
            aria-label="Back to conversations"
          >
            <CaretLeft size={20} weight="bold" />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {thread.label || thread.contact_formatted}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {thread.label ? `${thread.contact_formatted} · ` : ""}
            via {thread.did_description || thread.did_formatted}
            {thread.sub_account ? ` · ${thread.sub_account}` : ""}
          </p>
          {thread.note && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground/90">
              {thread.note}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => setMetaOpen(true)}
          aria-label="Edit label and note"
          title="Label & note"
        >
          <NotePencil size={18} weight="duotone" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            disabled={deletingThread}
            aria-label="Conversation actions"
          >
            <DotsThreeVertical size={18} weight="bold" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem
              variant="destructive"
              onClick={() => void handleDeleteConversation()}
            >
              <Trash size={16} />
              Delete conversation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 md:px-4"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {messages === undefined && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          )}
          {messages?.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No messages in this thread yet.
            </p>
          )}
          {messages?.map((msg) => {
            const outbound = msg.direction === "out";
            return (
              <div
                key={msg.id}
                className={cn(
                  "group flex flex-col gap-1",
                  outbound ? "items-end" : "items-start"
                )}
              >
                <div
                  className={cn(
                    "flex max-w-[92%] items-end gap-1 md:max-w-[80%]",
                    outbound ? "flex-row" : "flex-row-reverse"
                  )}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8 shrink-0 text-muted-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100",
                      deletingId === msg.id && "opacity-100"
                    )}
                    disabled={deletingId === msg.id}
                    onClick={() => void handleDeleteMessage(msg)}
                    aria-label="Delete message"
                    title="Delete message"
                  >
                    <Trash size={14} />
                  </Button>
                  <div
                    className={cn(
                      "rounded-2xl px-3.5 py-2 text-[15px] leading-snug shadow-sm",
                      outbound
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-bl-md bg-muted text-foreground"
                    )}
                  >
                    {msg.body && (
                      <p className="whitespace-pre-wrap break-words">
                        {msg.body}
                      </p>
                    )}
                    {msg.media_urls.length > 0 && (
                      <div className={cn("space-y-2", msg.body && "mt-2")}>
                        {msg.media_urls.map((url) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block overflow-hidden rounded-lg"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt="MMS attachment"
                              className="max-h-52 max-w-full object-contain"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <span className="px-1 text-[10px] tabular-nums text-muted-foreground">
                  {format(new Date(msg.sent_at), "MMM d, h:mm a")}
                  {msg.type === "mms" ? " · MMS" : ""}
                </span>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      <div
        className="shrink-0 border-t border-border bg-card px-3 pt-2.5 md:px-4"
        style={{
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Text message"
            rows={1}
            maxLength={160}
            className="max-h-28 min-h-[44px] flex-1 resize-none py-2.5 text-[15px]"
            disabled={rewriting}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-full"
            disabled={rewriting || sending || !draft.trim()}
            onClick={() => void handleRewrite()}
            aria-label="Rewrite professionally"
            title="Rewrite professionally"
          >
            <MagicWand
              size={18}
              weight="duotone"
              className={rewriting ? "animate-pulse" : undefined}
            />
          </Button>
          <Button
            size="icon"
            className="h-11 w-11 shrink-0 rounded-full"
            disabled={sending || rewriting || !draft.trim()}
            onClick={() => void handleSend()}
            aria-label="Send"
          >
            <PaperPlaneTilt size={18} weight="fill" />
          </Button>
        </div>
        <p className="mx-auto mt-1 max-w-2xl text-[11px] text-muted-foreground">
          {draft.length}/160
          {rewriting ? " · Rewriting…" : " · Wand rewrites with Groq"}
        </p>
      </div>

      <Sheet open={metaOpen} onOpenChange={setMetaOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Label & note</SheetTitle>
            <SheetDescription>
              Name this conversation so you recognize it later. Notes stay on
              this number for this line only.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-2">
            <div className="space-y-1.5">
              <Label htmlFor="conv-label">Label</Label>
              <Input
                id="conv-label"
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                placeholder="e.g. Jane – deep clean quote"
                maxLength={120}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conv-note">Note</Label>
              <Textarea
                id="conv-note"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Context you’ll want later…"
                rows={5}
                maxLength={2000}
                className="resize-none"
              />
              <p className="text-[11px] text-muted-foreground">
                {noteDraft.length}/2000 · Clear both fields and save to remove
              </p>
            </div>
          </div>
          <SheetFooter className="flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setMetaOpen(false)}
              disabled={savingMeta}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={() => void handleSaveMeta()}
              disabled={savingMeta}
            >
              {savingMeta ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
