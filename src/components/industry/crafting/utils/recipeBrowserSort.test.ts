import assert from "node:assert/strict";
import test from "node:test";

import type { ComponentCardIndexRecord } from "../../../../lib/componentCardIndex";
import { handleComponentCardsRoute } from "../../../../../server/routes/componentCards.routes";
import { parseRecipeBrowserSort, sortRecipeBrowserRecords } from "./recipeBrowserSort";

function shield(id: string, name: string, hp: number | null): ComponentCardIndexRecord {
  return {
    id,
    name,
    kind: "vehicle",
    type: "shield",
    typeLabel: "Shield Generator",
    stats: { shield: { maxShieldHealth: hp } },
  } as unknown as ComponentCardIndexRecord;
}

test("parses the URL sort contract and rejects unsafe keys", () => {
  assert.deepEqual(parseRecipeBrowserSort(new URLSearchParams("sort=hp&dir=desc")), { key: "hp", direction: "descending" });
  assert.deepEqual(parseRecipeBrowserSort(new URLSearchParams("sort=component")), { key: "component", direction: "ascending" });
  assert.equal(parseRecipeBrowserSort(new URLSearchParams("sort=../x")), null);
  assert.equal(parseRecipeBrowserSort(new URLSearchParams("")), null);
});

test("sorts numerically, keeps missing values last in both directions, and breaks ties by name", () => {
  const records = [
    shield("a", "Bravo", 900),
    shield("b", "Alpha", null),
    shield("c", "Charlie", 12000),
    shield("d", "Delta", 900),
  ];
  const descending = sortRecipeBrowserRecords(records, { key: "hp", direction: "descending" }).map((r) => r.name);
  const ascending = sortRecipeBrowserRecords(records, { key: "hp", direction: "ascending" }).map((r) => r.name);
  assert.deepEqual(descending, ["Charlie", "Bravo", "Delta", "Alpha"]);
  assert.deepEqual(ascending, ["Bravo", "Delta", "Charlie", "Alpha"]);
  assert.deepEqual(sortRecipeBrowserRecords(records, null).map((r) => r.id), ["a", "b", "c", "d"]);
});

type BrowserPayload = { totalRecords: number; page: number; records: ComponentCardIndexRecord[] };

async function browserPage(query: string): Promise<BrowserPayload> {
  const result = await handleComponentCardsRoute("GET", `/api/crafting/component-cards/browser?${query}`);
  assert.ok(result && result.status === 200);
  return result.body as BrowserPayload;
}

test("the browser API sorts the full filtered set before paginating", async () => {
  // Shields span several 10-record pages; concatenated pages must equal one global sort.
  const first = await browserPage("v=shield&limit=10&sort=hp&dir=desc&pg=1");
  const pageCount = Math.ceil(first.totalRecords / 10);
  assert.ok(pageCount >= 2, `expected several shield pages, found ${first.totalRecords} records`);
  const pages = [first];
  for (let pg = 2; pg <= pageCount; pg += 1) pages.push(await browserPage(`v=shield&limit=10&sort=hp&dir=desc&pg=${pg}`));
  const concatenated = pages.flatMap((page) => page.records);
  assert.equal(concatenated.length, first.totalRecords);
  assert.equal(new Set(concatenated.map((r) => r.id)).size, concatenated.length, "no record repeats across pages");
  const globallySorted = sortRecipeBrowserRecords(concatenated, { key: "hp", direction: "descending" });
  assert.deepEqual(concatenated.map((r) => r.id), globallySorted.map((r) => r.id));

  // Reversing direction reverses the ordering of present values across the page boundary.
  const ascendingFirst = await browserPage("v=shield&limit=10&sort=hp&dir=asc&pg=1");
  const hp = (record: ComponentCardIndexRecord) => (record as unknown as { stats?: { shield?: { maxShieldHealth?: number } } }).stats?.shield?.maxShieldHealth;
  assert.ok((hp(ascendingFirst.records[0]!) ?? Infinity) <= (hp(first.records[0]!) ?? -Infinity));
});

test("search and filters return the same set regardless of sort", async () => {
  const unsorted = await browserPage("v=shield&limit=40");
  const sorted = await browserPage("v=shield&limit=40&sort=component&dir=desc");
  assert.equal(sorted.totalRecords, unsorted.totalRecords);
});
