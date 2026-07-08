const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const USERNAME = process.env.SMOKE_USERNAME ?? process.env.COFFEE_POS_OWNER_USERNAME ?? "admin";
const PIN = process.env.SMOKE_PIN ?? process.env.COFFEE_POS_OWNER_PIN ?? "admin";

const results = [];

async function main() {
  const cookie = await login();
  const menu = await checkJson("menu load", "/api/menu", cookie);
  const item = menu.data.menuItems.find((menuItem) => menuItem.variants.length);
  assert(item, "menu has at least one saleable item");
  const variant = item.variants[0];

  const sentOrder = await checkJson("POS order creation", "/api/orders", cookie, {
    method: "POST",
    body: {
      orderType: "TAKEAWAY",
      note: `SMOKE_TEST order creation ${new Date().toISOString()}`,
      items: [{ menuItemId: item.id, variantId: variant.id, quantity: 1, modifiers: ["SMOKE_TEST"] }]
    }
  });
  assert(sentOrder.data?.orderNo, "created order has orderNo");

  const checkout = await checkJson("checkout/payment flow", "/api/orders/checkout", cookie, {
    method: "POST",
    body: {
      orderType: "TAKEAWAY",
      note: `SMOKE_TEST checkout ${new Date().toISOString()}`,
      paymentMethod: "CASH",
      receivedAmount: variant.price,
      items: [{ menuItemId: item.id, variantId: variant.id, quantity: 1, modifiers: ["SMOKE_TEST"] }]
    }
  });
  assert(checkout.data?.paymentStatus === "PAID", "checkout order is paid");

  const queue = await checkJson("queue visibility", "/api/bar", cookie);
  assert(Array.isArray(queue.data), "queue endpoint returns list");
  assert(queue.data.some((ticket) => ticket.orderNo === sentOrder.data.orderNo), "created sent order is visible in queue");

  const inventory = await checkJson("inventory list", "/api/inventory/items", cookie);
  assert(Array.isArray(inventory.data), "inventory endpoint returns list");

  await checkPage("report dashboard load", "/reports", cookie, ["Sales analytics"]);
  await checkPage("settings page load", "/?view=Settings", cookie, ["Cài đặt"]);

  console.table(results);
}

async function login() {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, pin: PIN })
  });
  const text = await response.text();
  assert(response.ok, `login succeeded (${response.status})`, text);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert(cookie, "login returned session cookie");
  record("auth login", true, `${USERNAME} authenticated`);
  return cookie;
}

async function checkJson(name, path, cookie, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Cookie: cookie,
      ...(options.body ? { "Content-Type": "application/json" } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => null);
  assert(response.ok, `${name} returned ${response.status}`, JSON.stringify(payload));
  record(name, true, path);
  return payload;
}

async function checkPage(name, path, cookie, expectedText) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { Cookie: cookie }
  });
  const html = await response.text();
  assert(response.ok, `${name} returned ${response.status}`, html.slice(0, 500));
  for (const text of expectedText) {
    assert(html.includes(text), `${name} contains ${text}`);
  }
  record(name, true, path);
}

function assert(condition, message, detail = "") {
  if (!condition) {
    record(message, false, detail);
    console.table(results);
    throw new Error(`${message}${detail ? `: ${detail}` : ""}`);
  }
}

function record(name, ok, detail) {
  results.push({ check: name, status: ok ? "PASS" : "FAIL", detail });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
