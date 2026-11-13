import { apiUrl } from "../../lib/apiUrl";
import {
  UNKNOWN_JOURNAL_EVIDENCE,
  type JournalEvidence,
  type JournalHabitatReport,
} from "./sourceResources";

function validReport(value: unknown): value is JournalHabitatReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Partial<JournalHabitatReport>;
  return (report.category === "wildlife" || report.category === "foraged_item")
    && typeof report.name === "string"
    && typeof report.reportedLocation === "string"
    && report.evidenceType === "reported_habitat";
}

/** Only published Source API reports may drive location badges.
 * A failed/absent endpoint never falls back to the unpublished local PTU candidate.
 */
export async function loadSourceJournalEvidence(signal?: AbortSignal): Promise<JournalEvidence> {
  const response = await fetch(apiUrl("/api/source/catalog"), { signal });
  if (!response.ok) throw new Error("Source catalog unavailable (HTTP " + response.status + ").");
  const catalog: unknown = await response.json();
  if (!catalog || typeof catalog !== "object") return UNKNOWN_JOURNAL_EVIDENCE;
  const journal = (catalog as { journal?: unknown }).journal;
  if (!journal || typeof journal !== "object") return UNKNOWN_JOURNAL_EVIDENCE;
  const value = journal as Partial<JournalEvidence>;
  if (value.availability !== "reported" ||
      !Array.isArray(value.wildlife) || !Array.isArray(value.foraging) ||
      !value.wildlife.every(validReport) || !value.foraging.every(validReport)) {
    return UNKNOWN_JOURNAL_EVIDENCE;
  }
  return {
    availability: "reported",
    source: value.source ?? null,
    wildlife: value.wildlife,
    foraging: value.foraging,
  };
}
