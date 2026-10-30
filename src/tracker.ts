import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

export type ColorTier = 'green' | 'yellow' | 'orange' | 'red';
export type SessionExpenseTier = 'normal' | 'heavy-40-60' | 'mega-60plus';

export interface TrackerConfig {
  monthlyCredits: number;
  overrideApiEntitlement: boolean;
  extraCredits: number;
  workDays: number[];
  workHoursPerDay: number;
  holidays: string[];
  dailyPercentMode: 'adjusted' | 'standard';
  expensiveSessionMinPercent: number;
  expensiveSessionMaxPercent: number;
  modelMultipliers: Record<string, number>;
}

export interface ApiQuotaInfo {
  login?: string;
  plan?: string;
  entitlement: number;
  used: number;
  remaining: number;
  unlimited: boolean;
  resetDate?: string;
  fetchedAt: string;
}

export interface ChatTurnRecord {
  timestamp: number; // epoch ms
  dateStr: string;   // YYYY-MM-DD
  hour: number;      // 0-23
  model: string;
  multiplier: number;
  credits: number;
  promptChars: number;
  responseChars: number;
  estimatedTokens: number;
  promptPreview?: string;
}

export interface SessionRecord {
  sessionId: string;
  title: string;
  workspaceName: string;
  dateStr: string; // YYYY-MM-DD of session start/primary activity
  startTime: number;
  endTime: number;
  durationMinutes: number;
  messages: number;
  credits: number;
  estimatedTokens: number;
  cumulativeContextTokens: number;
  modelsUsed: Record<string, { messages: number; credits: number }>;
  primaryModel: string;
  dailyLimitPercent: number;
  expenseTier: SessionExpenseTier;
  hasContextBloat: boolean;
  post20TurnCredits: number;
  isManual?: boolean;
}

export interface ModelUsageSummary {
  model: string;
  multiplier: number;
  messages: number;
  credits: number;
  estimatedTokens: number;
  percentOfCredits: number;
  percentOfMessages: number;
}

export interface WorkspaceUsageSummary {
  workspaceName: string;
  sessions: number;
  expensiveChats40to60: number;
  expensiveChatsOver60: number;
  totalExpensiveChats: number;
  messages: number;
  credits: number;
  percentOfCredits: number;
}

export interface DailyUsagePoint {
  dateStr: string;
  dayOfMonth: number;
  weekdayName: string;
  isWorkday: boolean;
  isToday: boolean;
   isFuture: boolean;
  credits: number;
  messages: number;
  sessionsCount: number;
  expensiveChats40to60: number;
  expensiveChatsOver60: number;
  totalExpensiveChats: number;
  topSessionTitle?: string;
  topSessionPercent?: number;
  recommendedLimit: number;
  cumulativeUsed: number;
  cumulativeBudget: number;
  dailyPercent: number;
  colorTier: ColorTier;
}

export interface HourlyUsagePoint {
  hour: number;
  label: string;
  credits: number;
  messages: number;
}

export interface WorkdayCalendarInfo {
  year: number;
  month: number; // 0-11
  monthName: string;
  daysInMonth: number;
  currentDay: number;
  totalWorkdays: number;
  pastWorkdays: number;      // strictly before today
  elapsedWorkdays: number;   // up to and including today
  remainingWorkdays: number; // today + future workdays
  isTodayWorkday: boolean;
  workdayMap: Record<string, boolean>; // YYYY-MM-DD -> boolean
}

export interface AnalyticsSnapshot {
  generatedAt: string;
  calendar: WorkdayCalendarInfo;
  apiQuota?: ApiQuotaInfo;
  // Monthly Budget
  baseMonthlyCredits: number;
  extraCredits: number;
  totalMonthlyCredits: number;
  totalUsedCredits: number;
  remainingMonthlyCredits: number;
  monthlyUsedPercent: number;
  // Daily Budget, Surplus (Extra) & Debt
  recommendedDailyLimit: number; // (Base + Extra) / Total Workdays
  baseDailyLimit: number;        // Base / Total Workdays
  effectiveDailyLimit: number;   // Adjusted for extra credits & prior debt across remaining workdays
  expectedUsedBeforeToday: number;
  usedBeforeToday: number;
  netBalance: number;            // Positive = Extra/Rollover banked, Negative = Debt
  rolloverExtraCredits: number;  // Surplus from prior days + extraCredits
  creditDebt: number;            // Overspend from prior days
  // Today's Status
  todayUsedCredits: number;
  todayMessages: number;
  todaySessions: number;
  todayExpensive40to60: number;
  todayExpensiveOver60: number;
  todayTotalExpensiveChats: number;
  standardDailyPercent: number;
  adjustedDailyPercent: number;
  activeDailyPercent: number;
  colorTier: ColorTier;
  colorHex: string;
  statusEmoji: string;
  // Averages
  weeklyAverageCredits: number;
  weeklyAverageMessages: number;
  last7DaysCredits: number;
  workdayAverageCredits: number;
  workdayAverageMessages: number;
  workHourAverageCredits: number;
  workHourAverageMessages: number;
  activeHourAverageCredits: number;
  // Session Metrics & Expensive Chats
  totalSessions: number;
  monthExpensive40to60: number;
  monthExpensiveOver60: number;
  monthTotalExpensiveChats: number;
  avgCreditsPerSession: number;
  avgMessagesPerSession: number;
  contextBloatSessionsCount: number;
  contextBloatCreditsWasted: number;
  topExpensiveSessions: SessionRecord[];
  activeTodayTopSession?: SessionRecord;
  // Breakdowns & Series
  models: ModelUsageSummary[];
  workspaces: WorkspaceUsageSummary[];
  dailySeries: DailyUsagePoint[];
  hourlySeries: HourlyUsagePoint[];
  // Forecast & Insights
  projectedMonthlyCredits: number;
  projectedEndBalance: number;
  exhaustionDateStr: string | null;
  highMultiplierSavingsEstimate: number;
  insights: string[];
}

