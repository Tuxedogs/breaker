import { execSync } from "node:child_process";

const tag = process.argv[2];

if (!tag) {
  console.error("Usage: npm run release:tag -- v0.1.0");
  process.exit(1);
}

if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
  console.error(`Invalid tag "${tag}". Expected format: v<major>.<minor>.<patch>`);
  process.exit(1);
}

function run(command) {
  execSync(command, { stdio: "inherit" });
}

run(`git-cliff -c cliff.toml --tag ${tag} -o CHANGELOG.md`);
run("git add CHANGELOG.md");
run(`git commit -m "chore: release ${tag}"`);
run(`git tag ${tag}`);
run("git push");
run(`git push origin ${tag}`);
