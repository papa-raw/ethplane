'use client';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * The three states every panel owes the reader (PRD 3.15). Written once so no panel invents its own
 * spinner, and so "empty" is always a sentence rather than a blank rectangle.
 */
export function Panel<T>({
  poll, empty, isEmpty, children,
}: {
  poll: { data: T | null; error: string | null; loading: boolean };
  empty: string;
  isEmpty?: (data: T) => boolean;
  children: (data: T) => React.ReactNode;
}) {
  if (poll.loading && poll.data === null) {
    return (
      <div data-testid="panel-loading" className="space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }
  if (poll.error && poll.data === null) {
    return (
      <p data-testid="panel-error" className="text-sm text-red-600">
        Could not load this from the API: {poll.error}
      </p>
    );
  }
  const data = poll.data as T;
  if (data === null || (isEmpty ? isEmpty(data) : Array.isArray(data) && data.length === 0)) {
    return <p data-testid="panel-empty" className="text-sm text-muted-foreground">{empty}</p>;
  }
  return <div data-testid="panel-data">{children(data)}</div>;
}
