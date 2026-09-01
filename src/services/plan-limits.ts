export const PLAN_LIMITS = { free: { properties: 1, historyDays: 7 }, pro: { properties: 5, historyDays: 90 }, business: { properties: 25, historyDays: 365 } } as const;
export type Plan = keyof typeof PLAN_LIMITS;
export function planLimits(plan: string) { return PLAN_LIMITS[plan as Plan] ?? PLAN_LIMITS.free; }
