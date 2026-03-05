import Link from "next/link";

export function TopNav() {
  return (
    <nav className="flex items-center px-4 h-11 bg-dark border-b border-white/8 shrink-0">
      <Link
        href="/"
        className="text-cream font-mono text-sm font-semibold tracking-tight hover:text-white transition-colors"
      >
        mikian.photo
      </Link>
    </nav>
  );
}
