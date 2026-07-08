import { spawnSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const OUTPUT_DIR = resolve(process.env.QA_SCREENSHOT_DIR ?? "docs/assets/qa");
const AUTH_STATE = resolve(OUTPUT_DIR, "auth-state.json");

const shots = [
  { name: "pos-desktop", path: "/", viewport: "1440,900" },
  { name: "orders-desktop", path: "/?view=Orders", viewport: "1440,900" },
  { name: "queue-desktop", path: "/?view=Queue", viewport: "1440,900" },
  { name: "reports-desktop", path: "/reports", viewport: "1440,900" },
  { name: "inventory-desktop", path: "/inventory", viewport: "1440,900" },
  { name: "settings-desktop", path: "/?view=Settings", viewport: "1440,900" },
  { name: "pos-tablet", path: "/", viewport: "1024,768" },
  { name: "pos-mobile", path: "/", viewport: "390,844" },
  { name: "admin-payroll-desktop", path: "/payroll", viewport: "1440,900" }
];

await mkdir(OUTPUT_DIR, { recursive: true });
await run("node", ["scripts/create-playwright-auth-state.mjs", AUTH_STATE]);

try {
  for (const shot of shots) {
    const output = resolve(OUTPUT_DIR, `${shot.name}.png`);
    await rm(output, { force: true });
    await run("pnpm", [
      "exec",
      "playwright",
      "screenshot",
      "--load-storage",
      AUTH_STATE,
      "--viewport-size",
      shot.viewport,
      "--wait-for-selector",
      "main",
      "--wait-for-timeout",
      "1500",
      `${BASE_URL}${shot.path}`,
      output
    ]);
    console.log(`Captured ${shot.name}: ${output}`);
  }
} finally {
  await rm(AUTH_STATE, { force: true });
}

async function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    shell: process.platform === "win32",
    stdio: "inherit",
    env: process.env
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}
