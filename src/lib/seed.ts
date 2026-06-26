import { query } from "./store/client";
import { addAttributes, createConnection, createMember } from "./store/repo";
import type { AttributeType } from "./types";

type Bundle = Partial<Record<AttributeType, string[]>>;

interface Archetype {
  headline: string;
  bundle: Bundle;
}

const ARCHETYPES: Archetype[] = [
  {
    headline: "Seed-stage founder, B2B SaaS",
    bundle: {
      skill: ["fundraising", "pitch decks", "go-to-market", "founder hiring"],
      experience: ["raised a seed round", "YC alum", "scaled 0 to 1"],
      industry: ["b2b saas", "startups"],
      offer: ["intros to seed VCs", "pitch deck feedback", "founder mentoring"],
      need: ["enterprise design partners", "a technical co-founder"],
    },
  },
  {
    headline: "ML engineer working on LLM applications",
    bundle: {
      skill: ["machine learning", "llm fine-tuning", "python", "rag pipelines", "pytorch"],
      experience: ["shipped an llm product", "built a rag system"],
      industry: ["ai", "developer tools"],
      offer: ["llm architecture review", "ml career advice", "eval design help"],
      need: ["gpu credits", "a design partner for an ai eval tool"],
    },
  },
  {
    headline: "Technical recruiter, deep fintech network",
    bundle: {
      skill: ["recruiting", "talent sourcing", "compensation benchmarking"],
      experience: ["placed 50+ fintech engineers", "ran a recruiting agency"],
      industry: ["fintech", "recruiting", "hiring"],
      offer: ["fintech engineer intros", "hiring funnel review", "salary benchmarks"],
      need: ["startups hiring senior engineers"],
    },
  },
  {
    headline: "Product designer, 0 to 1 consumer apps",
    bundle: {
      skill: ["product design", "figma", "user research", "prototyping", "design systems"],
      experience: ["designed a top-100 app", "built a design team"],
      industry: ["consumer", "mobile"],
      offer: ["design crits", "portfolio reviews", "figma templates"],
      need: ["a frontend engineer to partner with"],
    },
  },
  {
    headline: "Growth marketer, paid + lifecycle",
    bundle: {
      skill: ["growth marketing", "paid acquisition", "lifecycle marketing", "seo", "analytics"],
      experience: ["scaled a startup to 1M users", "ran 7-figure ad budgets"],
      industry: ["consumer", "ecommerce"],
      offer: ["growth audits", "paid channel strategy", "funnel teardowns"],
      need: ["a fractional data analyst"],
    },
  },
  {
    headline: "Early-stage VC associate",
    bundle: {
      skill: ["venture capital", "diligence", "market sizing", "deal sourcing"],
      experience: ["sourced 200 deals a year", "led a pre-seed check"],
      industry: ["venture capital", "startups"],
      offer: ["warm VC intros", "fundraising strategy", "investor feedback"],
      need: ["promising ai founders to meet"],
    },
  },
  {
    headline: "Backend engineer, distributed systems",
    bundle: {
      skill: ["backend engineering", "go", "kubernetes", "databases", "system design"],
      experience: ["scaled infra to billions of requests", "ran on-call at scale"],
      industry: ["infrastructure", "developer tools"],
      offer: ["system design reviews", "scaling advice", "interview prep"],
      need: ["a startup with a hard infra problem"],
    },
  },
  {
    headline: "Healthtech operator and clinician",
    bundle: {
      skill: ["clinical operations", "regulatory", "health policy", "partnerships"],
      experience: ["launched a digital health product", "navigated FDA clearance"],
      industry: ["healthcare", "healthtech"],
      offer: ["healthcare GTM advice", "clinical advisor intros", "regulatory guidance"],
      need: ["engineers interested in healthcare"],
    },
  },
  {
    headline: "Climate tech founder, hardware",
    bundle: {
      skill: ["hardware", "supply chain", "grant writing", "manufacturing"],
      experience: ["built a climate hardware startup", "won government grants"],
      industry: ["climate", "hardware", "energy"],
      offer: ["climate grant guidance", "hardware sourcing", "manufacturing intros"],
      need: ["embedded engineers", "climate-focused investors"],
    },
  },
  {
    headline: "Content creator and community builder",
    bundle: {
      skill: ["content strategy", "community building", "writing", "social media"],
      experience: ["grew a 100k newsletter", "built an online community"],
      industry: ["media", "creator economy"],
      offer: ["audience growth advice", "newsletter feedback", "creator intros"],
      need: ["a sponsor for my newsletter"],
    },
  },
  {
    headline: "Sales leader, enterprise SaaS",
    bundle: {
      skill: ["enterprise sales", "sales playbooks", "pipeline management", "negotiation"],
      experience: ["built a sales org", "closed seven-figure deals"],
      industry: ["b2b saas", "sales"],
      offer: ["sales process help", "enterprise buyer intros", "cold outreach review"],
      need: ["a RevOps hire"],
    },
  },
  {
    headline: "Startup lawyer, formation and fundraising",
    bundle: {
      skill: ["startup law", "equity", "contracts", "fundraising docs"],
      experience: ["advised 100+ startups", "closed venture rounds"],
      industry: ["legal", "startups"],
      offer: ["legal office hours", "cap table review", "SAFE explainers"],
      need: ["founders needing formation help"],
    },
  },
  {
    headline: "Data scientist, experimentation",
    bundle: {
      skill: ["data science", "sql", "ab testing", "causal inference", "python"],
      experience: ["built an experimentation platform", "ran 1000+ experiments"],
      industry: ["data", "consumer"],
      offer: ["ab test design", "metrics strategy", "analytics mentoring"],
      need: ["a startup with messy data to fix"],
    },
  },
  {
    headline: "Frontend engineer, React and design systems",
    bundle: {
      skill: ["frontend engineering", "react", "typescript", "design systems", "accessibility"],
      experience: ["shipped a consumer app to millions", "built a component library"],
      industry: ["consumer", "developer tools"],
      offer: ["frontend pairing", "react code review", "career advice"],
      need: ["a designer to collaborate with"],
    },
  },
  {
    headline: "Operations and finance generalist",
    bundle: {
      skill: ["operations", "financial modeling", "fundraising ops", "hiring"],
      experience: ["was first ops hire at a startup", "built financial models"],
      industry: ["startups", "operations"],
      offer: ["financial model templates", "ops setup advice", "fundraising data rooms"],
      need: ["a startup needing a fractional COO"],
    },
  },
];

