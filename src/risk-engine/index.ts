export type Metric = {
  sessions: number;
  engagementRate: number;
  avgEngagementSeconds: number;
};

export type Factor = {
  type: 'traffic_spike' | 'engagement_anomaly';
  title: string;
  points: number;
  explanation: string;
};

export type Assessment = {
  score: number | null;
  level: 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'CRITICAL' | 'BUILDING BASELINE';
  factors: Factor[];
  baselineStatus: 'building' | 'ready';
};

const MINIMUM_BASELINE_DAYS = 7;

export function riskLevel(score: number): Assessment['level'] {
  if (score <= 20) return 'LOW';
  if (score <= 40) return 'MODERATE';
  if (score <= 60) return 'ELEVATED';
  if (score <= 80) return 'HIGH';
  return 'CRITICAL';
}

function average(history: Metric[], key: keyof Metric) {
  return history.reduce((total, metric) => total + metric[key], 0) / history.length;
}

function percentIncrease(value: number, baseline: number) {
  return baseline > 0 ? ((value - baseline) / baseline) * 100 : 0;
}

function percentDecrease(value: number, baseline: number) {
  return baseline > 0 ? ((baseline - value) / baseline) * 100 : 0;
}

export function assess(current: Metric, history: Metric[]): Assessment {
  if (history.length < MINIMUM_BASELINE_DAYS) {
    return { score: null, level: 'BUILDING BASELINE', factors: [], baselineStatus: 'building' };
  }

  const sessionBaseline = average(history, 'sessions');
  const engagementBaseline = average(history, 'engagementRate');
  const durationBaseline = average(history, 'avgEngagementSeconds');
  const factors: Factor[] = [];
  const trafficIncrease = percentIncrease(current.sessions, sessionBaseline);
  if (trafficIncrease >= 100) {
    factors.push({ type: 'traffic_spike', title: 'Traffic spike', points: 25, explanation: `Sessions are ${Math.round(trafficIncrease)}% above the historical baseline.` });
  }

  const engagementDecrease = percentDecrease(current.engagementRate, engagementBaseline);
  const durationDecrease = percentDecrease(current.avgEngagementSeconds, durationBaseline);
  if (Math.max(engagementDecrease, durationDecrease) >= 40) {
    factors.push({ type: 'engagement_anomaly', title: 'Engagement anomaly', points: 18, explanation: 'Engagement rate or engagement duration is materially below the historical baseline.' });
  }

  const score = Math.min(100, factors.reduce((total, factor) => total + factor.points, 0));
  return { score, level: riskLevel(score), factors, baselineStatus: 'ready' };
}
