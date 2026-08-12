import { useEffect, useState } from "react";
import { api } from "./api.js";
import { InventoryApi } from "./InventoryApi.jsx";
import {
  BASE_INGREDIENTS,
  CALENDAR_OPTIONS,
  WEATHER_OPTIONS,
  Forecast,
  Hero,
  Marketplace,
  Modal,
  Performance,
  PREORDERS,
  Preorders,
  Recipes,
  Sidebar,
  predictWalkIns,
} from "./App.jsx";

function AuthScreen({ kind, onSubmit, onCancel, busy, error }) {
  const [form, setForm] = useState({ name: "", email: kind === "login" ? "hawker@hawkerforecast.sg" : "", password: "" });
  const title = kind === "register" ? "Create your customer account" : "Welcome back";
  return (
    <main className="auth-page">
      <section className="auth-aside">
        <div className="market-brand"><span className="brand-mark">HF</span><strong>Hawker Forecast</strong></div>
        <div><p className="eyebrow">Better preparation, less waste</p><h1>Lunch planning that starts with real reservations.</h1><p>Customers can reserve without an account. Hawker planning stays private and requires sign-in.</p></div>
        <button className="auth-back" onClick={onCancel}>← Continue browsing meals</button>
      </section>
      <section className="auth-form-wrap">
        <form className="auth-form" onSubmit={(event) => { event.preventDefault(); onSubmit(form); }}>
          <p className="eyebrow">{kind === "register" ? "Customer registration" : "Account access"}</p>
          <h2>{title}</h2>
          <p className="auth-intro">{kind === "register" ? "Save your details for a quicker reservation experience." : "Customers and approved hawkers use the same secure sign-in."}</p>
          {kind === "register" && <label>Full name<input autoComplete="name" required minLength="2" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>}
          <label>Email address<input type="email" autoComplete="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>Password<input type="password" autoComplete={kind === "register" ? "new-password" : "current-password"} required minLength="8" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><small>At least 8 characters</small></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="primary wide" disabled={busy}>{busy ? "Please wait…" : kind === "register" ? "Create customer account" : "Sign in"}</button>
          <p className="auth-note">{kind === "register" ? "Hawker accounts are approved separately and cannot be created here." : "Demo hawker password: zyy123123"}</p>
        </form>
      </section>
    </main>
  );
}