export interface MonthHistorySummary {
  monthKey: string; // YYYY-MM
  label: string;    // e.g. "Oct 2026"
  year: number;
  month: number;
  isCurrentMonth: boolean;
  isSelected: boolean;
  totalWorkdays: number;
  elapsedWorkdays: number;
  totalMonthlyCredits: number;
  usedCredits: number;
  usedPercent: number;
  recommendedDailyLimit: number;
  workdayAverageCredits: number;
  workHourAverageCredits: number;
  weeklyAverageCredits: number;
  endBalance: number; // +Surplus or -Debt
  totalSessions: number;
  expensive40to60: number;
  expensiveOver60: number;
  totalExpensiveChats: number;
  topModel: string;
  dailyCumulative: number[]; // index 0..30 for day 1..31
  dailyCredits: number[];    // index 0..30 for day 1..31
}

export interface HistoryComparison {
  selectedMonthKey: string;
  selectedSnapshot: AnalyticsSnapshot;
  previousMonthKey: string;
  previousMonthLabel: string;
  previousSnapshot: AnalyticsSnapshot;
  monthsHistory: MonthHistorySummary[]; // last 6 months chronological
  // Month-over-Month (MoM) Deltas (Selected vs Previous Month)
  sameDaySelectedCredits: number;
  sameDayPreviousCredits: number;
  momSameDayDeltaCredits: number;
  momSameDayDeltaPercent: number;
  momWorkdayAvgDeltaCredits: number;
  momWorkdayAvgDeltaPercent: number;
  momExpensiveChatsDelta: number;
}

export const DEFAULT_MODEL_MULTIPLIERS: Record<string, number> = {
  'claude-opus-4.5': 3,
  'claude-opus-4': 10,
  'claude-3.7-sonnet-thought': 1.25,
  'claude-3.7-sonnet-thinking': 1.25,
  'claude-3.7-sonnet': 1,
  'claude-3.5-sonnet': 1,
  'claude-sonnet-4': 1,
  'gemini-2.5-pro': 1,
  'gemini-2.0-flash': 0.25,
  'o1-preview': 10,
  'o1-mini': 3,
  'o1': 10,
  'o3-mini': 0.33,
  'o4-mini': 0.33,
  'gpt-4.5': 50,
  'gpt-4.1': 0,
  'gpt-4o-mini': 0,
  'gpt-4o': 0,
  'gpt-5-mini': 0,
  'gpt-5': 1
};

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getColorInfo(percent: number, monthlyExhausted = false): { tier: ColorTier; hex: string; emoji: string; label: string } {
  if (monthlyExhausted || percent >= 100) {
    return { tier: 'red', hex: '#ef4444', emoji: '🔴', label: 'Over Limit' };
  }
  if (percent >= 85) {
    return { tier: 'orange', hex: '#f97316', emoji: '🟠', label: 'Near Limit' };
  }
  if (percent >= 60) {
    return { tier: 'yellow', hex: '#eab308', emoji: '🟡', label: 'Moderate' };
  }
  return { tier: 'green', hex: '#22c55e', emoji: '🟢', label: 'Healthy' };
}

export function resolveModelMultiplier(modelName: string, customMap?: Record<string, number>): number {
  const clean = (modelName || 'copilot-chat').toLowerCase().trim();
  const map = { ...DEFAULT_MODEL_MULTIPLIERS, ...(customMap || {}) };
  // Sort keys by length descending so specific substrings ('claude-3.7-sonnet-thought') match before generic ('claude-3.7-sonnet')
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (clean.includes(key.toLowerCase())) {
      return map[key];
    }
  }
  return 1;
}

export function getMonthWorkdays(
  year: number,
  month: number,
  currentDay: number,
  workDays: number[] = [1, 2, 3, 4, 5],
  holidays: string[] = []
): WorkdayCalendarInfo {
  const holidaySet = new Set(holidays.map(h => h.trim()));
  const workdaySet = new Set(workDays);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let totalWorkdays = 0;
  let pastWorkdays = 0;
  let elapsedWorkdays = 0;
  let remainingWorkdays = 0;
  let isTodayWorkday = false;
  const workdayMap: Record<string, boolean> = {};

  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    const dateStr = formatDateYMD(dt);
    const dow = dt.getDay();
    const isWork = workdaySet.has(dow) && !holidaySet.has(dateStr);
    workdayMap[dateStr] = isWork;

    if (isWork) {
      totalWorkdays++;
      if (d < currentDay) {
        pastWorkdays++;
      }
      if (d <= currentDay) {
        elapsedWorkdays++;
      }
      if (d >= currentDay) {
        remainingWorkdays++;
      }
      if (d === currentDay) {
        isTodayWorkday = true;
      }
    }
  }

  return {
    year,
    month,
    monthName: MONTH_NAMES[month] || 'Month',
    daysInMonth,
    currentDay,
    totalWorkdays: Math.max(1, totalWorkdays),
    pastWorkdays,
    elapsedWorkdays: Math.max(1, elapsedWorkdays),
    remainingWorkdays: Math.max(1, remainingWorkdays),
    isTodayWorkday,
    workdayMap
  };
}

/**
 * Queries GitHub's internal Copilot user quota API using an OAuth token from VS Code's GitHub authentication provider.
 */
export function fetchCopilotInternalQuota(accessToken: string): Promise<ApiQuotaInfo | undefined> {
  return new Promise((resolve) => {
    const req = https.request(
      'https://api.github.com/copilot_internal/user',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'VSCode-Copilot-Credit-Analytics/1.0',
          'Accept': 'application/json'
        },
        timeout: 6000
      },
      (res) => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          resolve(undefined);
          return;
        }
        let body = '';
        res.on('data', chunk => (body += chunk));
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            const pi = data?.quota_snapshots?.premium_interactions || data?.quota_snapshots?.chat;
            if (!pi) {
              resolve(undefined);
              return;
            }
            const entitlement = typeof pi.entitlement === 'number' ? pi.entitlement : 300;
            const remaining = typeof pi.quota_remaining === 'number'
              ? pi.quota_remaining
              : (typeof pi.remaining === 'number' ? pi.remaining : entitlement);
            const used = typeof pi.used === 'number'
              ? pi.used
              : Math.max(0, entitlement - remaining);
            resolve({
              login: data.login,
              plan: data.copilot_plan || data.access_type_sku,
              entitlement,
              used: Math.round(used * 100) / 100,
              remaining: Math.round(remaining * 100) / 100,
              unlimited: Boolean(pi.unlimited),
              resetDate: pi.reset_date || data.quota_reset_date,
              fetchedAt: new Date().toISOString()
            });
          } catch {
            resolve(undefined);
          }
        });
      }
    );
    req.on('error', () => resolve(undefined));
    req.on('timeout', () => {
      req.destroy();
      resolve(undefined);
    });
    req.end();
  });
}

