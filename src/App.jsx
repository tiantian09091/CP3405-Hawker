import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import { InventoryApi } from "./InventoryApi.jsx";

export const BASE_INGREDIENTS = [
  { name: "Laksa noodles", per: 120, unit: "g", stock: 4.2, price: 1.5 },
  { name: "Prawns (medium)", per: 45, unit: "g", stock: 1.7, price: 15 },
  { name: "Fish cake slices", per: 40, unit: "g", stock: 1.2, price: 4 },
  { name: "Tau pok", per: 30, unit: "g", stock: 0.8, price: 3 },
  { name: "Laksa leaves", per: 2, unit: "g", stock: 0.05, price: 16 },
  { name: "Laksa paste", per: 60, unit: "g", stock: 2.1, price: 4.5 },
  { name: "Coconut milk", per: 150, unit: "ml", stock: 5, price: 1.5 },
];

export const PREORDERS = [
  { id: "HF-1048", customer: "Mei Lin", sets: 3, time: "11:30 AM", status: "Confirmed" },
  { id: "HF-1047", customer: "Daniel Ong", sets: 2, time: "12:00 PM", status: "Confirmed" },
  { id: "HF-1046", customer: "Nur Aisyah", sets: 4, time: "12:15 PM", status: "Preparing" },
  { id: "HF-1045", customer: "Rachel Lim", sets: 1, time: "1:00 PM", status: "Confirmed" },
];

const MARKET_SETS = [
  { id: 1, stall: "Laksa & More", centre: "Maxwell Food Centre", meal: "Classic laksa set", note: "Laksa, lime drink and tau pok", price: 8.5, left: 22 },
  { id: 2, stall: "Ahmad's Chicken Rice", centre: "Maxwell Food Centre", meal: "Roasted chicken rice set", note: "Chicken rice, soup and achar", price: 7.2, left: 31 },
  { id: 3, stall: "Kampong Nasi Lemak", centre: "Tanjong Pagar Plaza", meal: "Nasi lemak set", note: "Chicken wing, egg, ikan bilis and sambal", price: 6.8, left: 16 },
];

export const WEATHER_OPTIONS = {
  dry: { label: "Warm and dry", multiplier: 1.02, effect: "+2%" },
  hot: { label: "Hot afternoon", multiplier: 1.06, effect: "+6%" },
  rain: { label: "Rain likely", multiplier: 0.86, effect: "−14%" },
};

export const CALENDAR_OPTIONS = {
  normal: { label: "Regular working day", multiplier: 1, effect: "No change" },
  office: { label: "Nearby office event", multiplier: 1.12, effect: "+12%" },
  holiday: { label: "School holiday", multiplier: 0.92, effect: "−8%" },
};

export function predictWalkIns({ weather, calendar, trend }) {
  return Math.round(106 * (1 + trend / 100) * WEATHER_OPTIONS[weather].multiplier * CALENDAR_OPTIONS[calendar].multiplier);
}

function formatQty(value, unit) {
  if (unit === "ml") return value >= 1000 ? `${(value / 1000).toFixed(1)} L` : `${Math.round(value)} ml`;
  return value >= 1000 ? `${(value / 1000).toFixed(1)} kg` : `${Math.round(value)} g`;
}

export function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <div><p className="eyebrow">Planning controls</p><h2 id="modal-title">{title}</h2></div>
          <button className="text-button" onClick={onClose}>Close</button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function Sidebar({ active, setActive, onCustomerMode, user, onLogout }) {
  const links = [["forecast", "Today's forecast"], ["preorders", "Pre-orders"], ["recipes", "Menu & recipes"], ["inventory", "Inventory & ingredients"], ["performance", "Sales & performance"]];
  return (
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">HF</span><div><strong>Hawker Forecast</strong><small>Plan with confidence</small></div></div>
      <p className="sidebar-intro">Demand planning for hawker businesses</p>
      <nav aria-label="Hawker tools">{links.map(([id, label]) => <button key={id} className={active === id ? "nav-link active" : "nav-link"} onClick={() => setActive(id)}>{label}</button>)}</nav>
      <div className="marketplace-note"><strong>Customer marketplace</strong><p>Customers reserve meal sets. Their orders improve tomorrow's forecast.</p><button className="secondary small" onClick={onCustomerMode}>Open marketplace</button></div>
      <div className="account"><span className="avatar">{user?.name?.split(" ").map((part) => part[0]).slice(0, 2).join("") || "AB"}</span><div><strong>{user?.name || "Ahmad Bin Ismail"}</strong><small>{user?.stall || "Laksa & More · Stall 02-45"}</small><button className="account-logout" onClick={onLogout}>Sign out</button></div></div>
    </aside>
  );
}

