import { credTier, nextTier, tierProgress } from "@/lib/cred";
import { Card } from "@astryxdesign/core/Card";

// Pure presentational. The raw karma number becomes legible standing: a tier,
// a reciprocity blurb, and visible progress toward the next rung.
export default function CredBadge({
  karma,
  size = "lg",
}: {
  karma: number;
  size?: "sm" | "lg";
}) {
  const tier = credTier(karma);
  const { tier: next, remaining } = nextTier(karma);
  const progress = tierProgress(karma);

  if (size === "sm") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none"
        style={{
          color: tier.color,
          borderColor: tier.color,
          backgroundColor: `color-mix(in srgb, ${tier.color} 12%, transparent)`,
        }}
        title={tier.standing}
      >
        <span>{tier.name}</span>
        <span className="opacity-50">·</span>
        <span className="text-karma">{karma} ☼</span>
      </span>
    );
  }

  return (
    <Card padding={6} className="gap-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Your standing
          </div>
          <div className="mt-1 text-2xl font-bold tracking-tight" style={{ color: tier.color }}>
            {tier.name}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold text-karma">{karma} ☼</div>
          <div className="text-xs text-secondary">cred</div>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-secondary">{tier.standing}</p>

      <div className="mt-5">
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-border"
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.round(progress * 100)}%`,
              backgroundColor: tier.color,
            }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-secondary">
            {next ? `${remaining} cred to ${next.name}` : "Top tier"}
          </span>
          {next && (
            <span className="font-medium" style={{ color: next.color }}>
              {next.name}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
