import { ensureSeeded } from "@/lib/bootstrap";
import { allAttributes, listMembers } from "@/lib/store/repo";
import { getCurrentMemberId, sandboxEnabled } from "@/lib/session";
import type { Attribute } from "@/lib/types";
import DemoBar from "./DemoBar";
import LiveSpace from "@/components/LiveSpace";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function Community() {
  await ensureSeeded();
  const currentId = await getCurrentMemberId();
  const members = await listMembers();
  const attrsByMember = new Map<string, Attribute[]>();
  for (const a of await allAttributes()) {
    const list = attrsByMember.get(a.member_id) ?? [];
    list.push(a);
    attrsByMember.set(a.member_id, list);
  }

  return (
    <div className="max-w-5xl mx-auto px-5 py-8">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">The latent space</h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            {members.length} members embedded by what they offer and need. Your node
            is white; lines run to your nearest neighbors.
          </p>
        </div>
      </div>

      <div className="dark-panel rounded-3xl p-3 overflow-hidden mb-6">
        <LiveSpace height={480} />
      </div>

      {sandboxEnabled() && (
        <DemoBar
          options={members
            .filter((m) => m.is_synthetic)
            .map((m) => ({ id: m.id, name: m.name, headline: m.headline }))}
          currentId={currentId}
        />
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {members.map((m) => {
          const attrs = attrsByMember.get(m.id) ?? [];
          const offers = attrs.filter((a) => a.type === "offer").slice(0, 3);
          const skills = attrs.filter((a) => a.type === "skill").slice(0, 3);
          const chips = (offers.length ? offers : skills).slice(0, 4);
          return (
            <Card
              key={m.id}
              className={`gap-0 p-5 ${m.id === currentId ? "border-[var(--primary)] ring-1 ring-[var(--primary)]" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {m.name}
                    {m.id === currentId && (
                      <span className="text-[10px] font-semibold text-[var(--primary)] bg-[var(--surface)] border border-[var(--primary)] rounded px-1.5 py-0.5">
                        you
                      </span>
                    )}
                    {!m.is_synthetic && m.id !== currentId && (
                      <span className="text-[10px] font-semibold text-[var(--good)]">real</span>
                    )}
                  </div>
                  <div className="text-sm text-[var(--muted-foreground)]">{m.headline}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-[var(--karma)]">{m.karma}</div>
                  <div className="text-[10px] text-[var(--muted-foreground)]">karma</div>
                </div>
              </div>
              {chips.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {chips.map((a) => (
                    <Badge key={a.id} variant="secondary">
                      {a.value}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
