import type { ReactNode } from 'react';

type CommandHeaderProps = {
  icon: ReactNode;
  title: string;
  description: string;
  className?: string;
  center?: ReactNode;
  actions?: ReactNode;
};

/**
 * Compact operational page identity surface shared by Crafting and Inventory.
 * Page shells own adjacent actions; this component owns only the header's
 * consistent dimensions, icon, title, and concise supporting copy.
 */
export default function CommandHeader({ icon, title, description, className, center, actions }: CommandHeaderProps) {
  return (
    <header className={['app-command-header', center ? 'app-command-header--with-center' : '', className].filter(Boolean).join(' ')}>
      <div className="app-command-header__identity">
        <span className="app-command-header__icon" aria-hidden="true">{icon}</span>
        <div className="app-command-header__copy">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      {center ? <div className="app-command-header__center">{center}</div> : null}
      {actions ? <div className="app-command-header__actions">{actions}</div> : null}
    </header>
  );
}
