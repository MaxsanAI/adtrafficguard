import { describe, expect, it } from 'vitest';
import { planLimits } from '../src/services/plan-limits';

describe('plan limits', () => {
  it('uses the published server-side property and retention limits', () => {
    expect(planLimits('free')).toEqual({ properties: 1, historyDays: 7 });
    expect(planLimits('pro')).toEqual({ properties: 5, historyDays: 90 });
    expect(planLimits('business')).toEqual({ properties: 25, historyDays: 365 });
  });

  it('fails closed to the free plan for an unknown subscription value', () => {
    expect(planLimits('untrusted')).toEqual({ properties: 1, historyDays: 7 });
  });
});
