import { Skeleton } from "@/components/ui/skeleton";

export function PageHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72 max-w-full" />
    </div>
  );
}

export function ThreadListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-border" aria-busy="true" aria-label="Loading conversations">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="space-y-2 px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-14" />
          </div>
          <Skeleton className="h-3 w-48 max-w-[80%]" />
          <Skeleton className="h-3.5 w-full max-w-[90%]" />
        </li>
      ))}
    </ul>
  );
}

export function EmailThreadListSkeleton({ rows = 8 }: { rows?: number }) {
  return <ThreadListSkeleton rows={rows} />;
}

export function MessageBubbleSkeleton() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3 py-2" aria-busy="true" aria-label="Loading messages">
      <div className="flex justify-start">
        <Skeleton className="h-16 w-[70%] rounded-2xl" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-12 w-[55%] rounded-2xl" />
      </div>
      <div className="flex justify-start">
        <Skeleton className="h-20 w-[65%] rounded-2xl" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-10 w-[40%] rounded-2xl" />
      </div>
    </div>
  );
}

export function EmailMessageSkeleton() {
  return (
    <div className="space-y-4 py-1" aria-busy="true" aria-label="Loading email">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className={`rounded-xl border border-border/70 p-3.5 ${
            i % 2 === 0 ? "mr-4 md:mr-12" : "ml-4 md:ml-12"
          }`}
        >
          <div className="mb-3 flex justify-between gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="mb-2 h-3 w-full" />
          <Skeleton className="mb-2 h-3 w-[92%]" />
          <Skeleton className="h-3 w-[70%]" />
        </div>
      ))}
    </div>
  );
}