export function Hero({ onCustomerMode }) {
  return (
    <header className="hero">
      <div className="hero-copy"><p className="eyebrow">Tuesday, 11 August 2026</p><h1>Here's your forecast for today</h1><div className="stall-identity"><img src="/assets/laksa-bowl.png" alt="Bowl of laksa" /><div><strong>Laksa & More</strong><span>Stall 02-45 · Maxwell Food Centre</span><small>Laksa · Noodles · Local favourites</small></div></div></div>
      <button className="role-switch" onClick={onCustomerMode}>View as customer</button>
    </header>
  );
}

export function Forecast({ preorders, walkIns, safety, modelFactors, ingredientsSource, onModelReview, onAdjust, onConfirm, confirmed }) {
  const expected = preorders + walkIns;
  const confidence = modelFactors.weather === "rain" ? 72 : modelFactors.calendar === "office" ? 75 : 82;
  const range = [Math.round(expected * .93), Math.round(expected * 1.07)];
  const ingredients = useMemo(() => ingredientsSource.map((item) => {
    const needed = item.per * expected;
    const withSafety = needed * (1 + safety / 100);
    const buy = Math.max(withSafety - item.stock * 1000, 0);
    return { ...item, needed, buy, cost: (buy / 1000) * item.price };
  }), [expected, safety, ingredientsSource]);
  const total = ingredients.reduce((sum, item) => sum + item.cost, 0);
  return (
    <>
      <section className="demand-brief" aria-label="Today's forecast summary">
        <div className="total-forecast"><span>Today's preparation target</span><div><strong>{expected}</strong><small>bowls</small></div><p>Most likely range: {range[0]}–{range[1]}</p></div>
        <div className="demand-sources"><div><span>Already reserved</span><strong>{preorders}</strong><small>pre-orders · 9:00 AM–4:00 PM</small></div><div><span>Expected at the stall</span><strong>{walkIns}</strong><small>walk-ins · updated 7:45 AM</small></div></div>
        <div className="confidence-brief"><span>Forecast confidence</span><strong>{confidence >= 80 ? "High" : "Good"} · {confidence}%</strong><p>Built from the last eight Tuesdays and today's conditions.</p></div>
      </section>
      <section className="forecast-intelligence" aria-labelledby="smart-forecast-title">
        <div className="forecast-summary">
          <p className="eyebrow">Forecast notes · updated 7:45 AM</p>
          <h2 id="smart-forecast-title">A slightly busier lunch than usual</h2>
          <p>The estimate combines recent sales with today's reservations and operating conditions.</p>
          <div className="forecast-alert"><strong>Kitchen note</strong><span>Prepare core ingredients by 11:15 AM. Demand is tracking 9% above the recent Tuesday average.</span></div>
        </div>
        <div className="factor-list" aria-label="Prediction factors">
          <div><span>Usual Tuesday walk-ins</span><strong>106</strong><small>8-week average</small></div>
          <div><span>Recent sales</span><strong>{modelFactors.trend >= 0 ? "+" : ""}{modelFactors.trend}%</strong><small>past 14 days</small></div>
          <div><span>Weather today</span><strong>{WEATHER_OPTIONS[modelFactors.weather].label}</strong><small>{WEATHER_OPTIONS[modelFactors.weather].effect}</small></div>
          <div><span>What's happening nearby</span><strong>{CALENDAR_OPTIONS[modelFactors.calendar].label}</strong><small>{CALENDAR_OPTIONS[modelFactors.calendar].effect}</small></div>
        </div>
        <button className="factor-link" onClick={onModelReview}>Check or change these assumptions</button>
      </section>
      <section className="plan-section">
        <div className="section-heading"><div><p className="eyebrow">Procurement recommendation</p><h2>Recommended ingredient purchase plan</h2><p>Calculated from your recipe, {expected} expected bowls, current stock and a {safety}% safety allowance.</p></div><button className="secondary" onClick={onAdjust}>Adjust forecast</button></div>
        <div className="table-wrap"><table><thead><tr><th>Ingredient</th><th>Per bowl</th><th>Needed</th><th>Stock on hand</th><th>Recommended purchase</th><th>Est. cost</th></tr></thead><tbody>{ingredients.map((item) => <tr key={item.name}><td><strong>{item.name}</strong></td><td>{item.per} {item.unit}</td><td>{formatQty(item.needed, item.unit)}</td><td>{item.stock.toFixed(item.stock < 1 ? 2 : 1)} {item.unit === "ml" ? "L" : "kg"}</td><td className="recommendation">{formatQty(item.buy, item.unit)}</td><td>S${item.cost.toFixed(2)}</td></tr>)}</tbody><tfoot><tr><td colSpan="5">Estimated purchase total</td><td>S${total.toFixed(2)}</td></tr></tfoot></table></div>
      </section>
      <div className="action-bar"><div><strong>{confirmed ? "Purchase plan confirmed" : "Review the plan before confirming"}</strong><span>{confirmed ? "Your preparation target is locked for today." : "You can still adjust the forecast and safety allowance."}</span></div><button className="primary" onClick={onConfirm}>{confirmed ? "Plan confirmed" : "Confirm purchase plan"}</button></div>
    </>
  );
}

