import type { HTMLAttributes } from "react";

/** Purely presentational, headerless workspace panel. Business state stays with the caller. */
export type WorkspacePanelTone = "filter" | "primary" | "inspector";

export type WorkspacePanelProps = HTMLAttributes<HTMLElement> & {
  as?: "aside" | "section" | "main" | "div";
  tone?: WorkspacePanelTone;
};

export default function WorkspacePanel({
  as: Element = "section",
  tone = "primary",
  className,
  children,
  ...props
}: WorkspacePanelProps) {
  return (
    <Element
      {...props}
      data-workspace-panel=""
      data-workspace-tone={tone}
      className={["workspace-panel", "workspace-panel--" + tone, className].filter(Boolean).join(" ")}
    >
      {children}
    </Element>
  );
}