export function AppConnected() {
  const [mode, setMode] = useState("customer");
  const [user, setUser] = useState(null);
  const [authView, setAuthView] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [active, setActive] = useState("forecast");
  const [preorders, setPreorders] = useState(78);
  const [walkIns, setWalkIns] = useState(112);
  const [safety, setSafety] = useState(10);
  const [ingredients, setIngredients] = useState(BASE_INGREDIENTS);
  const [draft, setDraft] = useState({ preorders, walkIns, safety });
  const [adjusting, setAdjusting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [extraOrders, setExtraOrders] = useState([]);
  const [toast, setToast] = useState("");
  const [modelFactors, setModelFactors] = useState({ weather: "dry", calendar: "normal", trend: 4 });
  const [modelDraft, setModelDraft] = useState(modelFactors);
  const [reviewingModel, setReviewingModel] = useState(false);

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3400);
  };

  const applyForecast = (forecast) => {
    setPreorders(forecast.preorders);
    setWalkIns(forecast.walkIns);
    setSafety(forecast.safety);
    setModelFactors(forecast.modelFactors);
    setConfirmed(Boolean(forecast.confirmedAt));
  };

  useEffect(() => {
    let current = true;
    api.me().then(({ user: sessionUser }) => {
      if (!current) return;
      setUser(sessionUser);
      if (sessionUser?.role === "hawker") setMode("hawker");
      setAuthReady(true);
    }).catch(() => setAuthReady(true));
    return () => { current = false; };
  }, []);

  useEffect(() => {
    if (!authReady || user?.role !== "hawker") return;
    api.bootstrap().then((data) => {
      applyForecast(data.forecast);
      setIngredients(data.inventory);
      const seededIds = new Set(PREORDERS.map((order) => order.id));
      setExtraOrders(data.preorders.filter((order) => !seededIds.has(order.id)));
    }).catch((error) => showToast(`API connection failed: ${error.message}`));
  }, [authReady, user?.id]);

  const authenticate = async (details) => {
    setAuthBusy(true); setAuthError("");
    try {
      if (authView === "register") await api.register(details);
      const result = await api.login(details);
      setUser(result.user); setAuthView(null);
      setMode(result.user.role === "hawker" ? "hawker" : "customer");
    } catch (error) { setAuthError(error.message); }
    finally { setAuthBusy(false); }
  };

  const logout = async () => {
    await api.logout();
    setUser(null); setMode("customer"); setActive("forecast");
    showToast("You have signed out.");
  };

  const reserve = async (order) => {
    const result = await api.createPreorder(order);
    setExtraOrders((orders) => [...orders, result.order]);
    applyForecast(result.forecast);
  };

  const confirmPlan = async () => {
    try {
      const plan = await api.confirmPurchasePlan();
      setConfirmed(Boolean(plan.confirmedAt));
      showToast("Purchase plan saved by the API and confirmed.");
    } catch (error) {
      showToast(error.message);
    }
  };

  const recalculate = async () => {
    try {
      const result = await api.recalculateForecast(modelDraft);
      applyForecast(result.forecast);
      setReviewingModel(false);
      showToast(`API forecast updated to ${result.forecast.walkIns} predicted walk-ins.`);
    } catch (error) {
      showToast(error.message);
    }
  };

  const applyManualForecast = async () => {
    try {
      const result = await api.updateForecast(draft);
      applyForecast(result.forecast);
      setAdjusting(false);
      showToast("Forecast and ingredient quantities saved through the API.");
    } catch (error) {
      showToast(error.message);
    }
  };

  if (!authReady) return <main className="loading-page">Loading Hawker Forecast…</main>;

  if (authView) return <AuthScreen kind={authView} onSubmit={authenticate} onCancel={() => { setAuthView(null); setAuthError(""); }} busy={authBusy} error={authError} />;

  if (mode === "customer") return <Marketplace user={user} onLogin={() => setAuthView("login")} onRegister={() => setAuthView("register")} onLogout={logout} onBack={() => user?.role === "hawker" ? setMode("hawker") : setAuthView("login")} onReserved={reserve} />;

  if (user?.role !== "hawker") return <AuthScreen kind="login" onSubmit={authenticate} onCancel={() => setMode("customer")} busy={authBusy} error={authError} />;

  return (
    <main className="app-shell">
      <Sidebar active={active} setActive={setActive} onCustomerMode={() => setMode("customer")} user={user} onLogout={logout} />
      <div className="workspace">
        {active === "forecast" && (
          <>
            <Hero onCustomerMode={() => setMode("customer")} />
            <Forecast
              preorders={preorders}
              walkIns={walkIns}
              safety={safety}
              modelFactors={modelFactors}
              ingredientsSource={ingredients}
              onModelReview={() => { setModelDraft(modelFactors); setReviewingModel(true); }}
              onAdjust={() => { setDraft({ preorders, walkIns, safety }); setAdjusting(true); }}
              onConfirm={confirmPlan}
              confirmed={confirmed}
            />
          </>
        )}
        {active === "preorders" && <Preorders extraOrders={extraOrders} />}
        {active === "recipes" && <Recipes />}
        {active === "inventory" && <InventoryApi initialItems={ingredients} onSaved={setIngredients} />}
        {active === "performance" && <Performance />}
      </div>

      {reviewingModel && (
        <Modal title="Review prediction factors" onClose={() => setReviewingModel(false)}>
          <p className="modal-intro">The forecast starts with the last eight Tuesdays, then adjusts for recent sales, weather and nearby activity.</p>
          <div className="form-grid">
            <label>Weather forecast<select value={modelDraft.weather} onChange={(event) => setModelDraft({ ...modelDraft, weather: event.target.value })}>{Object.entries(WEATHER_OPTIONS).map(([value, option]) => <option key={value} value={value}>{option.label} ({option.effect})</option>)}</select></label>
            <label>Day type<select value={modelDraft.calendar} onChange={(event) => setModelDraft({ ...modelDraft, calendar: event.target.value })}>{Object.entries(CALENDAR_OPTIONS).map(([value, option]) => <option key={value} value={value}>{option.label} ({option.effect})</option>)}</select></label>
            <label>Recent sales trend (%)<input type="number" min="-20" max="25" value={modelDraft.trend} onChange={(event) => setModelDraft({ ...modelDraft, trend: Number(event.target.value) })} /></label>
          </div>
          <div className="model-preview"><span>Recalculated walk-in forecast</span><strong>{predictWalkIns(modelDraft)}</strong><small>Estimated from a 106-customer Tuesday baseline</small></div>
          <div className="modal-actions"><button className="secondary" onClick={() => setReviewingModel(false)}>Cancel</button><button className="primary" onClick={recalculate}>Recalculate forecast</button></div>
        </Modal>
      )}

      {adjusting && (
        <Modal title="Adjust today's forecast" onClose={() => setAdjusting(false)}>
          <div className="form-grid">
            <label>Confirmed pre-orders<input type="number" value={draft.preorders} onChange={(event) => setDraft({ ...draft, preorders: Number(event.target.value) })} /></label>
            <label>Predicted walk-ins<input type="number" value={draft.walkIns} onChange={(event) => setDraft({ ...draft, walkIns: Number(event.target.value) })} /></label>
            <label>Safety allowance (%)<input type="number" min="0" max="30" value={draft.safety} onChange={(event) => setDraft({ ...draft, safety: Number(event.target.value) })} /></label>
          </div>
          <p className="calculation-note">Updated preparation target: <strong>{draft.preorders + draft.walkIns} bowls</strong>. Recommendations will include {draft.safety}% additional stock.</p>
          <div className="modal-actions"><button className="secondary" onClick={() => setAdjusting(false)}>Cancel</button><button className="primary" onClick={applyManualForecast}>Apply changes</button></div>
        </Modal>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
