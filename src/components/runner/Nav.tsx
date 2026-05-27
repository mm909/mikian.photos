import { Logo } from "./Logo";

type Props = {
  cartCount: number;
  onLogo: () => void;
  onCart: () => void;
};

export function Nav({ cartCount, onLogo, onCart }: Props) {
  return (
    <nav className="nav">
      <Logo onClick={onLogo} />
      <span className="nav__spacer" />
      {cartCount > 0 && (
        <button className="nav__cart" onClick={onCart}>
          Cart <span className="nav__count">{cartCount}</span>
        </button>
      )}
    </nav>
  );
}
