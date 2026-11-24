import { Circle, Ellipse, G, Path } from "react-native-svg";
import { C } from "../theme";
import { prng } from "./rng";
import { star } from "./Token";

/* THE MONSTER ON THE ISLAND (single player, pve.ts). Line art in the
 * board's hand: a soft blob of a body with a face, its colour, its horns or
 * spikes and its size set by which monster it is; every fifth is a boss and
 * wears a crown. It bobs while it waits, flashes white and jolts when a
 * throw lands, looks toward the rower, and on a KO squashes and pops into
 * stars. Our own creatures, drawn here. */

const BODY = ["#8FD18B", "#F2A65A", "#B48CE0", "#6EC6D9", "#F28CB1", "#E8D35A", "#9AA7B5", "#E2725B"];

/* A wobbly round body, r across, its edge set by the seed. */
function bodyPath(r: number, seed: number, t: number): string {
  const rnd = prng(seed);
  const n = 12;
  const ks = Array.from({ length: n }, () => 0.9 + rnd() * 0.16);
  const at = (i: number) => {
    const a = (i / n) * Math.PI * 2;
    const breathe = 1 + 0.025 * Math.sin(t * 2.2 + i);
    /* Flatter underneath: it sits on the sand. */
    const ry = Math.sin(a) > 0 ? 0.78 : 1;
    const k = ks[i % n];
    return { x: Math.cos(a) * r * k * breathe, y: Math.sin(a) * r * k * ry * breathe };
  };
  let d = "";
  for (let i = 0; i < n; i++) {
    const q = at(i + 1);
    const nx = at(i + 2);
    if (i === 0) {
      const p = at(0);
      d += `M${((p.x + q.x) / 2).toFixed(1)} ${((p.y + q.y) / 2).toFixed(1)}`;
    }
    d += ` Q${q.x.toFixed(1)} ${q.y.toFixed(1)} ${((q.x + nx.x) / 2).toFixed(1)} ${((q.y + nx.y) / 2).toFixed(1)}`;
  }
  return `${d}Z`;
}

const f1 = (v: number) => v.toFixed(1);

/* `hurt` 0 to 1 just after a hit (1 the moment it lands); `ko` 0 to 1 over
 * its KO (1: gone); `born` 0 to 1 as it rises out of the water; `lookX`
 * -1 to 1, toward the rower. */
