import type { DoctrineModule } from "../../data/modules";

export function DoctrineContent({ module }: { module: DoctrineModule }) {
  const Content = module.Content;

  return (
    <div className="dm-content-prose">
      <Content />
    </div>
  );
}
