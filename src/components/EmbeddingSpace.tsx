"use client";

import { useEffect, useRef } from "react";

// Canvas-rendered high-dimensional embedding space. Members are vectors clustered
// by semantic role, projected from "1536-d" down to a rotating 3-d point cloud.
// mode="ambient": slow auto-rotating cloud you can drag. mode="query": a query
// vector lands in the space and its nearest neighbors light up.

import { landing } from "@/content/landing";

const HUES = [262, 158, 22, 330, 45, 205, 288];

// The query story (prompt + the people it surfaces) is editable in content/landing.ts.
const PROMPT = landing.ask.prompt;
const RESULTS = landing.ask.results;

export default function EmbeddingSpace({
  mode = "ambient",
  height = 520,
  fill = false,
  theme = "light",
}: {
  mode?: "ambient" | "query";
  height?: number;
  // when true, the canvas fills its positioned parent instead of a fixed height
  fill?: boolean;
  // light renders on a white panel; dark restores the glowing-on-black look
  theme?: "light" | "dark";
}) {
  const dark = theme === "dark";
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vecRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    type Pt = { x: number; y: number; z: number; c: number; i: number; sx: number; sy: number; depth: number; scale: number };

    const CLUSTERS = HUES.length;
    const perCluster = mode === "query" ? 34 : 30;
    const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 0.55;

    const centers: [number, number, number][] = [];
    for (let c = 0; c < CLUSTERS; c++) {
      const t = (c / CLUSTERS) * Math.PI * 2;
      centers.push([Math.cos(t) * 1.15, (Math.random() - 0.5) * 1.25, Math.sin(t) * 1.15]);
    }

    const pts: Pt[] = [];
    let idx = 0;
    for (let c = 0; c < CLUSTERS; c++) {
      for (let i = 0; i < perCluster; i++) {
        pts.push({
          x: centers[c][0] + gauss() * 0.6,
          y: centers[c][1] + gauss() * 0.6,
          z: centers[c][2] + gauss() * 0.6,
          c,
          i: idx++,
          sx: 0,
          sy: 0,
          depth: 0,
          scale: 1,
        });
      }
    }

    // Build an organic search: the query bounces through a couple of wrong
    // clusters, then finds the right cluster and settles on the best node.
    const nearest = new Set<number>();
    let journey: number[] = [];
    let target = -1;
    let segLenW: number[] = [];
    let totalW = 0;
    if (mode === "query") {
      const order = pts
        .map((p) => [p.i, Math.hypot(p.x, p.y, p.z)] as [number, number])
        .sort((a, b) => a[1] - b[1])
        .map(([i]) => i);
      order.slice(0, 5).forEach((i) => nearest.add(i));
      target = order[0];
      const tc = pts[target].c;
      // a representative node from a given cluster
      const rep = (c: number) => pts.find((p) => p.c === c)?.i;
      // wander through two clusters that are not the target's, spread around it
      const bounce1 = rep((tc + 2) % CLUSTERS);
      const bounce2 = rep((tc + 5) % CLUSTERS);
      // then, inside the right cluster, bounce across many nodes before settling
      const within = pts
        .filter((p) => p.c === tc && p.i !== target)
        .map((p) => p.i)
        .slice(0, 7);
      journey = [bounce1, bounce2, ...within, target].filter(
        (v): v is number => v !== undefined,
      );

      // Arc-length pacing: time per leg is proportional to its real length, with a
      // floor so each in-cluster hop still registers as a quick visible bounce.
      const base: number[][] = [[0, 0, 0], ...journey.map((i) => [pts[i].x, pts[i].y, pts[i].z])];
      for (let k = 1; k < base.length; k++) {
        const dx = base[k][0] - base[k - 1][0];
        const dy = base[k][1] - base[k - 1][1];
        const dz = base[k][2] - base[k - 1][2];
        const len = Math.max(0.35, Math.hypot(dx, dy, dz));
        segLenW.push(len);
        totalW += len;
      }
    }

    // Intra-cluster edges (each point to its 2 nearest in-cluster).
    const edges: [number, number][] = [];
    for (let i = 0; i < pts.length; i++) {
      const near = pts
        .map((p, j) =>
          j !== i && p.c === pts[i].c
            ? [j, (p.x - pts[i].x) ** 2 + (p.y - pts[i].y) ** 2 + (p.z - pts[i].z) ** 2]
            : [j, 1e9],
        )
        .sort((a, b) => a[1] - b[1]);
      for (let k = 0; k < 2; k++) if (near[k] && near[k][0] > i) edges.push([i, near[k][0]]);
    }

    const makeSprite = (stops: [number, string][], size: number) => {
      const s = document.createElement("canvas");
      s.width = s.height = size;
      const g = s.getContext("2d")!;
      const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      stops.forEach(([o, col]) => grad.addColorStop(o, col));
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      return s;
    };
    // Light: saturated cores with soft halos on white (source-over).
    // Dark: bright glowing points on black (additive).
    const sprites = HUES.map((h) =>
      makeSprite(
        dark
          ? [
              [0, `hsla(${h},90%,72%,0.95)`],
              [0.4, `hsla(${h},90%,62%,0.35)`],
              [1, `hsla(${h},90%,62%,0)`],
            ]
          : [
              [0, `hsla(${h},78%,52%,0.95)`],
              [0.42, `hsla(${h},78%,55%,0.28)`],
              [1, `hsla(${h},78%,55%,0)`],
            ],
        64,
      ),
    );
    // The query origin / pulse marker: white on dark, accent-indigo on light.
    const whiteSprite = makeSprite(
      dark
        ? [
            [0, "rgba(255,255,255,0.98)"],
            [0.35, "rgba(210,205,255,0.45)"],
            [1, "rgba(210,205,255,0)"],
          ]
        : [
            [0, "rgba(70,55,200,0.98)"],
            [0.35, "rgba(91,75,219,0.4)"],
            [1, "rgba(91,75,219,0)"],
          ],
      120,
    );

    let W = 0;
    let H = height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      W = wrap.clientWidth;
      H = fill ? wrap.clientHeight || height : height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let ay = 0;
    let ax = -0.32;
    let vy = 0.0017;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      vy = 0;
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      ay += (e.clientX - lastX) * 0.005;
      ax += (e.clientY - lastY) * 0.005;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const up = () => {
      dragging = false;
      vy = 0.0017;
    };
    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);

    const focal = 3;
    const project = (x: number, y: number, z: number) => {
      const cy = Math.cos(ay);
      const sy = Math.sin(ay);
      const X = x * cy - z * sy;
      const Z = x * sy + z * cy;
      const cx = Math.cos(ax);
      const sx = Math.sin(ax);
      const Y2 = y * cx - Z * sx;
      const Z2 = y * sx + Z * cx;
      const scale = focal / (focal - Z2);
      const spread = Math.min(W, H) * 0.42;
      return { sx: W / 2 + X * scale * spread, sy: H / 2 + Y2 * scale * spread, depth: Z2, scale };
    };

    let t = 0;
    let raf = 0;
    const frame = () => {
      t += 1;
      if (!dragging) ay += vy;
      ctx.clearRect(0, 0, W, H);

      for (const p of pts) {
        const pr = project(p.x, p.y, p.z);
        p.sx = pr.sx;
        p.sy = pr.sy;
        p.depth = pr.depth;
        p.scale = pr.scale;
      }

      ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
      ctx.lineWidth = 1;
      for (const [a, b] of edges) {
        const pa = pts[a];
        const pb = pts[b];
        const d = (pa.depth + pb.depth) / 2;
        const alpha = Math.max(0, Math.min(0.5, (d + 1.2) / 3)) * 0.45;
        ctx.strokeStyle = dark
          ? `hsla(${HUES[pa.c]},80%,66%,${alpha})`
          : `hsla(${HUES[pa.c]},55%,50%,${alpha})`;
        ctx.beginPath();
        ctx.moveTo(pa.sx, pa.sy);
        ctx.lineTo(pb.sx, pb.sy);
        ctx.stroke();
      }

      const order = [...pts].sort((a, b) => a.depth - b.depth);
      for (const p of order) {
        const hit = mode === "query" && nearest.has(p.i);
        const size = Math.max(3, 9 * p.scale) * (hit ? 1.9 : 1);
        const floor = dark ? 0.14 : 0.3;
        ctx.globalAlpha = Math.max(floor, Math.min(1, (p.depth + 1.4) / 2.6)) * (hit ? 1 : 0.85);
        ctx.drawImage(sprites[p.c], p.sx - size, p.sy - size, size * 2, size * 2);
      }
      ctx.globalAlpha = 1;

      if (mode === "query" && journey.length > 0) {
        const q = project(0, 0, 0);
        // Screen-space waypoints: the query origin, then each hop, ending on target.
        const path = [q, ...journey.map((i) => ({ sx: pts[i].sx, sy: pts[i].sy }))];

        ctx.globalCompositeOperation = dark ? "lighter" : "source-over";

        // The full route, faint.
        ctx.strokeStyle = dark ? "rgba(170,155,255,0.18)" : "rgba(91,75,219,0.22)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(path[0].sx, path[0].sy);
        for (let k = 1; k < path.length; k++) ctx.lineTo(path[k].sx, path[k].sy);
        ctx.stroke();

        // A pulse traveling the route, looping, with a bright trail behind it.
        // Arc-length paced (long cross-cluster legs are slow, in-cluster hops are
        // quick bounces), then a pause to settle on the match.
        const segs = path.length - 1;
        const LOOP = 300;
        const travelFrac = 0.82;
        const phase = (t % LOOP) / LOOP;
        let seg = segs - 1;
        let lt = 1;
        if (phase < travelFrac) {
          const d = (phase / travelFrac) * totalW;
          let acc = 0;
          seg = 0;
          while (seg < segLenW.length - 1 && acc + segLenW[seg] < d) {
            acc += segLenW[seg];
            seg += 1;
          }
          lt = segLenW[seg] > 0 ? Math.min(1, (d - acc) / segLenW[seg]) : 1;
        }
        const a = path[seg];
        const b = path[seg + 1];
        const px = a.sx + (b.sx - a.sx) * lt;
        const py = a.sy + (b.sy - a.sy) * lt;

        ctx.strokeStyle = dark ? "rgba(255,255,255,0.85)" : "rgba(70,55,200,0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(path[0].sx, path[0].sy);
        for (let k = 1; k <= seg; k++) ctx.lineTo(path[k].sx, path[k].sy);
        ctx.lineTo(px, py);
        ctx.stroke();

        // Origin (the written prompt enters here).
        const qs = 16 * q.scale;
        ctx.drawImage(whiteSprite, q.sx - qs, q.sy - qs, qs * 2, qs * 2);

        // Traveling pulse.
        const ps = 9;
        ctx.drawImage(whiteSprite, px - ps, py - ps, ps * 2, ps * 2);

        // Target blooms as the pulse arrives, and wears the person's name.
        const tp = pts[target];
        const bloom = phase >= travelFrac ? 1 : seg === segs - 1 ? lt : 0;
        const tsz = (16 + 10 * bloom) * tp.scale;
        ctx.drawImage(sprites[tp.c], tp.sx - tsz, tp.sy - tsz, tsz * 2, tsz * 2);
        ctx.globalCompositeOperation = "source-over";
        ctx.font = "600 14px ui-sans-serif, system-ui, sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillStyle = dark
          ? `rgba(255,255,255,${0.55 + 0.45 * bloom})`
          : `rgba(28,26,38,${0.55 + 0.45 * bloom})`;
        ctx.fillText(RESULTS[0].name, tp.sx + tsz + 6, tp.sy);
      }

      ctx.globalCompositeOperation = "source-over";

      if (vecRef.current && t % 8 === 0) {
        let s = "[";
        for (let i = 0; i < 6; i++) s += (Math.random() * 2 - 1).toFixed(2) + (i < 5 ? ", " : "");
        s += ", … ]";
        vecRef.current.textContent = s;
      }

      raf = requestAnimationFrame(frame);
    };

    if (reduce) {
      ay = 0.6;
      frame();
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [mode, height, fill, dark]);

  return (
    <div
      ref={wrapRef}
      className={`relative w-full ${fill ? "h-full" : ""}`}
      style={fill ? undefined : { height }}
    >
      <canvas
        ref={canvasRef}
        className={`block w-full cursor-grab active:cursor-grabbing ${fill ? "h-full" : ""}`}
      />

      {mode === "query" ? (
        <div className="absolute top-3 left-4 max-w-[18rem] pointer-events-none">
          <div className={`font-mono text-[10px] mb-1 ${dark ? "text-[#9a93c4]" : "text-[var(--muted-foreground)]"}`}>
            you ask
          </div>
          <div
            className={`rounded-xl backdrop-blur px-3 py-2 text-sm leading-snug ${
              dark
                ? "border border-white/10 bg-black/55 text-white/90"
                : "border border-[var(--border)] bg-white/80 text-[var(--foreground)]"
            }`}
          >
            &ldquo;{PROMPT}&rdquo;
          </div>
          <div className={`mt-1.5 text-[11px] ${dark ? "text-white/45" : "text-[var(--muted-foreground)]"}`}>
            searching across the community
          </div>
        </div>
      ) : fill ? null : (
        <div className="absolute top-3 left-4 text-[11px] leading-relaxed pointer-events-none">
          <div className={dark ? "text-[#cdc6ff]/70" : "text-[var(--primary)]"}>the community</div>
          <span ref={vecRef} className="hidden" />
        </div>
      )}

      {mode === "query" && (
        <div
          className={`absolute top-3 right-3 w-[14.5rem] rounded-xl backdrop-blur p-3 ${
            dark ? "border border-white/10 bg-black/55" : "border border-[var(--border)] bg-white/85"
          }`}
        >
          <div className={`font-mono text-[10px] mb-2 ${dark ? "text-[#9a93c4]" : "text-[var(--muted-foreground)]"}`}>
            the people who fit
          </div>
          <div className="flex flex-col gap-2">
            {RESULTS.map((r) => (
              <div key={r.name} className="flex items-start gap-2">
                <span className="font-mono text-[11px] text-[var(--good)] w-9 shrink-0">{r.score}%</span>
                <div>
                  <div className={`text-xs font-semibold leading-none ${dark ? "text-white" : "text-[var(--foreground)]"}`}>
                    {r.name}
                  </div>
                  <div className={`text-[11px] mt-0.5 ${dark ? "text-white/55" : "text-[var(--muted-foreground)]"}`}>
                    {r.why}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className={`absolute bottom-3 right-4 text-[11px] pointer-events-none ${
          dark ? "text-white/35" : "text-[var(--muted-foreground)]"
        }`}
      >
        {mode === "query" ? "the network connects you" : "drag to rotate"}
      </div>
    </div>
  );
}
