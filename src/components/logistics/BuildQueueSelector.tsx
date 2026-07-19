import { useEffect, useRef, useState } from "react";

import type { BuildQueue } from "../../types/logistics";

type EditorMode = "create" | "rename" | "delete" | null;

export default function BuildQueueSelector({
  queues,
  activeQueueId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  renameRequestToken = 0,
}: {
  queues: BuildQueue[];
  activeQueueId: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  renameRequestToken?: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [name, setName] = useState("");
  const activeQueue = queues.find((queue) => queue.id === activeQueueId) ?? queues[0];

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setEditorMode(null);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!renameRequestToken) return;
    setOpen(true);
    setEditorMode("rename");
    setName(activeQueue?.name ?? "");
  }, [activeQueue?.id, activeQueue?.name, renameRequestToken]);

  function beginCreate() {
    setName("");
    setEditorMode("create");
  }

  function beginRename() {
    setName(activeQueue?.name ?? "");
    setEditorMode("rename");
  }

  function submitName() {
    const nextName = name.trim();
    if (!nextName) return;
    if (editorMode === "create") onCreate(nextName);
    if (editorMode === "rename" && activeQueue) onRename(activeQueue.id, nextName);
    setEditorMode(null);
    setOpen(false);
  }

  return (
    <div className="bq-queue-selector" ref={rootRef}>
      <button
        type="button"
        className="bq-queue-selector-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          setEditorMode(null);
        }}
      >
        <span className="bq-queue-selector-label">Queue</span>
        <strong>{activeQueue?.name ?? "Default Queue"}</strong>
        <span className="bq-queue-selector-chevron" aria-hidden="true">⌄</span>
      </button>
      {open ? (
        <div className="bq-queue-selector-popover" role="dialog" aria-label="Manage build queues">
          <div className="bq-queue-selector-list" role="listbox" aria-label="Build queues">
            {queues.map((queue) => {
              const selected = queue.id === activeQueueId;
              return (
                <button
                  key={queue.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`bq-queue-selector-option${selected ? " is-selected" : ""}`}
                  onClick={() => {
                    onSelect(queue.id);
                    setEditorMode(null);
                    setOpen(false);
                  }}
                >
                  <span>{queue.name}</span>
                  <em>{queue.sourceType === "fitting" ? "Fitting" : "Custom"}</em>
                </button>
              );
            })}
          </div>
          {editorMode === "create" || editorMode === "rename" ? (
            <form
              className="bq-queue-selector-editor"
              aria-label={editorMode === "create" ? "Create queue" : "Rename queue"}
              onSubmit={(event) => {
                event.preventDefault();
                submitName();
              }}
            >
              <label htmlFor="bq-queue-name">{editorMode === "create" ? "New queue name" : "Queue name"}</label>
              <input
                id="bq-queue-name"
                autoFocus
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <div className="bq-queue-selector-editor-actions">
                <button type="button" onClick={() => setEditorMode(null)}>Cancel</button>
                <button type="submit" disabled={!name.trim()}>{editorMode === "create" ? "Create" : "Save"}</button>
              </div>
            </form>
          ) : editorMode === "delete" && activeQueue ? (
            <div className="bq-queue-selector-editor" role="alertdialog" aria-label="Delete queue confirmation">
              <p>Delete “{activeQueue.name}” and its queued items?</p>
              <div className="bq-queue-selector-editor-actions">
                <button type="button" onClick={() => setEditorMode(null)}>Cancel</button>
                <button
                  type="button"
                  className="is-danger"
                  onClick={() => {
                    onDelete(activeQueue.id);
                    setEditorMode(null);
                    setOpen(false);
                  }}
                >Delete</button>
              </div>
            </div>
          ) : (
            <div className="bq-queue-selector-actions">
              <button type="button" onClick={beginCreate}>+ New</button>
              <button type="button" onClick={beginRename}>Rename</button>
              <button type="button" disabled={queues.length <= 1} onClick={() => setEditorMode("delete")}>Delete</button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