export function Preorders({ extraOrders }) {
  const orders = [...PREORDERS, ...extraOrders];
  const totalSets = orders.reduce((sum, order) => sum + order.sets, 0);
  return <section className="content-page"><p className="eyebrow">Customer demand</p><h1>Pre-orders</h1><div className="page-summary"><strong>{orders.length} active orders</strong><span>{totalSets} meal sets reserved for today</span></div><div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Meal sets</th><th>Pickup time</th><th>Status</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td>{order.id}</td><td><strong>{order.customer}</strong></td><td>{order.sets}</td><td>{order.time}</td><td><span className="status">{order.status}</span></td></tr>)}</tbody></table></div></section>;
}

export function Recipes() {
  return <section className="content-page"><p className="eyebrow">Recipe basis</p><h1>Menu & recipes</h1><p className="lead">Forecasts become purchase quantities by multiplying expected portions by the recipe for one bowl.</p><div className="recipe-sheet"><div><img src="/assets/laksa-bowl.png" alt="Laksa set" /><h2>Classic laksa bowl</h2><p>S$6.50 · Active</p></div><ol>{BASE_INGREDIENTS.map((item) => <li key={item.name}><span>{item.name}</span><strong>{item.per} {item.unit} per bowl</strong></li>)}</ol></div></section>;
}

function Inventory() {
  return <section className="content-page"><p className="eyebrow">Stock check</p><h1>Inventory & ingredients</h1><p className="lead">Update today's stock before confirming a purchase plan.</p><div className="inventory-list">{BASE_INGREDIENTS.map((item) => <label key={item.name}><span>{item.name}</span><input type="number" defaultValue={item.stock} step="0.1" /><small>{item.unit === "ml" ? "litres" : "kilograms"}</small></label>)}</div><button className="primary">Save stock count</button></section>;
}

export function Performance() {
  const days = [["Mon", 162], ["Tue", 185], ["Wed", 174], ["Thu", 201], ["Fri", 219], ["Sat", 232], ["Sun", 196]];
  return <section className="content-page"><p className="eyebrow">Last seven days</p><h1>Sales & performance</h1><p className="lead">Actual portions sold are used to improve future walk-in predictions.</p><div className="performance-chart" aria-label="Portions sold over the last seven days">{days.map(([day, value]) => <div key={day}><span style={{ height: `${value}px` }}></span><strong>{value}</strong><small>{day}</small></div>)}</div></section>;
}

