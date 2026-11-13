import { Fragment } from "react";

/**
 * Inline "Grade · Class" text with each part color coded. The text matches the plain
 * presentation string, so color is never the only cue.
 */
export default function GradeClassText({ parts }: { parts: Array<{ text: string; tone: string } | null> }) {
  const visible = parts.filter((part): part is { text: string; tone: string } => Boolean(part?.text));
  if (visible.length === 0) return <>—</>;
  return (
    <>
      {visible.map((part, index) => (
        <Fragment key={`${index}:${part.text}`}>
          {index > 0 ? " · " : null}
          {part.tone ? <span className={part.tone}>{part.text}</span> : part.text}
        </Fragment>
      ))}
    </>
  );
}
