import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  SessionRecord,
  TrackerConfig,
  computeAnalytics,
  computeHistoryComparison,
  getColorInfo,
  getMonthWorkdays,
  resolveModelMultiplier,
  scanLocalChatSessions
} from './tracker';

function runTests() {
  console.log('Running Copilot Credit & Session Analytics verification suite...');

  // 1. Test Workdays in October 2026 (Oct 1, 2026 is Thursday; Oct 31 is Saturday -> 22 weekdays)
  const calOct = getMonthWorkdays(2026, 9, 15, [1, 2, 3, 4, 5], []);
  assert.strictEqual(calOct.totalWorkdays, 22, 'October 2026 should have 22 workdays');
  assert.strictEqual(calOct.pastWorkdays, 10, 'Oct 1..14 2026 should have 10 past workdays');
  assert.strictEqual(calOct.elapsedWorkdays, 11, 'Oct 1..15 2026 should have 11 elapsed workdays');
  assert.strictEqual(calOct.remainingWorkdays, 12, 'Oct 15..31 2026 should have 12 remaining workdays');

  // Holiday exclusion test
  const calWithHoliday = getMonthWorkdays(2026, 9, 15, [1, 2, 3, 4, 5], ['2026-10-02']);
  assert.strictEqual(calWithHoliday.totalWorkdays, 21, 'Holiday on Friday Oct 2 should reduce workdays to 21');

  // 2. Test Model Multipliers
  assert.strictEqual(resolveModelMultiplier('claude-3.7-sonnet-thought'), 1.25);
  assert.strictEqual(resolveModelMultiplier('claude-3.7-sonnet'), 1);
  assert.strictEqual(resolveModelMultiplier('claude-opus-4'), 10);
  assert.strictEqual(resolveModelMultiplier('gpt-4.1'), 0);

  // 3. Test Color Coding Tiers
  assert.strictEqual(getColorInfo(35).tier, 'green');
  assert.strictEqual(getColorInfo(65).tier, 'yellow');
  assert.strictEqual(getColorInfo(90).tier, 'orange');
  assert.strictEqual(getColorInfo(105).tier, 'red');

  // 4. Test Core Budget, Extra Credits, Credit Debt, Averages, and 40-60% Expensive Sessions
  const config: TrackerConfig = {
    monthlyCredits: 220, // 220 credits / 22 workdays = exactly 10.0 credits/day
    overrideApiEntitlement: true,
    extraCredits: 22,    // +22 extra credits -> Recommended Daily Limit = 242 / 22 = 11.0 credits/day
    workDays: [1, 2, 3, 4, 5],
    workHoursPerDay: 8,
    holidays: [],
    dailyPercentMode: 'standard',
    expensiveSessionMinPercent: 40,
    expensiveSessionMaxPercent: 60,
    modelMultipliers: {}
  };

  // Simulate Oct 15, 2026
  const now = new Date(2026, 9, 15, 14, 30, 0);

  // Past sessions (used 130 credits before today across 10 past workdays; expected base was 10 * 10 = 100 -> -30 overspend, +22 extra = -8 Debt!)
  const sessions: SessionRecord[] = [
    {
      sessionId: 's1',
      title: 'Heavy 50% Session Today',
      workspaceName: 'repo-alpha',
      dateStr: '2026-10-15',
      startTime: new Date(2026, 9, 15, 10, 0).getTime(),
      endTime: new Date(2026, 9, 15, 10, 40).getTime(),
      durationMinutes: 40,
      messages: 5,
      credits: 5.5, // 5.5 / 11.0 = 50% of daily limit -> 'heavy-40-60'
      estimatedTokens: 6000,
      cumulativeContextTokens: 18000,
      modelsUsed: { 'claude-3.7-sonnet': { messages: 5, credits: 5.5 } },
      primaryModel: 'claude-3.7-sonnet',
      dailyLimitPercent: 0,
      expenseTier: 'normal',
      hasContextBloat: false,
      post20TurnCredits: 0
    },
    {
      sessionId: 's2',
      title: 'Mega 70% Session Today (Marathon)',
      workspaceName: 'repo-beta',
      dateStr: '2026-10-15',
      startTime: new Date(2026, 9, 15, 13, 0).getTime(),
      endTime: new Date(2026, 9, 15, 14, 15).getTime(),
      durationMinutes: 75,
      messages: 25,
      credits: 7.7, // 7.7 / 11.0 = 70% of daily limit -> 'mega-60plus'
      estimatedTokens: 25000,
      cumulativeContextTokens: 95000,
      modelsUsed: { 'claude-3.7-sonnet': { messages: 25, credits: 7.7 } },
      primaryModel: 'claude-3.7-sonnet',
      dailyLimitPercent: 0,
      expenseTier: 'normal',
      hasContextBloat: true,
      post20TurnCredits: 2.0
    },
    {
      sessionId: 's3',
      title: 'Prior Week Opus Debugging',
      workspaceName: 'repo-alpha',
      dateStr: '2026-10-12',
      startTime: new Date(2026, 9, 12, 11, 0).getTime(),
      endTime: new Date(2026, 9, 12, 12, 0).getTime(),
      durationMinutes: 60,
      messages: 13,
      credits: 130,
      estimatedTokens: 15000,
      cumulativeContextTokens: 80000,
      modelsUsed: { 'claude-opus-4': { messages: 13, credits: 130 } },
      primaryModel: 'claude-opus-4',
      dailyLimitPercent: 0,
      expenseTier: 'normal',
      hasContextBloat: true,
      post20TurnCredits: 0
    }
  ];

  const snap = computeAnalytics(config, now, sessions);

  assert.strictEqual(snap.baseDailyLimit, 10, 'Base daily limit should be 220 / 22 = 10');
  assert.strictEqual(snap.recommendedDailyLimit, 11, 'Recommended daily limit with extra should be 242 / 22 = 11');
  assert.strictEqual(snap.expectedUsedBeforeToday, 100, '10 past workdays * 10 base limit = 100');
  assert.strictEqual(snap.usedBeforeToday, 130, 'Used before today is 130');
  assert.strictEqual(snap.creditDebt, 8, 'Debt should be |(100 - 130) + 22| = 8 credits');
  assert.strictEqual(snap.rolloverExtraCredits, 0, 'When in debt, rollover extra is 0');

  // Today's usage & expensive sessions
  assert.strictEqual(snap.todayUsedCredits, 13.2, 'Today used 5.5 + 7.7 = 13.2 credits');
  assert.strictEqual(snap.todayExpensive40to60, 1, 'Today should have 1 session in 40-60% tier');
  assert.strictEqual(snap.todayExpensiveOver60, 1, 'Today should have 1 session in >60% tier');
  assert.strictEqual(snap.todayTotalExpensiveChats, 2, 'Today should have 2 total expensive chats');
  assert.strictEqual(snap.monthTotalExpensiveChats, 3, 'Month should have 3 expensive chats total');
  assert.strictEqual(snap.colorTier, 'red', '13.2 / 11.0 = 120% -> red tier');

  // Averages
  assert.ok(snap.workdayAverageCredits > 0, 'Workday average should be positive');
  assert.strictEqual(
    snap.workHourAverageCredits,
    Math.round((snap.workdayAverageCredits / 8) * 100) / 100,
    'Work hour average should equal workday average / 8'
  );

  // 5. Test Local Chat Session Scanner (.json and .jsonl)
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-analytics-test-'));
  const hashDir = path.join(tmpRoot, 'abc123hash');
  const chatDir = path.join(hashDir, 'chatSessions');
  fs.mkdirSync(chatDir, { recursive: true });
  fs.writeFileSync(
    path.join(hashDir, 'workspace.json'),
    JSON.stringify({ folder: 'file:///Users/dev/payment-gateway' }),
    'utf8'
  );
  fs.writeFileSync(
    path.join(chatDir, 'session-1.json'),
    JSON.stringify({
      sessionId: 'session-1',
      customTitle: 'Stripe webhook signature verification',
      requests: [
        {
          message: { text: 'Verify stripe signature in express' },
          response: [{ value: 'Here is how to verify the signature...' }],
          modelId: 'copilot/claude-3.7-sonnet',
          timestamp: new Date(2026, 9, 14, 15, 0).getTime()
        },
        {
          message: { text: 'Add retry handler' },
          response: [{ value: 'Added exponential backoff retry...' }],
          modelId: 'copilot/claude-3.7-sonnet',
          timestamp: new Date(2026, 9, 14, 15, 5).getTime()
        }
      ]
    }),
    'utf8'
  );

  const scanned = scanLocalChatSessions(tmpRoot, 2026, 9, {});
  assert.strictEqual(scanned.length, 1, 'Should scan 1 local chat session');
  assert.strictEqual(scanned[0].workspaceName, 'payment-gateway');
  assert.strictEqual(scanned[0].title, 'Stripe webhook signature verification');
  assert.strictEqual(scanned[0].messages, 2);
  assert.strictEqual(scanned[0].credits, 2);

  fs.rmSync(tmpRoot, { recursive: true, force: true });

  // 6. Test Multi-Month History & Month-over-Month Comparison
  const septSessions: SessionRecord[] = [
    {
      sessionId: 'sep-1',
      title: 'September Auth Overhaul',
      workspaceName: 'repo-alpha',
      dateStr: '2026-09-10',
      startTime: new Date(2026, 8, 10, 10, 0).getTime(),
      endTime: new Date(2026, 8, 10, 11, 0).getTime(),
      durationMinutes: 60,
      messages: 20,
      credits: 100,
      estimatedTokens: 20000,
      cumulativeContextTokens: 90000,
      modelsUsed: { 'claude-opus-4': { messages: 10, credits: 100 } },
      primaryModel: 'claude-opus-4',
      dailyLimitPercent: 0,
      expenseTier: 'normal',
      hasContextBloat: true,
      post20TurnCredits: 0
    }
  ];

  const historyComp = computeHistoryComparison(
    config,
    now,
    2026,
    9, // October 2026
    {
      '2026-10': sessions,
      '2026-09': septSessions
    },
    undefined,
    6
  );

  assert.strictEqual(historyComp.selectedMonthKey, '2026-10');
  assert.strictEqual(historyComp.previousMonthKey, '2026-09');
  assert.strictEqual(historyComp.monthsHistory.length, 6, 'Should return 6 months of history');
  assert.strictEqual(historyComp.previousSnapshot.totalUsedCredits, 100, 'Previous month (Sept) used 100 credits');
  assert.strictEqual(
    historyComp.momSameDayDeltaCredits,
    43.2,
    'Through Day 15: Oct used 143.2 vs Sept 100 -> +43.2 delta'
  );

  console.log('✅ All Copilot Credit & Session Analytics tests passed!');
}

runTests();

