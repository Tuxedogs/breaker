module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [2, "always", ["doctrine", "framework", "refs", "fix", "ui", "chore", "docs", "test"]],
  },
};
