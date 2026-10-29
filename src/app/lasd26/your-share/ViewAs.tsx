"use client";

import { useRouter } from "next/navigation";
import { lasdPath } from "@/lib/lasd26/paths";

/**
 * THE OWNER'S TOOLS under the foot of /lasd26/your-share (owner, 2026-10-29,
 * on his own screen: "I don't see my expenses that I paid being taken out
 * of this"): VIEW AS any runner — the page re-renders with their numbers,
 * their note of what they covered, read-only (?as=<member id>) — and TEST
 * A PAYMENT ON YOURSELF (?test=1), the whole share with nothing taken off;
 * I SENT IT then only emails him his own test. Nobody but the owner sees
 * this.
 */
export function ViewAs({ roster, current, testing }: { roster: { id: string; name: string }[]; current: string | null; testing: boolean }) {
  const router = useRouter();
  const base = lasdPath("/your-share");
  return (
    <div className="tools mono">
      <label>
        View as
        <select value={current ?? ""} onChange={(e) => router.push(e.target.value ? `${base}?as=${encodeURIComponent(e.target.value)}` : base)}>
          <option value="">yourself</option>
          {roster.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <span className="sep" aria-hidden="true">
        ·
      </span>
      {testing ? <a href={base}>Stop the test</a> : <a href={`${base}?test=1`}>Test a payment on yourself</a>}
    </div>
  );
}
