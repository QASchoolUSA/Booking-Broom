"use client";

import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "convex/_generated/api";
import { format } from "date-fns";
import { toast } from "sonner";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { SmsMessage, SmsThread } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ConversationViewProps {
  thread: SmsThread | null;
  messages: SmsMessage[] | undefined;
}

export function ConversationView({ thread, messages }: ConversationViewProps) {
  const sendMessage = useAction(api.voipmsActions.sendMessage);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, thread?.contact, thread?.did]);

  useEffect(() => {
    setDraft("");
  }, [thread?.did, thread?.contact]);

  if (!thread) {
    return (
      <div className="flex h-full min-h-[280px] flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
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
    <div className="flex h-full min-h-[280px] flex-1 flex-col">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold text-foreground">
          {thread.contact_formatted}
        </p>
        <p className="text-xs text-muted-foreground">
          via {thread.did_description || thread.did_formatted}
          {thread.sub_account ? ` · ${thread.sub_account}` : ""}
        </p>
      </div>

      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-3">
          {messages === undefined && (
            <p className="text-center text-sm text-muted-foreground">Loading…</p>
          )}
          {messages?.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">
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
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
                    outbound
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md bg-muted text-foreground"
                  )}
                >
                  {msg.body && <p className="whitespace-pre-wrap">{msg.body}</p>}
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
                            className="max-h-48 max-w-full object-contain"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <span className="px-1 text-[10px] text-muted-foreground">
                  {format(new Date(msg.sent_at), "MMM d, h:mm a")}
                  {msg.type === "mms" ? " · MMS" : ""}
                </span>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a text message…"
            rows={2}
            maxLength={160}
            className="min-h-[64px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <Button
            size="icon"
            className="h-10 w-10 shrink-0"
            disabled={sending || !draft.trim()}
            onClick={() => void handleSend()}
            aria-label="Send"
          >
            <PaperPlaneTilt size={18} weight="fill" />
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {draft.length}/160 · Text only (inbound MMS still shown)
        </p>
      </div>
    </div>
  );
}
