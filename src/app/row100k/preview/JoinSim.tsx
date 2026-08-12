"use client";

import { useState } from "react";
import { JoinPanel } from "../JoinPanel";
import { Dashboard } from "../Dashboard";
import type { Division } from "@/lib/row100k";

/* Dev-preview walkthrough of the signup moment, no Google required: the real
 * join form (validated locally, nothing sent), and on "I'm in" the panel
 * swaps to the fresh-joiner dashboard exactly like the live refresh does —
 * zero meters, and the share dialog popping open on the bib card with
 * whatever name and @ were typed. */
export function JoinSim() {
  const [joined, setJoined] = useState<{
    displayName: string;
    instagram: string;
    division: Division;
  } | null>(null);

  return (
    <div className="panel">
      {joined ? (
        <Dashboard
          rowerNumber={101}
          displayName={joined.displayName}
          instagram={joined.instagram}
          division={joined.division}
          meters={0}
          sessions={0}
          rows={[]}
          phase="open"
          simulateJustJoined
        />
      ) : (
        <JoinPanel
          mode="form"
          simulate
          signedInAs="you@example.com"
          initialName=""
          initialInstagram=""
          initialDivision={null}
          onSaved={(values) => setJoined(values)}
        />
      )}
    </div>
  );
}
