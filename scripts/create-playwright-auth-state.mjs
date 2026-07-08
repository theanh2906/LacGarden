import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const USERNAME = process.env.SMOKE_USERNAME ?? process.env.COFFEE_POS_OWNER_USERNAME ?? "admin";
const PIN = process.env.SMOKE_PIN ?? process.env.COFFEE_POS_OWNER_PIN ?? "admin";
const OUTPUT = resolve(process.argv[2] ?? "docs/assets/qa/auth-state.json");

const response = await fetch(`${BASE_URL}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: USERNAME, pin: PIN })
});

if (!response.ok) {
  throw new Error(`Login failed with HTTP ${response.status}: ${await response.text()}`);
}

const setCookie = response.headers.get("set-cookie");
const [cookiePair] = setCookie?.split(";") ?? [];
const [name, value] = cookiePair?.split("=") ?? [];
if (!name || !value) {
  throw new Error("Login response did not include a session cookie.");
}

const url = new URL(BASE_URL);
const state = {
  cookies: [
    {
      name,
      value,
      domain: url.hostname,
      path: "/",
      expires: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "Lax"
    }
  ],
  origins: []
};

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(state, null, 2)}\n`, "utf8");
console.log(`Saved Playwright auth state to ${OUTPUT}`);
