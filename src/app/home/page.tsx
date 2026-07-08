import Link from "next/link";
import { ensureSeeded } from "@/lib/bootstrap";
import { getCurrentMemberId } from "@/lib/session";
import {
  getAttributes,
  getAsksFor,
  getConnectionsFor,
  getMember,
} from "@/lib/store/repo";
import type { AttributeType } from "@/lib/types";
import Feed from "@/components/Feed";
import NewRequest from "@/components/NewRequest";
import RequestsInbox from "@/components/RequestsInbox";
import { Card } from "@astryxdesign/core/Card";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";

const TYPE_LABEL: Record<AttributeType, string> = {
  skill: "Skills",
  experience: "Experience",
  company: "Companies",
  school: "Education",
  industry: "Industries",
  interest: "Interests",
  offer: "Can help with",
  need: "Looking for",
};
const TYPE_ORDER: AttributeType[] = [
  "offer",
  "skill",
  "experience",
  "company",
  "school",
  "industry",
  "interest",
  "need",
];

export default async function Home() {
  await ensureSeeded();
  const id = await getCurrentMemberId();
  const me = id ? await getMember(id) : undefined;

  if (!me) {
    return (
      <div className="max-w-md mx-auto px-5 py-24 text-center">
        <h1 className="text-2xl font-bold">You&apos;re not in the graph yet</h1>
        <p className="mt-2 text-secondary">Build your agent persona to start networking.</p>
        <Button
          label="Build your agent persona"
          href="/onboard"
          variant="primary"
          size="lg"
          className="mt-6"
        />
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
        {/* Profile: name, headline, bio, and the extracted persona in one card */}
        <Card padding={6} className="gap-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{me.name}</h1>
              <p className="text-secondary">{me.headline}</p>
            </div>
            <Link
              href="/settings"
              className="text-sm text-accent hover:underline shrink-0 mt-1"
            >
              Edit
            </Link>
          </div>
          {me.bio && <p className="mt-3 text-sm leading-relaxed">{me.bio}</p>}

          {grouped.length > 0 && (
            <div className="mt-5 pt-5 border-t border-border flex flex-col gap-4">
              {grouped.map((g) => (
                <div key={g.type}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-secondary mb-2">
                    {TYPE_LABEL[g.type]}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.items.map((a) => (
                      <Badge key={a.id} variant="neutral" label={a.value} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Core action: post a request */}
        <Card padding={6} className="gap-0">
          <NewRequest />
        </Card>

        {asks.length > 0 && (
          <Card padding={6} className="gap-0">
            <h2 className="font-semibold mb-3">Your requests</h2>
            <div className="flex flex-col gap-3">
              {asks.map((a) => (
                <div key={a.id} className="border-l-2 border-accent pl-3 py-0.5">
                  <div className="text-sm">{a.text}</div>
                  <div className="text-xs text-secondary mt-0.5">
                    Finding the right people — we&rsquo;ll introduce you.
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <RequestsInbox />

        <Feed />

        <Card padding={6} className="gap-0">
          <h2 className="font-semibold mb-3">Connections</h2>
          {connections.length === 0 ? (
            <p className="text-sm text-secondary">No connections yet. Post a request to start.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {connections.map((c) => {
                const otherId = c.from_member === me.id ? c.to_member : c.from_member;
                return (
                  <div key={c.id} className="text-sm">
                    <div className="font-medium">{connectionNames.get(otherId) ?? "Unknown"}</div>
                    {c.reason && <div className="text-secondary text-xs mt-0.5">{c.reason}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
