import { BellOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeading, PageSkeleton } from "@/components/workspace/parts";
import { requireWorkspace } from "@/lib/auth/guards";
import { markNotificationsRead } from "@/server/actions/account";
import { listNotifications } from "@/server/services/account";

export const metadata: Metadata = { title: "Notifications" };

const WHEN = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export default function Notifications() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NotificationsContent />
    </Suspense>
  );
}

async function NotificationsContent() {
  const { user, db } = await requireWorkspace("/dashboard/notifications");
  const items = await listNotifications(db, user.id);
  const unread = items.filter((item) => !item.readAt).length;

  return (
    <>
      <PageHeading
        title="Notifications"
        intro="Reviews, decisions and changes to your records."
        action={
          unread > 0 ? (
            <form action={markNotificationsRead}>
              <button type="submit" className="action action-secondary">
                Mark all as read
              </button>
            </form>
          ) : null
        }
      />

      {items.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-surface-2 text-muted">
            <BellOff aria-hidden="true" size={24} />
          </span>
          <h2 className="mt-5 text-[1.3rem]">Nothing yet</h2>
          <p className="mt-2 max-w-[44ch] text-muted">
            When an organisation reviews your work or something changes on one of your records, it
            will appear here.
          </p>
        </div>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {items.map((item) => (
            <li key={item.id} className="flex gap-4 p-5 sm:p-6">
              <span
                aria-hidden="true"
                className={`mt-2 size-2.5 flex-none rounded-full ${item.readAt ? "bg-transparent" : "bg-brand"}`}
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {item.readAt ? null : <span className="sr-only">Unread: </span>}
                  {item.href ? (
                    <Link href={item.href} className="text-ink no-underline hover:underline">
                      {item.title}
                    </Link>
                  ) : (
                    item.title
                  )}
                </p>
                {item.body ? <p className="mt-0.5 text-muted">{item.body}</p> : null}
                <p className="mt-1 text-[0.82rem] text-faint">{WHEN.format(item.createdAt)} UTC</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
