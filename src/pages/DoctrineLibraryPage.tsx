import DoctrineWorkspace from "../components/dashboard/DoctrineWorkspace";

export default function DoctrineLibraryPage() {
  return (
    <div className="dash-doctrine-page">
      <header className="dash-doctrine-page-header">
        <p className="dash-doctrine-eyebrow">Combat Doctrine</p>
        <h1>Doctrine Library</h1>
        <p>Browse procedures, references, checklists, and operational modules.</p>
      </header>
      <DoctrineWorkspace />
    </div>
  );
}
