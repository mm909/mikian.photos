type Props = { onClick?: () => void; dark?: boolean };

export function Logo({ onClick, dark = false }: Props) {
  return (
    <button
      className="nav__logo"
      onClick={onClick}
      style={dark ? { color: "var(--paper)" } : undefined}
    >
      Mikian
      <span style={{ color: dark ? "var(--accent-l)" : "var(--accent)" }}>.</span>
      Photos
    </button>
  );
}
