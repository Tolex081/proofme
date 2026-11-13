import { Bot, ExternalLink, ScanSearch } from "lucide-react";

import type { ReportView } from "@/server/services/evidence-agent";

const STATUS = {
  source_confirmed: { label: "Confirmed by source", chip: "chip-ok" },
  supports_claim: { label: "Supports the claim", chip: "chip-ok" },
  contradicts_claim: { label: "Contradicts the claim", chip: "chip-bad" },
  not_found: { label: "Not found", chip: "chip-wait" },
  unavailable: { label: "Could not be checked", chip: "chip-wait" },
  manual_review: { label: "Needs your judgement", chip: "chip-neutral" },
} as const;

const AI_STATUS = {
  completed: "AI analysis ran",
  not_configured: "AI analysis is not set up on this site; only source checks ran",
  unavailable: "The AI service was unavailable; only source checks ran",
  rejected: "The AI answer broke ProofMe's rules and was discarded; only source checks are shown",
} as const;

const MOMENT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

/** The Evidence Agent report. Source checks and AI interpretations are kept apart. */
export function EvidenceReportView({ view }: { view: ReportView }) {
  const { report } = view;
  const sourceFindings = report.findings.filter((finding) => finding.origin === "deterministic");
  const aiFindings = report.findings.filter((finding) => finding.origin === "ai");
  const counts = report.findings.reduce<Record<string, number>>((total, finding) => {
    total[finding.status] = (total[finding.status] ?? 0) + 1;
    return total;
  }, {});

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2 text-[0.9rem] text-muted">
        <span>
          Investigation {report.version} · {MOMENT.format(new Date(report.investigatedAt))}
        </span>
        <span>
          · GitHub:{" "}
          {report.github.accounts.length > 0
            ? report.github.accounts
                .map((account) => `@${account.login} (ID ${account.id})`)
                .join(", ")
            : "none linked"}
        </span>
      </div>
      <ul className="flex flex-wrap gap-2" aria-label="Summary">
        {Object.entries(counts).map(([status, count]) => (
          <li key={status} className={`chip ${STATUS[status as keyof typeof STATUS].chip}`}>
            {count} · {STATUS[status as keyof typeof STATUS].label}
          </li>
        ))}
      </ul>

      <section aria-label="Source checks">
        <h3 className="flex items-center gap-2 text-[1.02rem]">
          <ScanSearch aria-hidden="true" size={17} /> Checked against the source
        </h3>
        <p className="mt-1 text-[0.88rem] text-muted">
          Facts from GitHub&rsquo;s API at the time shown.
        </p>
        <ol className="mt-3 grid gap-3">
          {sourceFindings.map((finding, index) => (
            <Finding key={index} finding={finding} report={report} />
          ))}
        </ol>
      </section>

      <section aria-label="AI analysis">
        <h3 className="flex items-center gap-2 text-[1.02rem]">
          <Bot aria-hidden="true" size={17} /> AI analysis
        </h3>
        <p className="mt-1 text-[0.88rem] text-muted">
          {AI_STATUS[report.ai.status]}
          {report.ai.model ? ` (${report.ai.model})` : ""}. These are interpretations, not facts,
          and may be wrong.
        </p>
        {aiFindings.length > 0 ? (
          <ol className="mt-3 grid gap-3">
            {aiFindings.map((finding, index) => (
              <Finding key={index} finding={finding} report={report} />
            ))}
          </ol>
        ) : null}
      </section>

      <p className="rounded-2xl bg-surface-2 p-4 text-[0.88rem] text-muted">{report.notice}</p>
      <p className="digest text-[0.8rem] text-muted">Report digest {view.reportDigest}</p>
    </div>
  );
}

function Finding({
  finding,
  report,
}: {
  finding: ReportView["report"]["findings"][number];
  report: ReportView["report"];
}) {
  const status = STATUS[finding.status];
  const sources = report.sources.filter((source) => finding.sources.includes(source.key));
  return (
    <li className="well grid gap-1.5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`chip ${status.chip}`}>{status.label}</span>
        <span className="font-semibold">{finding.claim}</span>
      </div>
      <p className="text-[0.95rem]">{finding.explanation}</p>
      {sources.length > 0 ? (
        <p className="flex flex-wrap gap-x-4 text-[0.88rem]">
          {sources.map((source) => (
            <a
              key={source.key}
              href={source.url}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="text-link inline-flex items-center gap-1"
            >
              {source.key}: {source.label} <ExternalLink aria-hidden="true" size={13} />
            </a>
          ))}
        </p>
      ) : null}
    </li>
  );
}
