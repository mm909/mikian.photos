import React from "react";

type Props = {
  as?: keyof JSX.IntrinsicElements;
  text: string;
  accent?: string;
  className?: string;
  style?: React.CSSProperties;
};

export function Headline({ as = "h1", text, accent, className, style }: Props) {
  const Tag = as as keyof JSX.IntrinsicElements;
  if (!accent) {
    return React.createElement(Tag, { className, style }, text);
  }
  const parts = text.split(accent);
  const children: React.ReactNode[] = [];
  parts.forEach((p, i) => {
    children.push(<React.Fragment key={`p-${i}`}>{p}</React.Fragment>);
    if (i < parts.length - 1) {
      children.push(
        <em className="acc" key={`a-${i}`}>
          {accent}
        </em>
      );
    }
  });
  return React.createElement(Tag, { className, style }, children);
}
