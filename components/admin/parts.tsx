import Link from "next/link";

export const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export const MOMENT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

/** Pill links that set one search parameter. */
export function FilterLinks({
  label,
  base,
  param,
  current,
  options,
}: {
  label: string;
  base: string;
  param: string;
  current: string;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <nav aria-label={label} className="mb-4">
      <ul className="flex flex-wrap gap-2">
        {options.map((item, index) => (
          <li key={item.value}>
            <Link
              href={index === 0 ? base : `${base}?${param}=${item.value}`}
              aria-current={item.value === current ? "page" : undefined}
              className="inline-flex min-h-10 items-center rounded-full border border-line bg-surface px-4 text-[0.92rem] font-semibold text-muted no-underline hover:text-ink aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-canvas"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** A GET search box: works without JavaScript and keeps the query in the URL. */
export function SearchBox({
  action,
  label,
  defaultValue,
  hidden = {},
}: {
  action: string;
  label: string;
  defaultValue: string;
  hidden?: Record<string, string>;
}) {
  return (
    <form
      action={action}
      method="get"
      role="search"
      className="mb-6 flex flex-wrap items-end gap-3"
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="field min-w-[14rem] flex-1">
        <label htmlFor="admin-search" className="field-label">
          {label}
        </label>
        <input
          id="admin-search"
          name="q"
          type="search"
          maxLength={80}
          defaultValue={defaultValue}
          className="field-input"
        />
      </div>
      <button type="submit" className="action action-secondary">
        Search
      </button>
    </form>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="card px-6 py-12 text-center">
      <h2 className="text-[1.25rem]">{title}</h2>
      <p className="mx-auto mt-2 max-w-[46ch] text-muted">{body}</p>
    </div>
  );
}
