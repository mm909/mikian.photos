import Link from "next/link";
import { Headline } from "@/components/runner/Headline";

type Props = {
  title: string;
  accent: string;
  effective: string;
  children: React.ReactNode;
};

export function LegalPage({ title, accent, effective, children }: Props) {
  return (
    <main className="screen" style={{ padding: "64px 24px 96px" }}>
      <article style={{ maxWidth: 720, margin: "0 auto" }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginBottom: 14,
          }}
        >
          Effective {effective}
        </div>
        <Headline
          as="h1"
          text={title}
          accent={accent}
          style={{
            margin: "0 0 32px",
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: "clamp(36px, 4.4vw, 52px)",
            lineHeight: 1.02,
            letterSpacing: "-.018em",
            color: "var(--ink)",
          }}
        />
        <div className="legal-prose">{children}</div>
        <div
          style={{
            marginTop: 64,
            paddingTop: 24,
            borderTop: "1px solid var(--line)",
            fontSize: 13,
            color: "var(--muted)",
            display: "flex",
            gap: 14,
          }}
        >
          <Link href="/" style={{ color: "var(--muted)" }}>
            ← Home
          </Link>
          <span aria-hidden>·</span>
          <Link href="/terms" style={{ color: "var(--muted)" }}>
            Terms
          </Link>
          <Link href="/privacy" style={{ color: "var(--muted)" }}>
            Privacy
          </Link>
        </div>
      </article>
    </main>
  );
}
