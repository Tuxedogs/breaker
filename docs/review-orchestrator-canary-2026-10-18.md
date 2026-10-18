# Disposable review-orchestrator canary

This file exists only to validate the controlled Breaker review orchestrator.

## Requested correction target

`PENDING_REVIEWER_CORRECTION`

## Acceptance criterion

After a real `CHANGES_REQUESTED` review from `tuxactual`, the orchestrator must change
only the target token above to `CORRECTED_BY_REVIEW`, run `git diff --check`, commit,
perform a normal push to this canary branch, and post the result to this PR.

This pull request is disposable and will be closed after the validation.
