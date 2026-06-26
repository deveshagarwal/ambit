import { query } from "./client";

// GraphStore seam. Implemented now with Postgres recursive CTEs over the
// connections table. Swap-later: the same interface backed by Apache AGE or
// Neo4j when multi-hop matching becomes load-bearing or edge counts get large.

export async function neighborIds(memberId: string): Promise<string[]> {
  const rows = await query<{ id: string }>(
    `SELECT CASE WHEN from_member = $1 THEN to_member ELSE from_member END AS id
     FROM connections WHERE from_member = $1 OR to_member = $1`,
    [memberId],
  );
  return Array.from(new Set(rows.map((r) => r.id)));
}

// Trust-path expansion: everyone reachable from any seed within maxDepth hops,
// with the shortest depth at which they were reached. Used to boost candidates
// who are close in the social graph.
export async function expand(
  seedIds: string[],
  maxDepth = 2,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (seedIds.length === 0) return out;

  const rows = await query<{ id: string; depth: number }>(
    `
    WITH RECURSIVE reach(id, depth) AS (
      SELECT unnest($1::text[]) AS id, 0 AS depth
      UNION
      SELECT CASE WHEN c.from_member = r.id THEN c.to_member ELSE c.from_member END, r.depth + 1
      FROM reach r
      JOIN connections c ON (c.from_member = r.id OR c.to_member = r.id)
      WHERE r.depth < $2
    )
    SELECT id, MIN(depth)::int AS depth FROM reach GROUP BY id
    `,
    [seedIds, maxDepth],
  );
  for (const r of rows) out.set(r.id, r.depth);
  return out;
}
