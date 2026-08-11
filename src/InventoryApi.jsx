import { useEffect, useState } from "react";
import { api } from "./api.js";

export function InventoryApi({ initialItems, onSaved }) {
  const [items, setItems] = useState(initialItems);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => setItems(initialItems), [initialItems]);

  const updateStock = (name, value) => {
    setItems((current) => current.map((item) => item.name === name ? { ...item, stock: Number(value) } : item));
  };

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const result = await api.updateInventory(items.map(({ name, stock }) => ({ name, stock })));
      setItems(result.inventory);
      onSaved(result.inventory);
      setMessage("Stock saved. The purchase plan has been recalculated.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="content-page">
      <p className="eyebrow">Stock check</p>
      <h1>Inventory & ingredients</h1>
      <p className="lead">Update today's stock before confirming a purchase plan.</p>
      <div className="inventory-list">
        {items.map((item) => (
          <label key={item.name}>
            <span>{item.name}</span>
            <input type="number" min="0" value={item.stock} step="0.1" onChange={(event) => updateStock(item.name, event.target.value)} />
            <small>{item.unit === "ml" ? "litres" : "kilograms"}</small>
          </label>
        ))}
      </div>
      <button className="primary" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save stock count"}</button>
      {message && <p className="calculation-note" role="status">{message}</p>}
    </section>
  );
}
