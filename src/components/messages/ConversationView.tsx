"use client";

import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "convex/_generated/api";
import { format } from "date-fns";
import { toast } from "sonner";
import { CaretLeft, PaperPlaneTilt } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { SmsMessage, SmsThread } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ConversationViewProps {
  thread: SmsThread | null;
  messages: SmsMessage[] | undefined;
  onBack?: () => void;
  className?: string;
}

export function ConversationView({
  thread,
  messages,
  onBack,
  className,
}: ConversationViewProps) {
  const sendMessage = useAction(api.voipmsActions.sendMessage);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, thread?.contact, thread?.did]);

  useEffect(() => {
    setDraft("");
  }, [thread?.did, thread?.contact]);

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
            {thread.contact_formatted}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            via {thread.did_description || thread.did_formatted}
            {thread.sub_account ? ` · ${thread.sub_account}` : ""}
          </p>
        </div>
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
                  "flex flex-col gap-1",
                  outbound ? "items-end" : "items-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[88%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug shadow-sm md:max-w-[75%]",
                    outbound
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md bg-muted text-foreground"
                  )}
                >
                  {msg.body && (
                    <p className="whitespace-pre-wrap break-words">{msg.body}</p>
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
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <Button
            size="icon"
            className="h-11 w-11 shrink-0 rounded-full"
            disabled={sending || !draft.trim()}
            onClick={() => void handleSend()}
            aria-label="Send"
          >
            <PaperPlaneTilt size={18} weight="fill" />
          </Button>
        </div>
        <p className="mx-auto mt-1 max-w-2xl text-[11px] text-muted-foreground">
          {draft.length}/160
        </p>
      </div>
    </div>
  );
}
