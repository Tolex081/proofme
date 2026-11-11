import { Lock } from "lucide-react";
import Link from "next/link";

/** Shown to a member whose role does not allow what they asked for. */
export function NoAccess({ what, backHref }: { what: string; backHref: string }) {
  return (
    <div className="card grid place-items-center px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-surface-2 text-muted">
        <Lock aria-hidden="true" size={24} />
      </span>
      <h1 className="mt-5 text-subhead">Your role cannot {what}</h1>
      <p className="mt-2 max-w-[46ch] text-muted">
        An owner or admin of this organisation can do this, or change your role.
      </p>
      <Link href={backHref} className="action action-secondary mt-6">
        Go back
      </Link>
    </div>
  );
}