export function MonsterG({ x, y, r, n, boss, seed, t, hurt = 0, ko = 0, born = 1, lookX = 0 }: { x: number; y: number; r: number; n: number; boss: boolean; seed: number; t: number; hurt?: number; ko?: number; born?: number; lookX?: number }) {
  const ink = C.ink;
  if (ko >= 1) return null;
  const R = r * (boss ? 1.18 : 1) * (0.9 + 0.1 * ((n % 4) / 3));
  const fill = BODY[n % BODY.length];
  const bob = Math.sin(t * 2.4 + seed) * R * 0.04;
  const jolt = hurt > 0 ? Math.sin(hurt * 40) * R * 0.08 * hurt : 0;
  /* Out of the water as it comes, squashed flat on a KO. */
  const sy = Math.max(0.05, Math.min(1, born)) * (ko > 0 ? Math.max(0.05, 1 - ko * 1.6) : 1);
  const sx = ko > 0 ? 1 + ko * 0.6 : 1;
  const look = Math.max(-1, Math.min(1, lookX)) * R * 0.12;
  const kind = n % 3;
  const body = bodyPath(R, seed, t);
  const eyeY = -R * 0.18;
  const blink = (t + (seed % 7)) % 4 < 0.12;
  const arm = (s: number) => `M${f1(s * R * 0.82)} ${f1(R * 0.05)} q${f1(s * R * 0.32)} ${f1(-R * (0.2 + 0.18 * Math.sin(t * 3 + s)))} ${f1(s * R * 0.42)} ${f1(-R * 0.45)}`;
  const eyes = n % 4 === 3 ? [0] : [-1, 1];
  return (
    <G>
      <Ellipse cx={x} cy={y + R * 0.72} rx={R * 1.05} ry={R * 0.22} fill={ink} fillOpacity={0.16} />
      <G transform={`translate(${f1(x + jolt)} ${f1(y + bob + R * 0.72 * (1 - sy))}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`}>
        {kind === 1
          ? [-1, 1].map((s) => <Path key={`h${s}`} d={`M${f1(s * R * 0.42)} ${f1(-R * 0.7)} Q${f1(s * R * 0.75)} ${f1(-R * 1.25)} ${f1(s * R * 0.95)} ${f1(-R * 1.05)} Q${f1(s * R * 0.72)} ${f1(-R * 0.85)} ${f1(s * R * 0.66)} ${f1(-R * 0.52)}Z`} fill="#F7EBCB" stroke={ink} strokeWidth={2} strokeLinejoin="round" />)
          : kind === 2
            ? [-0.7, -0.35, 0, 0.35, 0.7].map((a, i) => {
                const bx = Math.sin(a) * R * 0.92;
                const by = -Math.cos(a) * R * 0.9;
                const tx = Math.sin(a) * R * 1.28;
                const ty = -Math.cos(a) * R * 1.26;
                return <Path key={`s${i}`} d={`M${f1(bx - R * 0.13)} ${f1(by)} L${f1(tx)} ${f1(ty)} L${f1(bx + R * 0.13)} ${f1(by + R * 0.04)}Z`} fill={fill} stroke={ink} strokeWidth={2} strokeLinejoin="round" />;
              })
            : null}
        {[-1, 1].map((s) => (
          <Path key={`a${s}`} d={arm(s)} stroke={ink} strokeWidth={R * 0.16 + 2} fill="none" strokeLinecap="round" />
        ))}
        {[-1, 1].map((s) => (
          <Path key={`b${s}`} d={arm(s)} stroke={fill} strokeWidth={Math.max(1, R * 0.16 - 1)} fill="none" strokeLinecap="round" />
        ))}
        <Path d={body} fill={hurt > 0.5 ? "#FFFFFF" : fill} stroke={ink} strokeWidth={2.4} strokeLinejoin="round" />
        <Ellipse cx={0} cy={R * 0.28} rx={R * 0.52} ry={R * 0.34} fill="#FFFFFF" fillOpacity={0.35} />
        {eyes.map((s) => {
          const ex = s * R * 0.3;
          const er = eyes.length === 1 ? R * 0.3 : R * 0.2;
          return (
            <G key={`e${s}`}>
              {blink ? (
                <Path d={`M${f1(ex - er)} ${f1(eyeY)} q${f1(er)} ${f1(er * 0.5)} ${f1(er * 2)} 0`} stroke={ink} strokeWidth={2} fill="none" strokeLinecap="round" />
              ) : (
                <G>
                  <Circle cx={ex} cy={eyeY} r={er} fill="#FFFFFF" stroke={ink} strokeWidth={2} />
                  <Circle cx={ex + look} cy={eyeY + er * 0.15} r={er * 0.48} fill={ink} />
                  <Circle cx={ex + look - er * 0.18} cy={eyeY - er * 0.05} r={er * 0.16} fill="#FFFFFF" />
                </G>
              )}
              {boss ? <Path d={`M${f1(ex - er * 1.1)} ${f1(eyeY - er * (s < 0 ? 1.5 : 1.1))} L${f1(ex + er * 1.1)} ${f1(eyeY - er * (s < 0 ? 1.1 : 1.5))}`} stroke={ink} strokeWidth={2.6} strokeLinecap="round" /> : null}
            </G>
          );
        })}
        {hurt > 0.25 ? (
          <Ellipse cx={0} cy={R * 0.26} rx={R * 0.14} ry={R * 0.17} fill={ink} />
        ) : (
          <G>
            <Path d={`M${f1(-R * 0.32)} ${f1(R * 0.2)} Q0 ${f1(R * 0.46)} ${f1(R * 0.32)} ${f1(R * 0.2)}Z`} fill={ink} />
            <Path d={`M${f1(-R * 0.2)} ${f1(R * 0.22)} l${f1(R * 0.07)} ${f1(R * 0.1)} l${f1(R * 0.07)} ${f1(-R * 0.1)}M${f1(R * 0.06)} ${f1(R * 0.22)} l${f1(R * 0.07)} ${f1(R * 0.1)} l${f1(R * 0.07)} ${f1(-R * 0.1)}`} fill="#FFFFFF" />
          </G>
        )}
        {boss ? (
          <Path d={`M${f1(-R * 0.42)} ${f1(-R * 0.82)} L${f1(-R * 0.46)} ${f1(-R * 1.25)} L${f1(-R * 0.22)} ${f1(-R * 1.02)} L0 ${f1(-R * 1.36)} L${f1(R * 0.22)} ${f1(-R * 1.02)} L${f1(R * 0.46)} ${f1(-R * 1.25)} L${f1(R * 0.42)} ${f1(-R * 0.82)}Z`} fill="#F5C935" stroke={ink} strokeWidth={2} strokeLinejoin="round" />
        ) : null}
      </G>
      {ko > 0
        ? Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2 + 0.3;
            const d = R * (0.4 + 1.6 * ko);
            return <Path key={`k${i}`} d={star(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, R * 0.22 * (1 - ko) + 1)} fill="#F5C935" stroke={ink} strokeWidth={1} strokeLinejoin="round" />;
          })
        : null}
    </G>
  );
}
