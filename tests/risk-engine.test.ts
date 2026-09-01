import { describe, expect, it } from 'vitest';
import { assess, riskLevel } from '../src/risk-engine';

const baseline = Array.from({ length: 7 }, () => ({ sessions: 100, engagementRate: 0.5, avgEngagementSeconds: 50 }));

describe('risk engine', () => {
  it('does not create a score while the baseline is incomplete', () => {
    const assessment = assess({ sessions: 1_000, engagementRate: 0.1, avgEngagementSeconds: 1 }, baseline.slice(0, 6));
    expect(assessment).toMatchObject({ score: null, level: 'BUILDING BASELINE', baselineStatus: 'building', factors: [] });
  });

  it('explains separate traffic and engagement deviations once the baseline is ready', () => {
    const assessment = assess({ sessions: 250, engagementRate: 0.2, avgEngagementSeconds: 20 }, baseline);
    expect(assessment.score).toBe(43);
    expect(assessment.level).toBe('ELEVATED');
    expect(assessment.factors.map((factor) => factor.type)).toEqual(['traffic_spike', 'engagement_anomaly']);
  });

  it('uses the published risk-level boundaries', () => {
    expect(riskLevel(20)).toBe('LOW');
    expect(riskLevel(21)).toBe('MODERATE');
    expect(riskLevel(81)).toBe('CRITICAL');
  });
});
