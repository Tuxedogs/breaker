import type {
  MissionCalculatedPayoutV1,
  MissionSourceRecordV3,
  MissionSourceRewardV3,
} from "../schema/source-v3.mts";

export type BrowserCreditProjectionV2 =
  | {
    status: "fixed";
    displayText: string;
    amount: number;
    currency: string;
    max?: number | string | null;
    plusBonuses?: number | string | null;
    sourceResultType: "ContractResult_Reward";
    sourceRefs: string[];
  }
  | {
    status: "calculated";
    displayText: string;
    amount: number;
    currency: string;
    sourceResultType: "ContractResult_CalculatedReward";
    sourceRefs: string[];
    payout: MissionCalculatedPayoutV1;
  }
  | {
    status: "variable";
    displayText: string;
    sourceResultType: "ContractResult_CalculatedReward";
    sourceRefs: string[];
    unresolvedReason: string;
    payout: MissionCalculatedPayoutV1;
  }
  | {
    status: "formula_unresolved";
    displayText: string;
    sourceResultType: "ContractResult_CalculatedReward";
    sourceRefs: string[];
    unresolvedReason: string;
    payout: MissionCalculatedPayoutV1;
  }
  | {
    status: "provenAbsent";
    displayText: "No credit reward extracted";
    sourceRefs: string[];
  }
  | {
    status: "unresolved";
    displayText: "Credits unresolved";
    sourceResultType?: string;
    sourceRefs: string[];
    unresolvedReason: string;
  };

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function sourceRefs(rewards: MissionSourceRewardV3[]): string[] {
  return [...new Set(rewards.flatMap((reward) => reward.sourceRefs ?? []))];
}

function formatAmount(amount: number, currency: string): string {
  return `${amount.toLocaleString("en-US")} ${currency}`;
}

export function projectBrowserCreditV2(record: MissionSourceRecordV3): BrowserCreditProjectionV2 {
  const rewards = record.creditRewardTypes ?? [];
  const fixed = rewards.find(
    (reward) => reward.type === "ContractResult_Reward"
      && finiteNumber(reward.fixedReward?.reward) !== undefined,
  );
  if (fixed) {
    const amount = finiteNumber(fixed.fixedReward?.reward)!;
    const currency = typeof fixed.fixedReward?.currencyType === "string" && fixed.fixedReward.currencyType
      ? fixed.fixedReward.currencyType
      : "UEC";
    return {
      status: "fixed",
      displayText: formatAmount(amount, currency),
      amount,
      currency,
      max: fixed.fixedReward?.max,
      plusBonuses: fixed.fixedReward?.plusBonuses,
      sourceResultType: "ContractResult_Reward",
      sourceRefs: fixed.sourceRefs ?? [],
    };
  }

  const calculatedRewards = rewards.filter((reward) => reward.type === "ContractResult_CalculatedReward");
  const payout = record.calculatedPayout;
  if (payout) {
    if (payout.resultLoopVerificationRequired || payout.resultCount > 1) {
      return {
        status: "variable",
        displayText: "Multiple calculated payout branches",
        sourceResultType: "ContractResult_CalculatedReward",
        sourceRefs: sourceRefs(calculatedRewards),
        unresolvedReason: "Multiple calculated reward branches require result-loop verification and are not summed.",
        payout,
      };
    }
    if (payout.calculationStatus === "resolved" && payout.baseSoloAmount !== null) {
      return {
        status: "calculated",
        displayText: formatAmount(payout.baseSoloAmount, payout.currency),
        amount: payout.baseSoloAmount,
        currency: payout.currency,
        sourceResultType: "ContractResult_CalculatedReward",
        sourceRefs: sourceRefs(calculatedRewards),
        payout,
      };
    }
    return {
      status: "formula_unresolved",
      displayText: "Credits formula unresolved",
      sourceResultType: "ContractResult_CalculatedReward",
      sourceRefs: sourceRefs(calculatedRewards),
      unresolvedReason: payout.unresolvedReasons.join("; ") || "Calculated payout inputs are unresolved.",
      payout,
    };
  }

  if (calculatedRewards.length) {
    return {
      status: "formula_unresolved",
      displayText: "Credits formula unresolved",
      sourceResultType: "ContractResult_CalculatedReward",
      sourceRefs: sourceRefs(calculatedRewards),
      unresolvedReason: "Calculated reward result has no source-backed calculated payout object.",
      payout: {
        schemaVersion: 1,
        modelVersion: "missing",
        calculationStatus: "unresolved",
        formulaStatus: "unresolved",
        currency: "aUEC",
        baseSoloAmount: null,
        resultCount: calculatedRewards.length,
        aggregationStatus: "not_aggregated",
        resultLoopVerificationRequired: calculatedRewards.length > 1,
        resultAmounts: [],
        unresolvedReasons: ["missing_calculated_payout"],
        validationWarnings: [],
        source: "missing",
      },
    };
  }

  if (!rewards.length) {
    return {
      status: "provenAbsent",
      displayText: "No credit reward extracted",
      sourceRefs: [],
    };
  }

  return {
    status: "unresolved",
    displayText: "Credits unresolved",
    sourceResultType: rewards[0]?.type,
    sourceRefs: sourceRefs(rewards),
    unresolvedReason: "Credit reward result type was not resolved.",
  };
}