/**
 * Resolves a human-readable workspace/project name from a workspaceStorage hash directory.
 */
function readWorkspaceName(hashDir: string): string {
  const wsJsonPath = path.join(hashDir, 'workspace.json');
  try {
    if (fs.existsSync(wsJsonPath)) {
      const content = JSON.parse(fs.readFileSync(wsJsonPath, 'utf8'));
      const uriStr: string = content.folder || content.workspace || '';
      if (uriStr) {
        const decoded = decodeURIComponent(uriStr.replace(/^file:\/\//, ''));
        return path.basename(decoded) || 'Workspace';
      }
    }
  } catch {
    // ignore malformed workspace.json
  }
  return 'Workspace';
}

/**
 * Scans VS Code's local workspaceStorage directories for Copilot Chat session files (.json and .jsonl).
 */
export function scanLocalChatSessions(
  workspaceStorageRoot: string | undefined,
  year: number,
  month: number,
  multipliers: Record<string, number>
): SessionRecord[] {
  if (!workspaceStorageRoot || !fs.existsSync(workspaceStorageRoot)) {
    return [];
  }

  const monthStartMs = new Date(year, month, 1, 0, 0, 0).getTime();
  const monthEndMs = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
  const sessions: SessionRecord[] = [];

  let hashDirs: string[] = [];
  try {
    hashDirs = fs.readdirSync(workspaceStorageRoot).map(name => path.join(workspaceStorageRoot, name));
  } catch {
    return [];
  }

  for (const hashDir of hashDirs) {
    const chatSessionsDir = path.join(hashDir, 'chatSessions');
    if (!fs.existsSync(chatSessionsDir)) {
      continue;
    }

    let files: string[] = [];
    try {
      files = fs.readdirSync(chatSessionsDir).filter(f => f.endsWith('.json') || f.endsWith('.jsonl'));
    } catch {
      continue;
    }

    if (files.length === 0) {
      continue;
    }

    const workspaceName = readWorkspaceName(hashDir);

    for (const file of files) {
      const fullPath = path.join(chatSessionsDir, file);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }

      // Skip files not modified since the start of the target month
      if (stat.mtimeMs < monthStartMs) {
        continue;
      }

      try {
        const parsed = file.endsWith('.jsonl')
          ? parseChatSessionJsonl(fullPath, workspaceName, stat.mtimeMs, multipliers)
          : parseChatSessionJson(fullPath, workspaceName, stat.mtimeMs, multipliers);

        if (parsed && parsed.messages > 0 && parsed.startTime >= monthStartMs && parsed.startTime <= monthEndMs) {
          sessions.push(parsed);
        }
      } catch {
        // Ignore unreadable/partial session files
      }
    }
  }

  return sessions;
}

function normalizeModelName(rawModel?: string): string {
  if (!rawModel || typeof rawModel !== 'string') {
    return 'claude-3.7-sonnet';
  }
  return rawModel
    .replace(/^copilot\//i, '')
    .replace(/^github\//i, '')
    .replace(/^models\//i, '')
    .trim();
}

function buildSessionRecordFromTurns(
  sessionId: string,
  title: string,
  workspaceName: string,
  turns: ChatTurnRecord[]
): SessionRecord | undefined {
  if (turns.length === 0) {
    return undefined;
  }

  turns.sort((a, b) => a.timestamp - b.timestamp);
  const startTime = turns[0].timestamp;
  const endTime = turns[turns.length - 1].timestamp;
  const durationMinutes = Math.max(1, Math.round((endTime - startTime) / 60000));
  const dateStr = turns[0].dateStr;

  let credits = 0;
  let directTokens = 0;
  let cumulativeContextTokens = 0;
  let runningThreadTokens = 0;
  let post20TurnCredits = 0;
  const modelsUsed: Record<string, { messages: number; credits: number }> = {};

  turns.forEach((t, idx) => {
    credits += t.credits;
    directTokens += t.estimatedTokens;
    // Each turn in a chat session re-sends prior conversation context
    runningThreadTokens += t.estimatedTokens;
    cumulativeContextTokens += runningThreadTokens;

    if (idx >= 20) {
      post20TurnCredits += t.credits;
    }

    if (!modelsUsed[t.model]) {
      modelsUsed[t.model] = { messages: 0, credits: 0 };
    }
    modelsUsed[t.model].messages += 1;
    modelsUsed[t.model].credits = Math.round((modelsUsed[t.model].credits + t.credits) * 100) / 100;
  });

  const primaryModel = Object.entries(modelsUsed)
    .sort((a, b) => b[1].credits - a[1].credits || b[1].messages - a[1].messages)[0]?.[0] || 'claude-3.7-sonnet';

  const hasContextBloat = turns.length > 20 || cumulativeContextTokens > 60000;

  return {
    sessionId,
    title: title.slice(0, 90),
    workspaceName,
    dateStr,
    startTime,
    endTime,
    durationMinutes,
    messages: turns.length,
    credits: Math.round(credits * 100) / 100,
    estimatedTokens: directTokens,
    cumulativeContextTokens,
    modelsUsed,
    primaryModel,
    dailyLimitPercent: 0, // populated during computeAnalytics once daily limit is known
    expenseTier: 'normal',
    hasContextBloat,
    post20TurnCredits: Math.round(post20TurnCredits * 100) / 100
  };
}

function parseChatSessionJson(
  filePath: string,
  workspaceName: string,
  fallbackMtimeMs: number,
  multipliers: Record<string, number>
): SessionRecord | undefined {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  const requests: any[] = Array.isArray(data?.requests) ? data.requests : [];
  if (requests.length === 0) {
    return undefined;
  }

  const sessionId = data.sessionId || path.basename(filePath, '.json');
  let title: string = data.customTitle || '';
  const turns: ChatTurnRecord[] = [];

  requests.forEach((req, idx) => {
    const promptText: string =
      typeof req?.message === 'string'
        ? req.message
        : (req?.message?.text || req?.message?.parts?.map((p: any) => p.text || '').join(' ') || '');

    if (!title && promptText) {
      title = promptText.replace(/\s+/g, ' ').trim();
    }

    const respArray: any[] = Array.isArray(req?.response) ? req.response : [];
    const responseText = respArray
      .map(r => (typeof r?.value === 'string' ? r.value : (r?.content?.value || '')))
      .join(' ');

    const modelRaw =
      req?.modelId ||
      req?.result?.metadata?.modelId ||
      req?.selectedModel?.identifier ||
      data?.selectedModel?.identifier ||
      'claude-3.7-sonnet';
    const model = normalizeModelName(modelRaw);
    const multiplier = resolveModelMultiplier(model, multipliers);

    const ts =
      typeof req?.timestamp === 'number'
        ? req.timestamp
        : (typeof data?.creationDate === 'number' ? data.creationDate + idx * 45000 : fallbackMtimeMs);
    const dt = new Date(ts);
    const promptChars = promptText.length;
    const responseChars = responseText.length;
    const estimatedTokens = Math.max(50, Math.ceil((promptChars + responseChars) / 4));

    turns.push({
      timestamp: ts,
      dateStr: formatDateYMD(dt),
      hour: dt.getHours(),
      model,
      multiplier,
      credits: multiplier,
      promptChars,
      responseChars,
      estimatedTokens,
      promptPreview: promptText.slice(0, 80)
    });
  });

  return buildSessionRecordFromTurns(sessionId, title || 'Copilot Chat Session', workspaceName, turns);
}

function parseChatSessionJsonl(
  filePath: string,
  workspaceName: string,
  fallbackMtimeMs: number,
  multipliers: Record<string, number>
): SessionRecord | undefined {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
  const sessionId = path.basename(filePath, '.jsonl');
  let title = '';
  const turns: ChatTurnRecord[] = [];

  lines.forEach((line, idx) => {
    try {
      const obj = JSON.parse(line);
      if (obj.customTitle && !title) {
        title = obj.customTitle;
      }
      // Handle either embedded request objects or single line events
      const reqs = Array.isArray(obj.requests) ? obj.requests : (obj.message || obj.prompt ? [obj] : []);
      for (const req of reqs) {
        const promptText: string =
          typeof req?.message === 'string'
            ? req.message
            : (req?.message?.text || req?.prompt || '');
        if (!title && promptText) {
          title = promptText.replace(/\s+/g, ' ').trim();
        }
        const model = normalizeModelName(req?.modelId || req?.model || obj?.modelId || 'claude-3.7-sonnet');
        const multiplier = resolveModelMultiplier(model, multipliers);
        const ts = typeof req?.timestamp === 'number' ? req.timestamp : fallbackMtimeMs + idx * 30000;
        const dt = new Date(ts);
        const responseChars = typeof req?.response === 'string' ? req.response.length : 600;
        const estimatedTokens = Math.max(50, Math.ceil((promptText.length + responseChars) / 4));

        turns.push({
          timestamp: ts,
          dateStr: formatDateYMD(dt),
          hour: dt.getHours(),
          model,
          multiplier,
          credits: multiplier,
          promptChars: promptText.length,
          responseChars,
          estimatedTokens
        });
      }
    } catch {
      // skip malformed line
    }
  });

  return buildSessionRecordFromTurns(sessionId, title || 'Copilot Session', workspaceName, turns);
}

/**
 * Core pure calculation engine producing the complete AnalyticsSnapshot.
 */
export function computeAnalytics(
  config: TrackerConfig,
  now: Date,
  sessionsInput: SessionRecord[],
  apiQuota?: ApiQuotaInfo
): AnalyticsSnapshot {
  const year = now.getFullYear();
  const month = now.getMonth();
  const currentDay = now.getDate();
  const todayStr = formatDateYMD(now);

  const calendar = getMonthWorkdays(year, month, currentDay, config.workDays, config.holidays);

  // 1. Establish Monthly Credits
  const baseMonthlyCredits =
    !config.overrideApiEntitlement && apiQuota && apiQuota.entitlement > 0
      ? apiQuota.entitlement
      : Math.max(1, config.monthlyCredits || 300);

  const extraCredits = Math.max(0, config.extraCredits || 0);
  const totalMonthlyCredits = baseMonthlyCredits + extraCredits;

  // 2. Recommended Daily Limit (Monthly Credits / Workdays in Month)
  const baseDailyLimit = baseMonthlyCredits / calendar.totalWorkdays;
  const recommendedDailyLimit = totalMonthlyCredits / calendar.totalWorkdays;

  // 3. Classify Sessions against Recommended Daily Limit (40-60% Heavy vs >60% Mega)
  const minExp = config.expensiveSessionMinPercent ?? 40;
  const maxExp = config.expensiveSessionMaxPercent ?? 60;

  const sessions: SessionRecord[] = sessionsInput.map(s => {
    const pct = recommendedDailyLimit > 0 ? (s.credits / recommendedDailyLimit) * 100 : 0;
    let expenseTier: SessionExpenseTier = 'normal';
    if (pct > maxExp) {
      expenseTier = 'mega-60plus';
    } else if (pct >= minExp) {
      expenseTier = 'heavy-40-60';
    }
    return {
      ...s,
      dailyLimitPercent: Math.round(pct * 10) / 10,
      expenseTier
    };
  });

  // Aggregate session credits & messages per day, per hour, per model, and per workspace
  const dailyMap: Record<string, {
    credits: number;
    messages: number;
    sessionsCount: number;
    exp40to60: number;
    expOver60: number;
    topSessionTitle?: string;
    topSessionPercent?: number;
  }> = {};

  for (let d = 1; d <= calendar.daysInMonth; d++) {
    const ds = formatDateYMD(new Date(year, month, d));
    dailyMap[ds] = { credits: 0, messages: 0, sessionsCount: 0, exp40to60: 0, expOver60: 0 };
  }

  const hourlyCredits = new Array<number>(24).fill(0);
  const hourlyMessages = new Array<number>(24).fill(0);
  const modelAgg: Record<string, { multiplier: number; messages: number; credits: number; tokens: number }> = {};
  const workspaceAgg: Record<string, WorkspaceUsageSummary> = {};

  let sessionsTotalCredits = 0;
  let sessionsTotalMessages = 0;
  let contextBloatSessionsCount = 0;
  let contextBloatCreditsWasted = 0;

  for (const s of sessions) {
    sessionsTotalCredits += s.credits;
    sessionsTotalMessages += s.messages;

    if (s.hasContextBloat) {
      contextBloatSessionsCount++;
      contextBloatCreditsWasted += s.post20TurnCredits > 0 ? s.post20TurnCredits : s.credits * 0.25;
    }

    const dayBucket = dailyMap[s.dateStr];
    if (dayBucket) {
      dayBucket.credits += s.credits;
      dayBucket.messages += s.messages;
      dayBucket.sessionsCount += 1;
      if (s.expenseTier === 'heavy-40-60') {
        dayBucket.exp40to60 += 1;
      } else if (s.expenseTier === 'mega-60plus') {
        dayBucket.expOver60 += 1;
      }
      if (!dayBucket.topSessionPercent || s.dailyLimitPercent > dayBucket.topSessionPercent) {
        dayBucket.topSessionPercent = s.dailyLimitPercent;
        dayBucket.topSessionTitle = s.title;
      }
    }

    const hr = new Date(s.startTime).getHours();
    if (hr >= 0 && hr < 24) {
      hourlyCredits[hr] += s.credits;
      hourlyMessages[hr] += s.messages;
    }

    // Models inside session
    for (const [modelName, mStats] of Object.entries(s.modelsUsed)) {
      if (!modelAgg[modelName]) {
        modelAgg[modelName] = {
          multiplier: resolveModelMultiplier(modelName, config.modelMultipliers),
          messages: 0,
          credits: 0,
          tokens: 0
        };
      }
      modelAgg[modelName].messages += mStats.messages;
      modelAgg[modelName].credits += mStats.credits;
      const share = s.messages > 0 ? mStats.messages / s.messages : 1;
      modelAgg[modelName].tokens += Math.round(s.estimatedTokens * share);
    }

    // Workspace aggregation
    const ws = s.workspaceName || 'Default Workspace';
    if (!workspaceAgg[ws]) {
      workspaceAgg[ws] = {
        workspaceName: ws,
        sessions: 0,
        expensiveChats40to60: 0,
        expensiveChatsOver60: 0,
        totalExpensiveChats: 0,
        messages: 0,
        credits: 0,
        percentOfCredits: 0
      };
    }
    workspaceAgg[ws].sessions += 1;
    workspaceAgg[ws].messages += s.messages;
    workspaceAgg[ws].credits += s.credits;
    if (s.expenseTier === 'heavy-40-60') {
      workspaceAgg[ws].expensiveChats40to60 += 1;
      workspaceAgg[ws].totalExpensiveChats += 1;
    } else if (s.expenseTier === 'mega-60plus') {
      workspaceAgg[ws].expensiveChatsOver60 += 1;
      workspaceAgg[ws].totalExpensiveChats += 1;
    }
  }

  // Reconcile total used credits if GitHub API reports higher total usage than local chat files
  const totalUsedCredits =
    apiQuota && apiQuota.used > sessionsTotalCredits
      ? apiQuota.used
      : Math.round(sessionsTotalCredits * 100) / 100;

  if (apiQuota && apiQuota.used > sessionsTotalCredits + 0.1) {
    const unattributed = Math.round((apiQuota.used - sessionsTotalCredits) * 100) / 100;
    modelAgg['copilot-inline-or-other'] = {
      multiplier: 1,
      messages: Math.ceil(unattributed),
      credits: unattributed,
      tokens: Math.ceil(unattributed * 1200)
    };
  }

  const todayBucket = dailyMap[todayStr] || {
    credits: 0,
    messages: 0,
    sessionsCount: 0,
    exp40to60: 0,
    expOver60: 0
  };
  const todayUsedCredits = Math.round(todayBucket.credits * 100) / 100;
  const usedBeforeToday = Math.max(0, Math.round((totalUsedCredits - todayUsedCredits) * 100) / 100);

  // 4. Extra (Rollover Surplus) & Credit Debt Calculation
  const expectedUsedBeforeToday = Math.round(calendar.pastWorkdays * baseDailyLimit * 100) / 100;
  // Net Balance entering today = (Budget for past workdays - Actual used before today) + Extra monthly credits
  const netBalance = Math.round(((expectedUsedBeforeToday - usedBeforeToday) + extraCredits) * 100) / 100;
  const rolloverExtraCredits = Math.max(0, netBalance);
  const creditDebt = Math.max(0, -netBalance);

  // Effective daily limit spreads remaining monthly pool (including extra credits & debt) across remaining workdays
  const remainingPoolEnteringToday = Math.max(0, totalMonthlyCredits - usedBeforeToday);
  const effectiveDailyLimit = Math.round((remainingPoolEnteringToday / calendar.remainingWorkdays) * 100) / 100;

  const standardDailyPercent =
    recommendedDailyLimit > 0 ? Math.round((todayUsedCredits / recommendedDailyLimit) * 1000) / 10 : 0;
  const adjustedDailyPercent =
    effectiveDailyLimit > 0
      ? Math.round((todayUsedCredits / effectiveDailyLimit) * 1000) / 10
      : (todayUsedCredits > 0 ? 100 : 0);

  const activeDailyPercent =
    config.dailyPercentMode === 'standard' ? standardDailyPercent : adjustedDailyPercent;

  const monthlyExhausted = totalUsedCredits >= totalMonthlyCredits;
  const colorInfo = getColorInfo(activeDailyPercent, monthlyExhausted);

  // Build Daily Series across the month
  const dailySeries: DailyUsagePoint[] = [];
  let runningUsed = 0;
  let runningBudget = 0;
  let last7DaysCredits = 0;

  for (let d = 1; d <= calendar.daysInMonth; d++) {
    const dt = new Date(year, month, d);
    const ds = formatDateYMD(dt);
    const isWork = Boolean(calendar.workdayMap[ds]);
    const bucket = dailyMap[ds];
    const dayCredits = Math.round((bucket?.credits || 0) * 100) / 100;

    if (d <= currentDay) {
      runningUsed = Math.round((runningUsed + dayCredits) * 100) / 100;
    }
    if (isWork) {
      runningBudget = Math.round((runningBudget + recommendedDailyLimit) * 100) / 100;
    }

    if (d > currentDay - 7 && d <= currentDay) {
      last7DaysCredits += dayCredits;
    }

    const dayPct = recommendedDailyLimit > 0 ? Math.round((dayCredits / recommendedDailyLimit) * 1000) / 10 : 0;
    const dayColor = getColorInfo(dayPct, false);

    dailySeries.push({
      dateStr: ds,
      dayOfMonth: d,
      weekdayName: WEEKDAY_SHORT[dt.getDay()],
      isWorkday: isWork,
      isToday: d === currentDay,
      isFuture: d > currentDay,
      credits: dayCredits,
      messages: bucket?.messages || 0,
      sessionsCount: bucket?.sessionsCount || 0,
      expensiveChats40to60: bucket?.exp40to60 || 0,
      expensiveChatsOver60: bucket?.expOver60 || 0,
      totalExpensiveChats: (bucket?.exp40to60 || 0) + (bucket?.expOver60 || 0),
      topSessionTitle: bucket?.topSessionTitle,
      topSessionPercent: bucket?.topSessionPercent,
      recommendedLimit: Math.round(recommendedDailyLimit * 100) / 100,
      cumulativeUsed: d <= currentDay ? runningUsed : 0,
      cumulativeBudget: runningBudget,
      dailyPercent: dayPct,
      colorTier: dayColor.tier
    });
  }

  // Build 24-Hour Series
  const hourlySeries: HourlyUsagePoint[] = hourlyCredits.map((cr, hr) => ({
    hour: hr,
    label: `${String(hr).padStart(2, '0')}:00`,
    credits: Math.round(cr * 100) / 100,
    messages: hourlyMessages[hr]
  }));

  // 5. Averages: Weekly, Workday, Work-Hour
  const elapsedWeeks = Math.max(1, currentDay / 7);
  const weeklyAverageCredits = Math.round((totalUsedCredits / elapsedWeeks) * 100) / 100;
  const weeklyAverageMessages = Math.round((sessionsTotalMessages / elapsedWeeks) * 10) / 10;

  const workdayAverageCredits = Math.round((totalUsedCredits / calendar.elapsedWorkdays) * 100) / 100;
  const workdayAverageMessages = Math.round((sessionsTotalMessages / calendar.elapsedWorkdays) * 10) / 10;

  const workHours = Math.max(1, config.workHoursPerDay || 8);
  const workHourAverageCredits = Math.round((workdayAverageCredits / workHours) * 100) / 100;
  const workHourAverageMessages = Math.round((workdayAverageMessages / workHours) * 100) / 100;

  const activeHoursCount = Math.max(1, hourlyCredits.filter(c => c > 0).length);
  const activeHourAverageCredits = Math.round((totalUsedCredits / activeHoursCount) * 100) / 100;

  // 6. Models & Workspaces summaries
  const models: ModelUsageSummary[] = Object.entries(modelAgg)
    .map(([model, m]) => ({
      model,
      multiplier: m.multiplier,
      messages: m.messages,
      credits: Math.round(m.credits * 100) / 100,
      estimatedTokens: m.tokens,
      percentOfCredits: totalUsedCredits > 0 ? Math.round((m.credits / totalUsedCredits) * 1000) / 10 : 0,
      percentOfMessages: sessionsTotalMessages > 0 ? Math.round((m.messages / sessionsTotalMessages) * 1000) / 10 : 0
    }))
    .sort((a, b) => b.credits - a.credits || b.messages - a.messages);

  const workspaces: WorkspaceUsageSummary[] = Object.values(workspaceAgg)
    .map(w => ({
      ...w,
      credits: Math.round(w.credits * 100) / 100,
      percentOfCredits: totalUsedCredits > 0 ? Math.round((w.credits / totalUsedCredits) * 1000) / 10 : 0
    }))
    .sort((a, b) => b.credits - a.credits);

  // 7. Expensive Sessions Leaderboard & Counts
  const monthExpensive40to60 = sessions.filter(s => s.expenseTier === 'heavy-40-60').length;
  const monthExpensiveOver60 = sessions.filter(s => s.expenseTier === 'mega-60plus').length;
  const monthTotalExpensiveChats = monthExpensive40to60 + monthExpensiveOver60;

  const topExpensiveSessions = [...sessions]
    .sort((a, b) => b.credits - a.credits || b.messages - a.messages)
    .slice(0, 15);

  const activeTodayTopSession = sessions
    .filter(s => s.dateStr === todayStr)
    .sort((a, b) => b.credits - a.credits)[0];

  // 8. Forecast & Smart Insights
  const projectedMonthlyCredits = Math.round(workdayAverageCredits * calendar.totalWorkdays * 100) / 100;
  const projectedEndBalance = Math.round((totalMonthlyCredits - projectedMonthlyCredits) * 100) / 100;

  let exhaustionDateStr: string | null = null;
  if (workdayAverageCredits > 0 && projectedMonthlyCredits > totalMonthlyCredits) {
    const remainingCredits = Math.max(0, totalMonthlyCredits - totalUsedCredits);
    const workdaysUntilEmpty = Math.floor(remainingCredits / workdayAverageCredits);
    let seenWorkdays = 0;
    for (let d = currentDay; d <= calendar.daysInMonth; d++) {
      const ds = formatDateYMD(new Date(year, month, d));
      if (calendar.workdayMap[ds]) {
        if (seenWorkdays >= workdaysUntilEmpty) {
          exhaustionDateStr = ds;
          break;
        }
        seenWorkdays++;
      }
    }
  }

  // Calculate potential savings if 50% of >1x multiplier calls switched to 1x models
  let highMultiplierSavingsEstimate = 0;
  for (const m of models) {
    if (m.multiplier > 1 && m.messages > 0) {
      const savingsPerCall = m.multiplier - 1;
      highMultiplierSavingsEstimate += (m.messages * 0.5) * savingsPerCall;
    }
  }
  highMultiplierSavingsEstimate = Math.round(highMultiplierSavingsEstimate * 100) / 100;

  const insights: string[] = [];
  if (creditDebt > 0) {
    insights.push(
      `Credit Debt Alert: You are carrying ${creditDebt.toFixed(1)} credits of debt from earlier workdays. Staying under ${effectiveDailyLimit.toFixed(1)} cr/workday will bring you back on budget.`
    );
  } else if (rolloverExtraCredits > 0) {
    insights.push(
      `Surplus Banked: You have +${rolloverExtraCredits.toFixed(1)} extra credits banked (rollover + extra credits), boosting your daily allowance from ${baseDailyLimit.toFixed(1)} to ${effectiveDailyLimit.toFixed(1)} cr/workday.`
    );
  }

  if (monthTotalExpensiveChats > 0) {
    insights.push(
      `Expensive Chats: ${monthTotalExpensiveChats} chat session(s) this month each consumed >=${minExp}% of a full day's budget (${monthExpensive40to60} used ${minExp}-${maxExp}%, ${monthExpensiveOver60} used >${maxExp}%).`
    );
  }

  if (contextBloatSessionsCount > 0) {
    insights.push(
      `Long Thread Tax: ${contextBloatSessionsCount} marathon session(s) (>20 turns) spent ~${contextBloatCreditsWasted.toFixed(1)} credits after turn #20. Starting a fresh chat (/new) saves context tokens and keeps sessions agile.`
    );
  }

  if (highMultiplierSavingsEstimate >= 2) {
    insights.push(
      `Model Optimizer: Switching 50% of high-multiplier (>1x) model requests to 1x models (Claude Sonnet / Gemini Pro) or 0x models (GPT-4.1 / GPT-4o) would save ~${highMultiplierSavingsEstimate.toFixed(1)} credits/month.`
    );
  }

  if (exhaustionDateStr) {
    insights.push(
      `Burn Rate Forecast: At your current workday average (${workdayAverageCredits.toFixed(1)} cr/day), your monthly credits will run out around ${exhaustionDateStr}.`
    );
  } else {
    insights.push(
      `Burn Rate Forecast: At ${workdayAverageCredits.toFixed(1)} cr/workday, you are on track to finish ${calendar.monthName} with ~${Math.max(0, projectedEndBalance).toFixed(1)} credits to spare.`
    );
  }

  return {
    generatedAt: now.toISOString(),
    calendar,
    apiQuota,
    baseMonthlyCredits,
    extraCredits,
    totalMonthlyCredits,
    totalUsedCredits,
    remainingMonthlyCredits: Math.max(0, Math.round((totalMonthlyCredits - totalUsedCredits) * 100) / 100),
    monthlyUsedPercent: totalMonthlyCredits > 0 ? Math.round((totalUsedCredits / totalMonthlyCredits) * 1000) / 10 : 0,
    recommendedDailyLimit: Math.round(recommendedDailyLimit * 100) / 100,
    baseDailyLimit: Math.round(baseDailyLimit * 100) / 100,
    effectiveDailyLimit,
    expectedUsedBeforeToday,
    usedBeforeToday,
    netBalance,
    rolloverExtraCredits,
    creditDebt,
    todayUsedCredits,
    todayMessages: todayBucket.messages,
    todaySessions: todayBucket.sessionsCount,
    todayExpensive40to60: todayBucket.exp40to60,
    todayExpensiveOver60: todayBucket.expOver60,
    todayTotalExpensiveChats: todayBucket.exp40to60 + todayBucket.expOver60,
    standardDailyPercent,
    adjustedDailyPercent,
    activeDailyPercent,
    colorTier: colorInfo.tier,
    colorHex: colorInfo.hex,
    statusEmoji: colorInfo.emoji,
    weeklyAverageCredits,
    weeklyAverageMessages,
    last7DaysCredits: Math.round(last7DaysCredits * 100) / 100,
    workdayAverageCredits,
    workdayAverageMessages,
    workHourAverageCredits,
    workHourAverageMessages,
    activeHourAverageCredits,
    totalSessions: sessions.length,
    monthExpensive40to60,
    monthExpensiveOver60,
    monthTotalExpensiveChats,
    avgCreditsPerSession: sessions.length > 0 ? Math.round((sessionsTotalCredits / sessions.length) * 100) / 100 : 0,
    avgMessagesPerSession: sessions.length > 0 ? Math.round((sessionsTotalMessages / sessions.length) * 10) / 10 : 0,
    contextBloatSessionsCount,
    contextBloatCreditsWasted: Math.round(contextBloatCreditsWasted * 100) / 100,
    topExpensiveSessions,
    activeTodayTopSession,
    models,
    workspaces,
    dailySeries,
    hourlySeries,
    projectedMonthlyCredits,
    projectedEndBalance,
    exhaustionDateStr,
    highMultiplierSavingsEstimate,
    insights
  };
}

const MONTH_SHORT_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatMonthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function getMonthShortLabel(year: number, month: number): string {
  return `${MONTH_SHORT_NAMES[month] || 'Mon'} ${year}`;
}

/**
 * Computes multi-month history summaries (up to `monthsBack` months) and a detailed comparison
 * between the selected month (`selectedYear`, `selectedMonth`) and its immediately preceding month.
 */
export function computeHistoryComparison(
  config: TrackerConfig,
  realNow: Date,
  selectedYear: number,
  selectedMonth: number,
  sessionsByMonth: Record<string, SessionRecord[]>,
  currentMonthApiQuota?: ApiQuotaInfo,
  monthsBack = 6
): HistoryComparison {
  const realYear = realNow.getFullYear();
  const realMonth = realNow.getMonth();
  const realMonthKey = formatMonthKey(realYear, realMonth);
  const selectedMonthKey = formatMonthKey(selectedYear, selectedMonth);

  const buildSnapshotForMonth = (y: number, m: number): AnalyticsSnapshot => {
    const mKey = formatMonthKey(y, m);
    const isCurrent = mKey === realMonthKey;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    // For any historical month prior to realNow, use the last day of that month so all days/workdays are elapsed
    const refDate = isCurrent
      ? realNow
      : new Date(y, m, daysInMonth, 23, 59, 59);
    const monthSessions = sessionsByMonth[mKey] || [];
    return computeAnalytics(config, refDate, monthSessions, isCurrent ? currentMonthApiQuota : undefined);
  };

  const selectedSnapshot = buildSnapshotForMonth(selectedYear, selectedMonth);

  // Immediately preceding month relative to selected month
  const prevDate = new Date(selectedYear, selectedMonth - 1, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth();
  const previousMonthKey = formatMonthKey(prevYear, prevMonth);
  const previousMonthLabel = `${MONTH_NAMES[prevMonth]} ${prevYear}`;
  const previousSnapshot = buildSnapshotForMonth(prevYear, prevMonth);

  // Build chronological list of last N months up to realNow
  const monthsHistory: MonthHistorySummary[] = [];
  for (let offset = monthsBack - 1; offset >= 0; offset--) {
    const dt = new Date(realYear, realMonth - offset, 1);
    const y = dt.getFullYear();
    const m = dt.getMonth();
    const mKey = formatMonthKey(y, m);
    const snap =
      mKey === selectedMonthKey
        ? selectedSnapshot
        : mKey === previousMonthKey
        ? previousSnapshot
        : buildSnapshotForMonth(y, m);

    const dailyCumulative = new Array<number>(31).fill(0);
    const dailyCredits = new Array<number>(31).fill(0);
    let lastCum = 0;
    for (let d = 1; d <= 31; d++) {
      const pt = snap.dailySeries[d - 1];
      if (pt) {
        dailyCredits[d - 1] = pt.credits;
        if (!pt.isFuture) {
          lastCum = pt.cumulativeUsed;
        }
        dailyCumulative[d - 1] = pt.isFuture ? lastCum : pt.cumulativeUsed;
      } else {
        dailyCumulative[d - 1] = lastCum;
      }
    }

    const isCurr = mKey === realMonthKey;
    // End balance: for past months, totalMonthlyCredits - totalUsedCredits; for current month, netBalance
    const endBalance = isCurr
      ? snap.netBalance
      : Math.round((snap.totalMonthlyCredits - snap.totalUsedCredits) * 100) / 100;

    monthsHistory.push({
      monthKey: mKey,
      label: getMonthShortLabel(y, m),
      year: y,
      month: m,
      isCurrentMonth: isCurr,
      isSelected: mKey === selectedMonthKey,
      totalWorkdays: snap.calendar.totalWorkdays,
      elapsedWorkdays: snap.calendar.elapsedWorkdays,
      totalMonthlyCredits: snap.totalMonthlyCredits,
      usedCredits: snap.totalUsedCredits,
      usedPercent: snap.monthlyUsedPercent,
      recommendedDailyLimit: snap.recommendedDailyLimit,
      workdayAverageCredits: snap.workdayAverageCredits,
      workHourAverageCredits: snap.workHourAverageCredits,
      weeklyAverageCredits: snap.weeklyAverageCredits,
      endBalance,
      totalSessions: snap.totalSessions,
      expensive40to60: snap.monthExpensive40to60,
      expensiveOver60: snap.monthExpensiveOver60,
      totalExpensiveChats: snap.monthTotalExpensiveChats,
      topModel: snap.models[0]?.model || '-',
      dailyCumulative,
      dailyCredits
    });
  }

  // Compare Selected Month vs Previous Month at the same day-of-month point (e.g. Day 15 vs Day 15)
  const compareDay = Math.min(selectedSnapshot.calendar.currentDay, previousSnapshot.calendar.daysInMonth);
  const sameDaySelectedCredits =
    selectedSnapshot.dailySeries[compareDay - 1]?.cumulativeUsed ?? selectedSnapshot.totalUsedCredits;
  const sameDayPreviousCredits =
    previousSnapshot.dailySeries[compareDay - 1]?.cumulativeUsed ?? previousSnapshot.totalUsedCredits;

  const momSameDayDeltaCredits = Math.round((sameDaySelectedCredits - sameDayPreviousCredits) * 100) / 100;
  const momSameDayDeltaPercent =
    sameDayPreviousCredits > 0
      ? Math.round(((sameDaySelectedCredits - sameDayPreviousCredits) / sameDayPreviousCredits) * 1000) / 10
      : (sameDaySelectedCredits > 0 ? 100 : 0);

  const momWorkdayAvgDeltaCredits =
    Math.round((selectedSnapshot.workdayAverageCredits - previousSnapshot.workdayAverageCredits) * 100) / 100;
  const momWorkdayAvgDeltaPercent =
    previousSnapshot.workdayAverageCredits > 0
      ? Math.round(
          ((selectedSnapshot.workdayAverageCredits - previousSnapshot.workdayAverageCredits) /
            previousSnapshot.workdayAverageCredits) *
            1000
        ) / 10
      : 0;

  const momExpensiveChatsDelta =
    selectedSnapshot.monthTotalExpensiveChats - previousSnapshot.monthTotalExpensiveChats;

  return {
    selectedMonthKey,
    selectedSnapshot,
    previousMonthKey,
    previousMonthLabel,
    previousSnapshot,
    monthsHistory,
    sameDaySelectedCredits,
    sameDayPreviousCredits,
    momSameDayDeltaCredits,
    momSameDayDeltaPercent,
    momWorkdayAvgDeltaCredits,
    momWorkdayAvgDeltaPercent,
    momExpensiveChatsDelta
  };
}


