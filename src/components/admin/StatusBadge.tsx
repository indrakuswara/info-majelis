// Badge status konten admin (plan Task 7).

import type { ContentStatus } from "../../lib/domain.ts";

export function StatusBadge({ status }: { status: ContentStatus }) {
  if (status === "published") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
        Terbit
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
      Draft
    </span>
  );
}
