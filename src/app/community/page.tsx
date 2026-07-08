import { ensureSeeded } from "@/lib/bootstrap";
import { allAttributes, listMembers } from "@/lib/store/repo";
import { getCurrentMemberId, sandboxEnabled } from "@/lib/session";
import type { Attribute } from "@/lib/types";
import DemoBar from "./DemoBar";
import EmbeddingSpace from "@/components/EmbeddingSpace";
import ContactButton from "@/components/ContactButton";
import { Card } from "@astryxdesign/core/Card";
import { Badge } from "@astryxdesign/core/Badge";

// Blurred dummy names — never a real member name, just so each card reads as
// "there's a person here, hidden" until you connect.
const NAME_MASKS = ["Jordan Rivera", "Alex Morgan", "Sam Taylor", "Casey Lee", "Riley Chen", "Devon Park"];

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
          <p className="text-secondary mt-1">
            {members.length} members, embedded by what they offer and need — clustered in a
            high-dimensional vector space, projected down so you can see the shape of the network.
          </p>
        </div>
      </div>

      <div className="dark-panel rounded-3xl p-3 overflow-hidden mb-6">
        <EmbeddingSpace mode="ambient" theme="dark" height={480} />
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
        {members.map((m, i) => {
          const attrs = attrsByMember.get(m.id) ?? [];
          const offers = attrs.filter((a) => a.type === "offer").slice(0, 3);
          const skills = attrs.filter((a) => a.type === "skill").slice(0, 3);
          const chips = (offers.length ? offers : skills).slice(0, 4);
          const isSelf = m.id === currentId;
          return (
            <Card
              key={m.id}
              padding={5}
              className={`gap-0 ${isSelf ? "border-accent ring-1 ring-accent" : ""}`}
            >
              <div className="flex items-center gap-3">
                {/* Blurred avatar — identity revealed on connect */}
                <div
                  aria-hidden
                  className="shrink-0 w-11 h-11 rounded-full blur-[4px] bg-gradient-to-br from-accent/40 to-border"
                />
                <div className="min-w-0 flex-1">
                  {isSelf ? (
                    <div className="font-semibold text-sm">You</div>
                  ) : (
                    <div
                      aria-hidden
                      className="font-semibold text-sm blur-[5px] select-none w-fit"
                    >
                      {NAME_MASKS[i % NAME_MASKS.length]}
                    </div>
                  )}
                  <div className="text-sm text-secondary truncate">{m.headline}</div>
                </div>
                {!isSelf && <ContactButton memberId={m.id} />}
              </div>
              {chips.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {chips.map((a) => (
                    <Badge key={a.id} variant="neutral" label={a.value} />
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
