import type { ReactNode } from 'react';

type CommandHeaderProps = {
  icon: ReactNode;
  title: string;
  description: string;
  className?: string;
  actions?: ReactNode;
};

/**
 * Compact operational page identity surface shared by Crafting and Inventory.
 * Page shells own adjacent actions; this component owns only the header's
 * consistent dimensions, icon, title, and concise supporting copy.
 */
export default function CommandHeader({ icon, title, description, className, actions }: CommandHeaderProps) {
  return (
    <header className={['app-command-header', className].filter(Boolean).join(' ')}>
      <span className="app-command-header__icon" aria-hidden="true">{icon}</span>
      <div className="app-command-header__copy">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="app-command-header__actions">{actions}</div> : null}
    </header>
  );
}
