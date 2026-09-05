import Link from "next/link";

/* The landing page OPT IN, ported for /row100k: Archivo Black at poster
 * size, a water-blue underline, the blunt arrow. The label is whatever the
 * page needs (OPT IN, LOG A ROW, ...). With `href` it is a next/link, with
 * `onClick` a plain button; size m is the panel-sized cut. No directive on
 * purpose: server pages use the link form, and a client component that
 * needs onClick pulls this into its own bundle by importing it. */
export function OptIn({
  href,
  onClick,
  size = "l",
  className,
  children,
}: {
  href?: string;
  onClick?: () => void;
  size?: "l" | "m";
  className?: string;
  children: React.ReactNode;
}) {
  const cls = ["optin", size === "m" ? "m" : "", className ?? ""].filter(Boolean).join(" ");
  const inner = (
    <>
      {children}
      <span className="arr" aria-hidden="true">
        <svg viewBox="0 0 100 100" focusable="false">
          <path
            d="M6 50h78M52 18l32 32-32 32"
            fill="none"
            stroke="currentColor"
            strokeWidth="20"
            strokeLinecap="butt"
            strokeLinejoin="miter"
          />
        </svg>
      </span>
    </>
  );
  if (href) {
    return (
      <Link className={cls} href={href} onClick={onClick}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick}>
      {inner}
    </button>
  );
}
