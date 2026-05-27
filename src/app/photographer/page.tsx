import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Headline } from "@/components/runner/Headline";
import { SignOutButton } from "@/components/photographer/SignOutButton";

export default async function PhotographerOverviewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.photographerId) {
    redirect("/photographer/sign-in");
  }

  const pg = await db.photographer.findUnique({
    where: { id: session.photographerId },
    include: {
      photos: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, bib: true, hidden: true, createdAt: true, eventId: true,
        },
      },
    },
  });
  if (!pg) {
    redirect("/photographer/sign-in");
  }

  const uploaded = pg.photos.length;
  const visible = pg.photos.filter((p) => !p.hidden).length;
  const hidden = uploaded - visible;

  return (
    <main className="screen" style={{ padding: "48px 24px 96px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 18,
            flexWrap: "wrap",
            marginBottom: 32,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--muted)",
                marginBottom: 6,
              }}
            >
              Photographer · {pg.email}
            </div>
            <Headline
              as="h1"
              text={`Hi, ${pg.name.split(" ")[0]}.`}
              accent={pg.name.split(" ")[0]}
              style={{
                margin: 0,
                fontFamily: "var(--font-serif)",
                fontWeight: 500,
                fontSize: 44,
                letterSpacing: "-.018em",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Link href="/photographer/upload" className="btn btn--primary">
              Upload photos →
            </Link>
            <SignOutButton />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 32,
          }}
        >
          <Stat label="Uploaded" value={uploaded.toString()} />
          <Stat label="Visible" value={visible.toString()} />
          <Stat label="Hidden" value={hidden.toString()} />
          <Stat label="Sales (coming)" value="—" muted />
        </div>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: 22,
            margin: "0 0 14px",
            color: "var(--ink)",
          }}
        >
          Your uploads
        </h2>

        {uploaded === 0 ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background: "var(--cream)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              color: "var(--muted)",
              fontSize: 15,
            }}
          >
            Nothing here yet. Drop your first batch via the upload button above.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 12,
            }}
          >
            {pg.photos.map((p) => (
              <div
                key={p.id}
                style={{
                  position: "relative",
                  aspectRatio: "2/3",
                  borderRadius: 5,
                  overflow: "hidden",
                  border: "1px solid var(--line)",
                  background: "var(--cream)",
                  opacity: p.hidden ? 0.5 : 1,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/photos/${p.id}/preview`}
                  alt={p.bib ? `Bib ${p.bib}` : "Race photo"}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 6,
                    left: 6,
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    background: "rgba(245,242,236,.92)",
                    padding: "2px 6px",
                    borderRadius: 3,
                    color: "var(--ink)",
                  }}
                >
                  {p.bib ? `#${p.bib}` : "Untagged"}
                </div>
                {p.hidden && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 6,
                      left: 6,
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      letterSpacing: ".1em",
                      textTransform: "uppercase",
                      background: "var(--ink)",
                      color: "var(--paper)",
                      padding: "2px 6px",
                      borderRadius: 3,
                    }}
                  >
                    Hidden
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: "14px 16px",
        opacity: muted ? 0.6 : 1,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 500,
          fontSize: 28,
          marginTop: 2,
          color: "var(--ink)",
        }}
      >
        {value}
      </div>
    </div>
  );
}