export function Marketplace({ onBack, onReserved, user, onLogin, onRegister, onLogout }) {
  const [selected, setSelected] = useState(null); const [quantity, setQuantity] = useState(2); const [time, setTime] = useState("12:00 PM"); const [done, setDone] = useState(false);
  const confirm = async () => { await onReserved({ customer: user?.name || "Guest customer", sets: quantity, time, status: "Confirmed", marketSetId: selected.id }); setDone(true); };
  return <main className="marketplace"><header className="market-header"><div className="market-brand"><span className="brand-mark">HF</span><strong>Hawker Forecast</strong></div><nav><button>Browse meals</button>{user?.role === "customer" ? <><span className="market-user">Hi, {user.name}</span><button className="secondary" onClick={onLogout}>Sign out</button></> : <><button onClick={onLogin}>Sign in</button><button className="secondary" onClick={onRegister}>Create account</button></>}<button className="hawker-entry" onClick={onBack}>Hawker sign in</button></nav></header><section className="market-hero"><p className="eyebrow">Maxwell Food Centre · Wednesday, 12 August</p><h1>Reserve tomorrow's lunch</h1><p>Your pre-order helps local hawkers prepare the right amount and reduce food waste. An account is optional.</p><div className="market-controls"><label>Pickup date<input type="date" defaultValue="2026-08-12" /></label><label>Search<input type="search" placeholder="Dish or stall name" /></label></div></section><section className="meal-list"><div className="section-heading"><div><h2>Available meal sets</h2><p>Order by 9:30 PM today for pickup tomorrow.</p></div></div>{MARKET_SETS.map((set) => <article key={set.id} className="meal-row"><img src="/assets/laksa-bowl.png" alt="Meal set" /><div><span>{set.centre}</span><h3>{set.stall}</h3><p>{set.meal} · {set.note}</p></div><div><strong>S${set.price.toFixed(2)}</strong><small>{set.left} sets left</small></div><button className="primary" onClick={() => { setSelected(set); setDone(false); }}>Reserve</button></article>)}</section>{selected && <Modal title={done ? "Reservation confirmed" : selected.meal} onClose={() => setSelected(null)}>{done ? <div className="success-state"><strong>Pickup confirmed for {time}</strong><p>Your order has been added to {selected.stall}'s demand forecast.</p>{!user && <button className="text-button" onClick={onRegister}>Create an account for future orders</button>}<button className="primary" onClick={() => setSelected(null)}>Done</button></div> : <div className="reservation-form"><p>{selected.stall} · {selected.centre}</p><div className="form-grid"><label>Quantity<input type="number" min="1" max="8" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} /></label><label>Pickup time<select value={time} onChange={(e) => setTime(e.target.value)}><option>11:30 AM</option><option>12:00 PM</option><option>12:30 PM</option><option>1:00 PM</option></select></label></div><div className="order-total"><span>Total</span><strong>S${(selected.price * quantity).toFixed(2)}</strong></div><button className="primary wide" onClick={confirm}>Confirm reservation</button></div>}</Modal>}</main>;
}

