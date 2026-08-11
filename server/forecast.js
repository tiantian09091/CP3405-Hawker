const WEATHER = {
  dry: { multiplier: 1.02, confidence: 82 },
  hot: { multiplier: 1.06, confidence: 79 },
  rain: { multiplier: 0.86, confidence: 72 },
};

const CALENDAR = {
  normal: { multiplier: 1, confidencePenalty: 0 },
  office: { multiplier: 1.12, confidencePenalty: 7 },
  holiday: { multiplier: 0.92, confidencePenalty: 5 },
};

export function predictWalkIns(factors) {
  const weather = WEATHER[factors.weather] ?? WEATHER.dry;
  const calendar = CALENDAR[factors.calendar] ?? CALENDAR.normal;
  const trend = Math.min(25, Math.max(-20, Number(factors.trend) || 0));
  return Math.round(106 * (1 + trend / 100) * weather.multiplier * calendar.multiplier);
}

export function buildPurchasePlan(state) {
  const expected = state.forecast.preorders + state.forecast.walkIns;
  const safetyMultiplier = 1 + state.forecast.safety / 100;
  const items = state.ingredients.map((item) => {
    const needed = item.per * expected;
    const purchase = Math.max(needed * safetyMultiplier - item.stock * 1000, 0);
    return { ...item, needed, purchase, estimatedCost: (purchase / 1000) * item.price };
  });
  return {
    expectedPortions: expected,
    safety: state.forecast.safety,
    items,
    estimatedTotal: items.reduce((sum, item) => sum + item.estimatedCost, 0),
    confirmedAt: state.forecast.confirmedAt,
  };
}

export function buildForecast(state) {
  const expectedPortions = state.forecast.preorders + state.forecast.walkIns;
  const weather = WEATHER[state.forecast.modelFactors.weather] ?? WEATHER.dry;
  const calendar = CALENDAR[state.forecast.modelFactors.calendar] ?? CALENDAR.normal;
  const confidence = Math.max(55, weather.confidence - calendar.confidencePenalty);
  return {
    ...state.forecast,
    expectedPortions,
    confidence,
    likelyRange: [Math.round(expectedPortions * 0.93), Math.round(expectedPortions * 1.07)],
  };
}
