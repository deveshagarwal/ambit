import Link from "next/link";
import { ensureSeeded } from "@/lib/bootstrap";
import { getCurrentMemberId } from "@/lib/session";
import {
  getAttributes,
  getAsksFor,
  getConnectionsFor,
  getKarmaEvents,
  getMember,
} from "@/lib/store/repo";
import type { AttributeType } from "@/lib/types";
import CredBadge from "@/components/CredBadge";
import Feed from "@/components/Feed";
import RequestsInbox from "@/components/RequestsInbox";

const TYPE_LABEL: Record<AttributeType, string> = {
  skill: "Skills",
  experience: "Experience",
  industry: "Industries",
  interest: "Interests",
  offer: "Can help with",
  need: "Looking for",
};
const TYPE_ORDER: AttributeType[] = ["offer", "skill", "experience", "industry", "interest", "need"];

export default async function Home() {
  await ensureSeeded();
  const id = await getCurrentMemberId();
  const me = id ? await getMember(id) : undefined;

  if (!me) {
    return (
      <div className="max-w-md mx-auto px-5 py-24 text-center">
        <h1 className="text-2xl font-bold">You&apos;re not in the graph yet</h1>
        <p className="mt-2 text-[var(--muted)]">Build your agent persona to start networking.</p>
        <Link href="/onboard" className="btn btn-primary mt-6">
          Build your agent persona
        </Link>
      </div>
    );
  }

  const attrs = await getAttributes(me.id);
  const grouped = TYPE_ORDER.map((t) => ({
    type: t,
    items: attrs.filter((a) => a.type === t),
  })).filter((g) => g.items.length > 0);
  const asks = await getAsksFor(me.id);
  const connections = await getConnectionsFor(me.id);
  const karma = await getKarmaEvents(me.id);
  // Resolve the other side of each connection up front (async repo).
  const connectionNames = new Map<string, string>();
  for (const c of connections) {
    const otherId = c.from_member === me.id ? c.to_member : c.from_member;
    if (!connectionNames.has(otherId)) {
      connectionNames.set(otherId, (await getMember(otherId))?.name ?? "Unknown");
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 grid md:grid-cols-3 gap-5">
      <div className="md:col-span-2 flex flex-col gap-5">
        <div className="card p-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{me.name}</h1>
            <p className="text-[var(--muted)]">{me.headline}</p>
          </div>
          <p className="mt-3 text-sm leading-relaxed">{me.bio}</p>
          <Link href="/ask" className="btn btn-primary mt-5">
            Talk to the network
          </Link>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Your persona</h2>
            <Link href="/settings" className="text-sm text-[var(--accent)] hover:underline">
              Edit
            </Link>
          </div>
          <div className="flex flex-col gap-4">
            {grouped.map((g) => (
              <div key={g.type}>
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-2">
                  {TYPE_LABEL[g.type]}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {g.items.map((a) => (
                    <span key={a.id} className="tag">
                      {a.value}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {asks.length > 0 && (
          <div className="card p-6">
            <h2 className="font-semibold mb-3">Your asks</h2>
            <div className="flex flex-col gap-2">
              {asks.map((a) => (
                <div key={a.id} className="text-sm border-l-2 border-[var(--accent)] pl-3 py-0.5">
                  {a.text}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <RequestsInbox />
        <CredBadge karma={me.karma} size="lg" />

        <Feed />

        <div className="card p-6">
          <h2 className="font-semibold mb-3">Connections</h2>
          {connections.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No connections yet. Make an ask to start.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {connections.map((c) => {
                const otherId = c.from_member === me.id ? c.to_member : c.from_member;
                return (
                  <div key={c.id} className="text-sm">
                    <div className="font-medium">{connectionNames.get(otherId) ?? "Unknown"}</div>
                    {c.reason && <div className="text-[var(--muted)] text-xs mt-0.5">{c.reason}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card p-6">
          <h2 className="font-semibold mb-3">Cred activity</h2>
          <div className="flex flex-col gap-2">
            {karma.map((k) => (
              <div key={k.id} className="flex items-start justify-between gap-2 text-sm">
                <span className="text-[var(--muted)]">{k.reason}</span>
                <span className={k.delta >= 0 ? "text-[var(--good)] font-semibold" : "text-[var(--accent-2)]"}>
                  {k.delta > 0 ? "+" : ""}
                  {k.delta}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
