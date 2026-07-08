import Link from "next/link";
import { ensureSeeded } from "@/lib/bootstrap";
import { getCurrentMemberId } from "@/lib/session";
import { getAttributes, getMember } from "@/lib/store/repo";
import PersonaEditor from "@/components/PersonaEditor";
import { Button } from "@astryxdesign/core/Button";

export default async function Settings() {
  await ensureSeeded();
  const id = await getCurrentMemberId();
  const me = id ? await getMember(id) : undefined;

  if (!me) {
    return (
      <div className="max-w-md mx-auto px-5 py-24 text-center">
        <h1 className="text-2xl font-bold">Build your persona first</h1>
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

  const attrs = (await getAttributes(me.id)).map((a) => ({
    id: a.id,
    type: a.type,
    value: a.value,
  }));

  return (
    <div className="max-w-2xl mx-auto px-5 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Edit your persona</h1>
        <p className="text-secondary mt-1 text-sm">
          Keep it current. Changes update what the network matches you on right away.
        </p>
      </div>
      <PersonaEditor initialName={me.name} initialHeadline={me.headline} initialAttrs={attrs} />
    </div>
  );
}
