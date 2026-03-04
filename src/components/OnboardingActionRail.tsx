import { useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import SectionHubCard from "./SectionHubCard";

type OnboardingAction = {
  label: "Onboarding" | "Training" | "Organization";
  subtitle: string;
  href: string;
  accentColor: string;
  icon: ReactNode;
  activePathPrefix: string;
};

const onboardingActions: OnboardingAction[] = [
  {
    label: "Onboarding",
    subtitle: "New member pipeline & progression",
    href: "/wip/onboarding",
    accentColor: "#60f2ff",
    activePathPrefix: "/wip/onboarding",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="section-hub-icon">
        <path d="M5.5 8.5L12 5l6.5 3.5v5.5c0 2.9-2 5.7-6.5 7-4.5-1.3-6.5-4.1-6.5-7V8.5z" />
        <path d="M9.5 12.5a2.5 2.5 0 1 1 5 0v1.5h-5v-1.5z" />
      </svg>
    ),
  },
  {
    label: "Training",
    subtitle: "Exercises, drills, and certifications",
    href: "/wip/training",
    accentColor: "#a78bfa",
    activePathPrefix: "/wip/training",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="section-hub-icon">
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2.2" />
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
      </svg>
    ),
  },
  {
    label: "Organization",
    subtitle: "Command structure and roles",
    href: "/wip/organization",
    accentColor: "#f59e0b",
    activePathPrefix: "/wip/organization",
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="section-hub-icon">
        <circle cx="5" cy="6" r="2.2" />
        <circle cx="19" cy="6" r="2.2" />
        <circle cx="12" cy="18" r="2.2" />
        <path d="M7.1 7.5l3.8 7.1M16.9 7.5l-3.8 7.1M7.2 6h9.6" />
      </svg>
    ),
  },
];

export default function OnboardingActionRail() {
  const { pathname } = useLocation();

  return (
    <section aria-label="Onboarding actions">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {onboardingActions.map((action) => (
          <SectionHubCard
            key={action.label}
            title={action.label}
            subtitle={action.subtitle}
            href={action.href}
            accentColor={action.accentColor}
            icon={action.icon}
            isActive={pathname.startsWith(action.activePathPrefix)}
          />
        ))}
      </div>
    </section>
  );
}