const FIRST = [
  "Maya","Leo","Priya","Sam","Aisha","Diego","Hana","Noah","Zoe","Ravi",
  "Elena","Marcus","Yuki","Omar","Grace","Theo","Nadia","Felix","Ivy","Jin",
  "Sofia","Kai","Amara","Ben","Lucia","Arjun","Nora","Eli","Chen","Tara",
  "Mateo","Layla","Hugo","Aria","Dev","Maria","Oscar","Anika","Jonas","Mira",
  "Pablo","Rina","Tom","Sana","Vik",
];
const LAST = [
  "Chen","Patel","Okafor","Reyes","Kim","Silva","Nguyen","Haddad","Rossi","Sharma",
  "Cohen","Diallo","Tanaka","Mensah","Park","Costa","Khan","Ortiz","Lund","Mehta",
  "Walsh","Adeyemi","Ferrari","Yang","Bauer","Ibrahim","Novak","Singh","Moreau","Flores",
  "Hassan","Larsen","Romano","Gupta","Berg","Cruz","Wagner","Kaur","Schmidt","Vance",
  "Lopez","Banerjee","Hale","Ali","Roy",
];

function pick<T>(arr: T[] | undefined, n: number, offset: number): T[] {
  if (!arr || arr.length === 0) return [];
  const out: T[] = [];
  for (let i = 0; i < Math.min(n, arr.length); i++) {
    out.push(arr[(offset + i) % arr.length]);
  }
  return out;
}

export async function hasSyntheticMembers(): Promise<boolean> {
  const r = await query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM members WHERE is_synthetic = true`,
  );
  return (r[0]?.c ?? 0) > 0;
}

export async function seedCommunity(force = false): Promise<number> {
  if (force) {
    await query(`DELETE FROM members WHERE is_synthetic = true`);
  } else if (await hasSyntheticMembers()) {
    return 0;
  }

  const created: string[] = [];
  let idx = 0;
  // 3 instances per archetype = 45 members.
  for (let inst = 0; inst < 3; inst++) {
    for (const arch of ARCHETYPES) {
      const name = `${FIRST[idx % FIRST.length]} ${LAST[(idx * 7) % LAST.length]}`;
      const karma = 8 + ((idx * 13) % 60);
      const m = await createMember({
        name,
        headline: arch.headline,
        bio: `${arch.headline}. Active member of the Weave community.`,
        isSynthetic: true,
        karma,
      });
      const attrs: { type: AttributeType; value: string; source: string }[] = [];
      (Object.keys(arch.bundle) as AttributeType[]).forEach((type) => {
        for (const v of pick(arch.bundle[type], 3, inst)) {
          attrs.push({ type, value: v, source: "seed" });
        }
      });
      await addAttributes(m.id, attrs);
      created.push(m.id);
      idx++;
    }
  }

  // Sprinkle a few existing connections so the graph isn't empty.
  for (let i = 0; i < created.length; i += 5) {
    const a = created[i];
    const b = created[(i + 3) % created.length];
    if (a && b && a !== b) {
      await createConnection({ from: a, to: b, reason: "Met through Weave", askId: null });
    }
  }

  return created.length;
}
