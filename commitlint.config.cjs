module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "doctrine",
        "framework",
        "refs",
        "ui",
        "review",
        "feat",
        "fix",
        "refactor",
        "perf",
        "style",
        "docs",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
      ],
    ],
  },
};
