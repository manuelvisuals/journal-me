import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost";

type Props = {
  variant?: Variant;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = "primary",
  className = "",
  type,
  ...props
}: Props) {
  const variantClass = variant === "primary" ? "btn-primary" : "btn-ghost";
  return (
    <button
      type={type ?? "button"}
      className={`${variantClass} ${className}`.trim()}
      {...props}
    />
  );
}
