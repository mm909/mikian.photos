import { baseCss, fontClass } from "../theme";

/* The 404 for /track/<slug>: an unknown event, or — in production, while
 * the tracker is in development — a viewer who is not an admin. One
 * message for both on purpose: the gate must not tell the two apart. */
export default function TrackNotFound() {
  return (
    <div className={`trk ${fontClass}`}>
      <style dangerouslySetInnerHTML={{ __html: baseCss }} />
      <div className="wrap" style={{ paddingTop: 96, paddingBottom: 64, textAlign: "center" }}>
        <p className="mono">Live tracker</p>
        <h1 className="cond" style={{ fontSize: 34, lineHeight: 1.05, marginTop: 10 }}>
          Nothing to track here.
        </h1>
        <p className="muted" style={{ marginTop: 12, fontSize: 15 }}>
          Check the link you were sent.
        </p>
      </div>
    </div>
  );
}