export function App() {
  const [mode, setMode] = useState("hawker"); const [active, setActive] = useState("forecast"); const [preorders, setPreorders] = useState(78); const [walkIns, setWalkIns] = useState(112); const [safety, setSafety] = useState(10); const [draft, setDraft] = useState({ preorders, walkIns, safety }); const [adjusting, setAdjusting] = useState(false); const [confirmed, setConfirmed] = useState(false); const [extraOrders, setExtraOrders] = useState([]); const [toast, setToast] = useState(""); const [modelFactors, setModelFactors] = useState({ weather: "dry", calendar: "normal", trend: 4 }); const [modelDraft, setModelDraft] = useState(modelFactors); const [reviewingModel, setReviewingModel] = useState(false);
  const reserve = (order) => { setExtraOrders((orders) => [...orders, order]); setPreorders((value) => value + order.sets); };
  const confirmPlan = () => { setConfirmed(true); setToast("Purchase plan confirmed. Today's preparation target is locked."); setTimeout(() => setToast(""), 3400); };
  if (mode === "customer") return <Marketplace onBack={() => setMode("hawker")} onReserved={reserve} />;
  return <main className="app-shell"><Sidebar active={active} setActive={setActive} onCustomerMode={() => setMode("customer")} /><div className="workspace">{active === "forecast" && <><Hero onCustomerMode={() => setMode("customer")} /><Forecast preorders={preorders} walkIns={walkIns} safety={safety} modelFactors={modelFactors} onModelReview={() => { setModelDraft(modelFactors); setReviewingModel(true); }} onAdjust={() => { setDraft({ preorders, walkIns, safety }); setAdjusting(true); }} onConfirm={confirmPlan} confirmed={confirmed} /></>}{active === "preorders" && <Preorders extraOrders={extraOrders} />}{active === "recipes" && <Recipes />}{active === "inventory" && <Inventory />}{active === "performance" && <Performance />}</div>{reviewingModel && <Modal title="Review prediction factors" onClose={() => setReviewingModel(false)}><p className="modal-intro">The forecast starts with the last eight Tuesdays, then adjusts for recent sales, weather and nearby activity.</p><div className="form-grid"><label>Weather forecast<select value={modelDraft.weather} onChange={(e) => setModelDraft({ ...modelDraft, weather: e.target.value })}>{Object.entries(WEATHER_OPTIONS).map(([value, option]) => <option key={value} value={value}>{option.label} ({option.effect})</option>)}</select></label><label>Day type<select value={modelDraft.calendar} onChange={(e) => setModelDraft({ ...modelDraft, calendar: e.target.value })}>{Object.entries(CALENDAR_OPTIONS).map(([value, option]) => <option key={value} value={value}>{option.label} ({option.effect})</option>)}</select></label><label>Recent sales trend (%)<input type="number" min="-20" max="25" value={modelDraft.trend} onChange={(e) => setModelDraft({ ...modelDraft, trend: Number(e.target.value) })} /></label></div><div className="model-preview"><span>Recalculated walk-in forecast</span><strong>{predictWalkIns(modelDraft)}</strong><small>Estimated from a 106-customer Tuesday baseline</small></div><div className="modal-actions"><button className="secondary" onClick={() => setReviewingModel(false)}>Cancel</button><button className="primary" onClick={() => { const prediction = predictWalkIns(modelDraft); setModelFactors(modelDraft); setWalkIns(prediction); setConfirmed(false); setReviewingModel(false); setToast(`Smart forecast updated to ${prediction} predicted walk-ins.`); setTimeout(() => setToast(""), 3400); }}>Recalculate forecast</button></div></Modal>}{adjusting && <Modal title="Adjust today's forecast" onClose={() => setAdjusting(false)}><div className="form-grid"><label>Confirmed pre-orders<input type="number" value={draft.preorders} onChange={(e) => setDraft({ ...draft, preorders: Number(e.target.value) })} /></label><label>Predicted walk-ins<input type="number" value={draft.walkIns} onChange={(e) => setDraft({ ...draft, walkIns: Number(e.target.value) })} /></label><label>Safety allowance (%)<input type="number" min="0" max="30" value={draft.safety} onChange={(e) => setDraft({ ...draft, safety: Number(e.target.value) })} /></label></div><p className="calculation-note">Updated preparation target: <strong>{draft.preorders + draft.walkIns} bowls</strong>. Recommendations will include {draft.safety}% additional stock.</p><div className="modal-actions"><button className="secondary" onClick={() => setAdjusting(false)}>Cancel</button><button className="primary" onClick={() => { setPreorders(draft.preorders); setWalkIns(draft.walkIns); setSafety(draft.safety); setConfirmed(false); setAdjusting(false); setToast("Forecast updated and ingredient quantities recalculated."); setTimeout(() => setToast(""), 3400); }}>Apply changes</button></div></Modal>}{toast && <div className="toast" role="status">{toast}</div>}</main>;
}
