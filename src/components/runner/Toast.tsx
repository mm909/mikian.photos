type Props = { text: string };

export function Toast({ text }: Props) {
  if (!text) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 28,
        left: "50%",
        transform: "translateX(-50%)",
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 18px",
        background: "var(--ink)",
        color: "var(--paper)",
        borderRadius: 6,
        fontFamily: "var(--font-sans)",
        fontSize: 14,
        boxShadow: "var(--shadow-lg)",
        zIndex: 200,
        animation: "fadeIn 200ms var(--ease) both",
      }}
    >
      {text}
    </div>
  );
}
