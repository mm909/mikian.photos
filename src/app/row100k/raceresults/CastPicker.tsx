"use client";

import { useState } from "react";

import { WavePicker } from "./RaceResults";
import type { ResultBoard } from "./types";

/* THE PICK ON THE WALL (owner, 2026-09-16: "When I click on a wave in the
 * cast view I should see the info change on the screen"). The cast frame
 * is a server component and its cells carry no radio — a television has no
 * keyboard — so the one piece of state the wall needs lives here, in the
 * smallest client wrapper that can hold it.
 *
 * FIRST PAINT IS THE SERVER FRAME. `picked` starts null, so the first render
 * (and the whole render with scripting off) draws pickedWave()'s answer
 * exactly as CastFrame drew it before this file existed — the same markup,
 * so hydration has nothing to argue with. A click swaps the open pane and
 * nothing else moves. A ?wave=N pin is the default until the first click. */
export function CastPicker({ board, pick }: { board: ResultBoard; pick?: number | null }) {
  const [picked, setPicked] = useState<number | null>(null);
  return <WavePicker board={board} cast pick={picked ?? pick} onPick={setPicked} />;
}
