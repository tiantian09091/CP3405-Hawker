import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { createStore } from "./store.js";
import { buildForecast, buildPurchasePlan, predictWalkIns } from "./forecast.js";
import { authMiddleware, ensureAccounts, installAuthRoutes, requireHawker } from "./auth.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = express();
const store = await createStore();
await ensureAccounts(store);
const port = Number(process.env.PORT) || 4174;

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

const asyncRoute = (handler) => (request, response, next) => Promise.resolve(handler(request, response)).catch(next);
const integer = (value, minimum, maximum) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) return null;
  return parsed;
};

async function saveMutation(mutator) {
  const state = await store.getState();
  await mutator(state);
  await store.setState(state);
  return state;
}

app.use(authMiddleware(store));
installAuthRoutes(app, store, asyncRoute, saveMutation);

app.get("/api/health", (request, response) => {
  response.json({ ok: true, service: "hawker-forecast-api", storage: process.env.DATABASE_URL ? "postgres" : "local-json" });
});

app.get("/api/bootstrap", requireHawker, asyncRoute(async (request, response) => {
  const state = await store.getState();
  response.json({
    forecast: buildForecast(state),
    purchasePlan: buildPurchasePlan(state),
    preorders: state.preorders,
    inventory: state.ingredients,
    marketSets: state.marketSets,
    salesHistory: state.salesHistory,
  });
}));

app.get("/api/forecast", requireHawker, asyncRoute(async (request, response) => {
  response.json(buildForecast(await store.getState()));
}));

app.put("/api/forecast", requireHawker, asyncRoute(async (request, response) => {
  const preorders = integer(request.body.preorders, 0, 5000);
  const walkIns = integer(request.body.walkIns, 0, 5000);
  const safety = integer(request.body.safety, 0, 30);
  if (preorders === null || walkIns === null || safety === null) {
    return response.status(400).json({ error: "preorders and walkIns must be non-negative integers; safety must be between 0 and 30." });
  }
  const state = await saveMutation((draft) => {
    Object.assign(draft.forecast, { preorders, walkIns, safety, confirmedAt: null, updatedAt: new Date().toISOString() });
  });
  response.json({ forecast: buildForecast(state), purchasePlan: buildPurchasePlan(state) });
}));

app.post("/api/forecast/recalculate", requireHawker, asyncRoute(async (request, response) => {
  const weather = ["dry", "hot", "rain"].includes(request.body.weather) ? request.body.weather : null;
  const calendar = ["normal", "office", "holiday"].includes(request.body.calendar) ? request.body.calendar : null;
  const trend = Number(request.body.trend);
  if (!weather || !calendar || !Number.isFinite(trend) || trend < -20 || trend > 25) {
    return response.status(400).json({ error: "Invalid prediction factors." });
  }
  const factors = { weather, calendar, trend };
  const state = await saveMutation((draft) => {
    draft.forecast.modelFactors = factors;
    draft.forecast.walkIns = predictWalkIns(factors);
    draft.forecast.confirmedAt = null;
    draft.forecast.updatedAt = new Date().toISOString();
  });
  response.json({ forecast: buildForecast(state), purchasePlan: buildPurchasePlan(state) });
}));

app.get("/api/preorders", requireHawker, asyncRoute(async (request, response) => {
  response.json((await store.getState()).preorders);
}));

app.post("/api/preorders", asyncRoute(async (request, response) => {
  const customer = String(request.body.customer ?? "").trim().slice(0, 80);
  const sets = integer(request.body.sets, 1, 20);
  const time = String(request.body.time ?? "").trim().slice(0, 20);
  const marketSetId = integer(request.body.marketSetId, 1, 9999);
  if (!customer || sets === null || !time || marketSetId === null) {
    return response.status(400).json({ error: "customer, sets, time and marketSetId are required." });
  }
  let order;
  const state = await saveMutation((draft) => {
    const meal = draft.marketSets.find((item) => item.id === marketSetId);
    if (!meal) throw Object.assign(new Error("Meal set not found."), { status: 404 });
    order = {
      id: `HF-${Date.now().toString().slice(-6)}`,
      customer,
      sets,
      time,
      status: "Confirmed",
      marketSetId,
      stall: meal.stall,
      createdAt: new Date().toISOString(),
    };
    draft.preorders.push(order);
    meal.left = Math.max(0, meal.left - sets);
    if (marketSetId === 1) draft.forecast.preorders += sets;
    draft.forecast.confirmedAt = null;
    draft.forecast.updatedAt = new Date().toISOString();
  });
  response.status(201).json({ order, forecast: buildForecast(state), marketSets: state.marketSets });
}));

app.get("/api/inventory", requireHawker, asyncRoute(async (request, response) => {
  response.json((await store.getState()).ingredients);
}));

app.put("/api/inventory", requireHawker, asyncRoute(async (request, response) => {
  if (!Array.isArray(request.body.items)) return response.status(400).json({ error: "items must be an array." });
  const updates = new Map();
  for (const item of request.body.items) {
    const stock = Number(item.stock);
    if (!item.name || !Number.isFinite(stock) || stock < 0 || stock > 10000) {
      return response.status(400).json({ error: "Each item needs a valid name and stock value." });
    }
    updates.set(item.name, stock);
  }
  const state = await saveMutation((draft) => {
    draft.ingredients = draft.ingredients.map((item) => updates.has(item.name) ? { ...item, stock: updates.get(item.name) } : item);
    draft.forecast.confirmedAt = null;
  });
  response.json({ inventory: state.ingredients, purchasePlan: buildPurchasePlan(state) });
}));

app.get("/api/purchase-plan", requireHawker, asyncRoute(async (request, response) => {
  response.json(buildPurchasePlan(await store.getState()));
}));

app.post("/api/purchase-plan/confirm", requireHawker, asyncRoute(async (request, response) => {
  const state = await saveMutation((draft) => { draft.forecast.confirmedAt = new Date().toISOString(); });
  response.json(buildPurchasePlan(state));
}));

app.get("/api/sales-history", requireHawker, asyncRoute(async (request, response) => {
  response.json((await store.getState()).salesHistory);
}));

if (process.env.NODE_ENV === "production") {
  const clientDirectory = path.join(root, "dist", "client");
  app.use(express.static(clientDirectory));
  app.use((request, response, next) => {
    if (request.path.startsWith("/api/")) return next();
    response.sendFile(path.join(clientDirectory, "index.html"));
  });
} else {
  const vite = await createViteServer({ root, server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
}

app.use((error, request, response, next) => {
  console.error(error);
  response.status(error.status || 500).json({ error: error.status ? error.message : "Internal server error." });
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Hawker Forecast running at http://127.0.0.1:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    server.close();
    await store.close();
    process.exit(0);
  });
}
