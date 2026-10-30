import * as fs from 'fs';
import * as os from 'os';
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
  colorStatusBarBackground: boolean;
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

export interface MonthlyArchiveEntry {
  entitlement: number;
  used: number;
  updatedAt: string;
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
  dateStr: string; // Primary active date (YYYY-MM-DD) within the month
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
  turns?: ChatTurnRecord[];
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

export interface StatusColorSpec {
  tier: ColorTier;
  bgHex: string;
  hoverBgHex: string;
  fgHex: string;     // High-contrast white or dark text for the status bar widget
  accentHex: string; // Bright chart/dashboard color
  emoji: string;
  label: string;
}

export interface AnalyticsSnapshot {
  generatedAt: string;
  calendar: WorkdayCalendarInfo;
  apiQuota?: ApiQuotaInfo;
  minedSessionsCount: number;
  minedWorkspacesCount: number;
  // Monthly Budget
  baseMonthlyCredits: number;
  extraCredits: number;
  totalMonthlyCredits: number;
  totalUsedCredits: number;
  localMinedCredits: number;
  remainingMonthlyCredits: number;
  monthlyUsedPercent: number;
  // Daily Budget, Surplus (Extra) & Debt
  recommendedDailyLimit: number; // (Base + Extra) / Total Workdays
  baseDailyLimit: number;        // Base / Total Workdays
  effectiveDailyLimit: number;   // Adjusted for extra credits & prior debt across remaining workdays
  recommendedDailyLimit: number;
  baseDailyLimit: number;
  effectiveDailyLimit: number;
  expectedUsedBeforeToday: number;
  usedBeforeToday: number;
  netBalance: number;            // Positive = Extra/Rollover banked, Negative = Debt
  rolloverExtraCredits: number;  // Surplus from prior days + extraCredits
  creditDebt: number;            // Overspend from prior days
  netBalance: number;
  rolloverExtraCredits: number;
  creditDebt: number;
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
  widgetBgHex: string;
  widgetHoverBgHex: string;
  widgetFgHex: string;
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
  endBalance: number;
  totalSessions: number;
  expensive40to60: number;
  expensiveOver60: number;
  totalExpensiveChats: number;
  topModel: string;
  dailyCumulative: number[]; // index 0..30 for day 1..31
  dailyCredits: number[];    // index 0..30 for day 1..31
  dailyCumulative: number[];
  dailyCredits: number[];
}

export interface HistoryComparison {
  selectedMonthKey: string;
  selectedSnapshot: AnalyticsSnapshot;
  previousMonthKey: string;
  previousMonthLabel: string;
  previousSnapshot: AnalyticsSnapshot;
  monthsHistory: MonthHistorySummary[]; // last 6 months chronological
  // Month-over-Month (MoM) Deltas (Selected vs Previous Month)
  monthsHistory: MonthHistorySummary[];
  sameDaySelectedCredits: number;
  sameDayPreviousCredits: number;
  momSameDayDeltaCredits: number;
  momSameDayDeltaPercent: number;
  momWorkdayAvgDeltaCredits: number;
  momWorkdayAvgDeltaPercent: number;
  momExpensiveChatsDelta: number;
}

export const DEFAULT_MODEL_MULTIPLIERS: Record<string, number> = {
  'claude-opus-4.6-fast': 9,
  'claude-opus-4.6': 3,
  'claude-opus-4.5': 3,
  'claude-opus-4.1': 10,
  'claude-opus-4': 10,
  'claude-sonnet-4.6': 1,
  'claude-sonnet-4.5': 1,
  'claude-sonnet-4': 1,
  'claude-haiku-4.5': 0.33,
  'claude-3.7-sonnet-thought': 1.25,
  'claude-3.7-sonnet-thinking': 1.25,
  'claude-3.7-sonnet': 1,
  'claude-3.5-sonnet': 1,
  'claude-sonnet-4': 1,
  'claude-3.5-haiku': 0.33,
  'gemini-3-pro': 1,
  'gemini-3-flash': 0.33,
  'gemini-2.5-pro': 1,
  'gemini-2.5-flash': 0.33,
  'gemini-2.0-flash': 0.25,
  'o1-preview': 10,
  'o1-mini': 3,
  'o1': 10,
  'o3-pro': 10,
  'o3-mini': 0.33,
  'o3': 1,
  'o4-mini': 0.33,
  'gpt-4.5': 50,
  'gpt-4.1-mini': 0,
  'gpt-4.1': 0,
  'gpt-4o-mini': 0,
  'gpt-4o': 0,
  'gpt-5-mini': 0,
  'gpt-5': 1
  'gpt-5-codex': 1,
  'gpt-5.2': 1,
  'gpt-5.1': 1,
  'gpt-5': 1,
  'grok-code-fast': 0.25
};

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const MONTH_SHORT_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getColorInfo(percent: number, monthlyExhausted = false): { tier: ColorTier; hex: string; emoji: string; label: string } {
  export function formatMonthKey(year: number, month: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  }

  export function getMonthShortLabel(year: number, month: number): string {
    return `${MONTH_SHORT_NAMES[month] || 'Mon'} ${year}`;
  }

  /**
   * Returns full color specification for both charts and the bottom-right VS Code Status Bar widget
   * (solid background fill + high-contrast white or dark text).
   */
  export function getColorInfo(percent: number, monthlyExhausted = false): StatusColorSpec {
    if (monthlyExhausted || percent >= 100) {
      return { tier: 'red', hex: '#ef4444', emoji: '🔴', label: 'Over Limit' };
      return {
        tier: 'red',
        bgHex: '#dc2626',
        hoverBgHex: '#b91c1c',
        fgHex: '#ffffff', // White text on crimson red
        accentHex: '#ef4444',
        emoji: '🔴',
        label: 'Over Limit'
      };
    }
    if (percent >= 85) {
      return { tier: 'orange', hex: '#f97316', emoji: '🟠', label: 'Near Limit' };
      return {
        tier: 'orange',
        bgHex: '#f97316',
        hoverBgHex: '#ea580c',
        fgHex: '#111827', // Dark text on vibrant orange
        accentHex: '#f97316',
        emoji: '🟠',
        label: 'Near Limit'
      };
    }
    if (percent >= 60) {
      return { tier: 'yellow', hex: '#eab308', emoji: '🟡', label: 'Moderate' };
      return {
        tier: 'yellow',
        bgHex: '#facc15',
        hoverBgHex: '#eab308',
        fgHex: '#111827', // Dark text on bright yellow
        accentHex: '#eab308',
        emoji: '🟡',
        label: 'Moderate'
      };
    }
    return { tier: 'green', hex: '#22c55e', emoji: '🟢', label: 'Healthy' };
    return {
      tier: 'green',
      bgHex: '#16a34a',
      hoverBgHex: '#15803d',
      fgHex: '#ffffff', // White text on emerald green
      accentHex: '#22c55e',
      emoji: '🟢',
      label: 'Healthy'
    };
  }

  export function normalizeModelName(rawModel?: string): string {
    if (!rawModel || typeof rawModel !== 'string') {
      return 'claude-sonnet-4';
    }
    const cleaned = rawModel
      .trim()
      .replace(/^(copilot\/|copilot-|github\/|models\/|anthropic\/|openai\/|google\/|azure\/)/i, '')
      .replace(/\(preview\)/gi, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
    return cleaned || 'claude-sonnet-4';
  }

  export function resolveModelMultiplier(modelName: string, customMap?: Record<string, number>): number {
    const clean = (modelName || 'copilot-chat').toLowerCase().trim();
    const map = { ...DEFAULT_MODEL_MULTIPLIERS, ...(customMap || {}) };
    // Sort keys by length descending so specific substrings ('claude-3.7-sonnet-thought') match before generic ('claude-3.7-sonnet')
    const clean = normalizeModelName(modelName);
    const map: Record<string, number> = { ...DEFAULT_MODEL_MULTIPLIERS };
    if (customMap) {
      for (const [k, v] of Object.entries(customMap)) {
        map[normalizeModelName(k)] = v;
      }
    }
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
   * Note: GitHub's personal Copilot API returns ONLY aggregate monthly entitlement & used count (no daily/model/session breakdown).
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
            'User-Agent': 'VSCode-Copilot-Credit-Analytics/0.3',
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
   * Discovers candidate VS Code User directories so local chat sessions are mined whether running
   * in standard VS Code, VS Code Insiders, or an Extension Development Host.
   */
  export function getCandidateVSCodeUserDirs(primaryUserDir?: string): string[] {
    const dirs = new Set<string>();
    if (primaryUserDir && fs.existsSync(primaryUserDir)) {
      dirs.add(primaryUserDir);
    }

    const home = os.homedir();
    const platform = process.platform;
    const standardRoots: string[] = [];

    if (platform === 'darwin') {
      standardRoots.push(
        path.join(home, 'Library', 'Application Support', 'Code', 'User'),
        path.join(home, 'Library', 'Application Support', 'Code - Insiders', 'User')
      );
    } else if (platform === 'win32' && process.env.APPDATA) {
      standardRoots.push(
        path.join(process.env.APPDATA, 'Code', 'User'),
        path.join(process.env.APPDATA, 'Code - Insiders', 'User')
      );
    } else {
      standardRoots.push(
        path.join(home, '.config', 'Code', 'User'),
        path.join(home, '.config', 'Code - Insiders', 'User')
      );
    }

    for (const r of standardRoots) {
      if (fs.existsSync(r)) {
        dirs.add(r);
      }
    }

    return Array.from(dirs);
  }

  function readWorkspaceName(hashDir: string): string {
    const wsJsonPath = path.join(hashDir, 'workspace.json');
    try {
      if (fs.existsSync(wsJsonPath)) {
        const content = JSON.parse(fs.readFileSync(wsJsonPath, 'utf8'));
        const uriStr: string = content.folder || content.workspace || '';
        if (uriStr) {
          const decoded = decodeURIComponent(uriStr.replace(/^file:\/\//, ''));
          return path.basename(decoded) || 'Workspace';
          return path.basename(decoded).replace(/\.code-workspace$/i, '') || 'Workspace';
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
      // --- VS Code .jsonl Object Mutation Log Replay Helpers (kind: 0, 1, 2, 3) ---

      function getByPath(root: any, keys: (string | number)[]): any {
        let curr = root;
        for (const k of keys) {
          if (curr === null || curr === undefined) {
            return undefined;
          }
          curr = curr[k];
        }
        return curr;
      }

      const monthStartMs = new Date(year, month, 1, 0, 0, 0).getTime();
      const monthEndMs = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
      const sessions: SessionRecord[] = [];
      function setByPath(root: any, keys: (string | number)[], value: any): void {
        if (!root || keys.length === 0) {
          return;
        }
        let curr = root;
        for (let i = 0; i < keys.length - 1; i++) {
          const k = keys[i];
          if (curr[k] === null || curr[k] === undefined || typeof curr[k] !== 'object') {
            curr[k] = typeof keys[i + 1] === 'number' ? [] : {};
          }
          curr = curr[k];
        }
        curr[keys[keys.length - 1]] = value;
      }

      let hashDirs: string[] = [];
      try {
        hashDirs = fs.readdirSync(workspaceStorageRoot).map(name => path.join(workspaceStorageRoot, name));
      } catch {
        return [];
        function deleteByPath(root: any, keys: (string | number)[]): void {
          if (!root || keys.length === 0) {
            return;
          }
          const parent = getByPath(root, keys.slice(0, -1));
          if (parent && typeof parent === 'object') {
            const last = keys[keys.length - 1];
            if (Array.isArray(parent) && typeof last === 'number') {
              parent.splice(last, 1);
            } else {
              delete parent[last];
            }
          }
        }

        for (const hashDir of hashDirs) {
          const chatSessionsDir = path.join(hashDir, 'chatSessions');
          if (!fs.existsSync(chatSessionsDir)) {
            /**
             * Replays VS Code's objectMutationLog (.jsonl) format:
             * - kind 0: initial full state snapshot under `v`
             * - kind 1: set property at key-path `k` to `v`
             * - kind 2: splice/truncate-and-append array at key-path `k` from index `i` with items `v`
             * - kind 3: delete property at key-path `k`
             * Also supports legacy flat JSONL lines containing `requests` or single prompt objects.
             */
            export function replayJsonlMutationLog(rawContent: string): any {
              const lines = rawContent.split(/\r?\n/);
              let state: any = undefined;
              const looseRequests: any[] = [];

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) {
                  continue;
                }

                let files: string[] = [];
                let obj: any;
                try {
                  files = fs.readdirSync(chatSessionsDir).filter(f => f.endsWith('.json') || f.endsWith('.jsonl'));
                  obj = JSON.parse(trimmed);
                } catch {
                  continue;
                }

                if (files.length === 0) {
                  continue;
                  if (typeof obj.kind === 'number') {
                    if (obj.kind === 0 && obj.v && typeof obj.v === 'object') {
                      state = obj.v;
                    } else if (obj.kind === 1 && state && Array.isArray(obj.k) && obj.k.length > 0) {
                      setByPath(state, obj.k, obj.v);
                    } else if (obj.kind === 2 && state) {
                      const hasPath = Array.isArray(obj.k) && obj.k.length > 0;
                      let target = hasPath ? getByPath(state, obj.k) : state;
                      if (!Array.isArray(target) && hasPath) {
                        target = [];
                        setByPath(state, obj.k, target);
                      }
                      if (Array.isArray(target)) {
                        const items = Array.isArray(obj.v) ? obj.v : (obj.v !== undefined ? [obj.v] : []);
                        if (typeof obj.i === 'number' && obj.i >= 0) {
                          target.splice(obj.i, Math.max(0, target.length - obj.i), ...items);
                        } else {
                          target.push(...items);
                        }
                      }
                    } else if (obj.kind === 3 && state && Array.isArray(obj.k) && obj.k.length > 0) {
                      deleteByPath(state, obj.k);
                    }
                  } else if (Array.isArray(obj.requests)) {
                    state = obj;
                  } else if (obj.requestId || obj.message || obj.prompt) {
                    looseRequests.push(obj);
                  }
                }

                const workspaceName = readWorkspaceName(hashDir);
                if (!state && looseRequests.length > 0) {
                  return { requests: looseRequests };
                }
                return state;
              }

              for (const file of files) {
                const fullPath = path.join(chatSessionsDir, file);
                let stat: fs.Stats;
                try {
                  stat = fs.statSync(fullPath);
                } catch {
                  continue;
                }
                function extractTextLength(node: any, depth = 0): number {
                  if (!node || depth > 4) {
                    return 0;
                  }
                  if (typeof node === 'string') {
                    return node.length;
                  }
                  if (Array.isArray(node)) {
                    let sum = 0;
                    for (const item of node) {
                      sum += extractTextLength(item, depth + 1);
                    }
                    return sum;
                  }
                  if (typeof node === 'object') {
                    let sum = 0;
                    if (typeof node.value === 'string') {
                      sum += node.value.length;
                    } else if (node.value) {
                      sum += extractTextLength(node.value, depth + 1);
                    }
                    if (typeof node.text === 'string') {
                      sum += node.text.length;
                    }
                    if (node.content) {
                      sum += extractTextLength(node.content, depth + 1);
                    }
                    return sum;
                  }
                  return 0;
                }

                // Skip files not modified since the start of the target month
                if (stat.mtimeMs < monthStartMs) {
                  continue;
                }
                function extractModelAndMultiplier(
                  req: any,
                  sessionState: any,
                  customMultipliers: Record<string, number>
                ): { model: string; multiplier: number } {
                  let explicitMultiplier: number | undefined;
                  let modelCandidate = '';

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
                  const detailsStr = typeof req?.result?.details === 'string' ? req.result.details.trim() : '';
                  if (detailsStr) {
                    // Parse Copilot Chat footer strings like "Claude Sonnet 4 • 1x" or "GPT-4.1 • 0x"
                    const multMatch = detailsStr.match(/(?:[•·|-]|\()\s*(\d+(?:\.\d+)?)\s*x\b/i);
                    if (multMatch) {
                      explicitMultiplier = parseFloat(multMatch[1]);
                    }
                    const modelPart = detailsStr
                      .replace(/(?:[•·|-]|\()?\s*\d+(?:\.\d+)?\s*x\)?.*$/i, '')
                      .trim();
                    if (modelPart) {
                      modelCandidate = normalizeModelName(modelPart);
                    }
                  }

                  return sessions;
                  if (!modelCandidate) {
                    const rawId =
                      req?.result?.metadata?.modelId ||
                      req?.result?.metadata?.model ||
                      req?.modelId ||
                      req?.selectedModel?.metadata?.id ||
                      req?.selectedModel?.metadata?.name ||
                      req?.selectedModel?.identifier ||
                      sessionState?.inputState?.selectedModel?.metadata?.id ||
                      sessionState?.inputState?.selectedModel?.metadata?.name ||
                      sessionState?.inputState?.selectedModel?.identifier ||
                      sessionState?.selectedModel?.metadata?.id ||
                      sessionState?.selectedModel?.identifier ||
                      '';
                    modelCandidate = normalizeModelName(rawId);
                  }

                  // Allow user overrides in copilotAnalytics.modelMultipliers to take priority if explicitly configured
                  const cleanUserOverrides: Record<string, number> = {};
                  for (const [k, v] of Object.entries(customMultipliers || {})) {
                    cleanUserOverrides[normalizeModelName(k)] = v;
                  }
                  const hasExplicitUserOverride = Object.keys(cleanUserOverrides).some(k => modelCandidate.includes(k) && DEFAULT_MODEL_MULTIPLIERS[k] !== cleanUserOverrides[k]);

                  const multiplier =
                    !hasExplicitUserOverride && explicitMultiplier !== undefined && !isNaN(explicitMultiplier)
                      ? explicitMultiplier
                      : resolveModelMultiplier(modelCandidate, customMultipliers);

                  return { model: modelCandidate, multiplier };
                }

                function normalizeModelName(rawModel?: string): string {
                  if (!rawModel || typeof rawModel !== 'string') {
                    return 'claude-3.7-sonnet';
                    interface ParsedFullSession {
                      sessionId: string;
                      title: string;
                      workspaceName: string;
                      turns: ChatTurnRecord[];
                    }

                    function parseSessionObject(
                      state: any,
                      fallbackSessionId: string,
                      workspaceName: string,
                      fallbackMtimeMs: number,
                      multipliers: Record<string, number>
                    ): ParsedFullSession | undefined {
                      if (!state || typeof state !== 'object') {
                        return undefined;
                      }
                      return rawModel
                        .replace(/^copilot\//i, '')
                        .replace(/^github\//i, '')
                        .replace(/^models\//i, '')
                        .trim();
                      const requests: any[] = Array.isArray(state.requests) ? state.requests : [];
                      if (requests.length === 0) {
                        return undefined;
                      }

                      const sessionId: string = String(state.sessionId || fallbackSessionId);
                      let title: string = String(state.customTitle || state.computedTitle || '').trim();
                      const baseCreationMs =
                        typeof state.creationDate === 'number' && state.creationDate > 1000000000000
                          ? state.creationDate
                          : fallbackMtimeMs - requests.length * 45000;

                      const turns: ChatTurnRecord[] = [];

                      requests.forEach((req, idx) => {
                        if (!req || req.isCanceled) {
                          return;
                        }

                        const promptText: string =
                          typeof req.message === 'string'
                            ? req.message
                            : (req.message?.text ||
                              (Array.isArray(req.message?.parts)
                                ? req.message.parts.map((p: any) => p?.text || '').join(' ')
                                : '') ||
                              req.prompt ||
                              '');

                        if (!title && promptText) {
                          title = promptText.replace(/\s+/g, ' ').trim();
                        }

                        const responseChars = extractTextLength(req.response);
                        const toolRoundChars = Array.isArray(req.result?.metadata?.toolCallRounds)
                          ? extractTextLength(req.result.metadata.toolCallRounds)
                          : 0;

                        const { model, multiplier } = extractModelAndMultiplier(req, state, multipliers);

                        const ts =
                          typeof req.timestamp === 'number' && req.timestamp > 1000000000000
                            ? req.timestamp
                            : (typeof req.requestDate === 'number' && req.requestDate > 1000000000000
                              ? req.requestDate
                              : baseCreationMs + idx * 45000);

                        const dt = new Date(ts);
                        const usageMeta = req.result?.metadata?.usage || req.usage;
                        const exactTokens =
                          typeof usageMeta?.totalTokens === 'number'
                            ? usageMeta.totalTokens
                            : (typeof usageMeta?.promptTokens === 'number' || typeof usageMeta?.completionTokens === 'number'
                              ? (usageMeta.promptTokens || 0) + (usageMeta.completionTokens || 0)
                              : 0);

                        const estimatedTokens =
                          exactTokens > 0
                            ? exactTokens
                            : Math.max(60, Math.ceil((promptText.length + responseChars + toolRoundChars) / 4));

                        turns.push({
                          timestamp: ts,
                          dateStr: formatDateYMD(dt),
                          hour: dt.getHours(),
                          model,
                          multiplier,
                          credits: multiplier,
                          promptChars: promptText.length,
                          responseChars: responseChars + toolRoundChars,
                          estimatedTokens,
                          promptPreview: promptText.slice(0, 90)
                        });
                      });

                      if (turns.length === 0) {
                        return undefined;
                      }

                      return {
                        sessionId,
                        title: (title || 'Copilot Chat Session').slice(0, 95),
                        workspaceName,
                        turns
                      };
                    }

                    function buildSessionRecordFromTurns(
function buildMonthlySessionRecord(
                      sessionId: string,
                      title: string,
                      workspaceName: string,
                      turns: ChatTurnRecord[]
  monthTurns: ChatTurnRecord[],
                      totalHistoricalTurnsBeforeMonth = 0
                    ): SessionRecord | undefined {
                      if (turns.length === 0) {
                        if (monthTurns.length === 0) {
                          return undefined;
                        }

                        turns.sort((a, b) => a.timestamp - b.timestamp);
                        const startTime = turns[0].timestamp;
                        const endTime = turns[turns.length - 1].timestamp;
                        const sorted = [...monthTurns].sort((a, b) => a.timestamp - b.timestamp);
                        const startTime = sorted[0].timestamp;
                        const endTime = sorted[sorted.length - 1].timestamp;
                        const durationMinutes = Math.max(1, Math.round((endTime - startTime) / 60000));
                        const dateStr = turns[0].dateStr;

                        let credits = 0;
                        let directTokens = 0;
                        let cumulativeContextTokens = 0;
                        let runningThreadTokens = 0;
                        let runningThreadTokens = totalHistoricalTurnsBeforeMonth * 800;
                        let post20TurnCredits = 0;
                        const modelsUsed: Record<string, { messages: number; credits: number }> = {};
                        const creditsByDay: Record<string, number> = {};

                        turns.forEach((t, idx) => {
                          sorted.forEach((t, idx) => {
                            credits += t.credits;
                            directTokens += t.estimatedTokens;
                            // Each turn in a chat session re-sends prior conversation context
                            runningThreadTokens += t.estimatedTokens;
                            cumulativeContextTokens += runningThreadTokens;

                            if (idx >= 20) {
                              const globalTurnIndex = totalHistoricalTurnsBeforeMonth + idx;
                              if (globalTurnIndex >= 20) {
                                post20TurnCredits += t.credits;
                              }

                              if (!modelsUsed[t.model]) {
                                modelsUsed[t.model] = { messages: 0, credits: 0 };
                              }
                              modelsUsed[t.model].messages += 1;
                              modelsUsed[t.model].credits = Math.round((modelsUsed[t.model].credits + t.credits) * 100) / 100;

                              creditsByDay[t.dateStr] = (creditsByDay[t.dateStr] || 0) + t.credits;
                            });

                          const primaryModel = Object.entries(modelsUsed)
                            .sort((a, b) => b[1].credits - a[1].credits || b[1].messages - a[1].messages)[0]?.[0] || 'claude-3.7-sonnet';
                          // Primary date within this month is the date with the highest credit spend (or first date if 0x model)
                          const primaryDateStr =
                            Object.entries(creditsByDay).sort((a, b) => b[1] - a[1])[0]?.[0] || sorted[0].dateStr;

                          const hasContextBloat = turns.length > 20 || cumulativeContextTokens > 60000;
                          const primaryModel =
                            Object.entries(modelsUsed).sort((a, b) => b[1].credits - a[1].credits || b[1].messages - a[1].messages)[0]?.[0] ||
                            'claude-sonnet-4';

                          const totalThreadTurns = totalHistoricalTurnsBeforeMonth + sorted.length;
                          const hasContextBloat = totalThreadTurns > 20 || cumulativeContextTokens > 60000;

                          return {
                            sessionId,
                            title: title.slice(0, 90),
                            title,
                            workspaceName,
                            dateStr,
                            dateStr: primaryDateStr,
                            startTime,
                            endTime,
                            durationMinutes,
                            messages: turns.length,
                            messages: sorted.length,
                            credits: Math.round(credits * 100) / 100,
                            estimatedTokens: directTokens,
                            cumulativeContextTokens,
                            modelsUsed,
                            primaryModel,
                            dailyLimitPercent: 0, // populated during computeAnalytics once daily limit is known
                            dailyLimitPercent: 0,
                            expenseTier: 'normal',
                            hasContextBloat,
                            post20TurnCredits: Math.round(post20TurnCredits * 100) / 100
    post20TurnCredits: Math.round(post20TurnCredits * 100) / 100,
                            turns: sorted
                          };
                        }

function parseChatSessionJson(
                          filePath: string,
                          workspaceName: string,
                          fallbackMtimeMs: number,
                          /**
                           * Collects all chat session files (.jsonl and .json) from workspaceStorage and globalStorage/emptyWindowChatSessions
                           * across one or more VS Code User directories, deduplicated by sessionId, and buckets them by YYYY-MM month key.
                           */
                          export function mineAllChatSessionsByMonth(
                            userDirs: string[],
                            earliestTimestampMs: number,
                            multipliers: Record<string, number>
                          ): SessionRecord | undefined {
                          const raw = fs.readFileSync(filePath, 'utf8');
                          const data = JSON.parse(raw);
                          const requests: any[] = Array.isArray(data?.requests) ? data.requests : [];
                          if (requests.length === 0) {
                            return undefined;
                          }
): Record < string, SessionRecord[] > {
                          const sessionFiles: { fullPath: string; workspaceName: string; mtimeMs: number } [] = [];

                        const sessionId = data.sessionId || path.basename(filePath, '.json');
                        let title: string = data.customTitle || '';
                        const turns: ChatTurnRecord[] = [];
                        for (const userDir of userDirs) {
                          if (!userDir || !fs.existsSync(userDir)) {
                            continue;
                          }

                          requests.forEach((req, idx) => {
                            const promptText: string =
                              typeof req?.message === 'string'
                                ? req.message
                                : (req?.message?.text || req?.message?.parts?.map((p: any) => p.text || '').join(' ') || '');
                            // 1. workspaceStorage/<hash>/chatSessions
                            const wsRoot = path.join(userDir, 'workspaceStorage');
                            if (fs.existsSync(wsRoot)) {
                              let hashEntries: string[] = [];
                              try {
                                hashEntries = fs.readdirSync(wsRoot);
                              } catch {
                                hashEntries = [];
                              }
                              for (const hashName of hashEntries) {
                                const hashDir = path.join(wsRoot, hashName);
                                const chatDir = path.join(hashDir, 'chatSessions');
                                if (!fs.existsSync(chatDir)) {
                                  continue;
                                }
                                let files: string[] = [];
                                try {
                                  files = fs.readdirSync(chatDir).filter(f => f.endsWith('.jsonl') || f.endsWith('.json'));
                                } catch {
                                  continue;
                                }
                                if (files.length === 0) {
                                  continue;
                                }
                                const wsName = readWorkspaceName(hashDir);
                                for (const f of files) {
                                  const fp = path.join(chatDir, f);
                                  try {
                                    const st = fs.statSync(fp);
                                    if (st.mtimeMs >= earliestTimestampMs) {
                                      sessionFiles.push({ fullPath: fp, workspaceName: wsName, mtimeMs: st.mtimeMs });
                                    }
                                  } catch {
                                    // ignore
                                  }
                                }
                              }
                            }

                            if (!title && promptText) {
                              title = promptText.replace(/\s+/g, ' ').trim();
                              // 2. globalStorage/emptyWindowChatSessions
                              const emptyChatDirs = [path.join(userDir, 'globalStorage', 'emptyWindowChatSessions')];
                              const profilesDir = path.join(userDir, 'profiles');
                              if (fs.existsSync(profilesDir)) {
                                try {
                                  for (const prof of fs.readdirSync(profilesDir)) {
                                    emptyChatDirs.push(path.join(profilesDir, prof, 'globalStorage', 'emptyWindowChatSessions'));
                                  }
                                } catch {
                                  // ignore
                                }
                              }

                              const respArray: any[] = Array.isArray(req?.response) ? req.response : [];
                              const responseText = respArray
                                .map(r => (typeof r?.value === 'string' ? r.value : (r?.content?.value || '')))
                                .join(' ');
                              for (const emptyDir of emptyChatDirs) {
                                if (!fs.existsSync(emptyDir)) {
                                  continue;
                                }
                                try {
                                  const files = fs.readdirSync(emptyDir).filter(f => f.endsWith('.jsonl') || f.endsWith('.json'));
                                  for (const f of files) {
                                    const fp = path.join(emptyDir, f);
                                    const st = fs.statSync(fp);
                                    if (st.mtimeMs >= earliestTimestampMs) {
                                      sessionFiles.push({ fullPath: fp, workspaceName: 'Empty Window', mtimeMs: st.mtimeMs });
                                    }
                                  }
                                } catch {
                                  // ignore
                                }
                              }
                            }

                            const modelRaw =
                              req?.modelId ||
                              req?.result?.metadata?.modelId ||
                              req?.selectedModel?.identifier ||
                              data?.selectedModel?.identifier ||
                              'claude-3.7-sonnet';
                            const model = normalizeModelName(modelRaw);
                            const multiplier = resolveModelMultiplier(model, multipliers);
                            // Parse and deduplicate by sessionId (prefer version with more turns / newer mtime)
                            const parsedById = new Map<string, ParsedFullSession & { mtimeMs: number }>();

                            const ts =
                              typeof req?.timestamp === 'number'
                                ? req.timestamp
                                : (typeof data?.creationDate === 'number' ? data.creationDate + idx * 45000 : fallbackMtimeMs);
                            const dt = new Date(ts);
                            const promptChars = promptText.length;
                            const responseChars = responseText.length;
                            const estimatedTokens = Math.max(50, Math.ceil((promptChars + responseChars) / 4));
                            for (const item of sessionFiles) {
                              try {
                                const raw = fs.readFileSync(item.fullPath, 'utf8');
                                const baseId = path.basename(item.fullPath).replace(/\.(jsonl|json)$/i, '');
                                const state = item.fullPath.endsWith('.jsonl')
                                  ? replayJsonlMutationLog(raw)
                                  : JSON.parse(raw);

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
                          const parsed = parseSessionObject(state, baseId, item.workspaceName, item.mtimeMs, multipliers);
                          if (!parsed || parsed.turns.length === 0) {
                            continue;
                          }

                          return buildSessionRecordFromTurns(sessionId, title || 'Copilot Chat Session', workspaceName, turns);
                        }
                        const prev = parsedById.get(parsed.sessionId);
                        if (!prev || parsed.turns.length > prev.turns.length || item.mtimeMs > prev.mtimeMs) {
                          parsedById.set(parsed.sessionId, { ...parsed, mtimeMs: item.mtimeMs });
                        }
                      } catch {
                        // Ignore unreadable or empty file
                      }
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
                      // Group turns per session into YYYY-MM buckets
                      const byMonth: Record<string, SessionRecord[]> = {};

                      lines.forEach((line, idx) => {
                        try {
                          const obj = JSON.parse(line);
                          if (obj.customTitle && !title) {
                            title = obj.customTitle;
                            for (const session of parsedById.values()) {
                              const sortedTurns = [...session.turns].sort((a, b) => a.timestamp - b.timestamp);
                              const monthTurnGroups = new Map<string, { turns: ChatTurnRecord[]; priorCount: number }>();

                              sortedTurns.forEach((turn, idx) => {
                                const mKey = turn.dateStr.slice(0, 7); // YYYY-MM
                                let grp = monthTurnGroups.get(mKey);
                                if (!grp) {
                                  grp = { turns: [], priorCount: idx };
                                  monthTurnGroups.set(mKey, grp);
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
                                    grp.turns.push(turn);
                                  });

                              for (const [mKey, grp] of monthTurnGroups.entries()) {
                                const rec = buildMonthlySessionRecord(
                                  session.sessionId,
                                  session.title,
                                  session.workspaceName,
                                  grp.turns,
                                  grp.priorCount
                                );
                                if (rec) {
                                  if (!byMonth[mKey]) {
                                    byMonth[mKey] = [];
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
                                  byMonth[mKey].push(rec);
                                }
                              } catch {
                                // skip malformed line
                              }
                            });
                    }

                    return buildSessionRecordFromTurns(sessionId, title || 'Copilot Session', workspaceName, turns);
                    return byMonth;
                  }

                  /**
                   * Convenience single-month scanner (takes a workspaceStorageRoot directory or parent User directory).
                   */
                  export function scanLocalChatSessions(
                    storagePath: string | undefined,
                    year: number,
                    month: number,
                    multipliers: Record<string, number>
                  ): SessionRecord[] {
                    if (!storagePath || !fs.existsSync(storagePath)) {
                      return [];
                    }
                    // Accept either `<User>/workspaceStorage` or `<User>`
                    const userDir = path.basename(storagePath) === 'workspaceStorage' ? path.dirname(storagePath) : storagePath;
                    const monthStartMs = new Date(year, month, 1, 0, 0, 0).getTime();
                    const byMonth = mineAllChatSessionsByMonth([userDir], monthStartMs, multipliers);
                    return byMonth[formatMonthKey(year, month)] || [];
                  }

                  /**
                   * Core pure calculation engine producing the complete AnalyticsSnapshot.
                   */
                  export function computeAnalytics(
                    config: TrackerConfig,
                    now: Date,
                    sessionsInput: SessionRecord[],
                    apiQuota?: ApiQuotaInfo
  apiQuota?: ApiQuotaInfo,
                    dailyQuotaLedger?: Record<string, number>
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
                    // Aggregate daily, hourly, model, and workspace metrics
                    const dailyMap: Record<string, {
                      credits: number;
                      messages: number;
                      sessionsCount: number;
                      sessionIds: Set<string>;
                      exp40to60: number;
                      expOver60: number;
                      topSessionTitle?: string;
                      topSessionPercent?: number;
                    }> = {};

                    for (let d = 1; d <= calendar.daysInMonth; d++) {
                      const ds = formatDateYMD(new Date(year, month, d));
                      dailyMap[ds] = { credits: 0, messages: 0, sessionsCount: 0, exp40to60: 0, expOver60: 0 };
                      dailyMap[ds] = { credits: 0, messages: 0, sessionIds: new Set(), exp40to60: 0, expOver60: 0 };
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
                        // Attribute turn-level timestamps accurately to their exact day and hour
                        if (Array.isArray(s.turns) && s.turns.length > 0) {
                          for (const t of s.turns) {
                            const bucket = dailyMap[t.dateStr];
                            if (bucket) {
                              bucket.credits += t.credits;
                              bucket.messages += 1;
                              bucket.sessionIds.add(s.sessionId);
                            }
                            if (t.hour >= 0 && t.hour < 24) {
                              hourlyCredits[t.hour] += t.credits;
                              hourlyMessages[t.hour] += 1;
                            }
                          }
                        } else {
                          const bucket = dailyMap[s.dateStr];
                          if (bucket) {
                            bucket.credits += s.credits;
                            bucket.messages += s.messages;
                            bucket.sessionIds.add(s.sessionId);
                          }
                          const hr = new Date(s.startTime).getHours();
                          if (hr >= 0 && hr < 24) {
                            hourlyCredits[hr] += s.credits;
                            hourlyMessages[hr] += s.messages;
                          }
                        }

                        // Attribute session-level expensive chat markers to the session's primary day
                        const primaryDayBucket = dailyMap[s.dateStr];
                        if (primaryDayBucket) {
                          if (s.expenseTier === 'heavy-40-60') {
                            dayBucket.exp40to60 += 1;
                            primaryDayBucket.exp40to60 += 1;
                          } else if (s.expenseTier === 'mega-60plus') {
                            dayBucket.expOver60 += 1;
                            primaryDayBucket.expOver60 += 1;
                          }
                          if (!dayBucket.topSessionPercent || s.dailyLimitPercent > dayBucket.topSessionPercent) {
                            dayBucket.topSessionPercent = s.dailyLimitPercent;
                            dayBucket.topSessionTitle = s.title;
                            if (!primaryDayBucket.topSessionPercent || s.dailyLimitPercent > primaryDayBucket.topSessionPercent) {
                              primaryDayBucket.topSessionPercent = s.dailyLimitPercent;
                              primaryDayBucket.topSessionTitle = s.title;
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
                          const ws = s.workspaceName || 'Workspace';
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
                        // Supplement daily credits from persistent daily API quota ledger if a day had non-chat external API usage
                        if (dailyQuotaLedger) {
                          const sortedDates = Object.keys(dailyQuotaLedger).sort();
                          for (let i = 1; i < sortedDates.length; i++) {
                            const ds = sortedDates[i];
                            const prevDs = sortedDates[i - 1];
                            if (ds.slice(0, 7) === prevDs.slice(0, 7) && dailyMap[ds]) {
                              const apiDelta = Math.max(0, dailyQuotaLedger[ds] - dailyQuotaLedger[prevDs]);
                              if (apiDelta > dailyMap[ds].credits) {
                                dailyMap[ds].credits = apiDelta;
                              }
                            }
                          }
                        }

                        const localMinedCredits = Math.round(sessionsTotalCredits * 100) / 100;
                        const totalUsedCredits =
                          apiQuota && apiQuota.used > sessionsTotalCredits
                        apiQuota && apiQuota.used > localMinedCredits
                          ? apiQuota.used
                          : Math.round(sessionsTotalCredits * 100) / 100;
      : localMinedCredits;

                        if (apiQuota && apiQuota.used > sessionsTotalCredits + 0.1) {
                          const unattributed = Math.round((apiQuota.used - sessionsTotalCredits) * 100) / 100;
                          modelAgg['copilot-inline-or-other'] = {
                            if(apiQuota && apiQuota.used > localMinedCredits + 0.5) {
                            const externalCredits = Math.round((apiQuota.used - localMinedCredits) * 100) / 100;
                            modelAgg['External / Non-Chat Copilot Usage'] = {
                              multiplier: 1,
                              messages: Math.ceil(unattributed),
                              credits: unattributed,
                              tokens: Math.ceil(unattributed * 1200)
      messages: Math.ceil(externalCredits),
                              credits: externalCredits,
                              tokens: 0
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
                          const todayBucket = dailyMap[todayStr];
                          const todayUsedCredits = Math.round((todayBucket?.credits || 0) * 100) / 100;
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
                              sessionsCount: bucket?.sessionIds.size || 0,
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
    .sort((a, b) => b.credits - a.credits || b.messages - a.messages);

                          // 7. Expensive Sessions Leaderboard & Counts
                          const monthExpensive40to60 = sessions.filter(s => s.expenseTier === 'heavy-40-60').length;
                          const monthExpensiveOver60 = sessions.filter(s => s.expenseTier === 'mega-60plus').length;
                          const monthTotalExpensiveChats = monthExpensive40to60 + monthExpensiveOver60;

                          const topExpensiveSessions = [...sessions]
                            .sort((a, b) => b.credits - a.credits || b.messages - a.messages)
                            .slice(0, 15);

                          const activeTodayTopSession = sessions
                            .filter(s => s.dateStr === todayStr)
                            .filter(s => s.dateStr === todayStr || s.turns?.some(t => t.dateStr === todayStr))
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
                              if (m.multiplier > 1 && m.messages > 0 && !m.model.startsWith('External')) {
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
                                  `Expensive Chats: ${monthTotalExpensiveChats} chat session(s) in ${calendar.monthName} each consumed >=${minExp}% of a full day's budget (${monthExpensive40to60} used ${minExp}-${maxExp}%, ${monthExpensiveOver60} used >${maxExp}%).`
                              );
                            }

                            if (contextBloatSessionsCount > 0) {
                              insights.push(
                                `Long Thread Tax: ${contextBloatSessionsCount} marathon session(s) (>20 turns) spent ~${contextBloatCreditsWasted.toFixed(1)} credits after turn #20. Starting a fresh chat (/new) saves context tokens and keeps sessions agile.`
                                  `Long Thread Tax: ${contextBloatSessionsCount} marathon session(s) (>20 turns) spent ~${contextBloatCreditsWasted.toFixed(1)} credits after turn #20. Starting a fresh chat (/new) saves context tokens.`
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
                              minedSessionsCount: sessions.length,
                              minedWorkspacesCount: workspaces.length,
                              baseMonthlyCredits,
                              extraCredits,
                              totalMonthlyCredits,
                              totalUsedCredits,
                              localMinedCredits,
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
                              todayMessages: todayBucket?.messages || 0,
                              todaySessions: todayBucket?.sessionIds.size || 0,
                              todayExpensive40to60: todayBucket?.exp40to60 || 0,
                              todayExpensiveOver60: todayBucket?.expOver60 || 0,
                              todayTotalExpensiveChats: (todayBucket?.exp40to60 || 0) + (todayBucket?.expOver60 || 0),
                              standardDailyPercent,
                              adjustedDailyPercent,
                              activeDailyPercent,
                              colorTier: colorInfo.tier,
                              colorHex: colorInfo.hex,
                              colorHex: colorInfo.accentHex,
                              widgetBgHex: colorInfo.bgHex,
                              widgetHoverBgHex: colorInfo.hoverBgHex,
                              widgetFgHex: colorInfo.fgHex,
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
  monthsBack = 6,
                            monthlyArchives?: Record<string, MonthlyArchiveEntry>,
                            dailyQuotaLedger?: Record<string, number>
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

                              let quotaForMonth: ApiQuotaInfo | undefined;
                              if (isCurrent) {
                                quotaForMonth = currentMonthApiQuota;
                              } else if (monthlyArchives?.[mKey]) {
                                const arch = monthlyArchives[mKey];
                                quotaForMonth = {
                                  entitlement: arch.entitlement,
                                  used: arch.used,
                                  remaining: Math.max(0, arch.entitlement - arch.used),
                                  unlimited: false,
                                  fetchedAt: arch.updatedAt
                                };
                              }

                              return computeAnalytics(config, refDate, monthSessions, quotaForMonth, dailyQuotaLedger);
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
                            selectedSnapshot.dailySeries[compareDay - 1]?.cumulativeUsed || selectedSnapshot.totalUsedCredits;
                            const sameDayPreviousCredits =
                              previousSnapshot.dailySeries[compareDay - 1]?.cumulativeUsed ?? previousSnapshot.totalUsedCredits;
                            previousSnapshot.dailySeries[compareDay - 1]?.cumulativeUsed || previousSnapshot.totalUsedCredits;

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
