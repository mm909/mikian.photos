type Props = {
  reason: "signed-out" | "no-role";
  name?: string;
};

/**
 * Empty-state shown to anyone who lands on a /photographer/* page without
 * the photographer (or owner) role. Two flavors:
 *
 *  - "signed-out": nudge to sign in or use the unlock key
 *  - "no-role":    they are signed in but as a runner. Tell them to ask
 *                  Mikian to be granted the photographer role.
 */
export function NoPhotographerAccess({ reason, name }: Props) {
  return (
    <main
      className="screen"
      style={{ padding: "96px 24px", textAlign: "center", maxWidth: 560, margin: "0 auto" }}
    >
      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 500,
          fontSize: 28,
          color: "var(--ink)",
        }}
      >
        Photographer access required
      </h1>
      {reason === "signed-out" ? (
        <p style={{ marginTop: 16, color: "var(--muted)", lineHeight: 1.55 }}>
          Sign in with Google at <a href="/photographer/sign-in">/photographer/sign-in</a>. If
          you&rsquo;re Mikian and OAuth isn&rsquo;t set up for this environment, hit{" "}
          <code>/api/photographer/unlock?key=…</code> with your unlock key.
        </p>
      ) : (
        <p style={{ marginTop: 16, color: "var(--muted)", lineHeight: 1.55 }}>
          {name ? `Hi, ${name.split(" ")[0]} — your` : "Your"} account doesn&rsquo;t have the
          photographer role yet. Ask Mikian to grant it from{" "}
          <a href="/admin/users">/admin/users</a>, then refresh.
        </p>
      )}
    </main>
  );
}
