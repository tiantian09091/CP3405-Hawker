async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

export const api = {
  me: () => request("/api/auth/me"),
  login: (details) => request("/api/auth/login", { method: "POST", body: JSON.stringify(details) }),
  register: (details) => request("/api/auth/register", { method: "POST", body: JSON.stringify(details) }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  bootstrap: () => request("/api/bootstrap"),
  updateForecast: (forecast) => request("/api/forecast", { method: "PUT", body: JSON.stringify(forecast) }),
  recalculateForecast: (factors) => request("/api/forecast/recalculate", { method: "POST", body: JSON.stringify(factors) }),
  createPreorder: (order) => request("/api/preorders", { method: "POST", body: JSON.stringify(order) }),
  updateInventory: (items) => request("/api/inventory", { method: "PUT", body: JSON.stringify({ items }) }),
  confirmPurchasePlan: () => request("/api/purchase-plan/confirm", { method: "POST" }),
};
