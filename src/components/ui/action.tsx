type Props = {
  children: React.ReactNode;
  href?: string;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "quiet" | "danger";
  disabled?: boolean;
  onClick?: () => void;
};

export function Action({ children, href, type = "button", variant = "primary", disabled, onClick }: Props) {
  const content = <>{children}<span className="action-arrow" aria-hidden="true">→</span></>;
  if (href) return <a className={`action ${variant}`} href={href}>{content}</a>;
  return <button className={`action ${variant}`} type={type} disabled={disabled} onClick={onClick}>{content}</button>;
}
