"use client";

import { useEffect, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  CaretLeft,
  DownloadSimple,
  PaperPlaneTilt,
  Trash,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { EmailMessage, EmailThread } from "@/lib/types";
import { EmailMessageSkeleton } from "@/components/loading/skeletons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

interface EmailThreadViewProps {
  thread: EmailThread | null;
  messages: EmailMessage[] | undefined;
  onBack?: () => void;
  onDeleted?: () => void;
  immersiveMobile?: boolean;
  className?: string;
}

function AttachmentLink({
  storageId,
  filename,
  skipped,
  size,
}: {
  storageId: string | null;
  filename: string;
  skipped: boolean;
  size: number;
}) {
  const url = useQuery(
    api.email.getAttachmentUrl,
    storageId && !skipped
      ? { storageId: storageId as Id<"_storage"> }
      : "skip"
  );

  const sizeLabel =
    size >= 1024 * 1024
      ? `${(size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(size / 1024))} KB`;

  if (skipped || !storageId) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
        {filename} ({sizeLabel}) — open in SpaceMail webmail
      </span>
    );
  }

  if (!url) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
        {filename}…
      </span>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground hover:bg-muted/80"
    >
      <DownloadSimple size={12} />
      {filename} ({sizeLabel})
    </a>
  );
}

function MessageBody({ message }: { message: EmailMessage }) {
  const [preferPlain, setPreferPlain] = useState(false);
  const [sanitized, setSanitized] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!message.html_body) {
      setSanitized(null);
      return;
    }
    void import("isomorphic-dompurify").then((mod) => {
      if (cancelled) return;
      const DOMPurify = mod.default;
      setSanitized(
        DOMPurify.sanitize(message.html_body!, {
          USE_PROFILES: { html: true },
          FORBID_TAGS: ["script", "iframe", "object", "embed", "form"],
          FORBID_ATTR: ["onerror", "onload", "onclick"],
        })
      );
    });
    return () => {
      cancelled = true;
    };
  }, [message.html_body]);

  const showHtml = Boolean(sanitized) && !preferPlain;

  return (
    <div className="space-y-2">
      {message.html_body && message.text_body && (
        <button
          type="button"
          className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => setPreferPlain((v) => !v)}
        >
          {preferPlain ? "Show HTML" : "Show plain text"}
        </button>
      )}
      {showHtml ? (
        <div
          className="email-html prose prose-sm max-w-none break-words text-sm text-foreground [&_a]:text-primary [&_img]:max-w-full"
          dangerouslySetInnerHTML={{ __html: sanitized! }}
        />
      ) : message.html_body && !preferPlain && !message.text_body ? (
        <Skeleton className="h-24 w-full rounded-md" />
      ) : (
        <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
          {message.text_body || (message.html_body ? "" : "(empty message)")}
        </pre>
      )}
      {message.attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {message.attachments.map((att, i) => (
            <AttachmentLink
              key={`${att.filename}-${i}`}
              storageId={att.storage_id}
              filename={att.filename}
              skipped={att.skipped}
              size={att.size}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function EmailThreadView({
  thread,
  messages,
  onBack,
  onDeleted,
  immersiveMobile = false,
  className,
}: EmailThreadViewProps) {
  const sendReply = useAction(api.emailActions.sendReply);
  const markSeen = useAction(api.emailActions.markSeen);
  const deleteThread = useAction(api.emailActions.deleteThread);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const markedRef = useRef<string | null>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages?.length, thread?.id]);

  useEffect(() => {
    if (!thread || thread.unread_count === 0) return;
    if (markedRef.current === thread.id) return;
    markedRef.current = thread.id;
    void markSeen({ threadId: thread.id as Id<"emailThreads"> }).catch(() => {
      markedRef.current = null;
    });
  }, [thread, markSeen]);

  useEffect(() => {
    setDraft("");
  }, [thread?.id]);

  const handleSend = async () => {
    if (!thread || sending) return;
    const text = draft.trim();
    if (!text) {
      toast.error("Enter a reply");
      return;
    }
    setSending(true);
    try {
      await sendReply({
        threadId: thread.id as Id<"emailThreads">,
        text,
      });
      setDraft("");
      toast.success("Reply sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    if (!thread || deleting) return;
    const ok = window.confirm(
      "Delete this conversation from Booking Broom and SpaceMail INBOX?"
    );
    if (!ok) return;
    setDeleting(true);
    try {
      const result = await deleteThread({
        threadId: thread.id as Id<"emailThreads">,
      });
      if (result.imapError) {
        toast.warning("Removed locally; SpaceMail delete had an issue", {
          description: result.imapError,
        });
      } else {
        toast.success("Conversation deleted");
      }
      onDeleted?.();
      onBack?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  if (!thread) {
    return (
      <div
        className={cn(
          "flex flex-1 items-center justify-center text-sm text-muted-foreground",
          className
        )}
      >
        Select a conversation
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col",
        immersiveMobile && "h-full",
        className
      )}
    >
      <div className="flex shrink-0 items-start gap-2 border-b border-border px-3 py-2.5 md:px-4">
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-0.5 h-9 w-9 shrink-0 md:hidden"
            onClick={onBack}
            aria-label="Back"
          >
            <CaretLeft size={20} weight="bold" />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold text-foreground">
            {thread.subject || "(no subject)"}
          </h3>
          <p className="truncate text-xs text-muted-foreground">
            {thread.site_name ? `${thread.site_name} · ` : ""}
            {thread.mailbox_email}
            {` · ${thread.message_count} message${thread.message_count === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mt-0.5 h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => void handleDelete()}
          disabled={deleting}
          aria-label="Delete conversation"
        >
          <Trash size={18} />
        </Button>
      </div>

      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 md:px-5"
      >
        {messages === undefined ? (
          <EmailMessageSkeleton />
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages</p>
        ) : (
          <ul className="space-y-4">
            {messages.map((m) => {
              const outbound = m.direction === "out";
              return (
                <li
                  key={m.id}
                  className={cn(
                    "rounded-xl border border-border/70 p-3.5 shadow-sm",
                    outbound ? "ml-4 bg-primary/5 md:ml-12" : "mr-4 bg-card md:mr-12"
                  )}
                >
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {outbound ? "You" : m.from}
                    </p>
                    <time className="text-[11px] tabular-nums text-muted-foreground">
                      {format(new Date(m.sent_at), "MMM d, yyyy · h:mm a")}
                    </time>
                  </div>
                  {!outbound && m.to.length > 0 && (
                    <p className="mb-2 text-[11px] text-muted-foreground">
                      To: {m.to.join(", ")}
                    </p>
                  )}
                  <MessageBody message={m} />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div
        className={cn(
          "shrink-0 border-t border-border bg-background px-3 py-2.5 md:px-4",
          immersiveMobile && "pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        )}
      >
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a reply…"
            rows={2}
            className="min-h-[44px] flex-1 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            aria-label="Send reply"
          >
            <PaperPlaneTilt size={18} weight="fill" />
          </Button>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          ⌘/Ctrl + Enter to send
        </p>
      </div>
    </div>
  );
}
