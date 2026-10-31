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
  chatStoragePaths?: string[];
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
  totalSessionCredits?: number;
  totalSessionMessages?: number;
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
  recommendedDailyLimit: number;
  baseDailyLimit: number;
  effectiveDailyLimit: number;
  expectedUsedBeforeToday: number;
  usedBeforeToday: number;
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
  endBalance: number;
  totalSessions: number;
  expensive40to60: number;
  expensiveOver60: number;
  totalExpensiveChats: number;
  topModel: string;
  dailyCumulative: number[];
  dailyCredits: number[];
}

export interface HistoryComparison {
  selectedMonthKey: string;
  selectedSnapshot: AnalyticsSnapshot;
  previousMonthKey: string;
  previousMonthLabel: string;
  previousSnapshot: AnalyticsSnapshot;
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
    return {
      tier: 'red',
      bgHex: '#dc2626',
      hoverBgHex: '#b91c1c',
      fgHex: '#ffffff',
      accentHex: '#ef4444',
      emoji: '🔴',
      label: 'Over Limit'
    };
  }
    if (percent >= 85) {
      return {
        tier: 'green',
        bgHex: '#16a34a',
        hoverBgHex: '#15803d',
        fgHex: '#ffffff',
        accentHex: '#22c55e',
        emoji: '🟢',
        label: 'Healthy'
      tier: 'orange',
        bgHex: '#f97316',
        hoverBgHex: '#ea580c',
        fgHex: '#111827',
        accentHex: '#f97316',
        emoji: '🟠',
        label: 'Near Limit'
      };
    }
    if (percent >= 60) {
      return {
        tier: 'yellow',
        bgHex: '#facc15',
        hoverBgHex: '#eab308',
        fgHex: '#111827',
        accentHex: '#eab308',
        emoji: '🟡',
        label: 'Moderate'
      };
    }
    return {
      tier: 'green',
      bgHex: '#16a34a',
      hoverBgHex: '#15803d',
      fgHex: '#ffffff',
      accentHex: '#22c55e',
      emoji: '🟢',
      label: 'Healthy'
    };
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
        const CREDIT_NUM_SRC = '(?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+|,\\d{1,2})?)';
        const STRIP_INLINE_CREDITS_RE = new RegExp(
          `(?:[\\s*-]+|\\s*[\\(\\[])?(?:~|<|≤)?\\s*${CREDIT_NUM_SRC}(?:\\s*(?:ai[-\\s]*)?(?:credits?|cr|x)|-(?:ai-)?credits?)\\b[\\)\\]]?.*$`,
          'i'
        );
        const EXTRACT_CREDITS_RE = new RegExp(
          `(?:~|<|≤)?\\s*(${CREDIT_NUM_SRC})(?:\\s*(?:ai[-\\s]*)?(?:credits?|cr)|-(?:ai-)?credits?)\\b`,
          'i'
        );

        export function parseNumericValue(rawNum: string): number {
          const trimmed = rawNum.replace(/[\s\u00a0]/g, '');
          if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(trimmed)) {
            return parseFloat(trimmed.replace(/,/g, ''));
          }
          if (/^\d+,\d{1,2}$/.test(trimmed)) {
            return parseFloat(trimmed.replace(',', '.'));
          }
          return parseFloat(trimmed.replace(/,/g, ''));
        }

        export function normalizeModelName(rawModel?: string): string {
          if (!rawModel || typeof rawModel !== 'string') {
            return 'claude-sonnet-4';
          }
          let s = rawModel.trim();
          const autoMatch = s.match(/^auto\s*\(([^)]+)\)/i);
          if (autoMatch) {
            s = autoMatch[1].trim();
          }
          // Keep only the model segment prior to bullet / star / pipe cost & token badges
          s = s.split(/\s*(?:[•·∙⋅|]|\s+\*\s+|\s+—\s+|\s+–\s+)\s*/)[0] || '';
          // Strip any vendor / extension prefix (e.g. copilot/..., github.copilot-chat/..., openai/...)
          s = s.replace(/^.*\//, '').replace(/^(copilot-|github-copilot-)/i, '');
          // Strip inline or hyphenated credit / multiplier / free badges (e.g. "*-0.5-credits", "- 1.7 credits", "(3x)")
          s = s
            .replace(STRIP_INLINE_CREDITS_RE, '')
            .replace(/(?:[\s*-]+|\s*[\(\[])(?:free|included)\b[\)\]]?.*$/i, '')
            .replace(/\s*[\(\[](?:preview|beta|experimental|latest|new)[\)\]]/gi, '')
            .replace(/[\s_]+/g, '-')
            .replace(/[()\[\]*•·∙⋅|]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .toLowerCase();

          // Canonicalize Claude hyphenated minor versions (e.g. claude-sonnet-4-5 -> claude-sonnet-4.5)
          s = s
            .replace(/\bclaude-(opus|sonnet|haiku)-(\d+)-(\d+)\b/g, 'claude-$1-$2.$3')
            .replace(/\bclaude-(\d+)-(\d+)-(opus|sonnet|haiku)\b/g, 'claude-$1.$2-$3');

          // Strip trailing snapshot dates and preview/latest suffixes so identical models group together
          s = s
            .replace(/-(?:preview|latest|beta|experimental)(?:-\d{2,8})*$/i, '')
            .replace(/-20\d{2}-\d{2}-\d{2}$/, '')
            .replace(/-20\d{6}$/, '')
            .replace(/^-|-$/g, '');

          return s || 'claude-sonnet-4';
        }

        export function resolveModelMultiplier(modelName: string, customMap?: Record<string, number>): number {
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

          export function resolveModelMultiplier(modelName: string, customMap?: Record<string, number>): number {
            const clean = normalizeModelName(modelName);
            const map: Record<string, number> = { ...DEFAULT_MODEL_MULTIPLIERS };
            if (customMap) {
              for (const [k, v] of Object.entries(customMap)) {
                map[normalizeModelName(k)] = v;
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
              const keys = Object.keys(map).sort((a, b) => b.length - a.length);
              for (const key of keys) {
                if (clean.includes(key.toLowerCase())) {
                  return map[key];
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
                export function getColorInfo(percent: number, monthlyExhausted = false): StatusColorSpec {
                  if (monthlyExhausted || percent >= 100) {
                    return {
                      tier: 'green',
                      bgHex: '#16a34a',
                      hoverBgHex: '#15803d',
                      fgHex: '#ffffff', // White text on emerald green
                      accentHex: '#22c55e',
                      emoji: '🟢',
                      label: 'Healthy'
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
                     * Returns full color specification for both charts and the bottom-right VS Code Status Bar widget
                     * (solid background fill + high-contrast white or dark text).
                     * Queries GitHub's internal Copilot user quota API using an OAuth token from VS Code's GitHub authentication provider.
                     */
                    export function getColorInfo(percent: number, monthlyExhausted = false): StatusColorSpec {
                      if (monthlyExhausted || percent >= 100) {
                        return {
                          tier: 'red',
                          bgHex: '#dc2626',
                          hoverBgHex: '#b91c1c',
                          fgHex: '#ffffff',
                          accentHex: '#ef4444',
                          emoji: '🔴',
                          label: 'Over Limit'
                        };
                      }
                      return 1;
                    }
                    bgHex: '#dc2626',
                      hoverBgHex: '#b91c1c',
                        fgHex: '#ffffff',
                          accentHex: '#ef4444',
                            emoji: '🔴',
                              label: 'Over Limit'
                  };
                  export function fetchCopilotInternalQuota(accessToken: string): Promise<ApiQuotaInfo | undefined> {
                    return new Promise(resolve => {
                      const req = https.request(
                        'https://api.github.com/copilot_internal/user',
                        {
                          method: 'GET',
                          headers: {
                            Authorization: `Bearer ${accessToken}`,
                            'User-Agent': 'VSCode-Copilot-Credit-Analytics/0.3.4',
                            Accept: 'application/json'
                          },
                          timeout: 6000
                        },
                        res => {
                          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                            resolve(undefined);
                            return;
                          }
                          let body = '';
                          res.on('data', chunk => (body += chunk));
                          res.on('end', () => {
                            try {
                              const data = JSON.parse(body);
                              const qs = data?.quota_snapshots;
                              const pi = qs?.premium_interactions || qs?.credits || qs?.ai_credits || qs?.chat;
                              if (!pi) {
                                resolve(undefined);
                                return;
                              }
                              if (percent >= 85) {
                                return {
                                  tier: 'orange',
                                  bgHex: '#f97316',
                                  hoverBgHex: '#ea580c',
                                  fgHex: '#111827',
                                  accentHex: '#f97316',
                                  emoji: '🟠',
                                  label: 'Near Limit'
                                };
                              }
                              if (percent >= 60) {
                                return {
                                  tier: 'yellow',
                                  bgHex: '#facc15',
                                  hoverBgHex: '#eab308',
                                  fgHex: '#111827',
                                  accentHex: '#eab308',
                                  emoji: '🟡',
                                  label: 'Moderate'
                                };
                              }
                              return {
                                tier: 'green',
                                bgHex: '#16a34a',
                                hoverBgHex: '#15803d',
                                fgHex: '#ffffff',
                                accentHex: '#22c55e',
                                emoji: '🟢',
                                label: 'Healthy'
                              };
                              const entitlement = typeof pi.entitlement === 'number' ? pi.entitlement : 300;
                              const remaining =
                                typeof pi.quota_remaining === 'number'
                                  ? pi.quota_remaining
                                  : typeof pi.remaining === 'number'
                                    ? pi.remaining
                                    : entitlement;
                              const used =
                                typeof pi.used === 'number'
                                  ? pi.used
                                  : typeof pi.credits_used === 'number'
                                    ? pi.credits_used
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
                    const CREDIT_NUM_SRC = '(?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+|,\\d{1,2})?)';
                    const STRIP_INLINE_CREDITS_RE = new RegExp(
                      `(?:[\\s*-]+|\\s*[\\(\\[])?(?:~|<|≤)?\\s*${CREDIT_NUM_SRC}(?:\\s*(?:ai[-\\s]*)?(?:credits?|cr|x)|-(?:ai-)?credits?)\\b[\\)\\]]?.*$`,
                      'i'
                    );
                    const EXTRACT_CREDITS_RE = new RegExp(
                      `(?:~|<|≤)?\\s*(${CREDIT_NUM_SRC})(?:\\s*(?:ai[-\\s]*)?(?:credits?|cr)|-(?:ai-)?credits?)\\b`,
                      'i'
                    );
                    function getWindowsMountRootsInWSL(): string[] {
                      const mounts = new Set<string>(['/mnt/c', '/c', '/mnt/d', '/d']);
                      try {
                        if (fs.existsSync('/proc/mounts')) {
                          const content = fs.readFileSync('/proc/mounts', 'utf8');
                          for (const line of content.split(/\r?\n/)) {
                            const parts = line.split(' ');
                            if (parts.length < 3) {
                              continue;
                            }
                            const mountPoint = parts[1];
                            const fsType = parts[2];
                            if (
                              (fsType === '9p' || fsType === 'drvfs') &&
                              mountPoint &&
                              !mountPoint.startsWith('/usr/') &&
                              !mountPoint.startsWith('/mnt/wsl')
                            ) {
                              mounts.add(mountPoint);
                            }
                          }
                        }
                      } catch {
                        // ignore
                      }
                      return Array.from(mounts);
                    }

                    let totalWorkdays = 0;
                    let pastWorkdays = 0;
                    let elapsedWorkdays = 0;
                    let remainingWorkdays = 0;
                    let isTodayWorkday = false;
                    const workdayMap: Record<string, boolean> = {};
                    export function parseNumericValue(rawNum: string): number {
                      const trimmed = rawNum.replace(/[\s\u00a0]/g, '');
                      if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(trimmed)) {
                        return parseFloat(trimmed.replace(/,/g, ''));
                      }
                      if (/^\d+,\d{1,2}$/.test(trimmed)) {
                        return parseFloat(trimmed.replace(',', '.'));
                      }
                      return parseFloat(trimmed.replace(/,/g, ''));
                    }
                    /**
                     * Discovers candidate VS Code User directories across macOS, Windows, Linux, AND Remote-WSL.
                     */
                    export function getCandidateVSCodeUserDirs(primaryUserDir?: string, extraPaths?: string[]): string[] {
                      const dirs = new Set<string>();
                      const home = os.homedir();
                      const normalizeCandidate = (p: string): string => {
                        const expanded = p.startsWith('~/') || p === '~' ? path.join(home, p.slice(1)) : p.trim();
                        return path.basename(expanded) === 'workspaceStorage' ? path.dirname(expanded) : expanded;
                      };

                      for (let d = 1; d <= daysInMonth; d++) {
                        const dt = new Date(year, month, d);
                        const dateStr = formatDateYMD(dt);
                        const dow = dt.getDay();
                        const isWork = workdaySet.has(dow) && !holidaySet.has(dateStr);
                        workdayMap[dateStr] = isWork;
                        export function normalizeModelName(rawModel?: string): string {
                          if (!rawModel || typeof rawModel !== 'string') {
                            return 'claude-sonnet-4';
                          }
                          let s = rawModel.trim();
                          const autoMatch = s.match(/^auto\s*\(([^)]+)\)/i);
                          if (autoMatch) {
                            s = autoMatch[1].trim();
                          }
                          // Keep only the model segment prior to bullet / star / pipe cost & token badges
                          s = s.split(/\s*(?:[•·∙⋅|]|\s+\*\s+|\s+—\s+|\s+–\s+)\s*/)[0] || '';
                          // Strip any vendor / extension prefix (e.g. copilot/..., github.copilot-chat/..., openai/...)
                          s = s.replace(/^.*\//, '').replace(/^(copilot-|github-copilot-)/i, '');
                          // Strip inline or hyphenated credit / multiplier / free badges (e.g. "*-0.5-credits", "- 1.7 credits", "(3x)")
                          s = s
                            .replace(STRIP_INLINE_CREDITS_RE, '')
                            .replace(/(?:[\s*-]+|\s*[\(\[])(?:free|included)\b[\)\]]?.*$/i, '')
                            .replace(/\s*[\(\[](?:preview|beta|experimental|latest|new)[\)\]]/gi, '')
                            .replace(/[\s_]+/g, '-')
                            .replace(/[()\[\]*•·∙⋅|]+/g, '-')
                            .replace(/-+/g, '-')
                            .replace(/^-|-$/g, '')
                            .toLowerCase();
                          if (Array.isArray(extraPaths)) {
                            for (const raw of extraPaths) {
                              if (typeof raw === 'string' && raw.trim()) {
                                const candidate = normalizeCandidate(raw);
                                if (fs.existsSync(candidate)) {
                                  dirs.add(candidate);
                                }
                              }
                            }
                          }

                          if (isWork) {
                            totalWorkdays++;
                            if (d < currentDay) {
                              pastWorkdays++;
                            }
                            if (percent >= 85) {
                              return {
                                tier: 'orange',
                                bgHex: '#f97316',
                                hoverBgHex: '#ea580c',
                                fgHex: '#111827',
                                accentHex: '#f97316',
                                emoji: '🟠',
                                label: 'Near Limit'
                              };
                              if (d <= currentDay) {
                                elapsedWorkdays++;
                              }
                              if (percent >= 60) {
                                return {
                                  tier: 'yellow',
                                  bgHex: '#facc15',
                                  hoverBgHex: '#eab308',
                                  fgHex: '#111827',
                                  accentHex: '#eab308',
                                  emoji: '🟡',
                                  label: 'Moderate'
                                };
                                if (d >= currentDay) {
                                  remainingWorkdays++;
                                }
                                return {
                                  tier: 'green',
                                  bgHex: '#16a34a',
                                  hoverBgHex: '#15803d',
                                  fgHex: '#ffffff',
                                  accentHex: '#22c55e',
                                  emoji: '🟢',
                                  label: 'Healthy'
                                };
                                if (d === currentDay) {
                                  isTodayWorkday = true;
                                }
                              }
                            }
                            // Canonicalize Claude hyphenated minor versions (e.g. claude-sonnet-4-5 -> claude-sonnet-4.5)
                            s = s
                              .replace(/\bclaude-(opus|sonnet|haiku)-(\d+)-(\d+)\b/g, 'claude-$1-$2.$3')
                              .replace(/\bclaude-(\d+)-(\d+)-(opus|sonnet|haiku)\b/g, 'claude-$1.$2-$3');
                            if (primaryUserDir) {
                              const candidate = normalizeCandidate(primaryUserDir);
                              if (fs.existsSync(candidate)) {
                                dirs.add(candidate);
                              }
                            }

                            export function normalizeModelName(rawModel?: string): string {
                              if (!rawModel || typeof rawModel !== 'string') {
                                return 'claude-sonnet-4';
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
                              // Strip trailing snapshot dates and preview/latest suffixes so identical models group together
                              s = s
                                .replace(/-(?:preview|latest|beta|experimental)(?:-\d{2,8})*$/i, '')
                                .replace(/-20\d{2}-\d{2}-\d{2}$/, '')
                                .replace(/-20\d{6}$/, '')
                                .replace(/^-|-$/g, '');

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
                                        'User-Agent': 'VSCode-Copilot-Credit-Analytics/0.3.2',
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
      const cleaned = rawModel
                                    .trim()
                                    .replace(/^(copilot\/|copilot-|github\/|models\/|anthropic\/|openai\/|google\/|azure\/)/i, '')
                                    .replace(/\(preview\)/gi, '')
                                    .replace(/\s+/g, '-')
                                    .replace(/-+/g, '-')
                                    .replace(/^-|-$/g, '')
                                    .toLowerCase();
                                  return cleaned || 'claude-sonnet-4';
                                  export function normalizeModelName(rawModel?: string): string {
                                    if (!rawModel || typeof rawModel !== 'string') {
                                      return 'claude-sonnet-4';
                                      const platform = process.platform;
                                      const standardRoots: string[] = [];
                                      if (platform === 'darwin') {
                                        standardRoots.push(
                                          path.join(home, 'Library', 'Application Support', 'Code', 'User'),
                                          path.join(home, 'Library', 'Application Support', 'Code - Insiders', 'User')
                                        );
                                        req.on('error', () => resolve(undefined));
                                        req.on('timeout', () => {
                                          req.destroy();
                                          resolve(undefined);
                                        });
                                        req.end();
                                      });
                              }
                              return s || 'claude-sonnet-4';
                            }
                          } else if (platform === 'win32' && process.env.APPDATA) {
                            standardRoots.push(
                              path.join(process.env.APPDATA, 'Code', 'User'),
                              path.join(process.env.APPDATA, 'Code - Insiders', 'User')
                            );
                          } else {
                            standardRoots.push(
                              path.join(home, '.vscode-server', 'data', 'User'),
                              path.join(home, '.vscode-server-insiders', 'data', 'User'),
                              path.join(home, '.config', 'Code', 'User'),
                              path.join(home, '.config', 'Code - Insiders', 'User')
                            );
                            const skipWinUsers = new Set(['Public', 'Default', 'Default User', 'All Users']);
                            for (const mountRoot of getWindowsMountRootsInWSL()) {
                              const usersDir = path.join(mountRoot, 'Users');
                              if (!fs.existsSync(usersDir)) {
                                continue;
                              }
                              try {
                                for (const winUser of fs.readdirSync(usersDir)) {
                                  if (skipWinUsers.has(winUser) || winUser.startsWith('.')) {
                                    continue;
                                  }
                                  standardRoots.push(
                                    path.join(usersDir, winUser, 'AppData', 'Roaming', 'Code', 'User'),
                                    path.join(usersDir, winUser, 'AppData', 'Roaming', 'Code - Insiders', 'User')
                                  );
                                }
                              } catch {
                                // ignore permission errors on system folders
                              }
                            }
                          }

                          /**
                           * Discovers Windows drive mount roots inside WSL (e.g. `/mnt/c`, `/c`, `/mnt/d`)
                           * by reading `/proc/mounts` (pure in-memory kernel pseudo-file, zero child processes)
                           * plus standard WSL mount locations.
                           */
                          function getWindowsMountRootsInWSL(): string[] {
                            const mounts = new Set<string>(['/mnt/c', '/c', '/mnt/d', '/d']);
                            try {
                              if (fs.existsSync('/proc/mounts')) {
                                const content = fs.readFileSync('/proc/mounts', 'utf8');
                                for (const line of content.split(/\r?\n/)) {
                                  const parts = line.split(' ');
                                  if (parts.length < 3) {
                                    continue;
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
                                  const mountPoint = parts[1];
                                  const fsType = parts[2];
                                  if (
                                    (fsType === '9p' || fsType === 'drvfs') &&
                                    mountPoint &&
                                    !mountPoint.startsWith('/usr/') &&
                                    !mountPoint.startsWith('/mnt/wsl')
                                  ) {
                                    mounts.add(mountPoint);
                                  }
                                }
                              }
                            } catch {
                              // ignore
                            }
                            return Array.from(mounts);
                          }
                          export function resolveModelMultiplier(modelName: string, customMap?: Record<string, number>): number {
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
                          for (const r of standardRoots) {
                            if (fs.existsSync(r)) {
                              dirs.add(r);
                            }
                          }
                          return Array.from(dirs);
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
                            export function resolveModelMultiplier(modelName: string, customMap?: Record<string, number>): number {
                              const clean = normalizeModelName(modelName);
                              const map: Record<string, number> = { ...DEFAULT_MODEL_MULTIPLIERS };
                              if (customMap) {
                                for (const [k, v] of Object.entries(customMap)) {
                                  map[normalizeModelName(k)] = v;
                                }
                                const keys = Object.keys(map).sort((a, b) => b.length - a.length);
                                for (const key of keys) {
                                  if (clean.includes(key.toLowerCase())) {
                                    return map[key];
                                  }
                                }
                                const keys = Object.keys(map).sort((a, b) => b.length - a.length);
                                for (const key of keys) {
                                  if (clean.includes(key.toLowerCase())) {
                                    return map[key];
                                  }
                                  return 1;
                                }
                                return 1;
                              }
                              /**
                               * Discovers candidate VS Code User directories across macOS, Windows, Linux, AND Remote-WSL
                               * (both WSL `~/.vscode-server/data/User` and Windows host `<mount>/Users/<WinUser>/AppData/Roaming/Code/User`).
                               */
                              export function getCandidateVSCodeUserDirs(primaryUserDir?: string, extraPaths?: string[]): string[] {
                                const dirs = new Set<string>();
                                const home = os.homedir();
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
                                  function cleanUriToPath(uriOrPath: string): string {
                                    try {
                                      return decodeURIComponent(uriOrPath)
                                        .replace(/^[a-zA-Z][a-zA-Z0-9+.-]+:(?:\/\/[^/]*)?/, '')
                                        .replace(/\\/g, '/')
                                        .replace(/\/+$/, '');
                                    } catch {
                                      return uriOrPath
                                        .replace(/^[a-zA-Z][a-zA-Z0-9+.-]+:(?:\/\/[^/]*)?/, '')
                                        .replace(/\\/g, '/')
                                        .replace(/\/+$/, '');
                                    }
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
                                      const normalizeCandidate = (p: string): string => {
                                        const expanded = p.startsWith('~/') || p === '~' ? path.join(home, p.slice(1)) : p.trim();
                                        return path.basename(expanded) === 'workspaceStorage' ? path.dirname(expanded) : expanded;
                                      };
                                      let totalWorkdays = 0;
                                      let pastWorkdays = 0;
                                      let elapsedWorkdays = 0;
                                      let remainingWorkdays = 0;
                                      let isTodayWorkday = false;
                                      const workdayMap: Record<string, boolean> = {};
                                      function extractNameFromWorkspaceConfigObject(rawConfig: string): string | undefined {
                                        try {
                                          const cfg = JSON.parse(rawConfig);
                                          if (typeof cfg?.name === 'string' && cfg.name.trim() && cfg.name.trim().toLowerCase() !== 'workspace.json') {
                                            return cfg.name.trim();
                                          }
                                          if (Array.isArray(cfg?.folders) && cfg.folders.length > 0) {
                                            const names: string[] = [];
                                            for (const f of cfg.folders) {
                                              if (typeof f?.name === 'string' && f.name.trim()) {
                                                names.push(f.name.trim());
                                                continue;
                                              }
                                              const rawTarget = typeof f?.uri === 'string' ? f.uri : typeof f?.path === 'string' ? f.path : '';
                                              if (!rawTarget || rawTarget === '.') {
                                                continue;
                                              }
                                              const seg = cleanUriToPath(rawTarget).split('/').filter(Boolean).pop();
                                              if (seg && seg.toLowerCase() !== 'workspace.json') {
                                                names.push(seg.replace(/\.code-workspace$/i, ''));
                                              }
                                            }
                                            if (names.length === 1) {
                                              return names[0];
                                            }
                                            if (names.length === 2) {
                                              return `${names[0]} + ${names[1]}`;
                                            }
                                            if (names.length > 2) {
                                              return `${names[0]} + ${names[1]} (+${names.length - 2})`;
                                            }
                                          }
                                        } catch {
                                          // ignore malformed workspace config
                                        }
                                        return undefined;
                                      }

                                      let totalWorkdays = 0;
                                      let pastWorkdays = 0;
                                      let elapsedWorkdays = 0;
                                      let remainingWorkdays = 0;
                                      let isTodayWorkday = false;
                                      const workdayMap: Record<string, boolean> = {};
                                      let totalWorkdays = 0;
                                      let pastWorkdays = 0;
                                      let elapsedWorkdays = 0;
                                      let remainingWorkdays = 0;
                                      let isTodayWorkday = false;
                                      const workdayMap: Record<string, boolean> = {};
                                      if (Array.isArray(extraPaths)) {
                                        for (const raw of extraPaths) {
                                          if (typeof raw === 'string' && raw.trim()) {
                                            const candidate = normalizeCandidate(raw);
                                            if (fs.existsSync(candidate)) {
                                              dirs.add(candidate);
                                            }
                                          }
                                        }
                                      }
                                      for (let d = 1; d <= daysInMonth; d++) {
                                        const dt = new Date(year, month, d);
                                        const dateStr = formatDateYMD(dt);
                                        const dow = dt.getDay();
                                        const isWork = workdaySet.has(dow) && !holidaySet.has(dateStr);
                                        workdayMap[dateStr] = isWork;
                                        function getCandidateWorkspaceConfigPaths(withoutScheme: string, hashDir?: string): string[] {
                                          const candidates: string[] = [];
                                          const wsMatch = withoutScheme.match(/\/Workspaces\/([^/]+)\/workspace\.json$/i);
                                          if (wsMatch && hashDir) {
                                            const userDir = path.dirname(path.dirname(hashDir));
                                            candidates.push(path.join(userDir, 'Workspaces', wsMatch[1], 'workspace.json'));
                                          }
                                          const winDriveMatch = withoutScheme.match(/^\/?([a-zA-Z]):\/(.*)$/);
                                          if (winDriveMatch) {
                                            const drive = winDriveMatch[1].toLowerCase();
                                            const rest = winDriveMatch[2];
                                            if (process.platform === 'win32') {
                                              candidates.push(`${drive}:/${rest}`);
                                            } else {
                                              candidates.push(`/mnt/${drive}/${rest}`, `/${drive}/${rest}`);
                                            }
                                          } else if (withoutScheme.startsWith('/')) {
                                            candidates.push(withoutScheme);
                                          }
                                          return candidates;
                                        }

                                        for (let d = 1; d <= daysInMonth; d++) {
                                          const dt = new Date(year, month, d);
                                          const dateStr = formatDateYMD(dt);
                                          const dow = dt.getDay();
                                          const isWork = workdaySet.has(dow) && !holidaySet.has(dateStr);
                                          workdayMap[dateStr] = isWork;
                                          for (let d = 1; d <= daysInMonth; d++) {
                                            const dt = new Date(year, month, d);
                                            const dateStr = formatDateYMD(dt);
                                            const dow = dt.getDay();
                                            const isWork = workdaySet.has(dow) && !holidaySet.has(dateStr);
                                            workdayMap[dateStr] = isWork;
                                            if (primaryUserDir) {
                                              const candidate = normalizeCandidate(primaryUserDir);
                                              if (fs.existsSync(candidate)) {
                                                dirs.add(candidate);
                                              }
                                            }
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
                                          function fallbackNameForWorkspaceJsonUri(withoutScheme: string, overrideName?: string): string {
                                            if (overrideName && overrideName.trim()) {
                                              return overrideName.trim();
                                            }
                                            const parts = withoutScheme.split('/').filter(Boolean);
                                            for (let i = parts.length - 2; i >= 0; i--) {
                                              const seg = parts[i];
                                              const lower = seg.toLowerCase();
                                              if (
                                                lower === '.vscode' ||
                                                lower === 'workspaces' ||
                                                lower === 'user' ||
                                                lower === 'code' ||
                                                /^\d+$/.test(seg) ||
                                                /^[0-9a-f]{16,}$/i.test(seg)
                                              ) {
                                                continue;
                                              }
                                              return seg.replace(/\.code-workspace$/i, '');
                                            }
                                            return 'Untitled Workspace';
                                          }

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
                                            const platform = process.platform;
                                            const standardRoots: string[] = [];
                                            function parseWorkspaceJsonContent(
                                              raw: string,
                                              hashDir?: string,
                                              readRefFileSync?: (p: string) => string | undefined,
                                              overrideName?: string
                                            ): string {
                                              try {
                                                const content = JSON.parse(raw);
                                                const wsField =
                                                  typeof content.workspace === 'string'
                                                    ? content.workspace
                                                    : typeof content.workspace?.configURIPath === 'string'
                                                      ? content.workspace.configURIPath
                                                      : '';
                                                const uriStr = content.folder || wsField || '';
                                                if (uriStr) {
                                                  const withoutScheme = cleanUriToPath(uriStr);
                                                  const base = withoutScheme.split('/').filter(Boolean).pop() || '';
                                                  if (base.toLowerCase() === 'workspace.json') {
                                                    if (readRefFileSync) {
                                                      for (const candidate of getCandidateWorkspaceConfigPaths(withoutScheme, hashDir)) {
                                                        const refRaw = readRefFileSync(candidate);
                                                        if (refRaw) {
                                                          const extracted = extractNameFromWorkspaceConfigObject(refRaw);
                                                          if (extracted) {
                                                            return extracted;
                                                          }
                                                        }
                                                      }
                                                    }
                                                    return fallbackNameForWorkspaceJsonUri(withoutScheme, overrideName);
                                                  }
                                                  if (base) {
                                                    const cleaned = base.replace(/\.code-workspace$/i, '');
                                                    if (cleaned.toLowerCase() === 'untitled' && overrideName) {
                                                      return overrideName;
                                                    }
                                                    return cleaned || overrideName || 'Workspace';
                                                  }
                                                }
                                              } catch {
                                                // ignore
                                              }
                                              return overrideName || 'Workspace';
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
                                              path.join(home, '.vscode-server', 'data', 'User'),
                                              path.join(home, '.vscode-server-insiders', 'data', 'User'),
                                              path.join(home, '.config', 'Code', 'User'),
                                              path.join(home, '.config', 'Code - Insiders', 'User')
                                            );
                                            async function parseWorkspaceJsonContentAsync(
                                              raw: string,
                                              hashDir?: string,
                                              overrideName?: string
                                            ): Promise<string> {
                                              try {
                                                const content = JSON.parse(raw);
                                                const wsField =
                                                  typeof content.workspace === 'string'
                                                    ? content.workspace
                                                    : typeof content.workspace?.configURIPath === 'string'
                                                      ? content.workspace.configURIPath
                                                      : '';
                                                const uriStr = content.folder || wsField || '';
                                                if (uriStr) {
                                                  const withoutScheme = cleanUriToPath(uriStr);
                                                  const base = withoutScheme.split('/').filter(Boolean).pop() || '';
                                                  if (base.toLowerCase() === 'workspace.json') {
                                                    for (const candidate of getCandidateWorkspaceConfigPaths(withoutScheme, hashDir)) {
                                                      try {
                                                        const refRaw = await fs.promises.readFile(candidate, 'utf8');
                                                        const extracted = extractNameFromWorkspaceConfigObject(refRaw);
                                                        if (extracted) {
                                                          return extracted;
                                                        }
                                                      } catch {
                                                        // try next candidate
                                                      }
                                                    }
                                                    return fallbackNameForWorkspaceJsonUri(withoutScheme, overrideName);
                                                  }
                                                  if (base) {
                                                    const cleaned = base.replace(/\.code-workspace$/i, '');
                                                    if (cleaned.toLowerCase() === 'untitled' && overrideName) {
                                                      return overrideName;
                                                    }
                                                    return cleaned || overrideName || 'Workspace';
                                                  }
                                                }
                                              } catch {
                                                // ignore
                                              }
                                              return overrideName || 'Workspace';
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
    // Remote-WSL bridge: VS Code's Chat UI runs in the Windows client and writes chatSessions/*.jsonl
    // to %APPDATA%\Code\User on the Windows filesystem (mounted at /mnt/c, /c, etc.).
    const skipWinUsers = new Set(['Public', 'Default', 'Default User', 'All Users']);
                                                for (const mountRoot of getWindowsMountRootsInWSL()) {
                                                  const usersDir = path.join(mountRoot, 'Users');
                                                  if (!fs.existsSync(usersDir)) {
                                                    continue;
                                                  }
                                                  try {
                                                    for (const winUser of fs.readdirSync(usersDir)) {
                                                      if (skipWinUsers.has(winUser) || winUser.startsWith('.')) {
                                                        continue;
                                                      }
                                                      standardRoots.push(
                                                        path.join(usersDir, winUser, 'AppData', 'Roaming', 'Code', 'User'),
                                                        path.join(usersDir, winUser, 'AppData', 'Roaming', 'Code - Insiders', 'User')
                                                      );
                                                    }
                                                  } catch {
                                                    // ignore permission errors on system folders
                                                  }
                                                }
                                              }
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
                                           * Extracts a clean project/repository name from workspace.json, handling single folders,
                                           * Remote-WSL / SSH URIs, .code-workspace files, and untitled multi-root workspaces (`User/Workspaces/<id>/workspace.json`).
                                           */
                                          export function readWorkspaceName(hashDir: string, overrideName?: string): string {
                                            const wsJsonPath = path.join(hashDir, 'workspace.json');
                                            try {
                                              if (fs.existsSync(wsJsonPath)) {
                                                const raw = fs.readFileSync(wsJsonPath, 'utf8');
                                                return parseWorkspaceJsonContent(
                                                  raw,
                                                  hashDir,
                                                  p => {
                                                    try {
                                                      return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : undefined;
                                                    } catch {
                                                      return undefined;
                                                    }
                                                  },
                                                  overrideName
                                                );
                                              }
                                            } catch {
                                              // ignore malformed workspace.json
                                            }
                                            return overrideName || 'Workspace';
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
                                                    'User-Agent': 'VSCode-Copilot-Credit-Analytics/0.3.1',
                                                    'Accept': 'application/json'
                                                  },
        (res) => {
                                                if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
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
                                          return new Promise(resolve => {
                                            const req = https.request(
                                              'https://api.github.com/copilot_internal/user',
                                              {
                                                method: 'GET',
                                                headers: {
                                                  Authorization: `Bearer ${accessToken}`,
                                                  'User-Agent': 'VSCode-Copilot-Credit-Analytics/0.3.3',
                                                  Accept: 'application/json'
                                                },
                                                timeout: 6000
                                              },
                                              res => {
                                                if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                                                  resolve(undefined);
                                                  return;
                                                }
                                                let body = '';
                                                res.on('data', chunk => (body += chunk));
                                                res.on('end', () => {
                                                  try {
                                                    const data = JSON.parse(body);
                                                    const qs = data?.quota_snapshots;
                                                    const pi = qs?.premium_interactions || qs?.credits || qs?.ai_credits || qs?.chat;
                                                    if (!pi) {
                                                      resolve(undefined);
                                                      return;
                                                    }
                                                    const entitlement = typeof pi.entitlement === 'number' ? pi.entitlement : 300;
                                                    const remaining =
                                                      typeof pi.quota_remaining === 'number'
                                                        ? pi.quota_remaining
                                                        : typeof pi.remaining === 'number'
                                                          ? pi.remaining
                                                          : entitlement;
                                                    const used =
                                                      typeof pi.used === 'number'
                                                        ? pi.used
                                                        : typeof pi.credits_used === 'number'
                                                          ? pi.credits_used
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
                                        for (const r of standardRoots) {
                                          if (fs.existsSync(r)) {
                                            dirs.add(r);
                                          }
                                        }
                                        req.on('error', () => resolve(undefined));
                                        req.on('timeout', () => {
                                          req.destroy();
                                          resolve(undefined);
                                        });
                                        req.end();
                                      });
                                    }
                                    function getByPath(root: any, keys: Array<string | number>): any {
                                      let curr = root;
                                      for (const k of keys) {
                                        if (curr === null || curr === undefined) {
                                          return undefined;
                                        }
                                        curr = curr[k];
                                      }
                                      return curr;
                                    }

                                    /**
                                     * Discovers candidate VS Code User directories across macOS, Windows, Linux, AND WSL
                                     * (`/mnt/c/Users/<WinUser>/AppData/Roaming/Code/User`).
                                     */
                                    export function getCandidateVSCodeUserDirs(primaryUserDir?: string): string[] {
                                      const dirs = new Set<string>();
                                      if (primaryUserDir && fs.existsSync(primaryUserDir)) {
                                        dirs.add(primaryUserDir);
                                      }
                                      return Array.from(dirs);
                                    }
                                    function getWindowsMountRootsInWSL(): string[] {
                                      const mounts = new Set<string>(['/mnt/c', '/c', '/mnt/d', '/d']);
                                      try {
                                        if (fs.existsSync('/proc/mounts')) {
                                          const content = fs.readFileSync('/proc/mounts', 'utf8');
                                          for (const line of content.split(/\r?\n/)) {
                                            const parts = line.split(' ');
                                            if (parts.length < 3) {
                                              continue;
                                            }
                                            const mountPoint = parts[1];
                                            const fsType = parts[2];
                                            if (
                                              (fsType === '9p' || fsType === 'drvfs') &&
                                              mountPoint &&
                                              !mountPoint.startsWith('/usr/') &&
                                              !mountPoint.startsWith('/mnt/wsl')
                                            ) {
                                              mounts.add(mountPoint);
                                            }
                                          }
                                        }
                                      } catch {
                                        // ignore
                                      }
                                      return Array.from(mounts);
                                    }
                                    function setByPath(root: any, keys: Array<string | number>, value: any) {
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

                                    /**
                                     * Resolves a human-readable workspace/project name from a workspaceStorage hash directory.
                                     * Discovers candidate VS Code User directories so local chat sessions are mined whether running
                                     * in standard VS Code, VS Code Insiders, or an Extension Development Host.
                                     */
                                    export function getCandidateVSCodeUserDirs(primaryUserDir?: string): string[] {
                                      const dirs = new Set<string>();
                                      if (primaryUserDir && fs.existsSync(primaryUserDir)) {
                                        dirs.add(primaryUserDir);
                                        const home = os.homedir();
                                        const platform = process.platform;
                                        const standardRoots: string[] = [];
                                        /**
                                         * Extracts a clean project/repository name from workspace.json, handling both local file:// URIs
                                         * and Remote-WSL / SSH URIs (e.g. vscode-remote://wsl+Ubuntu/home/user/my-project).
                                         */
                                        export function readWorkspaceName(hashDir: string): string {
                                          const wsJsonPath = path.join(hashDir, 'workspace.json');
                                          try {
                                            if (fs.existsSync(wsJsonPath)) {
                                              return parseWorkspaceJsonContent(fs.readFileSync(wsJsonPath, 'utf8'));
                                            }
                                          } catch {
                                            // ignore malformed workspace.json
                                          }
                                          return 'Workspace';
                                        }
                                        /**
                                         * Discovers candidate VS Code User directories across macOS, Windows, Linux, AND Remote-WSL.
                                         */
                                        export function getCandidateVSCodeUserDirs(primaryUserDir?: string, extraPaths?: string[]): string[] {
                                          const dirs = new Set<string>();
                                          const home = os.homedir();
                                          const normalizeCandidate = (p: string): string => {
                                            const expanded = p.startsWith('~/') || p === '~' ? path.join(home, p.slice(1)) : p.trim();
                                            return path.basename(expanded) === 'workspaceStorage' ? path.dirname(expanded) : expanded;
                                          };
                                          function deleteByPath(root: any, keys: Array<string | number>) {
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
                                            // WSL fallback: in Remote-WSL, Copilot Chat sessions live on the Windows host under %APPDATA%\Code\User
                                            const wslUsersDir = '/mnt/c/Users';
                                            if (fs.existsSync(wslUsersDir)) {
                                              try {
                                                for (const winUser of fs.readdirSync(wslUsersDir)) {
                                                  if (winUser === 'Public' || winUser === 'Default' || winUser === 'Default User' || winUser === 'All Users') {
                                                    continue;
                                                  }
                                                  standardRoots.push(
                                                    path.join(wslUsersDir, winUser, 'AppData', 'Roaming', 'Code', 'User'),
                                                    path.join(wslUsersDir, winUser, 'AppData', 'Roaming', 'Code - Insiders', 'User')
                                                  );
                                                }
                                              } catch {
                                                // ignore permission errors on system folders
                                              }
                                            }
                                          }
                                          function parseWorkspaceJsonContent(raw: string): string {
                                            try {
                                              const content = JSON.parse(raw);
                                              const uriStr: string = content.folder || content.workspace || '';
                                              if (uriStr) {
                                                const decoded = decodeURIComponent(uriStr);
                                                const withoutScheme = decoded
                                                  .replace(/^[a-zA-Z0-9+.-]+:\/\/[^/]*/, '')
                                                  .replace(/\\/g, '/')
                                                  .replace(/\/+$/, '');
                                                const base = withoutScheme.split('/').filter(Boolean).pop() || '';
                                                if (base) {
                                                  return base.replace(/\.code-workspace$/i, '');
                                                }
                                              }
                                            } catch {
                                              // ignore
                                            }
                                            return 'Workspace';
                                          }
                                          if (Array.isArray(extraPaths)) {
                                            for (const raw of extraPaths) {
                                              if (typeof raw === 'string' && raw.trim()) {
                                                const candidate = normalizeCandidate(raw);
                                                if (fs.existsSync(candidate)) {
                                                  dirs.add(candidate);
                                                }
                                              }
                                            }
                                          }
                                          /**
                                           * Replays VS Code's objectMutationLog (.jsonl) format (kind 0, 1, 2, 3) plus flat JSONL fallbacks.
                                           */
                                          export function replayJsonlMutationLog(rawContent: string): any {
                                            const lines = rawContent.split(/\r?\n/);
                                            let state: any = undefined;
                                            const looseRequests: any[] = [];

                                            const home = os.homedir();
                                            const platform = process.platform;
                                            const standardRoots: string[] = [];
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
                                            if (primaryUserDir) {
                                              const candidate = normalizeCandidate(primaryUserDir);
                                              if (fs.existsSync(candidate)) {
                                                dirs.add(candidate);
                                              }
                                            }
                                            for (const line of lines) {
                                              const trimmed = line.trim();
                                              if (!trimmed) {
                                                continue;
                                              }
                                              let obj: any;
                                              try {
                                                obj = JSON.parse(trimmed);
                                              } catch {
                                                continue;
                                              }

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
                                                for (const r of standardRoots) {
                                                  if (fs.existsSync(r)) {
                                                    dirs.add(r);
                                                  }
                                                }
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
                                                    path.join(home, '.vscode-server', 'data', 'User'),
                                                    path.join(home, '.vscode-server-insiders', 'data', 'User'),
                                                    path.join(home, '.config', 'Code', 'User'),
                                                    path.join(home, '.config', 'Code - Insiders', 'User')
                                                  );
                                                  const skipWinUsers = new Set(['Public', 'Default', 'Default User', 'All Users']);
                                                  for (const mountRoot of getWindowsMountRootsInWSL()) {
                                                    const usersDir = path.join(mountRoot, 'Users');
                                                    if (!fs.existsSync(usersDir)) {
                                                      continue;
                                                    }
                                                    try {
                                                      for (const winUser of fs.readdirSync(usersDir)) {
                                                        if (skipWinUsers.has(winUser) || winUser.startsWith('.')) {
                                                          continue;
                                                        }
                                                        standardRoots.push(
                                                          path.join(usersDir, winUser, 'AppData', 'Roaming', 'Code', 'User'),
                                                          path.join(usersDir, winUser, 'AppData', 'Roaming', 'Code - Insiders', 'User')
                                                        );
                                                      }
                                                    } catch {
                                                      // ignore permission errors on system folders
                                                    }
                                                  }
                                                }
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
                                                      const items = Array.isArray(obj.v) ? obj.v : obj.v !== undefined ? [obj.v] : [];
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

                                              for (const r of standardRoots) {
                                                if (fs.existsSync(r)) {
                                                  dirs.add(r);
                                                  return Array.from(dirs);
                                                }
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
                                                for (const r of standardRoots) {
                                                  if (fs.existsSync(r)) {
                                                    dirs.add(r);
                                                  }
                                                }
                                                return Array.from(dirs);
                                              }
                                              if (!state && looseRequests.length > 0) {
                                                return { requests: looseRequests };
                                              }
                                              return state;
                                            }

                                            /**
                                             * Extracts a clean project/repository name from workspace.json, handling both local file:// URIs
                                             * and Remote-WSL / SSH URIs (e.g. vscode-remote://wsl+Ubuntu/home/user/my-project).
                                             */
                                            export function readWorkspaceName(hashDir: string): string {
                                              const wsJsonPath = path.join(hashDir, 'workspace.json');
                                              try {
                                                if (fs.existsSync(wsJsonPath)) {
                                                  const content = JSON.parse(fs.readFileSync(wsJsonPath, 'utf8'));
                                                  const uriStr: string = content.folder || content.workspace || '';
                                                  if (uriStr) {
                                                    const decoded = decodeURIComponent(uriStr);
                                                    // Strip scheme + authority (e.g. file:///c:/... or vscode-remote://wsl+Ubuntu/home/...)
                                                    const withoutScheme = decoded.replace(/^[a-zA-Z0-9+.-]+:\/\/[^/]*/, '').replace(/\\/g, '/').replace(/\/+$/, '');
                                                    const base = withoutScheme.split('/').filter(Boolean).pop() || '';
                                                    if (base) {
                                                      return base.replace(/\.code-workspace$/i, '');
                                                    }
                                                  }
                                                }
                                              } catch {
                                                // ignore malformed workspace.json
                                              }
                                              return 'Workspace';
                                            }
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
                                              function cleanUriToPath(uriOrPath: string): string {
                                                try {
                                                  return decodeURIComponent(uriOrPath)
                                                    .replace(/^[a-zA-Z][a-zA-Z0-9+.-]+:(?:\/\/[^/]*)?/, '')
                                                    .replace(/\\/g, '/')
                                                    .replace(/\/+$/, '');
                                                } catch {
                                                  return uriOrPath
                                                    .replace(/^[a-zA-Z][a-zA-Z0-9+.-]+:(?:\/\/[^/]*)?/, '')
                                                    .replace(/\\/g, '/')
                                                    .replace(/\/+$/, '');
                                                }
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

                                              return Array.from(dirs);
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
                                              for (const line of lines) {
                                                const trimmed = line.trim();
                                                if (!trimmed) {
                                                  continue;
                                                }
                                                let obj: any;
                                                try {
                                                  obj = JSON.parse(trimmed);
                                                } catch {
                                                  continue;
                                                }
                                                function extractNameFromWorkspaceConfigObject(rawConfig: string): string | undefined {
                                                  try {
                                                    const cfg = JSON.parse(rawConfig);
                                                    if (typeof cfg?.name === 'string' && cfg.name.trim() && cfg.name.trim().toLowerCase() !== 'workspace.json') {
                                                      return cfg.name.trim();
                                                    }
                                                    if (Array.isArray(cfg?.folders) && cfg.folders.length > 0) {
                                                      const names: string[] = [];
                                                      for (const f of cfg.folders) {
                                                        if (typeof f?.name === 'string' && f.name.trim()) {
                                                          names.push(f.name.trim());
                                                          continue;
                                                        }
                                                        const rawTarget = typeof f?.uri === 'string' ? f.uri : typeof f?.path === 'string' ? f.path : '';
                                                        if (!rawTarget || rawTarget === '.') {
                                                          continue;
                                                        }
                                                        const seg = cleanUriToPath(rawTarget).split('/').filter(Boolean).pop();
                                                        if (seg && seg.toLowerCase() !== 'workspace.json') {
                                                          names.push(seg.replace(/\.code-workspace$/i, ''));
                                                        }
                                                      }
                                                      if (names.length === 1) {
                                                        return names[0];
                                                      }
                                                      if (names.length === 2) {
                                                        return `${names[0]} + ${names[1]}`;
                                                      }
                                                      if (names.length > 2) {
                                                        return `${names[0]} + ${names[1]} (+${names.length - 2})`;
                                                      }
                                                    }
                                                  } catch {
                                                    // ignore malformed workspace config
                                                  }
                                                  return undefined;
                                                }
                                                function readNumericCredits(obj: any): number | undefined {
                                                  if (!obj || typeof obj !== 'object') {
                                                    return undefined;
                                                  }
                                                  for (const key of ['credits', 'aiCredits', 'totalCredits', 'copilotCredits', 'creditsUsed', 'usedCredits']) {
                                                    const val = obj[key];
                                                    if (typeof val === 'number' && isFinite(val) && val >= 0) {
                                                      return val;
                                                    }
                                                  }
                                                  if (obj.cost && typeof obj.cost === 'object') {
                                                    for (const key of ['credits', 'aiCredits', 'totalCredits']) {
                                                      const val = obj.cost[key];
                                                      if (typeof val === 'number' && isFinite(val) && val >= 0) {
                                                        return val;
                                                      }
                                                    }
                                                  }
                                                  return undefined;
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
                                                        return 'Workspace';
                                                        curr = curr[k];
                                                      }
                                                      curr[keys[keys.length - 1]] = value;
                                                    }
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
                                                  function getCandidateWorkspaceConfigPaths(withoutScheme: string, hashDir?: string): string[] {
                                                    const candidates: string[] = [];
                                                    const wsMatch = withoutScheme.match(/\/Workspaces\/([^/]+)\/workspace\.json$/i);
                                                    if (wsMatch && hashDir) {
                                                      const userDir = path.dirname(path.dirname(hashDir));
                                                      candidates.push(path.join(userDir, 'Workspaces', wsMatch[1], 'workspace.json'));
                                                    }
                                                    const winDriveMatch = withoutScheme.match(/^\/?([a-zA-Z]):\/(.*)$/);
                                                    if (winDriveMatch) {
                                                      const drive = winDriveMatch[1].toLowerCase();
                                                      const rest = winDriveMatch[2];
                                                      if (process.platform === 'win32') {
                                                        candidates.push(`${drive}:/${rest}`);
                                                      } else {
                                                        candidates.push(`/mnt/${drive}/${rest}`, `/${drive}/${rest}`);
                                                      }
                                                    } else if (withoutScheme.startsWith('/')) {
                                                      candidates.push(withoutScheme);
                                                    }
                                                    return candidates;
                                                  }
                                                  function parseCreditsFromDetailsString(detailsStr: string): {
                                                    explicitCredits?: number;
                                                    explicitMultiplier?: number;
                                                    explicitTokens?: number;
                                                    modelPart: string;
                                                  } {
                                                    let explicitCredits: number | undefined;
                                                    let explicitMultiplier: number | undefined;
                                                    let explicitTokens: number | undefined;

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
                                                        if (!state && looseRequests.length > 0) {
                                                          return { requests: looseRequests };
                                                        }
                                                        return state;
                                                      }
                                                      function fallbackNameForWorkspaceJsonUri(withoutScheme: string, overrideName?: string): string {
                                                        if (overrideName && overrideName.trim()) {
                                                          return overrideName.trim();
                                                        }
                                                        const parts = withoutScheme.split('/').filter(Boolean);
                                                        for (let i = parts.length - 2; i >= 0; i--) {
                                                          const seg = parts[i];
                                                          const lower = seg.toLowerCase();
                                                          if (
                                                            lower === '.vscode' ||
                                                            lower === 'workspaces' ||
                                                            lower === 'user' ||
                                                            lower === 'code' ||
                                                            /^\d+$/.test(seg) ||
                                                            /^[0-9a-f]{16,}$/i.test(seg)
                                                          ) {
                                                            continue;
                                                          }
                                                          return seg.replace(/\.code-workspace$/i, '');
                                                        }
                                                        return 'Untitled Workspace';
                                                      }
                                                      const creditMatch = detailsStr.match(EXTRACT_CREDITS_RE);
                                                      if (creditMatch) {
                                                        const parsed = parseNumericValue(creditMatch[1]);
                                                        if (!isNaN(parsed) && parsed >= 0) {
                                                          explicitCredits = parsed;
                                                        }
                                                      } else if (/(?:[•·∙⋅|]|\s\*\s|\()\s*(?:free|included)\b/i.test(detailsStr)) {
                                                        explicitCredits = 0;
                                                      }

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
                                                      export function replayJsonlMutationLog(rawContent: string): any {
                                                        const lines = rawContent.split(/\r?\n/);
                                                        let state: any = undefined;
                                                        const looseRequests: any[] = [];
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
                                                        function parseWorkspaceJsonContent(
                                                          raw: string,
                                                          hashDir?: string,
                                                          readRefFileSync?: (p: string) => string | undefined,
                                                          overrideName?: string
                                                        ): string {
                                                          try {
                                                            const content = JSON.parse(raw);
                                                            const wsField =
                                                              typeof content.workspace === 'string'
                                                                ? content.workspace
                                                                : typeof content.workspace?.configURIPath === 'string'
                                                                  ? content.workspace.configURIPath
                                                                  : '';
                                                            const uriStr = content.folder || wsField || '';
                                                            if (uriStr) {
                                                              const withoutScheme = cleanUriToPath(uriStr);
                                                              const base = withoutScheme.split('/').filter(Boolean).pop() || '';
                                                              if (base.toLowerCase() === 'workspace.json') {
                                                                if (readRefFileSync) {
                                                                  for (const candidate of getCandidateWorkspaceConfigPaths(withoutScheme, hashDir)) {
                                                                    const refRaw = readRefFileSync(candidate);
                                                                    if (refRaw) {
                                                                      const extracted = extractNameFromWorkspaceConfigObject(refRaw);
                                                                      if (extracted) {
                                                                        return extracted;
                                                                      }
                                                                    }
                                                                  }
                                                                }
                                                                return fallbackNameForWorkspaceJsonUri(withoutScheme, overrideName);
                                                              }
                                                              if (base) {
                                                                const cleaned = base.replace(/\.code-workspace$/i, '');
                                                                if (cleaned.toLowerCase() === 'untitled' && overrideName) {
                                                                  return overrideName;
                                                                }
                                                                return cleaned || overrideName || 'Workspace';
                                                              }
                                                            }
                                                          } catch {
                                                            // ignore
                                                          }
                                                          return overrideName || 'Workspace';
                                                        }
                                                        const multMatch = detailsStr.match(/(?:[•·∙⋅|*-]|\()\s*(\d+(?:\.\d+)?)\s*x\b/i);
                                                        if (multMatch) {
                                                          const parsedMult = parseFloat(multMatch[1]);
                                                          if (!isNaN(parsedMult) && parsedMult >= 0) {
                                                            explicitMultiplier = parsedMult;
                                                          }
                                                        }

                                                        const monthStartMs = new Date(year, month, 1, 0, 0, 0).getTime();
                                                        const monthEndMs = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
                                                        const sessions: SessionRecord[] = [];
                                                        function setByPath(root: any, keys: (string | number)[], value: any): void {
                                                          if (!root || keys.length === 0) {
                                                            return;
                                                            for (const line of lines) {
                                                              const trimmed = line.trim();
                                                              if (!trimmed) {
                                                                continue;
                                                              }
                                                              let obj: any;
                                                              try {
                                                                obj = JSON.parse(trimmed);
                                                              } catch {
                                                                continue;
                                                              }
                                                              function extractModelAndMultiplier(
                                                                req: any,
                                                                sessionState: any,
                                                                customMultipliers: Record<string, number>
                                                              ): { model: string; multiplier: number } {
                                                                let explicitMultiplier: number | undefined;
                                                                let modelCandidate = '';
                                                                async function parseWorkspaceJsonContentAsync(
                                                                  raw: string,
                                                                  hashDir?: string,
                                                                  overrideName?: string
                                                                ): Promise<string> {
                                                                  try {
                                                                    const content = JSON.parse(raw);
                                                                    const wsField =
                                                                      typeof content.workspace === 'string'
                                                                        ? content.workspace
                                                                        : typeof content.workspace?.configURIPath === 'string'
                                                                          ? content.workspace.configURIPath
                                                                          : '';
                                                                    const uriStr = content.folder || wsField || '';
                                                                    if (uriStr) {
                                                                      const withoutScheme = cleanUriToPath(uriStr);
                                                                      const base = withoutScheme.split('/').filter(Boolean).pop() || '';
                                                                      if (base.toLowerCase() === 'workspace.json') {
                                                                        for (const candidate of getCandidateWorkspaceConfigPaths(withoutScheme, hashDir)) {
                                                                          try {
                                                                            const refRaw = await fs.promises.readFile(candidate, 'utf8');
                                                                            const extracted = extractNameFromWorkspaceConfigObject(refRaw);
                                                                            if (extracted) {
                                                                              return extracted;
                                                                            }
                                                                          } catch {
                                                                            // try next candidate
                                                                          }
                                                                        }
                                                                        return fallbackNameForWorkspaceJsonUri(withoutScheme, overrideName);
                                                                      }
                                                                      if (base) {
                                                                        const cleaned = base.replace(/\.code-workspace$/i, '');
                                                                        if (cleaned.toLowerCase() === 'untitled' && overrideName) {
                                                                          return overrideName;
                                                                        }
                                                                        return cleaned || overrideName || 'Workspace';
                                                                      }
                                                                    }
                                                                  } catch {
                                                                    // ignore
                                                                  }
                                                                  return overrideName || 'Workspace';
                                                                }
                                                                const tokMatch = detailsStr.match(/(\d[\d,]*(?:\.\d+)?)\s*([km])?\s*tokens?\b/i);
                                                                if (tokMatch) {
                                                                  const baseTok = parseNumericValue(tokMatch[1]);
                                                                  const unit = (tokMatch[2] || '').toLowerCase();
                                                                  const scale = unit === 'm' ? 1_000_000 : unit === 'k' ? 1_000 : 1;
                                                                  if (!isNaN(baseTok) && baseTok > 0) {
                                                                    explicitTokens = Math.round(baseTok * scale);
                                                                  }
                                                                }

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
                                                                    let curr = root;
                                                                    for (let i = 0; i < keys.length - 1; i++) {
                                                                      const k = keys[i];
                                                                      if (curr[k] === null || curr[k] === undefined || typeof curr[k] !== 'object') {
                                                                        curr[k] = typeof keys[i + 1] === 'number' ? [] : {};
                                                                        if (Array.isArray(target)) {
                                                                          const items = Array.isArray(obj.v) ? obj.v : (obj.v !== undefined ? [obj.v] : []);
                                                                          if (typeof obj.i === 'number' && obj.i >= 0) {
                                                                            target.splice(obj.i, Math.max(0, target.length - obj.i), ...items);
                                                                          } else {
                                                                            target.push(...items);
                                                                          }
                                                                          curr = curr[k];
                                                                        }
                                                                        curr[keys[keys.length - 1]] = value;
                                                                      } else if (obj.kind === 3 && state && Array.isArray(obj.k) && obj.k.length > 0) {
                                                                        deleteByPath(state, obj.k);
                                                                      }
                                                                    } else if (Array.isArray(obj.requests)) {
                                                                      state = obj;
                                                                    } else if (obj.requestId || obj.message || obj.prompt) {
                                                                      looseRequests.push(obj);
                                                                    }
                                                                  }
                                                                  const detailsStr = typeof req?.result?.details === 'string' ? req.result.details.trim() : '';
                                                                  if (detailsStr) {
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
                                                                  /**
                                                                   * Extracts a clean project/repository name from workspace.json, handling single folders,
                                                                   * Remote-WSL / SSH URIs, .code-workspace files, and untitled multi-root workspaces (`User/Workspaces/<id>/workspace.json`).
                                                                   */
                                                                  export function readWorkspaceName(hashDir: string, overrideName?: string): string {
                                                                    const wsJsonPath = path.join(hashDir, 'workspace.json');
                                                                    try {
                                                                      if (fs.existsSync(wsJsonPath)) {
                                                                        const raw = fs.readFileSync(wsJsonPath, 'utf8');
                                                                        return parseWorkspaceJsonContent(
                                                                          raw,
                                                                          hashDir,
                                                                          p => {
                                                                            try {
                                                                              return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : undefined;
                                                                            } catch {
                                                                              return undefined;
                                                                            }
                                                                          },
                                                                          overrideName
                                                                        );
                                                                      }
                                                                    } catch {
                                                                      // ignore malformed workspace.json
                                                                    }
                                                                    return overrideName || 'Workspace';
                                                                  }
                                                                  const firstSeg = detailsStr.split(/\s*(?:[•·∙⋅|]|\s+\*\s+|\s+—\s+|\s+–\s+)\s*/)[0] || '';
                                                                  const modelPart = firstSeg
                                                                    .replace(STRIP_INLINE_CREDITS_RE, '')
                                                                    .replace(/(?:[\s*-]+|\s*[\(\[])(?:free|included)\b[\)\]]?.*$/i, '')
                                                                    .replace(/[\s*-]+$/g, '')
                                                                    .trim();

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
                                                                    if (!state && looseRequests.length > 0) {
                                                                      return { requests: looseRequests };
                                                                    }
                                                                    return state;
                                                                  }
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
                                                                  function getByPath(root: any, keys: Array<string | number>): any {
                                                                    let curr = root;
                                                                    for (const k of keys) {
                                                                      if (curr === null || curr === undefined) {
                                                                        return undefined;
                                                                      }
                                                                      curr = curr[k];
                                                                    }
                                                                    return curr;
                                                                  }
                                                                  return { explicitCredits, explicitMultiplier, explicitTokens, modelPart };
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
                                                                      const cleanUserOverrides: Record<string, number> = {};
                                                                      for (const [k, v] of Object.entries(customMultipliers || {})) {
                                                                        cleanUserOverrides[normalizeModelName(k)] = v;
                                                                      }
                                                                      const hasExplicitUserOverride = Object.keys(cleanUserOverrides).some(
                                                                        k => modelCandidate.includes(k) && DEFAULT_MODEL_MULTIPLIERS[k] !== cleanUserOverrides[k]
                                                                      );
                                                                      function setByPath(root: any, keys: Array<string | number>, value: any) {
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
                                                                      function extractTurnCostAndModel(
                                                                        req: any,
                                                                        sessionState: any,
                                                                        customMultipliers?: Record<string, number>
                                                                      ): { model: string; multiplier: number; credits: number; hasExplicitCost: boolean; detailsTokens?: number } {
                                                                        const resultObj = req?.result || (!Array.isArray(req?.response) ? req?.response?.result : undefined);
                                                                        const detailsStr =
                                                                          typeof resultObj?.details === 'string'
                                                                            ? resultObj.details.trim()
                                                                            : typeof req?.details === 'string'
                                                                              ? req.details.trim()
                                                                              : '';

                                                                        for (const line of lines) {
                                                                          const trimmed = line.trim();
                                                                          if (!trimmed) {
                                                                            continue;
                                                                          }
                                                                          function extractModelAndMultiplier(
                                                                            req: any,
                                                                            sessionState: any,
                                                                            customMultipliers: Record<string, number>
                                                                          ): { model: string; multiplier: number } {
                                                                            let explicitMultiplier: number | undefined;
                                                                            let modelCandidate = '';
                                                                            const multiplier =
                                                                              !hasExplicitUserOverride && explicitMultiplier !== undefined && !isNaN(explicitMultiplier)
                                                                                ? explicitMultiplier
                                                                                : resolveModelMultiplier(modelCandidate, customMultipliers);
                                                                            function deleteByPath(root: any, keys: Array<string | number>) {
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
                                                                            let explicitCredits: number | undefined;
                                                                            let explicitMultiplier: number | undefined;
                                                                            let detailsTokens: number | undefined;
                                                                            let modelCandidate = '';

                                                                            let files: string[] = [];
                                                                            let obj: any;
                                                                            try {
                                                                              files = fs.readdirSync(chatSessionsDir).filter(f => f.endsWith('.json') || f.endsWith('.jsonl'));
                                                                              obj = JSON.parse(trimmed);
                                                                            } catch {
                                                                              continue;
                                                                            }
                                                                            const detailsStr = typeof req?.result?.details === 'string' ? req.result.details.trim() : '';
                                                                            if (detailsStr) {
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
                                                                            return { model: modelCandidate, multiplier };
                                                                          }
                                                                          /**
                                                                           * Replays VS Code's objectMutationLog (.jsonl) format (kind 0, 1, 2, 3) plus flat JSONL fallbacks.
                                                                           */
                                                                          export function replayJsonlMutationLog(rawContent: string): any {
                                                                            const lines = rawContent.split(/\r?\n/);
                                                                            let state: any = undefined;
                                                                            const looseRequests: any[] = [];
                                                                            if (detailsStr) {
                                                                              const parsed = parseCreditsFromDetailsString(detailsStr);
                                                                              explicitCredits = parsed.explicitCredits;
                                                                              explicitMultiplier = parsed.explicitMultiplier;
                                                                              detailsTokens = parsed.explicitTokens;
                                                                              if (parsed.modelPart) {
                                                                                modelCandidate = normalizeModelName(parsed.modelPart);
                                                                              }
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
                                                                            interface ParsedFullSession {
                                                                              sessionId: string;
                                                                              title: string;
                                                                              workspaceName: string;
                                                                              turns: ChatTurnRecord[];
                                                                            }
                                                                            for (const line of lines) {
                                                                              const trimmed = line.trim();
                                                                              if (!trimmed) {
                                                                                continue;
                                                                              }
                                                                              let obj: any;
                                                                              try {
                                                                                obj = JSON.parse(trimmed);
                                                                              } catch {
                                                                                continue;
                                                                              }
                                                                              const metaCredits =
                                                                                readNumericCredits(resultObj) ??
                                                                                readNumericCredits(resultObj?.metadata) ??
                                                                                readNumericCredits(resultObj?.metadata?.usage) ??
                                                                                readNumericCredits(req?.usage) ??
                                                                                readNumericCredits(req?.modelState) ??
                                                                                readNumericCredits(req);

                                                                              const workspaceName = readWorkspaceName(hashDir);
                                                                              if (!state && looseRequests.length > 0) {
                                                                                return { requests: looseRequests };
                                                                              }
                                                                              return state;
                                                                            }
                                                                            const cleanUserOverrides: Record<string, number> = {};
                                                                            for (const [k, v] of Object.entries(customMultipliers || {})) {
                                                                              cleanUserOverrides[normalizeModelName(k)] = v;
                                                                            }
                                                                            const hasExplicitUserOverride = Object.keys(cleanUserOverrides).some(
                                                                              k => modelCandidate.includes(k) && DEFAULT_MODEL_MULTIPLIERS[k] !== cleanUserOverrides[k]
                                                                            );
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
                                                                              const requests: any[] = Array.isArray(state.requests) ? state.requests : [];
                                                                              if (requests.length === 0) {
                                                                                return undefined;
                                                                              }
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
                                                                                    const items = Array.isArray(obj.v) ? obj.v : obj.v !== undefined ? [obj.v] : [];
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
                                                                            if (metaCredits !== undefined) {
                                                                              explicitCredits = explicitCredits !== undefined ? Math.max(explicitCredits, metaCredits) : metaCredits;
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
                                                                              const multiplier =
                                                                                !hasExplicitUserOverride && explicitMultiplier !== undefined && !isNaN(explicitMultiplier)
                                                                                  ? explicitMultiplier
                                                                                  : resolveModelMultiplier(modelCandidate, customMultipliers);
                                                                              const sessionId: string = String(state.sessionId || fallbackSessionId);
                                                                              let title: string = String(state.customTitle || state.computedTitle || '').trim();
                                                                              const baseCreationMs =
                                                                                typeof state.creationDate === 'number' && state.creationDate > 1000000000000
                                                                                  ? state.creationDate
                                                                                  : fallbackMtimeMs - requests.length * 45000;
                                                                              if (!state && looseRequests.length > 0) {
                                                                                return { requests: looseRequests };
                                                                              }
                                                                              return state;
                                                                            }
                                                                            if (Array.isArray(resultObj?.metadata?.toolCallRounds)) {
                                                                              let roundCreditsSum = 0;
                                                                              let foundRoundCredits = false;
                                                                              for (const round of resultObj.metadata.toolCallRounds) {
                                                                                const rc =
                                                                                  readNumericCredits(round) ??
                                                                                  readNumericCredits(round?.usage) ??
                                                                                  (typeof round?.details === 'string' ? parseCreditsFromDetailsString(round.details).explicitCredits : undefined);
                                                                                if (rc !== undefined) {
                                                                                  roundCreditsSum += rc;
                                                                                  foundRoundCredits = true;
                                                                                }
                                                                              }
                                                                              if (foundRoundCredits) {
                                                                                explicitCredits = explicitCredits !== undefined ? Math.max(explicitCredits, roundCreditsSum) : roundCreditsSum;
                                                                              }
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
                                                                              return { model: modelCandidate, multiplier };
                                                                            }
                                                                            const turns: ChatTurnRecord[] = [];
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
                                                                            const fallbackModelId =
                                                                              resultObj?.metadata?.modelId ||
                                                                              resultObj?.metadata?.model ||
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

                                                                            try {
                                                                              const parsed = file.endsWith('.jsonl')
                                                                                ? parseChatSessionJsonl(fullPath, workspaceName, stat.mtimeMs, multipliers)
                                                                                : parseChatSessionJson(fullPath, workspaceName, stat.mtimeMs, multipliers);
                                                                              interface ParsedFullSession {
                                                                                sessionId: string;
                                                                                title: string;
                                                                                workspaceName: string;
                                                                                turns: ChatTurnRecord[];
                                                                              }
                                                                              requests.forEach((req, idx) => {
                                                                                if (!req || req.isCanceled) {
                                                                                  return;
                                                                                }
                                                                                function readNumericCredits(obj: any): number | undefined {
                                                                                  if (!obj || typeof obj !== 'object') {
                                                                                    return undefined;
                                                                                  }
                                                                                  for (const key of ['credits', 'aiCredits', 'totalCredits', 'copilotCredits', 'creditsUsed', 'usedCredits']) {
                                                                                    const val = obj[key];
                                                                                    if (typeof val === 'number' && isFinite(val) && val >= 0) {
                                                                                      return val;
                                                                                    }
                                                                                  }
                                                                                  if (obj.cost && typeof obj.cost === 'object') {
                                                                                    for (const key of ['credits', 'aiCredits', 'totalCredits']) {
                                                                                      const val = obj.cost[key];
                                                                                      if (typeof val === 'number' && isFinite(val) && val >= 0) {
                                                                                        return val;
                                                                                      }
                                                                                    }
                                                                                  }
                                                                                  return undefined;
                                                                                }
                                                                                if (!modelCandidate || modelCandidate === 'auto') {
                                                                                  const resolvedFallback = fallbackModelId ? normalizeModelName(fallbackModelId) : '';
                                                                                  if (resolvedFallback && resolvedFallback !== 'auto') {
                                                                                    modelCandidate = resolvedFallback;
                                                                                  } else if (!modelCandidate) {
                                                                                    modelCandidate = normalizeModelName(fallbackModelId);
                                                                                  }
                                                                                }

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
                                                                                const requests: any[] = Array.isArray(state.requests) ? state.requests : [];
                                                                                if (requests.length === 0) {
                                                                                  return undefined;
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
                                                                                function parseCreditsFromDetailsString(detailsStr: string): {
                                                                                  explicitCredits?: number;
                                                                                  explicitMultiplier?: number;
                                                                                  explicitTokens?: number;
                                                                                  modelPart: string;
                                                                                } {
                                                                                  let explicitCredits: number | undefined;
                                                                                  let explicitMultiplier: number | undefined;
                                                                                  let explicitTokens: number | undefined;
                                                                                  const cleanUserOverrides: Record<string, number> = {};
                                                                                  for (const [k, v] of Object.entries(customMultipliers || {})) {
                                                                                    cleanUserOverrides[normalizeModelName(k)] = v;
                                                                                  }
                                                                                  const hasExplicitUserOverride = Object.keys(cleanUserOverrides).some(
                                                                                    k => modelCandidate.includes(k) && DEFAULT_MODEL_MULTIPLIERS[k] !== cleanUserOverrides[k]
                                                                                  );

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
                                                                                  const sessionId: string = String(state.sessionId || fallbackSessionId);
                                                                                  let title: string = String(state.customTitle || state.computedTitle || '').trim();
                                                                                  const baseCreationMs =
                                                                                    typeof state.creationDate === 'number' && state.creationDate > 1000000000000
                                                                                      ? state.creationDate
                                                                                      : fallbackMtimeMs - requests.length * 45000;
                                                                                  if (!title && promptText) {
                                                                                    title = promptText.replace(/\s+/g, ' ').trim();
                                                                                  }
                                                                                  const creditMatch = detailsStr.match(EXTRACT_CREDITS_RE);
                                                                                  if (creditMatch) {
                                                                                    const parsed = parseNumericValue(creditMatch[1]);
                                                                                    if (!isNaN(parsed) && parsed >= 0) {
                                                                                      explicitCredits = parsed;
                                                                                    }
                                                                                  } else if (/(?:[•·∙⋅|]|\s\*\s|\()\s*(?:free|included)\b/i.test(detailsStr)) {
                                                                                    explicitCredits = 0;
                                                                                  }
                                                                                  const fallbackMultiplier = resolveModelMultiplier(modelCandidate, customMultipliers);
                                                                                  if (hasExplicitUserOverride) {
                                                                                    return {
                                                                                      model: modelCandidate,
                                                                                      multiplier: fallbackMultiplier,
                                                                                      credits: fallbackMultiplier,
                                                                                      hasExplicitCost: false,
                                                                                      detailsTokens
                                                                                    };
                                                                                  }

                                                                                  // Allow user overrides in copilotAnalytics.modelMultipliers to take priority if explicitly configured
                                                                                  const cleanUserOverrides: Record<string, number> = {};
                                                                                  for (const [k, v] of Object.entries(customMultipliers || {})) {
                                                                                    cleanUserOverrides[normalizeModelName(k)] = v;
                                                                                  }
                                                                                  const hasExplicitUserOverride = Object.keys(cleanUserOverrides).some(k => modelCandidate.includes(k) && DEFAULT_MODEL_MULTIPLIERS[k] !== cleanUserOverrides[k]);
                                                                                  const turns: ChatTurnRecord[] = [];
                                                                                  const responseChars = extractTextLength(req.response);
                                                                                  const toolRoundChars = Array.isArray(req.result?.metadata?.toolCallRounds)
                                                                                    ? extractTextLength(req.result.metadata.toolCallRounds)
                                                                                    : 0;
                                                                                  const multMatch = detailsStr.match(/(?:[•·∙⋅|*-]|\()\s*(\d+(?:\.\d+)?)\s*x\b/i);
                                                                                  if (multMatch) {
                                                                                    const parsedMult = parseFloat(multMatch[1]);
                                                                                    if (!isNaN(parsedMult) && parsedMult >= 0) {
                                                                                      explicitMultiplier = parsedMult;
                                                                                    }
                                                                                  }
                                                                                  if (explicitCredits !== undefined && !isNaN(explicitCredits)) {
                                                                                    return {
                                                                                      model: modelCandidate,
                                                                                      multiplier: explicitMultiplier ?? explicitCredits,
                                                                                      credits: explicitCredits,
                                                                                      hasExplicitCost: true,
                                                                                      detailsTokens
                                                                                    };
                                                                                  }

                                                                                  const multiplier =
                                                                                    !hasExplicitUserOverride && explicitMultiplier !== undefined && !isNaN(explicitMultiplier)
                                                                                      ? explicitMultiplier
                                                                                      : resolveModelMultiplier(modelCandidate, customMultipliers);
                                                                                  requests.forEach((req, idx) => {
                                                                                    if (!req || req.isCanceled) {
                                                                                      return;
                                                                                    }
                                                                                    const { model, multiplier } = extractModelAndMultiplier(req, state, multipliers);
                                                                                    const tokMatch = detailsStr.match(/(\d[\d,]*(?:\.\d+)?)\s*([km])?\s*tokens?\b/i);
                                                                                    if (tokMatch) {
                                                                                      const baseTok = parseNumericValue(tokMatch[1]);
                                                                                      const unit = (tokMatch[2] || '').toLowerCase();
                                                                                      const scale = unit === 'm' ? 1_000_000 : unit === 'k' ? 1_000 : 1;
                                                                                      if (!isNaN(baseTok) && baseTok > 0) {
                                                                                        explicitTokens = Math.round(baseTok * scale);
                                                                                      }
                                                                                    }
                                                                                    const mult = explicitMultiplier !== undefined && !isNaN(explicitMultiplier) ? explicitMultiplier : fallbackMultiplier;
                                                                                    return {
                                                                                      model: modelCandidate,
                                                                                      multiplier: mult,
                                                                                      credits: mult,
                                                                                      hasExplicitCost: explicitMultiplier !== undefined,
                                                                                      detailsTokens
                                                                                    };
                                                                                  }

                                                                          return { model: modelCandidate, multiplier };
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
                                                                                const ts =
                                                                                  typeof req.timestamp === 'number' && req.timestamp > 1000000000000
                                                                                    ? req.timestamp
                                                                                    : (typeof req.requestDate === 'number' && req.requestDate > 1000000000000
                                                                                      ? req.requestDate
                                                                                      : baseCreationMs + idx * 45000);
                                                                                const firstSeg = detailsStr.split(/\s*(?:[•·∙⋅|]|\s+\*\s+|\s+—\s+|\s+–\s+)\s*/)[0] || '';
                                                                                const modelPart = firstSeg
                                                                                  .replace(STRIP_INLINE_CREDITS_RE, '')
                                                                                  .replace(/(?:[\s*-]+|\s*[\(\[])(?:free|included)\b[\)\]]?.*$/i, '')
                                                                                  .replace(/[\s*-]+$/g, '')
                                                                                  .trim();
                                                                                interface ParsedSessionData {
                                                                                  sessionId: string;
                                                                                  title: string;
                                                                                  workspaceName: string;
                                                                                  turns: ChatTurnRecord[];
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
                                                                                    if (!title && promptText) {
                                                                                      title = promptText.replace(/\s+/g, ' ').trim();
                                                                                    }
                                                                                    const dt = new Date(ts);
                                                                                    const usageMeta = req.result?.metadata?.usage || req.usage;
                                                                                    const exactTokens =
                                                                                      typeof usageMeta?.totalTokens === 'number'
                                                                                        ? usageMeta.totalTokens
                                                                                        : (typeof usageMeta?.promptTokens === 'number' || typeof usageMeta?.completionTokens === 'number'
                                                                                          ? (usageMeta.promptTokens || 0) + (usageMeta.completionTokens || 0)
                                                                                          : 0);
                                                                                    return { explicitCredits, explicitMultiplier, explicitTokens, modelPart };
                                                                                  }
                                                                                  function parseSessionObject(
                                                                                    state: any,
                                                                                    fallbackSessionId: string,
                                                                                    workspaceName: string,
                                                                                    fallbackMtimeMs: number,
                                                                                    multipliers?: Record<string, number>
                                                                                  ): ParsedSessionData | undefined {
                                                                                    if (!state || typeof state !== 'object') {
                                                                                      return undefined;
                                                                                    }
                                                                                    const requests = Array.isArray(state.requests) ? state.requests : [];
                                                                                    if (requests.length === 0) {
                                                                                      return undefined;
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
                                                                                      const responseChars = extractTextLength(req.response);
                                                                                      const toolRoundChars = Array.isArray(req.result?.metadata?.toolCallRounds)
                                                                                        ? extractTextLength(req.result.metadata.toolCallRounds)
                                                                                        : 0;
                                                                                      const estimatedTokens =
                                                                                        exactTokens > 0
                                                                                          ? exactTokens
                                                                                          : Math.max(60, Math.ceil((promptText.length + responseChars + toolRoundChars) / 4));
                                                                                      function extractTurnCostAndModel(
                                                                                        req: any,
                                                                                        sessionState: any,
                                                                                        customMultipliers?: Record<string, number>
                                                                                      ): { model: string; multiplier: number; credits: number; hasExplicitCost: boolean; detailsTokens?: number } {
                                                                                        const resultObj = req?.result || (!Array.isArray(req?.response) ? req?.response?.result : undefined);
                                                                                        const detailsStr =
                                                                                          typeof resultObj?.details === 'string'
                                                                                            ? resultObj.details.trim()
                                                                                            : typeof req?.details === 'string'
                                                                                              ? req.details.trim()
                                                                                              : '';
                                                                                        const sessionId = String(state.sessionId || fallbackSessionId);
                                                                                        let title = String(state.customTitle || state.computedTitle || '').trim();
                                                                                        const baseCreationMs =
                                                                                          typeof state.creationDate === 'number' && state.creationDate > 1000000000000
                                                                                            ? state.creationDate
                                                                                            : fallbackMtimeMs - requests.length * 45000;

                                                                                        const sessionId: string = String(state.sessionId || fallbackSessionId);
                                                                                        let title: string = String(state.customTitle || state.computedTitle || '').trim();
                                                                                        const baseCreationMs =
                                                                                          typeof state.creationDate === 'number' && state.creationDate > 1000000000000
                                                                                            ? state.creationDate
                                                                                            : fallbackMtimeMs - requests.length * 45000;
                                                                                        const { model, multiplier } = extractModelAndMultiplier(req, state, multipliers);
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
                                                                                      let explicitCredits: number | undefined;
                                                                                      let explicitMultiplier: number | undefined;
                                                                                      let detailsTokens: number | undefined;
                                                                                      let modelCandidate = '';
                                                                                      const turns: ChatTurnRecord[] = [];
                                                                                      requests.forEach((req: any, idx: number) => {
                                                                                        if (!req) {
                                                                                          return;
                                                                                        }
                                                                                        const promptText =
                                                                                          typeof req.message === 'string'
                                                                                            ? req.message
                                                                                            : req.message?.text ||
                                                                                            (Array.isArray(req.message?.parts) ? req.message.parts.map((p: any) => p?.text || '').join(' ') : '') ||
                                                                                            req.prompt ||
                                                                                            '';

                                                                                        const turns: ChatTurnRecord[] = [];
                                                                                        const ts =
                                                                                          typeof req.timestamp === 'number' && req.timestamp > 1000000000000
                                                                                            ? req.timestamp
                                                                                            : (typeof req.requestDate === 'number' && req.requestDate > 1000000000000
                                                                                              ? req.requestDate
                                                                                              : baseCreationMs + idx * 45000);
                                                                                        if (turns.length === 0) {
                                                                                          return undefined;
                                                                                        }
                                                                                        if (detailsStr) {
                                                                                          const parsed = parseCreditsFromDetailsString(detailsStr);
                                                                                          explicitCredits = parsed.explicitCredits;
                                                                                          explicitMultiplier = parsed.explicitMultiplier;
                                                                                          detailsTokens = parsed.explicitTokens;
                                                                                          if (parsed.modelPart) {
                                                                                            modelCandidate = normalizeModelName(parsed.modelPart);
                                                                                          }
                                                                                        }
                                                                                        if (!title && promptText) {
                                                                                          title = promptText.replace(/\s+/g, ' ').trim();
                                                                                        }

                                                                                        requests.forEach((req, idx) => {
                                                                                          if (!req || req.isCanceled) {
                                                                                            return;
                                                                                          }
                                                                                          const dt = new Date(ts);
                                                                                          const usageMeta = req.result?.metadata?.usage || req.usage;
                                                                                          const exactTokens =
                                                                                            typeof usageMeta?.totalTokens === 'number'
                                                                                              ? usageMeta.totalTokens
                                                                                              : (typeof usageMeta?.promptTokens === 'number' || typeof usageMeta?.completionTokens === 'number'
                                                                                                ? (usageMeta.promptTokens || 0) + (usageMeta.completionTokens || 0)
                                                                                                : 0);
                                                                                          return {
                                                                                            sessionId,
                                                                                            title: (title || 'Copilot Chat Session').slice(0, 95),
                                                                                            workspaceName,
                                                                                            turns
                                                                                          };
                                                                                        }
  const metaCredits =
                                                                                          readNumericCredits(resultObj) ??
                                                                                          readNumericCredits(resultObj?.metadata) ??
                                                                                          readNumericCredits(resultObj?.metadata?.usage) ??
                                                                                          readNumericCredits(req?.usage) ??
                                                                                          readNumericCredits(req?.modelState) ??
                                                                                          readNumericCredits(req);
                                                                                        const responseChars = extractTextLength(req.response);
                                                                                        const resultObj = req?.result || (!Array.isArray(req?.response) ? req?.response?.result : undefined);
                                                                                        const toolRoundChars = Array.isArray(resultObj?.metadata?.toolCallRounds)
                                                                                          ? extractTextLength(resultObj.metadata.toolCallRounds)
                                                                                          : 0;

                                                                                        const promptText: string =
                                                                                          typeof req.message === 'string'
                                                                                            ? req.message
                                                                                            : (req.message?.text ||
                                                                                              (Array.isArray(req.message?.parts)
                                                                                                ? req.message.parts.map((p: any) => p?.text || '').join(' ')
                                                                                                : '') ||
                                                                                              req.prompt ||
                                                                                              '');
                                                                                        const estimatedTokens =
                                                                                          exactTokens > 0
                                                                                            ? exactTokens
                                                                                            : Math.max(60, Math.ceil((promptText.length + responseChars + toolRoundChars) / 4));
                                                                                        function buildMonthlySessionRecord(
                                                                                          sessionId: string,
                                                                                          title: string,
                                                                                          workspaceName: string,
                                                                                          monthTurns: ChatTurnRecord[],
                                                                                          totalHistoricalTurnsBeforeMonth = 0
                                                                                        ): SessionRecord | undefined {
                                                                                          if (monthTurns.length === 0) {
                                                                                            return undefined;
                                                                                          }
                                                                                          if (metaCredits !== undefined) {
                                                                                            explicitCredits = explicitCredits !== undefined ? Math.max(explicitCredits, metaCredits) : metaCredits;
                                                                                          }
                                                                                          const { model, multiplier, credits, hasExplicitCost, detailsTokens } = extractTurnCostAndModel(
                                                                                            req,
                                                                                            state,
                                                                                            multipliers
                                                                                          );

                                                                                          if (!title && promptText) {
                                                                                            title = promptText.replace(/\s+/g, ' ').trim();
                                                                                          }
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
                                                                                      const sorted = [...monthTurns].sort((a, b) => a.timestamp - b.timestamp);
                                                                                      const startTime = sorted[0].timestamp;
                                                                                      const endTime = sorted[sorted.length - 1].timestamp;
                                                                                      const durationMinutes = Math.max(1, Math.round((endTime - startTime) / 60000));
                                                                                      if (Array.isArray(resultObj?.metadata?.toolCallRounds)) {
                                                                                        let roundCreditsSum = 0;
                                                                                        let foundRoundCredits = false;
                                                                                        for (const round of resultObj.metadata.toolCallRounds) {
                                                                                          const rc =
                                                                                            readNumericCredits(round) ??
                                                                                            readNumericCredits(round?.usage) ??
                                                                                            (typeof round?.details === 'string' ? parseCreditsFromDetailsString(round.details).explicitCredits : undefined);
                                                                                          if (rc !== undefined) {
                                                                                            roundCreditsSum += rc;
                                                                                            foundRoundCredits = true;
                                                                                          }
                                                                                        }
                                                                                        if (foundRoundCredits) {
                                                                                          explicitCredits = explicitCredits !== undefined ? Math.max(explicitCredits, roundCreditsSum) : roundCreditsSum;
                                                                                        }
                                                                                      }
                                                                                      if (req.isCanceled && !hasExplicitCost && responseChars === 0 && toolRoundChars === 0) {
                                                                                        return;
                                                                                      }

                                                                                      const responseChars = extractTextLength(req.response);
                                                                                      const toolRoundChars = Array.isArray(req.result?.metadata?.toolCallRounds)
                                                                                        ? extractTextLength(req.result.metadata.toolCallRounds)
                                                                                        : 0;
                                                                                      if (turns.length === 0) {
                                                                                        return undefined;
                                                                                      }
                                                                                      let credits = 0;
                                                                                      let directTokens = 0;
                                                                                      let cumulativeContextTokens = 0;
                                                                                      let runningThreadTokens = totalHistoricalTurnsBeforeMonth * 800;
                                                                                      let post20TurnCredits = 0;
                                                                                      const fallbackModelId =
                                                                                        resultObj?.metadata?.modelId ||
                                                                                        resultObj?.metadata?.model ||
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
                                                                                      const ts =
                                                                                        typeof req.timestamp === 'number' && req.timestamp > 1000000000000
                                                                                          ? req.timestamp
                                                                                          : typeof req.requestDate === 'number' && req.requestDate > 1000000000000
                                                                                            ? req.requestDate
                                                                                            : baseCreationMs + idx * 45000;

                                                                                      const { model, multiplier } = extractModelAndMultiplier(req, state, multipliers);
                                                                                      return {
                                                                                        sessionId,
                                                                                        title: (title || 'Copilot Chat Session').slice(0, 95),
                                                                                        workspaceName,
                                                                                        turns
                                                                                      };
                                                                                    }
                                                                                    const modelsUsed: Record<string, { messages: number; credits: number }> = {};
                                                                                    const creditsByDay: Record<string, number> = {};
                                                                                    if (!modelCandidate || modelCandidate === 'auto') {
                                                                                      const resolvedFallback = fallbackModelId ? normalizeModelName(fallbackModelId) : '';
                                                                                      if (resolvedFallback && resolvedFallback !== 'auto') {
                                                                                        modelCandidate = resolvedFallback;
                                                                                      } else if (!modelCandidate) {
                                                                                        modelCandidate = normalizeModelName(fallbackModelId);
                                                                                      }
                                                                                    }
                                                                                    const dt = new Date(ts);
                                                                                    const usageMeta = resultObj?.metadata?.usage || req.usage;
                                                                                    let exactTokens =
                                                                                      typeof usageMeta?.totalTokens === 'number'
                                                                                        ? usageMeta.totalTokens
                                                                                        : typeof usageMeta?.promptTokens === 'number' || typeof usageMeta?.completionTokens === 'number'
                                                                                          ? (usageMeta.promptTokens || 0) + (usageMeta.completionTokens || 0)
                                                                                          : 0;

                                                                                    const ts =
                                                                                      typeof req.timestamp === 'number' && req.timestamp > 1000000000000
                                                                                        ? req.timestamp
                                                                                        : (typeof req.requestDate === 'number' && req.requestDate > 1000000000000
                                                                                          ? req.requestDate
                                                                                          : baseCreationMs + idx * 45000);
                                                                                    sorted.forEach((t, idx) => {
                                                                                      credits += t.credits;
                                                                                      directTokens += t.estimatedTokens;
                                                                                      runningThreadTokens += t.estimatedTokens;
                                                                                      cumulativeContextTokens += runningThreadTokens;
                                                                                      const cleanUserOverrides: Record<string, number> = {};
                                                                                      for (const [k, v] of Object.entries(customMultipliers || {})) {
                                                                                        cleanUserOverrides[normalizeModelName(k)] = v;
                                                                                      }
                                                                                      const hasExplicitUserOverride = Object.keys(cleanUserOverrides).some(
                                                                                        k => modelCandidate.includes(k) && DEFAULT_MODEL_MULTIPLIERS[k] !== cleanUserOverrides[k]
                                                                                      );
                                                                                      if (exactTokens === 0 && Array.isArray(resultObj?.metadata?.toolCallRounds)) {
                                                                                        for (const r of resultObj.metadata.toolCallRounds) {
                                                                                          const ru = r?.usage;
                                                                                          if (typeof ru?.totalTokens === 'number') {
                                                                                            exactTokens += ru.totalTokens;
                                                                                          } else if (typeof ru?.promptTokens === 'number' || typeof ru?.completionTokens === 'number') {
                                                                                            exactTokens += (ru.promptTokens || 0) + (ru.completionTokens || 0);
                                                                                          }
                                                                                        }
                                                                                      }

                                                                                      const dt = new Date(ts);
                                                                                      const usageMeta = req.result?.metadata?.usage || req.usage;
                                                                                      const exactTokens =
                                                                                        typeof usageMeta?.totalTokens === 'number'
                                                                                          ? usageMeta.totalTokens
                                                                                          : (typeof usageMeta?.promptTokens === 'number' || typeof usageMeta?.completionTokens === 'number'
                                                                                            ? (usageMeta.promptTokens || 0) + (usageMeta.completionTokens || 0)
                                                                                            : 0);
                                                                                      const globalTurnIndex = totalHistoricalTurnsBeforeMonth + idx;
                                                                                      if (globalTurnIndex >= 20) {
                                                                                        post20TurnCredits += t.credits;
                                                                                      }
                                                                                      const fallbackMultiplier = resolveModelMultiplier(modelCandidate, customMultipliers);
                                                                                      if (hasExplicitUserOverride) {
                                                                                        return {
                                                                                          model: modelCandidate,
                                                                                          multiplier: fallbackMultiplier,
                                                                                          credits: fallbackMultiplier,
                                                                                          hasExplicitCost: false,
                                                                                          detailsTokens
                                                                                        };
                                                                                      }
                                                                                      const estimatedTokens =
                                                                                        exactTokens > 0
                                                                                          ? exactTokens
                                                                                          : detailsTokens && detailsTokens > 0
                                                                                            ? detailsTokens
                                                                                            : Math.max(60, Math.ceil((promptText.length + responseChars + toolRoundChars) / 4));

                                                                                      const estimatedTokens =
                                                                                        exactTokens > 0
                                                                                          ? exactTokens
                                                                                          : Math.max(60, Math.ceil((promptText.length + responseChars + toolRoundChars) / 4));
                                                                                      if (!modelsUsed[t.model]) {
                                                                                        modelsUsed[t.model] = { messages: 0, credits: 0 };
                                                                                      }
                                                                                      modelsUsed[t.model].messages += 1;
                                                                                      modelsUsed[t.model].credits = Math.round((modelsUsed[t.model].credits + t.credits) * 100) / 100;
                                                                                      if (explicitCredits !== undefined && !isNaN(explicitCredits)) {
                                                                                        return {
                                                                                          model: modelCandidate,
                                                                                          multiplier: explicitMultiplier ?? explicitCredits,
                                                                                          credits: explicitCredits,
                                                                                          hasExplicitCost: true,
                                                                                          detailsTokens
                                                                                        };
                                                                                      }
                                                                                      turns.push({
                                                                                        timestamp: ts,
                                                                                        dateStr: formatDateYMD(dt),
                                                                                        hour: dt.getHours(),
                                                                                        model,
                                                                                        multiplier,
                                                                                        credits: req.isCanceled && !hasExplicitCost ? 0 : credits,
                                                                                        promptChars: promptText.length,
                                                                                        responseChars: responseChars + toolRoundChars,
                                                                                        estimatedTokens,
                                                                                        promptPreview: promptText.slice(0, 90)
                                                                                      });
                                                                                    });

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
                                                                                  creditsByDay[t.dateStr] = (creditsByDay[t.dateStr] || 0) + t.credits;
                                                                                });
                                                                                const mult = explicitMultiplier !== undefined && !isNaN(explicitMultiplier) ? explicitMultiplier : fallbackMultiplier;
                                                                                return {
                                                                                  model: modelCandidate,
                                                                                  multiplier: mult,
                                                                                  credits: mult,
                                                                                  hasExplicitCost: explicitMultiplier !== undefined,
                                                                                  detailsTokens
                                                                                };
                                                                              }
                                                                              if (turns.length === 0) {
                                                                                return undefined;
                                                                              }

                                                                              if (turns.length === 0) {
                                                                                return undefined;
                                                                              }
                                                                              const primaryDateStr =
                                                                                Object.entries(creditsByDay).sort((a, b) => b[1] - a[1])[0]?.[0] || sorted[0].dateStr;
                                                                              interface ParsedSessionData {
                                                                                sessionId: string;
                                                                                title: string;
                                                                                workspaceName: string;
                                                                                turns: ChatTurnRecord[];
                                                                              }
                                                                              const sessionLevelCredits =
                                                                                readNumericCredits(state) ??
                                                                                readNumericCredits(state.usage) ??
                                                                                readNumericCredits(state.stats) ??
                                                                                readNumericCredits(state.metadata);

                                                                              return {
                                                                                sessionId,
                                                                                title: (title || 'Copilot Chat Session').slice(0, 95),
                                                                                workspaceName,
                                                                                turns
                                                                              };
                                                                            }
                                                                    const primaryModel =
                                                                              Object.entries(modelsUsed).sort((a, b) => b[1].credits - a[1].credits || b[1].messages - a[1].messages)[0]?.[0] ||
                                                                              'claude-sonnet-4';
                                                                            function parseSessionObject(
                                                                              state: any,
                                                                              fallbackSessionId: string,
                                                                              workspaceName: string,
                                                                              fallbackMtimeMs: number,
                                                                              multipliers?: Record<string, number>
                                                                            ): ParsedSessionData | undefined {
                                                                              if (!state || typeof state !== 'object') {
                                                                                return undefined;
                                                                              }
                                                                              const requests = Array.isArray(state.requests) ? state.requests : [];
                                                                              if (requests.length === 0) {
                                                                                return undefined;
                                                                              }
                                                                              if (sessionLevelCredits !== undefined) {
                                                                                const sumTurns = turns.reduce((acc, t) => acc + t.credits, 0);
                                                                                if (sessionLevelCredits > sumTurns + 0.01) {
                                                                                  if (sumTurns > 0) {
                                                                                    const ratio = sessionLevelCredits / sumTurns;
                                                                                    for (const t of turns) {
                                                                                      t.credits = Math.round(t.credits * ratio * 1000) / 1000;
                                                                                    }
                                                                                  } else {
                                                                                    const perTurn = sessionLevelCredits / turns.length;
                                                                                    for (const t of turns) {
                                                                                      t.credits = Math.round(perTurn * 1000) / 1000;
                                                                                    }
                                                                                  }
                                                                                }
                                                                              }

                                                                              function buildSessionRecordFromTurns(
  return {
                                                                                sessionId,
                                                                                title: (title || 'Copilot Chat Session').slice(0, 95),
                                                                                workspaceName,
                                                                                turns
                                                                              };
                                                                            }

                                                                            function buildMonthlySessionRecord(
                                                                              sessionId: string,
                                                                              title: string,
                                                                              workspaceName: string,
                                                                              turns: ChatTurnRecord[]
  sessionId: string,
                                                                              title: string,
                                                                              workspaceName: string,
                                                                              monthTurns: ChatTurnRecord[],
                                                                              totalHistoricalTurnsBeforeMonth = 0
                                                                            ): SessionRecord | undefined {
                                                                              if (turns.length === 0) {
                                                                                if (monthTurns.length === 0) {
                                                                                  return undefined;
                                                                                }
                                                                                totalHistoricalTurnsBeforeMonth = 0
                                                                                title: string,
                                                                                  workspaceName: string,
                                                                                    monthTurns: ChatTurnRecord[],
                                                                                      totalHistoricalTurnsBeforeMonth = 0,
                                                                                      totalSessionCredits ?: number,
                                                                                      totalSessionMessages ?: number
): SessionRecord | undefined {
                                                                                  if (monthTurns.length === 0) {
                                                                                    return undefined;
                                                                                  }
                                                                                  const totalThreadTurns = totalHistoricalTurnsBeforeMonth + sorted.length;
                                                                                  const hasContextBloat = totalThreadTurns > 20 || cumulativeContextTokens > 60000;
                                                                                  const sessionId = String(state.sessionId || fallbackSessionId);
                                                                                  let title = String(state.customTitle || state.computedTitle || '').trim();
                                                                                  const baseCreationMs =
                                                                                    typeof state.creationDate === 'number' && state.creationDate > 1000000000000
                                                                                      ? state.creationDate
                                                                                      : fallbackMtimeMs - requests.length * 45000;
                                                                                  if (monthTurns.length === 0) {
                                                                                    return undefined;
                                                                                  }
                                                                                  const sorted = [...monthTurns].sort((a, b) => a.timestamp - b.timestamp);
                                                                                  const startTime = sorted[0].timestamp;
                                                                                  const endTime = sorted[sorted.length - 1].timestamp;
                                                                                  const durationMinutes = Math.max(1, Math.round((endTime - startTime) / 60000));

                                                                                  turns.sort((a, b) => a.timestamp - b.timestamp);
                                                                                  const startTime = turns[0].timestamp;
                                                                                  const endTime = turns[turns.length - 1].timestamp;
                                                                                  const sorted = [...monthTurns].sort((a, b) => a.timestamp - b.timestamp);
                                                                                  const startTime = sorted[0].timestamp;
                                                                                  const endTime = sorted[sorted.length - 1].timestamp;
                                                                                  const durationMinutes = Math.max(1, Math.round((endTime - startTime) / 60000));
                                                                                  const dateStr = turns[0].dateStr;
                                                                                  const sorted = [...monthTurns].sort((a, b) => a.timestamp - b.timestamp);
                                                                                  const startTime = sorted[0].timestamp;
                                                                                  const endTime = sorted[sorted.length - 1].timestamp;
                                                                                  const durationMinutes = Math.max(1, Math.round((endTime - startTime) / 60000));
                                                                                  return {
                                                                                    sessionId,
                                                                                    title,
                                                                                    workspaceName,
                                                                                    dateStr: primaryDateStr,
                                                                                    startTime,
                                                                                    endTime,
                                                                                    durationMinutes,
                                                                                    messages: sorted.length,
                                                                                    credits: Math.round(credits * 100) / 100,
                                                                                    estimatedTokens: directTokens,
                                                                                    cumulativeContextTokens,
                                                                                    modelsUsed,
                                                                                    primaryModel,
                                                                                    dailyLimitPercent: 0,
                                                                                    expenseTier: 'normal',
                                                                                    hasContextBloat,
                                                                                    post20TurnCredits: Math.round(post20TurnCredits * 100) / 100,
                                                                                    turns: sorted
                                                                                  };
                                                                                }
                                                                                const turns: ChatTurnRecord[] = [];
                                                                                requests.forEach((req: any, idx: number) => {
                                                                                  if (!req) {
                                                                                    return;
                                                                                  }
                                                                                  const promptText =
                                                                                    typeof req.message === 'string'
                                                                                      ? req.message
                                                                                      : req.message?.text ||
                                                                                      (Array.isArray(req.message?.parts) ? req.message.parts.map((p: any) => p?.text || '').join(' ') : '') ||
                                                                                      req.prompt ||
                                                                                      '';
                                                                                  let credits = 0;
                                                                                  let directTokens = 0;
                                                                                  let cumulativeContextTokens = 0;
                                                                                  let runningThreadTokens = totalHistoricalTurnsBeforeMonth * 800;
                                                                                  let post20TurnCredits = 0;
                                                                                  const modelsUsed: Record<string, { messages: number; credits: number }> = {};
                                                                                  const creditsByDay: Record<string, number> = {};

                                                                                  let credits = 0;
                                                                                  let directTokens = 0;
                                                                                  let cumulativeContextTokens = 0;
                                                                                  let runningThreadTokens = 0;
                                                                                  let runningThreadTokens = totalHistoricalTurnsBeforeMonth * 800;
                                                                                  let post20TurnCredits = 0;
                                                                                  const modelsUsed: Record<string, { messages: number; credits: number }> = {};
                                                                                  const creditsByDay: Record<string, number> = {};
                                                                                  let credits = 0;
                                                                                  let directTokens = 0;
                                                                                  let cumulativeContextTokens = 0;
                                                                                  let runningThreadTokens = totalHistoricalTurnsBeforeMonth * 800;
                                                                                  let post20TurnCredits = 0;
                                                                                  const modelsUsed: Record<string, { messages: number; credits: number }> = {};
                                                                                  const creditsByDay: Record<string, number> = {};
                                                                                  interface SessionFileCandidate {
                                                                                    fullPath: string;
                                                                                    workspaceName: string;
                                                                                    mtimeMs: number;
                                                                                    size: number;
                                                                                  }
                                                                                  if (!title && promptText) {
                                                                                    title = promptText.replace(/\s+/g, ' ').trim();
                                                                                  }
                                                                                  sorted.forEach((t, idx) => {
                                                                                    credits += t.credits;
                                                                                    directTokens += t.estimatedTokens;
                                                                                    runningThreadTokens += t.estimatedTokens;
                                                                                    cumulativeContextTokens += runningThreadTokens;

                                                                                    turns.forEach((t, idx) => {
                                                                                      sorted.forEach((t, idx) => {
                                                                                        credits += t.credits;
                                                                                        directTokens += t.estimatedTokens;
                                                                                        // Each turn in a chat session re-sends prior conversation context
                                                                                        runningThreadTokens += t.estimatedTokens;
                                                                                        cumulativeContextTokens += runningThreadTokens;
                                                                                        sorted.forEach((t, idx) => {
                                                                                          credits += t.credits;
                                                                                          directTokens += t.estimatedTokens;
                                                                                          runningThreadTokens += t.estimatedTokens;
                                                                                          cumulativeContextTokens += runningThreadTokens;
                                                                                          interface SessionCacheEntry {
                                                                                            mtimeMs: number;
                                                                                            size: number;
                                                                                            multipliersKey: string;
                                                                                            parsed: ParsedFullSession | null;
                                                                                          }
                                                                                          const responseChars = extractTextLength(req.response);
                                                                                          const resultObj = req?.result || (!Array.isArray(req?.response) ? req?.response?.result : undefined);
                                                                                          const toolRoundChars = Array.isArray(resultObj?.metadata?.toolCallRounds)
                                                                                            ? extractTextLength(resultObj.metadata.toolCallRounds)
                                                                                            : 0;
                                                                                          const globalTurnIndex = totalHistoricalTurnsBeforeMonth + idx;
                                                                                          if (globalTurnIndex >= 20) {
                                                                                            post20TurnCredits += t.credits;
                                                                                          }

                                                                                          if (idx >= 20) {
                                                                                            const globalTurnIndex = totalHistoricalTurnsBeforeMonth + idx;
                                                                                            if (globalTurnIndex >= 20) {
                                                                                              post20TurnCredits += t.credits;
                                                                                            }
                                                                                            const globalTurnIndex = totalHistoricalTurnsBeforeMonth + idx;
                                                                                            if (globalTurnIndex >= 20) {
                                                                                              post20TurnCredits += t.credits;
                                                                                            }
                                                                                            // In-memory cache so unchanged .jsonl files over WSL /mnt/c (9P) are never re-read or re-parsed
                                                                                            const sessionFileCache = new Map<string, SessionCacheEntry>();
                                                                                            const { model, multiplier, credits, hasExplicitCost, detailsTokens } = extractTurnCostAndModel(
                                                                                              req,
                                                                                              state,
                                                                                              multipliers
                                                                                            );
                                                                                            if (!modelsUsed[t.model]) {
                                                                                              modelsUsed[t.model] = { messages: 0, credits: 0 };
                                                                                            }
                                                                                            modelsUsed[t.model].messages += 1;
                                                                                            modelsUsed[t.model].credits = Math.round((modelsUsed[t.model].credits + t.credits) * 100) / 100;
                                                                                            creditsByDay[t.dateStr] = (creditsByDay[t.dateStr] || 0) + t.credits;
                                                                                          });

                                                                                        if (!modelsUsed[t.model]) {
                                                                                          modelsUsed[t.model] = { messages: 0, credits: 0 };
                                                                                        }
                                                                                        modelsUsed[t.model].messages += 1;
                                                                                        modelsUsed[t.model].credits = Math.round((modelsUsed[t.model].credits + t.credits) * 100) / 100;
                                                                                        if (!modelsUsed[t.model]) {
                                                                                          modelsUsed[t.model] = { messages: 0, credits: 0 };
                                                                                        }
                                                                                        modelsUsed[t.model].messages += 1;
                                                                                        modelsUsed[t.model].credits = Math.round((modelsUsed[t.model].credits + t.credits) * 100) / 100;
                                                                                        function parseRawSessionContent(
                                                                                          fullPath: string,
                                                                                          raw: string,
                                                                                          workspaceName: string,
                                                                                          mtimeMs: number,
                                                                                          multipliers: Record<string, number>
                                                                                        ): ParsedFullSession | undefined {
                                                                                          const baseId = path.basename(fullPath).replace(/\.(jsonl|json)$/i, '');
                                                                                          const state = fullPath.endsWith('.jsonl') ? replayJsonlMutationLog(raw) : JSON.parse(raw);
                                                                                          return parseSessionObject(state, baseId, workspaceName, mtimeMs, multipliers);
                                                                                        }
                                                                                        if (req.isCanceled && !hasExplicitCost && responseChars === 0 && toolRoundChars === 0) {
                                                                                          return;
                                                                                        }
                                                                                        const primaryDateStr = Object.entries(creditsByDay).sort((a, b) => b[1] - a[1])[0]?.[0] || sorted[0].dateStr;
                                                                                        const primaryModel =
                                                                                          Object.entries(modelsUsed).sort((a, b) => b[1].credits - a[1].credits || b[1].messages - a[1].messages)[0]?.[0] ||
                                                                                          'claude-sonnet-4';

                                                                                        creditsByDay[t.dateStr] = (creditsByDay[t.dateStr] || 0) + t.credits;
                                                                                      });
                                                                                      creditsByDay[t.dateStr] = (creditsByDay[t.dateStr] || 0) + t.credits;
                                                                                    });
                                                                                    function groupParsedSessionsByMonth(
                                                                                      parsedEntries: Array<ParsedFullSession & { mtimeMs: number }>
                                                                                    ): Record<string, SessionRecord[]> {
                                                                                      const parsedById = new Map<string, ParsedFullSession & { mtimeMs: number }>();
                                                                                      for (const entry of parsedEntries) {
                                                                                        if (!entry || entry.turns.length === 0) {
                                                                                          continue;
                                                                                        }
                                                                                        const prev = parsedById.get(entry.sessionId);
                                                                                        if (!prev || entry.turns.length > prev.turns.length || entry.mtimeMs > prev.mtimeMs) {
                                                                                          parsedById.set(entry.sessionId, entry);
                                                                                        }
                                                                                      }
                                                                                      const ts =
                                                                                        typeof req.timestamp === 'number' && req.timestamp > 1000000000000
                                                                                          ? req.timestamp
                                                                                          : typeof req.requestDate === 'number' && req.requestDate > 1000000000000
                                                                                            ? req.requestDate
                                                                                            : baseCreationMs + idx * 45000;
                                                                                      const totalThreadTurns = totalHistoricalTurnsBeforeMonth + sorted.length;
                                                                                      const hasContextBloat = totalThreadTurns > 20 || cumulativeContextTokens > 60000;
                                                                                      const roundedMonthCredits = Math.round(credits * 100) / 100;

                                                                                      const primaryModel = Object.entries(modelsUsed)
                                                                                        .sort((a, b) => b[1].credits - a[1].credits || b[1].messages - a[1].messages)[0]?.[0] || 'claude-3.7-sonnet';
                                                                                      // Primary date within this month is the date with the highest credit spend (or first date if 0x model)
                                                                                      const primaryDateStr =
                                                                                        Object.entries(creditsByDay).sort((a, b) => b[1] - a[1])[0]?.[0] || sorted[0].dateStr;
                                                                                      const primaryDateStr =
                                                                                        Object.entries(creditsByDay).sort((a, b) => b[1] - a[1])[0]?.[0] || sorted[0].dateStr;
                                                                                      const byMonth: Record<string, SessionRecord[]> = {};
                                                                                      for (const session of parsedById.values()) {
                                                                                        const sortedTurns = [...session.turns].sort((a, b) => a.timestamp - b.timestamp);
                                                                                        const monthTurnGroups = new Map<string, { turns: ChatTurnRecord[]; priorCount: number }>();
                                                                                        const dt = new Date(ts);
                                                                                        const usageMeta = resultObj?.metadata?.usage || req.usage;
                                                                                        let exactTokens =
                                                                                          typeof usageMeta?.totalTokens === 'number'
                                                                                            ? usageMeta.totalTokens
                                                                                            : typeof usageMeta?.promptTokens === 'number' || typeof usageMeta?.completionTokens === 'number'
                                                                                              ? (usageMeta.promptTokens || 0) + (usageMeta.completionTokens || 0)
                                                                                              : 0;
                                                                                        return {
                                                                                          sessionId,
                                                                                          title,
                                                                                          workspaceName,
                                                                                          dateStr: primaryDateStr,
                                                                                          startTime,
                                                                                          endTime,
                                                                                          durationMinutes,
                                                                                          messages: sorted.length,
                                                                                          credits: roundedMonthCredits,
                                                                                          totalSessionCredits:
                                                                                            totalSessionCredits !== undefined ? Math.round(totalSessionCredits * 100) / 100 : roundedMonthCredits,
                                                                                          totalSessionMessages: totalSessionMessages ?? sorted.length,
                                                                                          estimatedTokens: directTokens,
                                                                                          cumulativeContextTokens,
                                                                                          modelsUsed,
                                                                                          primaryModel,
                                                                                          dailyLimitPercent: 0,
                                                                                          expenseTier: 'normal',
                                                                                          hasContextBloat,
                                                                                          post20TurnCredits: Math.round(post20TurnCredits * 100) / 100,
                                                                                          turns: sorted
                                                                                        };
                                                                                      }

                                                                                      const hasContextBloat = turns.length > 20 || cumulativeContextTokens > 60000;
                                                                                      const primaryModel =
                                                                                        Object.entries(modelsUsed).sort((a, b) => b[1].credits - a[1].credits || b[1].messages - a[1].messages)[0]?.[0] ||
                                                                                        'claude-sonnet-4';
                                                                                      const primaryModel =
                                                                                        Object.entries(modelsUsed).sort((a, b) => b[1].credits - a[1].credits || b[1].messages - a[1].messages)[0]?.[0] ||
                                                                                        'claude-sonnet-4';
                                                                                      sortedTurns.forEach((turn, idx) => {
                                                                                        const mKey = turn.dateStr.slice(0, 7);
                                                                                        let grp = monthTurnGroups.get(mKey);
                                                                                        if (!grp) {
                                                                                          grp = { turns: [], priorCount: idx };
                                                                                          monthTurnGroups.set(mKey, grp);
                                                                                        }
                                                                                        grp.turns.push(turn);
                                                                                      });
                                                                                      if (exactTokens === 0 && Array.isArray(resultObj?.metadata?.toolCallRounds)) {
                                                                                        for (const r of resultObj.metadata.toolCallRounds) {
                                                                                          const ru = r?.usage;
                                                                                          if (typeof ru?.totalTokens === 'number') {
                                                                                            exactTokens += ru.totalTokens;
                                                                                          } else if (typeof ru?.promptTokens === 'number' || typeof ru?.completionTokens === 'number') {
                                                                                            exactTokens += (ru.promptTokens || 0) + (ru.completionTokens || 0);
                                                                                          }
                                                                                        }
                                                                                      }
                                                                                      interface CachedSessionEntry {
                                                                                        mtimeMs: number;
                                                                                        size: number;
                                                                                        multipliersKey: string;
                                                                                        parsed: ParsedSessionData | null;
                                                                                      }

                                                                                      const totalThreadTurns = totalHistoricalTurnsBeforeMonth + sorted.length;
                                                                                      const hasContextBloat = totalThreadTurns > 20 || cumulativeContextTokens > 60000;
                                                                                      const totalThreadTurns = totalHistoricalTurnsBeforeMonth + sorted.length;
                                                                                      const hasContextBloat = totalThreadTurns > 20 || cumulativeContextTokens > 60000;
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
                                                                                          byMonth[mKey].push(rec);
                                                                                        }
                                                                                      }
                                                                                    }
                                                                                    const estimatedTokens =
                                                                                      exactTokens > 0
                                                                                        ? exactTokens
                                                                                        : detailsTokens && detailsTokens > 0
                                                                                          ? detailsTokens
                                                                                          : Math.max(60, Math.ceil((promptText.length + responseChars + toolRoundChars) / 4));
                                                                                    // In-memory cache so unchanged .jsonl files over WSL /mnt/c (9P) are never re-read or re-parsed
                                                                                    const sessionFileCache = new Map<string, CachedSessionEntry>();

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
  return {
                                                                                        sessionId,
                                                                                        title,
                                                                                        workspaceName,
                                                                                        dateStr: primaryDateStr,
                                                                                        startTime,
                                                                                        endTime,
                                                                                        durationMinutes,
                                                                                        messages: sorted.length,
                                                                                        credits: Math.round(credits * 100) / 100,
                                                                                        estimatedTokens: directTokens,
                                                                                        cumulativeContextTokens,
                                                                                        modelsUsed,
                                                                                        primaryModel,
                                                                                        dailyLimitPercent: 0,
                                                                                        expenseTier: 'normal',
                                                                                        hasContextBloat,
                                                                                        post20TurnCredits: Math.round(post20TurnCredits * 100) / 100,
                                                                                        turns: sorted
                                                                                      };
                                                                                    }
                                                                                    turns: sorted
                                                                                  };
                                                                                }
  return byMonth;
                                                                              }
                                                                              turns.push({
                                                                                timestamp: ts,
                                                                                dateStr: formatDateYMD(dt),
                                                                                hour: dt.getHours(),
                                                                                model,
                                                                                multiplier,
                                                                                credits: req.isCanceled && !hasExplicitCost ? 0 : credits,
                                                                                promptChars: promptText.length,
                                                                                responseChars: responseChars + toolRoundChars,
                                                                                estimatedTokens,
                                                                                promptPreview: promptText.slice(0, 90)
                                                                              });
                                                                            });
                                                                            function parseRawSessionContent(
                                                                              fullPath: string,
                                                                              raw: string,
                                                                              workspaceName: string,
                                                                              mtimeMs: number,
                                                                              multipliers?: Record<string, number>
                                                                            ): ParsedSessionData | undefined {
                                                                              const baseId = path.basename(fullPath).replace(/\.(jsonl|json)$/i, '');
                                                                              const state = fullPath.endsWith('.jsonl') ? replayJsonlMutationLog(raw) : JSON.parse(raw);
                                                                              return parseSessionObject(state, baseId, workspaceName, mtimeMs, multipliers);
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
                                                                              export function mineAllChatSessionsByMonth(
                                                                                userDirs: string[],
                                                                                earliestTimestampMs: number,
                                                                                multipliers: Record<string, number>
                                                                              ): Record<string, SessionRecord[]> {
                                                                                const sessionFiles: { fullPath: string; workspaceName: string; mtimeMs: number }[] = [];
                                                                                /**
                                                                                 * Non-blocking async chat session miner optimized for Remote-WSL (`/mnt/c` 9P filesystem)
                                                                                 * with bounded concurrency and `(mtimeMs, size)` caching.
                                                                                 */
                                                                                export async function mineAllChatSessionsByMonthAsync(
                                                                                  userDirs: string[],
                                                                                  earliestTimestampMs: number,
                                                                                  multipliers: Record<string, number>
                                                                                ): Promise<Record<string, SessionRecord[]>> {
                                                                                  const fsp = fs.promises;
                                                                                  const multipliersKey = JSON.stringify(multipliers || {});
                                                                                  const sessionFiles: SessionFileCandidate[] = [];
                                                                                  if (turns.length === 0) {
                                                                                    return undefined;
                                                                                  }
                                                                                  function groupParsedSessionsByMonth(
                                                                                    parsedEntries: Array<ParsedSessionData & { mtimeMs: number }>
                                                                                  ): Record<string, SessionRecord[]> {
                                                                                    const parsedById = new Map<string, ParsedSessionData & { mtimeMs: number }>();
                                                                                    for (const entry of parsedEntries) {
                                                                                      if (!entry || entry.turns.length === 0) {
                                                                                        continue;
                                                                                      }
                                                                                      const prev = parsedById.get(entry.sessionId);
                                                                                      if (!prev || entry.turns.length > prev.turns.length || entry.mtimeMs > prev.mtimeMs) {
                                                                                        parsedById.set(entry.sessionId, entry);
                                                                                      }
                                                                                    }

                                                                                    const sessionId = data.sessionId || path.basename(filePath, '.json');
                                                                                    let title: string = data.customTitle || '';
                                                                                    const turns: ChatTurnRecord[] = [];
                                                                                    for (const userDir of userDirs) {
                                                                                      if (!userDir || !fs.existsSync(userDir)) {
                                                                                        continue;
                                                                                      }
                                                                                      for (const userDir of userDirs) {
                                                                                        if (!userDir || !fs.existsSync(userDir)) {
                                                                                          continue;
                                                                                        }
                                                                                        const collectChatDirFiles = async (chatDir: string, workspaceNameResolver: () => Promise<string>) => {
                                                                                          let entries: string[];
                                                                                          try {
                                                                                            entries = (await fsp.readdir(chatDir)).filter(f => f.endsWith('.jsonl') || f.endsWith('.json'));
                                                                                          } catch {
                                                                                            return;
                                                                                          }
                                                                                          if (entries.length === 0) {
                                                                                            return;
                                                                                          }
                                                                                          const wsName = await workspaceNameResolver();
                                                                                          for (const f of entries) {
                                                                                            const fp = path.join(chatDir, f);
                                                                                            try {
                                                                                              const st = await fsp.stat(fp);
                                                                                              if (st.mtimeMs >= earliestTimestampMs) {
                                                                                                sessionFiles.push({ fullPath: fp, workspaceName: wsName, mtimeMs: st.mtimeMs, size: st.size });
                                                                                              }
                                                                                            } catch {
                                                                                              // ignore disappearing temp files
                                                                                            }
                                                                                          }
                                                                                        };
                                                                                        const sessionLevelCredits =
                                                                                          readNumericCredits(state) ??
                                                                                          readNumericCredits(state.usage) ??
                                                                                          readNumericCredits(state.stats) ??
                                                                                          readNumericCredits(state.metadata);
                                                                                        const byMonth: Record<string, SessionRecord[]> = {};
                                                                                        for (const session of parsedById.values()) {
                                                                                          const sortedTurns = [...session.turns].sort((a, b) => a.timestamp - b.timestamp);
                                                                                          const totalSessionCredits = sortedTurns.reduce((sum, t) => sum + t.credits, 0);
                                                                                          const totalSessionMessages = sortedTurns.length;
                                                                                          const monthTurnGroups = new Map<string, { turns: ChatTurnRecord[]; priorCount: number }>();

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
                                                                                            for (const userDir of userDirs) {
                                                                                              if (!userDir) {
                                                                                                continue;
                                                                                              }
                                                                                              if (sessionLevelCredits !== undefined) {
                                                                                                const sumTurns = turns.reduce((acc, t) => acc + t.credits, 0);
                                                                                                if (sessionLevelCredits > sumTurns + 0.01) {
                                                                                                  if (sumTurns > 0) {
                                                                                                    const ratio = sessionLevelCredits / sumTurns;
                                                                                                    for (const t of turns) {
                                                                                                      t.credits = Math.round(t.credits * ratio * 1000) / 1000;
                                                                                                    }
                                                                                                  } else {
                                                                                                    const perTurn = sessionLevelCredits / turns.length;
                                                                                                    for (const t of turns) {
                                                                                                      t.credits = Math.round(perTurn * 1000) / 1000;
                                                                                                    }
                                                                                                  }
                                                                                                }
                                                                                              }
                                                                                              sortedTurns.forEach((turn, idx) => {
                                                                                                const mKey = turn.dateStr.slice(0, 7);
                                                                                                let grp = monthTurnGroups.get(mKey);
                                                                                                if (!grp) {
                                                                                                  grp = { turns: [], priorCount: idx };
                                                                                                  monthTurnGroups.set(mKey, grp);
                                                                                                }
                                                                                                grp.turns.push(turn);
                                                                                              });

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
                                                                                                const wsRoot = path.join(userDir, 'workspaceStorage');
                                                                                                let hashEntries: string[] = [];
                                                                                                try {
                                                                                                  hashEntries = await fsp.readdir(wsRoot);
                                                                                                } catch {
                                                                                                  hashEntries = [];
                                                                                                }
                                                                                                return {
                                                                                                  sessionId,
                                                                                                  title: (title || 'Copilot Chat Session').slice(0, 95),
                                                                                                  workspaceName,
                                                                                                  turns
                                                                                                };
                                                                                              }
                                                                                              for (const [mKey, grp] of monthTurnGroups.entries()) {
                                                                                                const rec = buildMonthlySessionRecord(
                                                                                                  session.sessionId,
                                                                                                  session.title,
                                                                                                  session.workspaceName,
                                                                                                  grp.turns,
                                                                                                  grp.priorCount,
                                                                                                  totalSessionCredits,
                                                                                                  totalSessionMessages
                                                                                                );
                                                                                                if (rec) {
                                                                                                  if (!byMonth[mKey]) {
                                                                                                    byMonth[mKey] = [];
                                                                                                  }
                                                                                                  byMonth[mKey].push(rec);
                                                                                                }
                                                                                              }
                                                                                            }
                                                                                            return byMonth;
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
                                                                                      // Scan workspaceStorage hash folders in parallel batches of 24 to minimize WSL /mnt/c 9P latency
                                                                                      const BATCH = 24;
                                                                                      for (let i = 0; i < hashEntries.length; i += BATCH) {
                                                                                        const slice = hashEntries.slice(i, i + BATCH);
                                                                                        await Promise.all(
                                                                                          slice.map(async hashName => {
                                                                                            const hashDir = path.join(wsRoot, hashName);
                                                                                            const chatDir = path.join(hashDir, 'chatSessions');
                                                                                            await collectChatDirFiles(chatDir, async () => {
                                                                                              try {
                                                                                                const rawWs = await fsp.readFile(path.join(hashDir, 'workspace.json'), 'utf8');
                                                                                                return parseWorkspaceJsonContent(rawWs);
                                                                                              } catch {
                                                                                                return 'Workspace';
                                                                                              }
                                                                                            });
                                                                                          })
                                                                                        );
                                                                                      }
                                                                                      function buildMonthlySessionRecord(
                                                                                        sessionId: string,
                                                                                        title: string,
                                                                                        workspaceName: string,
                                                                                        monthTurns: ChatTurnRecord[],
                                                                                        totalHistoricalTurnsBeforeMonth = 0,
                                                                                        totalSessionCredits?: number,
                                                                                        totalSessionMessages?: number
                                                                                      ): SessionRecord | undefined {
                                                                                        if (monthTurns.length === 0) {
                                                                                          return undefined;
                                                                                        }
                                                                                        const sorted = [...monthTurns].sort((a, b) => a.timestamp - b.timestamp);
                                                                                        const startTime = sorted[0].timestamp;
                                                                                        const endTime = sorted[sorted.length - 1].timestamp;
                                                                                        const durationMinutes = Math.max(1, Math.round((endTime - startTime) / 60000));
                                                                                        /**
                                                                                         * Non-blocking async chat session miner optimized for Remote-WSL (`/mnt/c` 9P filesystem)
                                                                                         * with bounded concurrency and `(mtimeMs, size)` caching.
                                                                                         */
                                                                                        export async function mineAllChatSessionsByMonthAsync(
                                                                                          userDirs: string[],
                                                                                          earliestTimestampMs: number,
                                                                                          multipliers?: Record<string, number>,
                                                                                          workspaceNameOverrides?: Record<string, string>
                                                                                        ): Promise<Record<string, SessionRecord[]>> {
                                                                                          const fsp = fs.promises;
                                                                                          const multipliersKey = JSON.stringify(multipliers || {});
                                                                                          const sessionFiles: Array<{ fullPath: string; workspaceName: string; mtimeMs: number; size: number }> = [];

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
                                                                                          const parsedById = new Map<string, ParsedFullSession & { mtimeMs: number }>();
                                                                                          const emptyChatDirs = [path.join(userDir, 'globalStorage', 'emptyWindowChatSessions')];
                                                                                          const profilesDir = path.join(userDir, 'profiles');
                                                                                          try {
                                                                                            const profiles = await fsp.readdir(profilesDir);
                                                                                            for (const prof of profiles) {
                                                                                              emptyChatDirs.push(path.join(profilesDir, prof, 'globalStorage', 'emptyWindowChatSessions'));
                                                                                            }
                                                                                          } catch {
                                                                                            // no profiles folder
                                                                                          }
                                                                                          let credits = 0;
                                                                                          let directTokens = 0;
                                                                                          let cumulativeContextTokens = 0;
                                                                                          let runningThreadTokens = totalHistoricalTurnsBeforeMonth * 800;
                                                                                          let post20TurnCredits = 0;
                                                                                          const modelsUsed: Record<string, { messages: number; credits: number }> = {};
                                                                                          const creditsByDay: Record<string, number> = {};
                                                                                          const collectChatDirFiles = async (chatDir: string, workspaceNameResolver: () => Promise<string>) => {
                                                                                            let entries: string[];
                                                                                            try {
                                                                                              entries = (await fsp.readdir(chatDir)).filter(f => f.endsWith('.jsonl') || f.endsWith('.json'));
                                                                                            } catch {
                                                                                              return;
                                                                                            }
                                                                                            if (entries.length === 0) {
                                                                                              return;
                                                                                            }
                                                                                            const wsName = await workspaceNameResolver();
                                                                                            for (const f of entries) {
                                                                                              const fp = path.join(chatDir, f);
                                                                                              try {
                                                                                                const st = await fsp.stat(fp);
                                                                                                if (st.mtimeMs >= earliestTimestampMs) {
                                                                                                  sessionFiles.push({ fullPath: fp, workspaceName: wsName, mtimeMs: st.mtimeMs, size: st.size });
                                                                                                }
                                                                                              } catch {
                                                                                                // ignore disappearing temp files
                                                                                              }
                                                                                            }
                                                                                          };

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
                                                                                              for (const item of sessionFiles) {
                                                                                                try {
                                                                                                  const raw = fs.readFileSync(item.fullPath, 'utf8');
                                                                                                  const baseId = path.basename(item.fullPath).replace(/\.(jsonl|json)$/i, '');
                                                                                                  const state = item.fullPath.endsWith('.jsonl')
                                                                                                    ? replayJsonlMutationLog(raw)
                                                                                                    : JSON.parse(raw);
                                                                                                  for (const emptyDir of emptyChatDirs) {
                                                                                                    await collectChatDirFiles(emptyDir, async () => 'Empty Window');
                                                                                                  }
                                                                                                }
  sorted.forEach((t, idx) => {
                                                                                                  credits += t.credits;
                                                                                                  directTokens += t.estimatedTokens;
                                                                                                  runningThreadTokens += t.estimatedTokens;
                                                                                                  cumulativeContextTokens += runningThreadTokens;
                                                                                                  for (const userDir of userDirs) {
                                                                                                    if (!userDir) {
                                                                                                      continue;
                                                                                                    }
                                                                                                    const wsRoot = path.join(userDir, 'workspaceStorage');
                                                                                                    let hashEntries: string[] = [];
                                                                                                    try {
                                                                                                      hashEntries = await fsp.readdir(wsRoot);
                                                                                                    } catch {
                                                                                                      hashEntries = [];
                                                                                                    }

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
                                                                                                const parsed = parseSessionObject(state, baseId, item.workspaceName, item.mtimeMs, multipliers);
                                                                                                if (!parsed || parsed.turns.length === 0) {
                                                                                                  continue;
                                                                                                }
                                                                                                const parsedEntries: Array<ParsedFullSession & { mtimeMs: number }> = [];
                                                                                                const READ_BATCH = 16;
                                                                                                for (let i = 0; i < sessionFiles.length; i += READ_BATCH) {
                                                                                                  const batch = sessionFiles.slice(i, i + READ_BATCH);
                                                                                                  await Promise.all(
                                                                                                    batch.map(async item => {
                                                                                                      const cached = sessionFileCache.get(item.fullPath);
                                                                                                      if (
                                                                                                        cached &&
                                                                                                        cached.mtimeMs === item.mtimeMs &&
                                                                                                        cached.size === item.size &&
                                                                                                        cached.multipliersKey === multipliersKey
                                                                                                      ) {
                                                                                                        if (cached.parsed) {
                                                                                                          parsedEntries.push({ ...cached.parsed, workspaceName: item.workspaceName, mtimeMs: item.mtimeMs });
                                                                                                        }
                                                                                                        return;
                                                                                                      }
                                                                                                      const globalTurnIndex = totalHistoricalTurnsBeforeMonth + idx;
                                                                                                      if (globalTurnIndex >= 20) {
                                                                                                        post20TurnCredits += t.credits;
                                                                                                      }
                                                                                                      const BATCH = 24;
                                                                                                      for (let i = 0; i < hashEntries.length; i += BATCH) {
                                                                                                        const slice = hashEntries.slice(i, i + BATCH);
                                                                                                        await Promise.all(
                                                                                                          slice.map(async hashName => {
                                                                                                            const hashDir = path.join(wsRoot, hashName);
                                                                                                            const chatDir = path.join(hashDir, 'chatSessions');
                                                                                                            const overrideName = workspaceNameOverrides?.[hashName];
                                                                                                            await collectChatDirFiles(chatDir, async () => {
                                                                                                              try {
                                                                                                                const rawWs = await fsp.readFile(path.join(hashDir, 'workspace.json'), 'utf8');
                                                                                                                return await parseWorkspaceJsonContentAsync(rawWs, hashDir, overrideName);
                                                                                                              } catch {
                                                                                                                return overrideName || 'Workspace';
                                                                                                              }
                                                                                                            });
                                                                                                          })
                                                                                                        );
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
                                                                                              const prev = parsedById.get(parsed.sessionId);
                                                                                              if (!prev || parsed.turns.length > prev.turns.length || item.mtimeMs > prev.mtimeMs) {
                                                                                                parsedById.set(parsed.sessionId, { ...parsed, mtimeMs: item.mtimeMs });
                                                                                              }
                                                                                            } catch {
                                                                                              // Ignore unreadable or empty file
                                                                                            }
                                                                                          }
                                                                                          try {
                                                                                            const raw = await fsp.readFile(item.fullPath, 'utf8');
                                                                                            const parsed = parseRawSessionContent(item.fullPath, raw, item.workspaceName, item.mtimeMs, multipliers);
                                                                                            sessionFileCache.set(item.fullPath, {
                                                                                              mtimeMs: item.mtimeMs,
                                                                                              size: item.size,
                                                                                              multipliersKey,
                                                                                              parsed: parsed || null
                                                                                            });
                                                                                            if (parsed) {
                                                                                              parsedEntries.push({ ...parsed, mtimeMs: item.mtimeMs });
                                                                                            }
                                                                                          } catch {
                                                                                            // Ignore unreadable or partially written file
                                                                                          }
                                                                                        })
                                                                                        const emptyChatDirs = [path.join(userDir, 'globalStorage', 'emptyWindowChatSessions')];
                                                                                        const profilesDir = path.join(userDir, 'profiles');
                                                                                        try {
                                                                                          const profiles = await fsp.readdir(profilesDir);
                                                                                          for (const prof of profiles) {
                                                                                            emptyChatDirs.push(path.join(profilesDir, prof, 'globalStorage', 'emptyWindowChatSessions'));
                                                                                          }
                                                                                        } catch {
                                                                                          // no profiles folder
                                                                                        }

                                                                                        for (const emptyDir of emptyChatDirs) {
                                                                                          await collectChatDirFiles(emptyDir, async () => 'Empty Window');
                                                                                        }
                                                                                      }

                                                                                      const parsedEntries: Array<ParsedSessionData & { mtimeMs: number }> = [];
                                                                                      const READ_BATCH = 16;
                                                                                      for (let i = 0; i < sessionFiles.length; i += READ_BATCH) {
                                                                                        const batch = sessionFiles.slice(i, i + READ_BATCH);
                                                                                        await Promise.all(
                                                                                          batch.map(async item => {
                                                                                            const cached = sessionFileCache.get(item.fullPath);
                                                                                            if (
                                                                                              cached &&
                                                                                              cached.mtimeMs === item.mtimeMs &&
                                                                                              cached.size === item.size &&
                                                                                              cached.multipliersKey === multipliersKey
                                                                                            ) {
                                                                                              if (cached.parsed) {
                                                                                                parsedEntries.push({ ...cached.parsed, workspaceName: item.workspaceName, mtimeMs: item.mtimeMs });
                                                                                              }
                                                                                              return;
                                                                                            }
                                                                                            try {
                                                                                              const raw = await fsp.readFile(item.fullPath, 'utf8');
                                                                                              const parsed = parseRawSessionContent(item.fullPath, raw, item.workspaceName, item.mtimeMs, multipliers);
                                                                                              sessionFileCache.set(item.fullPath, {
                                                                                                mtimeMs: item.mtimeMs,
                                                                                                size: item.size,
                                                                                                multipliersKey,
                                                                                                parsed: parsed || null
                                                                                              });
                                                                                              if (parsed) {
                                                                                                parsedEntries.push({ ...parsed, mtimeMs: item.mtimeMs });
                                                                                              }
                                                                                            } catch {
                                                                                              // Ignore unreadable or partially written file
                                                                                            }
                                                                                          })
                                                                                        );
                                                                                      }
                                                                                      if (!modelsUsed[t.model]) {
                                                                                        modelsUsed[t.model] = { messages: 0, credits: 0 };
                                                                                      }
                                                                                      modelsUsed[t.model].messages += 1;
                                                                                      modelsUsed[t.model].credits = Math.round((modelsUsed[t.model].credits + t.credits) * 100) / 100;
                                                                                      creditsByDay[t.dateStr] = (creditsByDay[t.dateStr] || 0) + t.credits;
                                                                                    });
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
                                                                                    const byMonth: Record<string, SessionRecord[]> = {};
                                                                                    return groupParsedSessionsByMonth(parsedEntries);
                                                                                  }
                                                                                  const primaryDateStr = Object.entries(creditsByDay).sort((a, b) => b[1] - a[1])[0]?.[0] || sorted[0].dateStr;
                                                                                  const primaryModel =
                                                                                    Object.entries(modelsUsed).sort((a, b) => b[1].credits - a[1].credits || b[1].messages - a[1].messages)[0]?.[0] ||
                                                                                    'claude-sonnet-4';
                                                                                  return groupParsedSessionsByMonth(parsedEntries);
                                                                                }

                                                                                lines.forEach((line, idx) => {
                                                                                  try {
                                                                                    const obj = JSON.parse(line);
                                                                                    if (obj.customTitle && !title) {
                                                                                      title = obj.customTitle;
                                                                                      for (const session of parsedById.values()) {
                                                                                        const sortedTurns = [...session.turns].sort((a, b) => a.timestamp - b.timestamp);
                                                                                        const monthTurnGroups = new Map<string, { turns: ChatTurnRecord[]; priorCount: number }>();
                                                                                        for (const session of parsedById.values()) {
                                                                                          const sortedTurns = [...session.turns].sort((a, b) => a.timestamp - b.timestamp);
                                                                                          const monthTurnGroups = new Map<string, { turns: ChatTurnRecord[]; priorCount: number }>();
                                                                                          /**
                                                                                           * Synchronous chat session miner (used by unit tests and single-folder utilities).
                                                                                           */
                                                                                          export function mineAllChatSessionsByMonth(
                                                                                            userDirs: string[],
                                                                                            earliestTimestampMs: number,
                                                                                            multipliers: Record<string, number>
                                                                                          ): Record<string, SessionRecord[]> {
                                                                                            const multipliersKey = JSON.stringify(multipliers || {});
                                                                                            const sessionFiles: SessionFileCandidate[] = [];
                                                                                            const totalThreadTurns = totalHistoricalTurnsBeforeMonth + sorted.length;
                                                                                            const hasContextBloat = totalThreadTurns > 20 || cumulativeContextTokens > 60000;
                                                                                            const roundedMonthCredits = Math.round(credits * 100) / 100;
                                                                                            /**
                                                                                             * Synchronous chat session miner (used by unit tests and single-folder utilities).
                                                                                             */
                                                                                            export function mineAllChatSessionsByMonth(
                                                                                              userDirs: string[],
                                                                                              earliestTimestampMs: number,
                                                                                              multipliers?: Record<string, number>,
                                                                                              workspaceNameOverrides?: Record<string, string>
                                                                                            ): Record<string, SessionRecord[]> {
                                                                                              const multipliersKey = JSON.stringify(multipliers || {});
                                                                                              const sessionFiles: Array<{ fullPath: string; workspaceName: string; mtimeMs: number; size: number }> = [];

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
                                                                                              sortedTurns.forEach((turn, idx) => {
                                                                                                const mKey = turn.dateStr.slice(0, 7);
                                                                                                let grp = monthTurnGroups.get(mKey);
                                                                                                if (!grp) {
                                                                                                  grp = { turns: [], priorCount: idx };
                                                                                                  monthTurnGroups.set(mKey, grp);
                                                                                                }
                                                                                                grp.turns.push(turn);
                                                                                              });
                                                                                              for (const userDir of userDirs) {
                                                                                                if (!userDir || !fs.existsSync(userDir)) {
                                                                                                  continue;
                                                                                                }
                                                                                                return {
                                                                                                  sessionId,
                                                                                                  title,
                                                                                                  workspaceName,
                                                                                                  dateStr: primaryDateStr,
                                                                                                  startTime,
                                                                                                  endTime,
                                                                                                  durationMinutes,
                                                                                                  messages: sorted.length,
                                                                                                  credits: roundedMonthCredits,
                                                                                                  totalSessionCredits:
                                                                                                    totalSessionCredits !== undefined ? Math.round(totalSessionCredits * 100) / 100 : roundedMonthCredits,
                                                                                                  totalSessionMessages: totalSessionMessages ?? sorted.length,
                                                                                                  estimatedTokens: directTokens,
                                                                                                  cumulativeContextTokens,
                                                                                                  modelsUsed,
                                                                                                  primaryModel,
                                                                                                  dailyLimitPercent: 0,
                                                                                                  expenseTier: 'normal',
                                                                                                  hasContextBloat,
                                                                                                  post20TurnCredits: Math.round(post20TurnCredits * 100) / 100,
                                                                                                  turns: sorted
                                                                                                };
                                                                                              }
                                                                                              for (const userDir of userDirs) {
                                                                                                if (!userDir || !fs.existsSync(userDir)) {
                                                                                                  continue;
                                                                                                }
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
                                                                                                    const wsName = readWorkspaceName(hashDir, workspaceNameOverrides?.[hashName]);
                                                                                                    for (const f of files) {
                                                                                                      const fp = path.join(chatDir, f);
                                                                                                      try {
                                                                                                        const st = fs.statSync(fp);
                                                                                                        if (st.mtimeMs >= earliestTimestampMs) {
                                                                                                          sessionFiles.push({ fullPath: fp, workspaceName: wsName, mtimeMs: st.mtimeMs, size: st.size });
                                                                                                        }
                                                                                                      } catch {
                                                                                                        // ignore
                                                                                                      }
                                                                                                    }
                                                                                                  }
                                                                                                }

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
                                                                                                        byMonth[mKey].push(rec);
                                                                                                      }
                                                                                                    }
                                                                                                  }
                                                                                                  const wsRoot = path.join(userDir, 'workspaceStorage');
                                                                                                  if (fs.existsSync(wsRoot)) {
                                                                                                    let hashEntries: string[] = [];
                                                                                                    try {
                                                                                                      hashEntries = fs.readdirSync(wsRoot);
                                                                                                    } catch {
                                                                                                      hashEntries = [];
                                                                                                    }
                                                                                                    interface CachedSessionEntry {
                                                                                                      mtimeMs: number;
                                                                                                      size: number;
                                                                                                      multipliersKey: string;
                                                                                                      parsed: ParsedSessionData | null;
                                                                                                    }
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
                                                                                                            sessionFiles.push({ fullPath: fp, workspaceName: 'Empty Window', mtimeMs: st.mtimeMs, size: st.size });
                                                                                                          }
                                                                                                        }
                                                                                                      } catch {
                                                                                                        // ignore
                                                                                                      }
                                                                                                    }
                                                                                                  }

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
                                                                              return byMonth;
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
                                                                                    sessionFiles.push({ fullPath: fp, workspaceName: wsName, mtimeMs: st.mtimeMs, size: st.size });
                                                                                  }
                                                                                } catch {
                                                                                  // ignore
                                                                                }
                                                                              }
                                                                            }
                                                                          }
                                                                          // In-memory cache so unchanged .jsonl files over WSL /mnt/c (9P) are never re-read or re-parsed
                                                                          const sessionFileCache = new Map<string, CachedSessionEntry>();
                                                                          const parsedEntries: Array<ParsedSessionData & { mtimeMs: number }> = [];
                                                                          for (const item of sessionFiles) {
                                                                            const cached = sessionFileCache.get(item.fullPath);
                                                                            if (
                                                                              cached &&
                                                                              cached.mtimeMs === item.mtimeMs &&
                                                                              cached.size === item.size &&
                                                                              cached.multipliersKey === multipliersKey
                                                                            ) {
                                                                              if (cached.parsed) {
                                                                                parsedEntries.push({ ...cached.parsed, workspaceName: item.workspaceName, mtimeMs: item.mtimeMs });
                                                                              }
                                                                              continue;
                                                                            }
                                                                            try {
                                                                              const raw = fs.readFileSync(item.fullPath, 'utf8');
                                                                              const parsed = parseRawSessionContent(item.fullPath, raw, item.workspaceName, item.mtimeMs, multipliers);
                                                                              sessionFileCache.set(item.fullPath, {
                                                                                mtimeMs: item.mtimeMs,
                                                                                size: item.size,
                                                                                multipliersKey,
                                                                                parsed: parsed || null
                                                                              });
                                                                              if (parsed) {
                                                                                parsedEntries.push({ ...parsed, mtimeMs: item.mtimeMs });
                                                                              }
                                                                            } catch {
                                                                              // Ignore unreadable or empty file
                                                                            }
                                                                          }

                                                                          return buildSessionRecordFromTurns(sessionId, title || 'Copilot Session', workspaceName, turns);
                                                                          return byMonth;
                                                                        }
                                                                        export function scanLocalChatSessions(
                                                                          storagePath: string | undefined,
                                                                          year: number,
                                                                          month: number,
                                                                          multipliers: Record<string, number>
                                                                        ): SessionRecord[] {
                                                                          if (!storagePath || !fs.existsSync(storagePath)) {
                                                                            return [];
                                                                          }
                                                                          const userDir = path.basename(storagePath) === 'workspaceStorage' ? path.dirname(storagePath) : storagePath;
                                                                          const monthStartMs = new Date(year, month, 1, 0, 0, 0).getTime();
                                                                          const byMonth = mineAllChatSessionsByMonth([userDir], monthStartMs, multipliers);
                                                                          return byMonth[formatMonthKey(year, month)] || [];
                                                                        }
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
                                                                        function parseRawSessionContent(
                                                                          fullPath: string,
                                                                          raw: string,
                                                                          workspaceName: string,
                                                                          mtimeMs: number,
                                                                          multipliers?: Record<string, number>
                                                                        ): ParsedSessionData | undefined {
                                                                          const baseId = path.basename(fullPath).replace(/\.(jsonl|json)$/i, '');
                                                                          const state = fullPath.endsWith('.jsonl') ? replayJsonlMutationLog(raw) : JSON.parse(raw);
                                                                          return parseSessionObject(state, baseId, workspaceName, mtimeMs, multipliers);
                                                                        }
                                                                        return groupParsedSessionsByMonth(parsedEntries);
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
                                                                              sessionFiles.push({ fullPath: fp, workspaceName: 'Empty Window', mtimeMs: st.mtimeMs, size: st.size });
                                                                            }
                                                                          }
                                                                        } catch {
                                                                          // ignore
                                                                        }
                                                                      }
                                                                    }
                                                                    function groupParsedSessionsByMonth(
                                                                      parsedEntries: Array<ParsedSessionData & { mtimeMs: number }>
                                                                    ): Record<string, SessionRecord[]> {
                                                                      const parsedById = new Map<string, ParsedSessionData & { mtimeMs: number }>();
                                                                      for (const entry of parsedEntries) {
                                                                        if (!entry || entry.turns.length === 0) {
                                                                          continue;
                                                                        }
                                                                        const prev = parsedById.get(entry.sessionId);
                                                                        if (!prev || entry.turns.length > prev.turns.length || entry.mtimeMs > prev.mtimeMs) {
                                                                          parsedById.set(entry.sessionId, entry);
                                                                        }
                                                                      }
                                                                      export function scanLocalChatSessions(
                                                                        storagePath: string,
                                                                        year: number,
                                                                        month: number,
                                                                        multipliers?: Record<string, number>
                                                                      ): SessionRecord[] {
                                                                        if (!storagePath || !fs.existsSync(storagePath)) {
                                                                          return [];
                                                                        }
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
export function computeAnalytics(
                                                                          config: TrackerConfig,
                                                                          now: Date,
                                                                          sessionsInput: SessionRecord[],
                                                                          apiQuota?: ApiQuotaInfo,
                                                                          dailyQuotaLedger?: Record<string, number>
                                                                        ): AnalyticsSnapshot {
                                                                        const year = now.getFullYear();
                                                                        const month = now.getMonth();
                                                                        const currentDay = now.getDate();
                                                                        const todayStr = formatDateYMD(now);
                                                                        dailyQuotaLedger ?: Record<string, number>
                                                                        config: TrackerConfig,
                                                                          now: Date,
                                                                            sessionsInput: SessionRecord[],
                                                                              apiQuota ?: ApiQuotaInfo,
                                                                              dailyQuotaLedger ?: Record<string, number>
): AnalyticsSnapshot {
                                                                          const year = now.getFullYear();
                                                                          const month = now.getMonth();
                                                                          const currentDay = now.getDate();
                                                                          const todayStr = formatDateYMD(now);
                                                                          const parsedEntries: Array<ParsedFullSession & { mtimeMs: number }> = [];
                                                                          for (const item of sessionFiles) {
                                                                            const cached = sessionFileCache.get(item.fullPath);
                                                                            if (
                                                                              cached &&
                                                                              cached.mtimeMs === item.mtimeMs &&
                                                                              cached.size === item.size &&
                                                                              cached.multipliersKey === multipliersKey
                                                                            ) {
                                                                              if (cached.parsed) {
                                                                                parsedEntries.push({ ...cached.parsed, workspaceName: item.workspaceName, mtimeMs: item.mtimeMs });
                                                                              }
                                                                              continue;
                                                                            }
                                                                            const byMonth: Record<string, SessionRecord[]> = {};
                                                                            for (const session of parsedById.values()) {
                                                                              const sortedTurns = [...session.turns].sort((a, b) => a.timestamp - b.timestamp);
                                                                              const totalSessionCredits = sortedTurns.reduce((sum, t) => sum + t.credits, 0);
                                                                              const totalSessionMessages = sortedTurns.length;
                                                                              const monthTurnGroups = new Map<string, { turns: ChatTurnRecord[]; priorCount: number }>();
                                                                              const year = now.getFullYear();
                                                                              const month = now.getMonth();
                                                                              const currentDay = now.getDate();
                                                                              const todayStr = formatDateYMD(now);
                                                                              const calendar = getMonthWorkdays(year, month, currentDay, config.workDays, config.holidays);

                                                                              const calendar = getMonthWorkdays(year, month, currentDay, config.workDays, config.holidays);
                                                                              const calendar = getMonthWorkdays(year, month, currentDay, config.workDays, config.holidays);
                                                                              try {
                                                                                const raw = fs.readFileSync(item.fullPath, 'utf8');
                                                                                const parsed = parseRawSessionContent(item.fullPath, raw, item.workspaceName, item.mtimeMs, multipliers);
                                                                                sessionFileCache.set(item.fullPath, {
                                                                                  mtimeMs: item.mtimeMs,
                                                                                  size: item.size,
                                                                                  multipliersKey,
                                                                                  parsed: parsed || null
                                                                                });
                                                                                if (parsed) {
                                                                                  parsedEntries.push({ ...parsed, mtimeMs: item.mtimeMs });
                                                                                }
                                                                              } catch {
                                                                                // Ignore unreadable or empty file
                                                                              }
                                                                            }
                                                                            sortedTurns.forEach((turn, idx) => {
                                                                              const mKey = turn.dateStr.slice(0, 7);
                                                                              let grp = monthTurnGroups.get(mKey);
                                                                              if (!grp) {
                                                                                grp = { turns: [], priorCount: idx };
                                                                                monthTurnGroups.set(mKey, grp);
                                                                              }
                                                                              grp.turns.push(turn);
                                                                            });
                                                                            const baseMonthlyCredits =
                                                                              !config.overrideApiEntitlement && apiQuota && apiQuota.entitlement > 0
                                                                                ? apiQuota.entitlement
                                                                                : Math.max(1, config.monthlyCredits || 300);
                                                                            const extraCredits = Math.max(0, config.extraCredits || 0);
                                                                            const totalMonthlyCredits = baseMonthlyCredits + extraCredits;
                                                                            const baseDailyLimit = baseMonthlyCredits / calendar.totalWorkdays;
                                                                            const recommendedDailyLimit = totalMonthlyCredits / calendar.totalWorkdays;
                                                                            const minExp = config.expensiveSessionMinPercent ?? 40;
                                                                            const maxExp = config.expensiveSessionMaxPercent ?? 60;

                                                                            // 1. Establish Monthly Credits
                                                                            const baseMonthlyCredits =
                                                                              !config.overrideApiEntitlement && apiQuota && apiQuota.entitlement > 0
                                                                                ? apiQuota.entitlement
                                                                                : Math.max(1, config.monthlyCredits || 300);
                                                                            const baseMonthlyCredits =
                                                                              !config.overrideApiEntitlement && apiQuota && apiQuota.entitlement > 0
                                                                                ? apiQuota.entitlement
                                                                                : Math.max(1, config.monthlyCredits || 300);
                                                                            return groupParsedSessionsByMonth(parsedEntries);
                                                                          }
                                                                          for (const [mKey, grp] of monthTurnGroups.entries()) {
                                                                            const rec = buildMonthlySessionRecord(
                                                                              session.sessionId,
                                                                              session.title,
                                                                              session.workspaceName,
                                                                              grp.turns,
                                                                              grp.priorCount,
                                                                              totalSessionCredits,
                                                                              totalSessionMessages
                                                                            );
                                                                            if (rec) {
                                                                              if (!byMonth[mKey]) {
                                                                                byMonth[mKey] = [];
                                                                              }
                                                                              byMonth[mKey].push(rec);
                                                                            }
                                                                          }
                                                                        }
                                                                        return byMonth;
                                                                      }
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

                                                                      const extraCredits = Math.max(0, config.extraCredits || 0);
                                                                      const totalMonthlyCredits = baseMonthlyCredits + extraCredits;
                                                                      const extraCredits = Math.max(0, config.extraCredits || 0);
                                                                      const totalMonthlyCredits = baseMonthlyCredits + extraCredits;
                                                                      export function scanLocalChatSessions(
                                                                        storagePath: string | undefined,
                                                                        year: number,
                                                                        month: number,
                                                                        multipliers: Record<string, number>
                                                                      ): SessionRecord[] {
                                                                        if (!storagePath || !fs.existsSync(storagePath)) {
                                                                          return [];
                                                                        }
                                                                        const userDir = path.basename(storagePath) === 'workspaceStorage' ? path.dirname(storagePath) : storagePath;
                                                                        const monthStartMs = new Date(year, month, 1, 0, 0, 0).getTime();
                                                                        const byMonth = mineAllChatSessionsByMonth([userDir], monthStartMs, multipliers);
                                                                        return byMonth[formatMonthKey(year, month)] || [];
                                                                      }
                                                                      /**
                                                                       * Non-blocking async chat session miner optimized for Remote-WSL (`/mnt/c` 9P filesystem)
                                                                       * with bounded concurrency and `(mtimeMs, size)` caching.
                                                                       */
                                                                      export async function mineAllChatSessionsByMonthAsync(
                                                                        userDirs: string[],
                                                                        earliestTimestampMs: number,
                                                                        multipliers?: Record<string, number>,
                                                                        workspaceNameOverrides?: Record<string, string>
                                                                      ): Promise<Record<string, SessionRecord[]>> {
                                                                        const fsp = fs.promises;
                                                                        const multipliersKey = JSON.stringify(multipliers || {});
                                                                        const sessionFiles: Array<{ fullPath: string; workspaceName: string; mtimeMs: number; size: number }> = [];
                                                                        const dailyMap: Record<
                                                                          string,
                                                                          {
                                                                            credits: number;
                                                                            messages: number;
                                                                            sessionIds: Set<string>;
                                                                            exp40to60: number;
                                                                            expOver60: number;
                                                                            topSessionTitle?: string;
                                                                            topSessionPercent?: number;
                                                                          }
                                                                        > = {};

                                                                        // 2. Recommended Daily Limit (Monthly Credits / Workdays in Month)
                                                                        const baseDailyLimit = baseMonthlyCredits / calendar.totalWorkdays;
                                                                        const recommendedDailyLimit = totalMonthlyCredits / calendar.totalWorkdays;
                                                                        const baseDailyLimit = baseMonthlyCredits / calendar.totalWorkdays;
                                                                        const recommendedDailyLimit = totalMonthlyCredits / calendar.totalWorkdays;
                                                                        export function computeAnalytics(
                                                                          config: TrackerConfig,
                                                                          now: Date,
                                                                          sessionsInput: SessionRecord[],
                                                                          apiQuota?: ApiQuotaInfo,
                                                                          dailyQuotaLedger?: Record<string, number>
                                                                        ): AnalyticsSnapshot {
                                                                          const year = now.getFullYear();
                                                                          const month = now.getMonth();
                                                                          const currentDay = now.getDate();
                                                                          const todayStr = formatDateYMD(now);
                                                                          const collectChatDirFiles = async (chatDir: string, workspaceNameResolver: () => Promise<string>) => {
                                                                            let entries: string[];
                                                                            try {
                                                                              entries = (await fsp.readdir(chatDir)).filter(f => f.endsWith('.jsonl') || f.endsWith('.json'));
                                                                            } catch {
                                                                              return;
                                                                            }
                                                                            if (entries.length === 0) {
                                                                              return;
                                                                            }
                                                                            const wsName = await workspaceNameResolver();
                                                                            for (const f of entries) {
                                                                              const fp = path.join(chatDir, f);
                                                                              try {
                                                                                const st = await fsp.stat(fp);
                                                                                if (st.mtimeMs >= earliestTimestampMs) {
                                                                                  sessionFiles.push({ fullPath: fp, workspaceName: wsName, mtimeMs: st.mtimeMs, size: st.size });
                                                                                }
                                                                              } catch {
                                                                                // ignore disappearing temp files
                                                                              }
                                                                            }
                                                                          };
                                                                          for (let d = 1; d <= calendar.daysInMonth; d++) {
                                                                            const ds = formatDateYMD(new Date(year, month, d));
                                                                            dailyMap[ds] = { credits: 0, messages: 0, sessionIds: new Set(), exp40to60: 0, expOver60: 0 };
                                                                          }

                                                                          // 3. Classify Sessions against Recommended Daily Limit (40-60% Heavy vs >60% Mega)
                                                                          const minExp = config.expensiveSessionMinPercent ?? 40;
                                                                          const maxExp = config.expensiveSessionMaxPercent ?? 60;
                                                                          const minExp = config.expensiveSessionMinPercent ?? 40;
                                                                          const maxExp = config.expensiveSessionMaxPercent ?? 60;
                                                                          const calendar = getMonthWorkdays(year, month, currentDay, config.workDays, config.holidays);
                                                                          for (const userDir of userDirs) {
                                                                            if (!userDir) {
                                                                              continue;
                                                                            }
                                                                            const wsRoot = path.join(userDir, 'workspaceStorage');
                                                                            let hashEntries: string[] = [];
                                                                            try {
                                                                              hashEntries = await fsp.readdir(wsRoot);
                                                                            } catch {
                                                                              hashEntries = [];
                                                                            }
                                                                            const hourlyCredits = new Array<number>(24).fill(0);
                                                                            const hourlyMessages = new Array<number>(24).fill(0);
                                                                            const modelAgg: Record<string, { multiplier: number; messages: number; credits: number; tokens: number }> = {};
                                                                            const workspaceAgg: Record<string, WorkspaceUsageSummary> = {};

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
                                                                            const baseMonthlyCredits =
                                                                              !config.overrideApiEntitlement && apiQuota && apiQuota.entitlement > 0
                                                                                ? apiQuota.entitlement
                                                                                : Math.max(1, config.monthlyCredits || 300);
                                                                            const BATCH = 24;
                                                                            for (let i = 0; i < hashEntries.length; i += BATCH) {
                                                                              const slice = hashEntries.slice(i, i + BATCH);
                                                                              await Promise.all(
                                                                                slice.map(async hashName => {
                                                                                  const hashDir = path.join(wsRoot, hashName);
                                                                                  const chatDir = path.join(hashDir, 'chatSessions');
                                                                                  const overrideName = workspaceNameOverrides?.[hashName];
                                                                                  await collectChatDirFiles(chatDir, async () => {
                                                                                    try {
                                                                                      const rawWs = await fsp.readFile(path.join(hashDir, 'workspace.json'), 'utf8');
                                                                                      return await parseWorkspaceJsonContentAsync(rawWs, hashDir, overrideName);
                                                                                    } catch {
                                                                                      return overrideName || 'Workspace';
                                                                                    }
                                                                                  });
                                                                                })
                                                                              );
                                                                            }
                                                                            let sessionsTotalCredits = 0;
                                                                            let sessionsTotalMessages = 0;
                                                                            let contextBloatSessionsCount = 0;
                                                                            let contextBloatCreditsWasted = 0;

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
                                                                            const dailyMap: Record<string, {
                                                                              credits: number;
                                                                              messages: number;
                                                                              sessionIds: Set<string>;
                                                                              exp40to60: number;
                                                                              expOver60: number;
                                                                              topSessionTitle?: string;
                                                                              topSessionPercent?: number;
                                                                            }> = {};
                                                                            const extraCredits = Math.max(0, config.extraCredits || 0);
                                                                            const totalMonthlyCredits = baseMonthlyCredits + extraCredits;
                                                                            const emptyChatDirs = [path.join(userDir, 'globalStorage', 'emptyWindowChatSessions')];
                                                                            const profilesDir = path.join(userDir, 'profiles');
                                                                            try {
                                                                              const profiles = await fsp.readdir(profilesDir);
                                                                              for (const prof of profiles) {
                                                                                emptyChatDirs.push(path.join(profilesDir, prof, 'globalStorage', 'emptyWindowChatSessions'));
                                                                              }
                                                                            } catch {
                                                                              // no profiles folder
                                                                            }
                                                                            for (const s of sessions) {
                                                                              sessionsTotalCredits += s.credits;
                                                                              sessionsTotalMessages += s.messages;
                                                                              if (s.hasContextBloat) {
                                                                                contextBloatSessionsCount++;
                                                                                contextBloatCreditsWasted += s.post20TurnCredits > 0 ? s.post20TurnCredits : s.credits * 0.25;
                                                                              }

                                                                              for (let d = 1; d <= calendar.daysInMonth; d++) {
                                                                                const ds = formatDateYMD(new Date(year, month, d));
                                                                                dailyMap[ds] = { credits: 0, messages: 0, sessionsCount: 0, exp40to60: 0, expOver60: 0 };
                                                                                dailyMap[ds] = { credits: 0, messages: 0, sessionIds: new Set(), exp40to60: 0, expOver60: 0 };
                                                                              }
                                                                              for (let d = 1; d <= calendar.daysInMonth; d++) {
                                                                                const ds = formatDateYMD(new Date(year, month, d));
                                                                                dailyMap[ds] = { credits: 0, messages: 0, sessionIds: new Set(), exp40to60: 0, expOver60: 0 };
                                                                              }
                                                                              const baseDailyLimit = baseMonthlyCredits / calendar.totalWorkdays;
                                                                              const recommendedDailyLimit = totalMonthlyCredits / calendar.totalWorkdays;
                                                                              for (const emptyDir of emptyChatDirs) {
                                                                                await collectChatDirFiles(emptyDir, async () => 'Empty Window');
                                                                              }
                                                                            }
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

                                                                            const hourlyCredits = new Array<number>(24).fill(0);
                                                                            const hourlyMessages = new Array<number>(24).fill(0);
                                                                            const modelAgg: Record<string, { multiplier: number; messages: number; credits: number; tokens: number }> = {};
                                                                            const workspaceAgg: Record<string, WorkspaceUsageSummary> = {};
                                                                            const hourlyCredits = new Array<number>(24).fill(0);
                                                                            const hourlyMessages = new Array<number>(24).fill(0);
                                                                            const modelAgg: Record<string, { multiplier: number; messages: number; credits: number; tokens: number }> = {};
                                                                            const workspaceAgg: Record<string, WorkspaceUsageSummary> = {};
                                                                            const minExp = config.expensiveSessionMinPercent ?? 40;
                                                                            const maxExp = config.expensiveSessionMaxPercent ?? 60;
                                                                            const parsedEntries: Array<ParsedSessionData & { mtimeMs: number }> = [];
                                                                            const READ_BATCH = 16;
                                                                            for (let i = 0; i < sessionFiles.length; i += READ_BATCH) {
                                                                              const batch = sessionFiles.slice(i, i + READ_BATCH);
                                                                              await Promise.all(
                                                                                batch.map(async item => {
                                                                                  const cached = sessionFileCache.get(item.fullPath);
                                                                                  if (
                                                                                    cached &&
                                                                                    cached.mtimeMs === item.mtimeMs &&
                                                                                    cached.size === item.size &&
                                                                                    cached.multipliersKey === multipliersKey
                                                                                  ) {
                                                                                    if (cached.parsed) {
                                                                                      parsedEntries.push({ ...cached.parsed, workspaceName: item.workspaceName, mtimeMs: item.mtimeMs });
                                                                                    }
                                                                                    return;
                                                                                  }
                                                                                  try {
                                                                                    const raw = await fsp.readFile(item.fullPath, 'utf8');
                                                                                    const parsed = parseRawSessionContent(item.fullPath, raw, item.workspaceName, item.mtimeMs, multipliers);
                                                                                    sessionFileCache.set(item.fullPath, {
                                                                                      mtimeMs: item.mtimeMs,
                                                                                      size: item.size,
                                                                                      multipliersKey,
                                                                                      parsed: parsed || null
                                                                                    });
                                                                                    if (parsed) {
                                                                                      parsedEntries.push({ ...parsed, mtimeMs: item.mtimeMs });
                                                                                    }
                                                                                  } catch {
                                                                                    // Ignore unreadable or partially written file
                                                                                  }
                                                                                })
                                                                              );
                                                                            }
                                                                            const primaryDayBucket = dailyMap[s.dateStr];
                                                                            if (primaryDayBucket) {
                                                                              if (s.expenseTier === 'heavy-40-60') {
                                                                                primaryDayBucket.exp40to60 += 1;
                                                                              } else if (s.expenseTier === 'mega-60plus') {
                                                                                primaryDayBucket.expOver60 += 1;
                                                                              }
                                                                              if (!primaryDayBucket.topSessionPercent || s.dailyLimitPercent > primaryDayBucket.topSessionPercent) {
                                                                                primaryDayBucket.topSessionPercent = s.dailyLimitPercent;
                                                                                primaryDayBucket.topSessionTitle = s.title;
                                                                              }
                                                                            }

                                                                            let sessionsTotalCredits = 0;
                                                                            let sessionsTotalMessages = 0;
                                                                            let contextBloatSessionsCount = 0;
                                                                            let contextBloatCreditsWasted = 0;
                                                                            let sessionsTotalCredits = 0;
                                                                            let sessionsTotalMessages = 0;
                                                                            let contextBloatSessionsCount = 0;
                                                                            let contextBloatCreditsWasted = 0;
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
                                                                            return groupParsedSessionsByMonth(parsedEntries);
                                                                          }
                                                                          for (const [rawModelKey, mStats] of Object.entries(s.modelsUsed)) {
                                                                            const modelName = normalizeModelName(rawModelKey);
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

                                                                          for (const s of sessions) {
                                                                            sessionsTotalCredits += s.credits;
                                                                            sessionsTotalMessages += s.messages;
                                                                            for (const s of sessions) {
                                                                              sessionsTotalCredits += s.credits;
                                                                              sessionsTotalMessages += s.messages;
                                                                              const dailyMap: Record<
                                                                                string,
                                                                                {
                                                                                  credits: number;
                                                                                  messages: number;
                                                                                  sessionIds: Set<string>;
                                                                                  exp40to60: number;
                                                                                  expOver60: number;
                                                                                  topSessionTitle?: string;
                                                                                  topSessionPercent?: number;
                                                                                }
                                                                              > = {};
                                                                              /**
                                                                               * Synchronous chat session miner (used by unit tests and single-folder utilities).
                                                                               */
                                                                              export function mineAllChatSessionsByMonth(
                                                                                userDirs: string[],
                                                                                earliestTimestampMs: number,
                                                                                multipliers?: Record<string, number>,
                                                                                workspaceNameOverrides?: Record<string, string>
                                                                              ): Record<string, SessionRecord[]> {
                                                                                const multipliersKey = JSON.stringify(multipliers || {});
                                                                                const sessionFiles: Array<{ fullPath: string; workspaceName: string; mtimeMs: number; size: number }> = [];
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

                                                                              if (s.hasContextBloat) {
                                                                                contextBloatSessionsCount++;
                                                                                contextBloatCreditsWasted += s.post20TurnCredits > 0 ? s.post20TurnCredits : s.credits * 0.25;
                                                                              }
                                                                              if (s.hasContextBloat) {
                                                                                contextBloatSessionsCount++;
                                                                                contextBloatCreditsWasted += s.post20TurnCredits > 0 ? s.post20TurnCredits : s.credits * 0.25;
                                                                              }
                                                                              for (let d = 1; d <= calendar.daysInMonth; d++) {
                                                                                const ds = formatDateYMD(new Date(year, month, d));
                                                                                dailyMap[ds] = { credits: 0, messages: 0, sessionIds: new Set(), exp40to60: 0, expOver60: 0 };
                                                                              }
                                                                              for (const userDir of userDirs) {
                                                                                if (!userDir || !fs.existsSync(userDir)) {
                                                                                  continue;
                                                                                }
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
                                                                                    const wsName = readWorkspaceName(hashDir, workspaceNameOverrides?.[hashName]);
                                                                                    for (const f of files) {
                                                                                      const fp = path.join(chatDir, f);
                                                                                      try {
                                                                                        const st = fs.statSync(fp);
                                                                                        if (st.mtimeMs >= earliestTimestampMs) {
                                                                                          sessionFiles.push({ fullPath: fp, workspaceName: wsName, mtimeMs: st.mtimeMs, size: st.size });
                                                                                        }
                                                                                      } catch {
                                                                                        // ignore
                                                                                      }
                                                                                    }
                                                                                  }
                                                                                }
                                                                                if (dailyQuotaLedger) {
                                                                                  const sortedDates = Object.keys(dailyQuotaLedger).sort();
                                                                                  for (let i = 1; i < sortedDates.length; i++) {
                                                                                    const ds = sortedDates[i];
                                                                                    const prevDs = sortedDates[i - 1];
                                                                                    if (
                                                                                      ds.slice(0, 7) === prevDs.slice(0, 7) &&
                                                                                      dailyMap[ds] &&
                                                                                      Math.round((Date.parse(ds) - Date.parse(prevDs)) / 86_400_000) === 1
                                                                                    ) {
                                                                                      const apiDelta = Math.max(0, dailyQuotaLedger[ds] - dailyQuotaLedger[prevDs]);
                                                                                      if (apiDelta > dailyMap[ds].credits) {
                                                                                        dailyMap[ds].credits = apiDelta;
                                                                                      }
                                                                                    }
                                                                                  }
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
                                                                                  const hourlyCredits = new Array<number>(24).fill(0);
                                                                                  const hourlyMessages = new Array<number>(24).fill(0);
                                                                                  const modelAgg: Record<string, { multiplier: number; messages: number; credits: number; tokens: number }> = {};
                                                                                  const workspaceAgg: Record<string, WorkspaceUsageSummary> = {};
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
                                                                                          sessionFiles.push({ fullPath: fp, workspaceName: 'Empty Window', mtimeMs: st.mtimeMs, size: st.size });
                                                                                        }
                                                                                      }
                                                                                    } catch {
                                                                                      // ignore
                                                                                    }
                                                                                  }
                                                                                }
                                                                                const localMinedCredits = Math.round(sessionsTotalCredits * 100) / 100;
                                                                                const totalUsedCredits = apiQuota && apiQuota.used > localMinedCredits ? apiQuota.used : localMinedCredits;

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
                                                                                  const primaryDayBucket = dailyMap[s.dateStr];
                                                                                  if (primaryDayBucket) {
                                                                                    if (s.expenseTier === 'heavy-40-60') {
                                                                                      primaryDayBucket.exp40to60 += 1;
                                                                                    } else if (s.expenseTier === 'mega-60plus') {
                                                                                      primaryDayBucket.expOver60 += 1;
                                                                                    }
                                                                                    if (!primaryDayBucket.topSessionPercent || s.dailyLimitPercent > primaryDayBucket.topSessionPercent) {
                                                                                      primaryDayBucket.topSessionPercent = s.dailyLimitPercent;
                                                                                      primaryDayBucket.topSessionTitle = s.title;
                                                                                    }
                                                                                  }
                                                                                  let sessionsTotalCredits = 0;
                                                                                  let sessionsTotalMessages = 0;
                                                                                  let contextBloatSessionsCount = 0;
                                                                                  let contextBloatCreditsWasted = 0;
                                                                                  const parsedEntries: Array<ParsedSessionData & { mtimeMs: number }> = [];
                                                                                  for (const item of sessionFiles) {
                                                                                    const cached = sessionFileCache.get(item.fullPath);
                                                                                    if (
                                                                                      cached &&
                                                                                      cached.mtimeMs === item.mtimeMs &&
                                                                                      cached.size === item.size &&
                                                                                      cached.multipliersKey === multipliersKey
                                                                                    ) {
                                                                                      if (cached.parsed) {
                                                                                        parsedEntries.push({ ...cached.parsed, workspaceName: item.workspaceName, mtimeMs: item.mtimeMs });
                                                                                      }
                                                                                      continue;
                                                                                    }
                                                                                    try {
                                                                                      const raw = fs.readFileSync(item.fullPath, 'utf8');
                                                                                      const parsed = parseRawSessionContent(item.fullPath, raw, item.workspaceName, item.mtimeMs, multipliers);
                                                                                      sessionFileCache.set(item.fullPath, {
                                                                                        mtimeMs: item.mtimeMs,
                                                                                        size: item.size,
                                                                                        multipliersKey,
                                                                                        parsed: parsed || null
                                                                                      });
                                                                                      if (parsed) {
                                                                                        parsedEntries.push({ ...parsed, mtimeMs: item.mtimeMs });
                                                                                      }
                                                                                    } catch {
                                                                                      // Ignore unreadable or empty file
                                                                                    }
                                                                                  }
                                                                                  if (apiQuota && apiQuota.used > localMinedCredits + 0.5) {
                                                                                    const externalCredits = Math.round((apiQuota.used - localMinedCredits) * 100) / 100;
                                                                                    modelAgg['External / Non-Chat Copilot Usage'] = {
                                                                                      multiplier: 0,
                                                                                      messages: 0,
                                                                                      credits: externalCredits,
                                                                                      tokens: 0
                                                                                    };
                                                                                  }

                                                                                  const hr = new Date(s.startTime).getHours();
                                                                                  if (hr >= 0 && hr < 24) {
                                                                                    hourlyCredits[hr] += s.credits;
                                                                                    hourlyMessages[hr] += s.messages;
                                                                                  }
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
                                                                                  for (const s of sessions) {
                                                                                    sessionsTotalCredits += s.credits;
                                                                                    sessionsTotalMessages += s.messages;
                                                                                    return groupParsedSessionsByMonth(parsedEntries);
                                                                                  }
                                                                                  const todayBucket = dailyMap[todayStr];
                                                                                  const todayUsedCredits = Math.round((todayBucket?.credits || 0) * 100) / 100;
                                                                                  const usedBeforeToday = Math.max(0, Math.round((totalUsedCredits - todayUsedCredits) * 100) / 100);
                                                                                  const expectedUsedBeforeToday = Math.round(calendar.pastWorkdays * baseDailyLimit * 100) / 100;
                                                                                  const netBalance = Math.round((expectedUsedBeforeToday - usedBeforeToday + extraCredits) * 100) / 100;
                                                                                  const rolloverExtraCredits = Math.max(0, netBalance);
                                                                                  const creditDebt = Math.max(0, -netBalance);
                                                                                  const remainingPoolEnteringToday = Math.max(0, totalMonthlyCredits - usedBeforeToday);
                                                                                  const effectiveDailyLimit = Math.round((remainingPoolEnteringToday / calendar.remainingWorkdays) * 100) / 100;

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
                                                                                if (s.hasContextBloat) {
                                                                                  contextBloatSessionsCount++;
                                                                                  contextBloatCreditsWasted += s.post20TurnCredits > 0 ? s.post20TurnCredits : s.credits * 0.25;
                                                                                }
                                                                                export function scanLocalChatSessions(
                                                                                  storagePath: string,
                                                                                  year: number,
                                                                                  month: number,
                                                                                  multipliers?: Record<string, number>
                                                                                ): SessionRecord[] {
                                                                                  if (!storagePath || !fs.existsSync(storagePath)) {
                                                                                    return [];
                                                                                  }
                                                                                  const userDir = path.basename(storagePath) === 'workspaceStorage' ? path.dirname(storagePath) : storagePath;
                                                                                  const monthStartMs = new Date(year, month, 1, 0, 0, 0).getTime();
                                                                                  const byMonth = mineAllChatSessionsByMonth([userDir], monthStartMs, multipliers);
                                                                                  return byMonth[formatMonthKey(year, month)] || [];
                                                                                }
                                                                                const standardDailyPercent =
                                                                                  recommendedDailyLimit > 0 ? Math.round((todayUsedCredits / recommendedDailyLimit) * 1000) / 10 : 0;
                                                                                const adjustedDailyPercent =
                                                                                  effectiveDailyLimit > 0
                                                                                    ? Math.round((todayUsedCredits / effectiveDailyLimit) * 1000) / 10
                                                                                    : todayUsedCredits > 0
                                                                                      ? 100
                                                                                      : 0;
                                                                                const activeDailyPercent = config.dailyPercentMode === 'standard' ? standardDailyPercent : adjustedDailyPercent;
                                                                                const monthlyExhausted = totalUsedCredits >= totalMonthlyCredits;
                                                                                const colorInfo = getColorInfo(activeDailyPercent, monthlyExhausted);

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
                                                                              export function computeAnalytics(
                                                                                config: TrackerConfig,
                                                                                now: Date,
                                                                                sessionsInput: SessionRecord[],
                                                                                apiQuota?: ApiQuotaInfo,
                                                                                dailyQuotaLedger?: Record<string, number>
                                                                              ): AnalyticsSnapshot {
                                                                                const year = now.getFullYear();
                                                                                const month = now.getMonth();
                                                                                const currentDay = now.getDate();
                                                                                const todayStr = formatDateYMD(now);
                                                                                const calendar = getMonthWorkdays(year, month, currentDay, config.workDays, config.holidays);
                                                                                const dailySeries: DailyUsagePoint[] = [];
                                                                                let runningUsed = 0;
                                                                                let runningBudget = 0;
                                                                                let last7DaysCredits = 0;

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
                                                                                const primaryDayBucket = dailyMap[s.dateStr];
                                                                                if (primaryDayBucket) {
                                                                                  if (s.expenseTier === 'heavy-40-60') {
                                                                                    primaryDayBucket.exp40to60 += 1;
                                                                                  } else if (s.expenseTier === 'mega-60plus') {
                                                                                    primaryDayBucket.expOver60 += 1;
                                                                                  }
                                                                                  if (!primaryDayBucket.topSessionPercent || s.dailyLimitPercent > primaryDayBucket.topSessionPercent) {
                                                                                    primaryDayBucket.topSessionPercent = s.dailyLimitPercent;
                                                                                    primaryDayBucket.topSessionTitle = s.title;
                                                                                  }
                                                                                }
                                                                                const baseMonthlyCredits =
                                                                                  !config.overrideApiEntitlement && apiQuota && apiQuota.entitlement > 0
                                                                                    ? apiQuota.entitlement
                                                                                    : Math.max(1, config.monthlyCredits || 300);
                                                                                const extraCredits = Math.max(0, config.extraCredits || 0);
                                                                                const totalMonthlyCredits = baseMonthlyCredits + extraCredits;
                                                                                const baseDailyLimit = baseMonthlyCredits / calendar.totalWorkdays;
                                                                                const recommendedDailyLimit = totalMonthlyCredits / calendar.totalWorkdays;
                                                                                const minExp = config.expensiveSessionMinPercent ?? 40;
                                                                                const maxExp = config.expensiveSessionMaxPercent ?? 60;
                                                                                for (let d = 1; d <= calendar.daysInMonth; d++) {
                                                                                  const dt = new Date(year, month, d);
                                                                                  const ds = formatDateYMD(dt);
                                                                                  const isWork = Boolean(calendar.workdayMap[ds]);
                                                                                  const bucket = dailyMap[ds];
                                                                                  const dayCredits = Math.round((bucket?.credits || 0) * 100) / 100;

                                                                                  const localMinedCredits = Math.round(sessionsTotalCredits * 100) / 100;
                                                                                  const totalUsedCredits =
                                                                                    apiQuota && apiQuota.used > sessionsTotalCredits
                                                                                  apiQuota && apiQuota.used > localMinedCredits
                                                                                    ? apiQuota.used
                                                                                    : Math.round(sessionsTotalCredits * 100) / 100;
                                                                                  const localMinedCredits = Math.round(sessionsTotalCredits * 100) / 100;
                                                                                  const totalUsedCredits =
                                                                                    apiQuota && apiQuota.used > localMinedCredits
                                                                                      ? apiQuota.used
                                                                                      : localMinedCredits;
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
                                                                                  if (d <= currentDay) {
                                                                                    runningUsed = Math.round((runningUsed + dayCredits) * 100) / 100;
                                                                                  }
                                                                                  if (isWork) {
                                                                                    runningBudget = Math.round((runningBudget + recommendedDailyLimit) * 100) / 100;
                                                                                  }
                                                                                  if (d > currentDay - 7 && d <= currentDay) {
                                                                                    last7DaysCredits += dayCredits;
                                                                                  }

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
  if(apiQuota && apiQuota.used > localMinedCredits + 0.5) {
                                                                                        const externalCredits = Math.round((apiQuota.used - localMinedCredits) * 100) / 100;
                                                                                        modelAgg['External / Non-Chat Copilot Usage'] = {
                                                                                          multiplier: 1,
                                                                                          messages: Math.ceil(externalCredits),
                                                                                          credits: externalCredits,
                                                                                          tokens: 0
                                                                                        };
                                                                                      }
                                                                                      credits: externalCredits,
                                                                                        tokens: 0
                                                                                    };
                                                                                  }
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
                                                                                const dailyMap: Record<
                                                                                  string,
                                                                                  {
                                                                                    credits: number;
                                                                                    messages: number;
                                                                                    sessionIds: Set<string>;
                                                                                    exp40to60: number;
                                                                                    expOver60: number;
                                                                                    topSessionTitle?: string;
                                                                                    topSessionPercent?: number;
                                                                                  }
                                                                                > = {};
                                                                                const dayPct = recommendedDailyLimit > 0 ? Math.round((dayCredits / recommendedDailyLimit) * 1000) / 10 : 0;
                                                                                const dayColor = getColorInfo(dayPct, false);

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
                                                                                const todayBucket = dailyMap[todayStr];
                                                                                const todayUsedCredits = Math.round((todayBucket?.credits || 0) * 100) / 100;
                                                                                const usedBeforeToday = Math.max(0, Math.round((totalUsedCredits - todayUsedCredits) * 100) / 100);
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
                                                                                for (let d = 1; d <= calendar.daysInMonth; d++) {
                                                                                  const ds = formatDateYMD(new Date(year, month, d));
                                                                                  dailyMap[ds] = { credits: 0, messages: 0, sessionIds: new Set(), exp40to60: 0, expOver60: 0 };
                                                                                }
                                                                                dailySeries.push({
                                                                                  dateStr: ds,
                                                                                  dayOfMonth: d,
                                                                                  weekdayName: WEEKDAY_SHORT[dt.getDay()],
                                                                                  isWorkday: isWork,
                                                                                  isToday: d === currentDay,
                                                                                  isFuture: d > currentDay,
                                                                                  credits: dayCredits,
                                                                                  messages: bucket?.messages || 0,
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

                                                                              // 4. Extra (Rollover Surplus) & Credit Debt Calculation
                                                                              const expectedUsedBeforeToday = Math.round(calendar.pastWorkdays * baseDailyLimit * 100) / 100;
                                                                              // Net Balance entering today = (Budget for past workdays - Actual used before today) + Extra monthly credits
                                                                              const netBalance = Math.round(((expectedUsedBeforeToday - usedBeforeToday) + extraCredits) * 100) / 100;
                                                                              const rolloverExtraCredits = Math.max(0, netBalance);
                                                                              const creditDebt = Math.max(0, -netBalance);
                                                                              const expectedUsedBeforeToday = Math.round(calendar.pastWorkdays * baseDailyLimit * 100) / 100;
                                                                              const netBalance = Math.round(((expectedUsedBeforeToday - usedBeforeToday) + extraCredits) * 100) / 100;
                                                                              const rolloverExtraCredits = Math.max(0, netBalance);
                                                                              const creditDebt = Math.max(0, -netBalance);
                                                                              const localMinedCredits = Math.round(sessionsTotalCredits * 100) / 100;
                                                                              const totalUsedCredits =
                                                                                apiQuota && apiQuota.used > localMinedCredits
                                                                                  ? apiQuota.used
                                                                                  : localMinedCredits;
                                                                              const hourlyCredits = new Array<number>(24).fill(0);
                                                                              const hourlyMessages = new Array<number>(24).fill(0);
                                                                              const modelAgg: Record<string, { multiplier: number; messages: number; credits: number; tokens: number }> = {};
                                                                              const workspaceAgg: Record<string, WorkspaceUsageSummary> = {};
                                                                              const hourlySeries: HourlyUsagePoint[] = hourlyCredits.map((cr, hr) => ({
                                                                                hour: hr,
                                                                                label: `${String(hr).padStart(2, '0')}:00`,
                                                                                credits: Math.round(cr * 100) / 100,
                                                                                messages: hourlyMessages[hr]
                                                                              }));

                                                                              // Effective daily limit spreads remaining monthly pool (including extra credits & debt) across remaining workdays
                                                                              const remainingPoolEnteringToday = Math.max(0, totalMonthlyCredits - usedBeforeToday);
                                                                              const effectiveDailyLimit = Math.round((remainingPoolEnteringToday / calendar.remainingWorkdays) * 100) / 100;
                                                                              const remainingPoolEnteringToday = Math.max(0, totalMonthlyCredits - usedBeforeToday);
                                                                              const effectiveDailyLimit = Math.round((remainingPoolEnteringToday / calendar.remainingWorkdays) * 100) / 100;
                                                                              if (apiQuota && apiQuota.used > localMinedCredits + 0.5) {
                                                                                const externalCredits = Math.round((apiQuota.used - localMinedCredits) * 100) / 100;
                                                                                modelAgg['External / Non-Chat Copilot Usage'] = {
                                                                                  multiplier: 1,
                                                                                  messages: Math.ceil(externalCredits),
                                                                                  credits: externalCredits,
                                                                                  tokens: 0
                                                                                };
                                                                              }
                                                                              let sessionsTotalCredits = 0;
                                                                              let sessionsTotalMessages = 0;
                                                                              let contextBloatSessionsCount = 0;
                                                                              let contextBloatCreditsWasted = 0;
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

                                                                              const standardDailyPercent =
                                                                                recommendedDailyLimit > 0 ? Math.round((todayUsedCredits / recommendedDailyLimit) * 1000) / 10 : 0;
                                                                              const adjustedDailyPercent =
                                                                                effectiveDailyLimit > 0
                                                                                  ? Math.round((todayUsedCredits / effectiveDailyLimit) * 1000) / 10
                                                                                  : (todayUsedCredits > 0 ? 100 : 0);
                                                                              const standardDailyPercent =
                                                                                recommendedDailyLimit > 0 ? Math.round((todayUsedCredits / recommendedDailyLimit) * 1000) / 10 : 0;
                                                                              const adjustedDailyPercent =
                                                                                effectiveDailyLimit > 0
                                                                                  ? Math.round((todayUsedCredits / effectiveDailyLimit) * 1000) / 10
                                                                                  : (todayUsedCredits > 0 ? 100 : 0);
                                                                              const todayBucket = dailyMap[todayStr];
                                                                              const todayUsedCredits = Math.round((todayBucket?.credits || 0) * 100) / 100;
                                                                              const usedBeforeToday = Math.max(0, Math.round((totalUsedCredits - todayUsedCredits) * 100) / 100);
                                                                              for (const s of sessions) {
                                                                                sessionsTotalCredits += s.credits;
                                                                                sessionsTotalMessages += s.messages;
                                                                                if (s.hasContextBloat) {
                                                                                  contextBloatSessionsCount++;
                                                                                  contextBloatCreditsWasted += s.post20TurnCredits > 0 ? s.post20TurnCredits : s.credits * 0.25;
                                                                                }
                                                                                const models: ModelUsageSummary[] = Object.entries(modelAgg)
                                                                                  .map(([model, m]) => {
                                                                                    const avgRate = m.messages > 0 ? Math.round((m.credits / m.messages) * 100) / 100 : m.multiplier;
                                                                                    return {
                                                                                      model,
                                                                                      multiplier: avgRate,
                                                                                      messages: m.messages,
                                                                                      credits: Math.round(m.credits * 100) / 100,
                                                                                      estimatedTokens: m.tokens,
                                                                                      percentOfCredits: totalUsedCredits > 0 ? Math.round((m.credits / totalUsedCredits) * 1000) / 10 : 0,
                                                                                      percentOfMessages: sessionsTotalMessages > 0 ? Math.round((m.messages / sessionsTotalMessages) * 1000) / 10 : 0
                                                                                    };
                                                                                  })
                                                                                  .sort((a, b) => b.credits - a.credits || b.messages - a.messages);

                                                                                const activeDailyPercent =
                                                                                  config.dailyPercentMode === 'standard' ? standardDailyPercent : adjustedDailyPercent;
                                                                                const activeDailyPercent =
                                                                                  config.dailyPercentMode === 'standard' ? standardDailyPercent : adjustedDailyPercent;
                                                                                const expectedUsedBeforeToday = Math.round(calendar.pastWorkdays * baseDailyLimit * 100) / 100;
                                                                                const netBalance = Math.round(((expectedUsedBeforeToday - usedBeforeToday) + extraCredits) * 100) / 100;
                                                                                const rolloverExtraCredits = Math.max(0, netBalance);
                                                                                const creditDebt = Math.max(0, -netBalance);
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
                                                                                const workspaces: WorkspaceUsageSummary[] = Object.values(workspaceAgg)
                                                                                  .map(w => ({
                                                                                    ...w,
                                                                                    credits: Math.round(w.credits * 100) / 100,
                                                                                    percentOfCredits: totalUsedCredits > 0 ? Math.round((w.credits / totalUsedCredits) * 1000) / 10 : 0
                                                                                  }))
                                                                                  .sort((a, b) => b.credits - a.credits || b.messages - a.messages);

                                                                                const monthlyExhausted = totalUsedCredits >= totalMonthlyCredits;
                                                                                const colorInfo = getColorInfo(activeDailyPercent, monthlyExhausted);
                                                                                const monthlyExhausted = totalUsedCredits >= totalMonthlyCredits;
                                                                                const colorInfo = getColorInfo(activeDailyPercent, monthlyExhausted);
                                                                                const remainingPoolEnteringToday = Math.max(0, totalMonthlyCredits - usedBeforeToday);
                                                                                const effectiveDailyLimit = Math.round((remainingPoolEnteringToday / calendar.remainingWorkdays) * 100) / 100;
                                                                                const primaryDayBucket = dailyMap[s.dateStr];
                                                                                if (primaryDayBucket) {
                                                                                  if (s.expenseTier === 'heavy-40-60') {
                                                                                    primaryDayBucket.exp40to60 += 1;
                                                                                  } else if (s.expenseTier === 'mega-60plus') {
                                                                                    primaryDayBucket.expOver60 += 1;
                                                                                  }
                                                                                  if (!primaryDayBucket.topSessionPercent || s.dailyLimitPercent > primaryDayBucket.topSessionPercent) {
                                                                                    primaryDayBucket.topSessionPercent = s.dailyLimitPercent;
                                                                                    primaryDayBucket.topSessionTitle = s.title;
                                                                                  }
                                                                                }
                                                                                const monthExpensive40to60 = sessions.filter(s => s.expenseTier === 'heavy-40-60').length;
                                                                                const monthExpensiveOver60 = sessions.filter(s => s.expenseTier === 'mega-60plus').length;
                                                                                const monthTotalExpensiveChats = monthExpensive40to60 + monthExpensiveOver60;

                                                                                // Build Daily Series across the month
                                                                                const dailySeries: DailyUsagePoint[] = [];
                                                                                let runningUsed = 0;
                                                                                let runningBudget = 0;
                                                                                let last7DaysCredits = 0;
                                                                                const dailySeries: DailyUsagePoint[] = [];
                                                                                let runningUsed = 0;
                                                                                let runningBudget = 0;
                                                                                let last7DaysCredits = 0;
                                                                                const standardDailyPercent =
                                                                                  recommendedDailyLimit > 0 ? Math.round((todayUsedCredits / recommendedDailyLimit) * 1000) / 10 : 0;
                                                                                const adjustedDailyPercent =
                                                                                  effectiveDailyLimit > 0
                                                                                    ? Math.round((todayUsedCredits / effectiveDailyLimit) * 1000) / 10
                                                                                    : (todayUsedCredits > 0 ? 100 : 0);
                                                                                for (const [rawModelKey, mStats] of Object.entries(s.modelsUsed)) {
                                                                                  const modelName = normalizeModelName(rawModelKey);
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
                                                                                const topExpensiveSessions = [...sessions]
                                                                                  .sort((a, b) => b.credits - a.credits || b.messages - a.messages)
                                                                                  .slice(0, 15);

                                                                                for (let d = 1; d <= calendar.daysInMonth; d++) {
                                                                                  const dt = new Date(year, month, d);
                                                                                  const ds = formatDateYMD(dt);
                                                                                  const isWork = Boolean(calendar.workdayMap[ds]);
                                                                                  const bucket = dailyMap[ds];
                                                                                  const dayCredits = Math.round((bucket?.credits || 0) * 100) / 100;
                                                                                  for (let d = 1; d <= calendar.daysInMonth; d++) {
                                                                                    const dt = new Date(year, month, d);
                                                                                    const ds = formatDateYMD(dt);
                                                                                    const isWork = Boolean(calendar.workdayMap[ds]);
                                                                                    const bucket = dailyMap[ds];
                                                                                    const dayCredits = Math.round((bucket?.credits || 0) * 100) / 100;
                                                                                    const activeDailyPercent =
                                                                                      config.dailyPercentMode === 'standard' ? standardDailyPercent : adjustedDailyPercent;
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
                                                                                  const activeTodayTopSession = sessions
                                                                                    .filter(s => s.dateStr === todayStr || s.turns?.some(t => t.dateStr === todayStr))
                                                                                    .sort((a, b) => b.credits - a.credits)[0];

                                                                                  if (d <= currentDay) {
                                                                                    runningUsed = Math.round((runningUsed + dayCredits) * 100) / 100;
                                                                                  }
                                                                                  if (isWork) {
                                                                                    runningBudget = Math.round((runningBudget + recommendedDailyLimit) * 100) / 100;
                                                                                  }
                                                                                  if (d <= currentDay) {
                                                                                    runningUsed = Math.round((runningUsed + dayCredits) * 100) / 100;
                                                                                  }
                                                                                  if (isWork) {
                                                                                    runningBudget = Math.round((runningBudget + recommendedDailyLimit) * 100) / 100;
                                                                                  }
                                                                                  const monthlyExhausted = totalUsedCredits >= totalMonthlyCredits;
                                                                                  const colorInfo = getColorInfo(activeDailyPercent, monthlyExhausted);
                                                                                  if (dailyQuotaLedger) {
                                                                                    const sortedDates = Object.keys(dailyQuotaLedger).sort();
                                                                                    for (let i = 1; i < sortedDates.length; i++) {
                                                                                      const ds = sortedDates[i];
                                                                                      const prevDs = sortedDates[i - 1];
                                                                                      if (
                                                                                        ds.slice(0, 7) === prevDs.slice(0, 7) &&
                                                                                        dailyMap[ds] &&
                                                                                        Math.round((Date.parse(ds) - Date.parse(prevDs)) / 86_400_000) === 1
                                                                                      ) {
                                                                                        const apiDelta = Math.max(0, dailyQuotaLedger[ds] - dailyQuotaLedger[prevDs]);
                                                                                        if (apiDelta > dailyMap[ds].credits) {
                                                                                          dailyMap[ds].credits = apiDelta;
                                                                                        }
                                                                                      }
                                                                                    }
                                                                                  }
                                                                                  const projectedMonthlyCredits = Math.round(workdayAverageCredits * calendar.totalWorkdays * 100) / 100;
                                                                                  const projectedEndBalance = Math.round((totalMonthlyCredits - projectedMonthlyCredits) * 100) / 100;

                                                                                  if (d > currentDay - 7 && d <= currentDay) {
                                                                                    last7DaysCredits += dayCredits;
                                                                                  }
                                                                                  if (d > currentDay - 7 && d <= currentDay) {
                                                                                    last7DaysCredits += dayCredits;
                                                                                  }
                                                                                  const dailySeries: DailyUsagePoint[] = [];
                                                                                  let runningUsed = 0;
                                                                                  let runningBudget = 0;
                                                                                  let last7DaysCredits = 0;
                                                                                  const localMinedCredits = Math.round(sessionsTotalCredits * 100) / 100;
                                                                                  const totalUsedCredits = apiQuota && apiQuota.used > localMinedCredits ? apiQuota.used : localMinedCredits;
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

                                                                                  const dayPct = recommendedDailyLimit > 0 ? Math.round((dayCredits / recommendedDailyLimit) * 1000) / 10 : 0;
                                                                                  const dayColor = getColorInfo(dayPct, false);
                                                                                  const dayPct = recommendedDailyLimit > 0 ? Math.round((dayCredits / recommendedDailyLimit) * 1000) / 10 : 0;
                                                                                  const dayColor = getColorInfo(dayPct, false);
                                                                                  for (let d = 1; d <= calendar.daysInMonth; d++) {
                                                                                    const dt = new Date(year, month, d);
                                                                                    const ds = formatDateYMD(dt);
                                                                                    const isWork = Boolean(calendar.workdayMap[ds]);
                                                                                    const bucket = dailyMap[ds];
                                                                                    const dayCredits = Math.round((bucket?.credits || 0) * 100) / 100;
                                                                                    if (apiQuota && apiQuota.used > localMinedCredits + 0.5) {
                                                                                      const externalCredits = Math.round((apiQuota.used - localMinedCredits) * 100) / 100;
                                                                                      modelAgg['External / Non-Chat Copilot Usage'] = {
                                                                                        multiplier: 0,
                                                                                        messages: 0,
                                                                                        credits: externalCredits,
                                                                                        tokens: 0
                                                                                      };
                                                                                    }
                                                                                    let highMultiplierSavingsEstimate = 0;
                                                                                    for (const m of models) {
                                                                                      if (m.multiplier > 1 && m.messages > 0 && !m.model.startsWith('External')) {
                                                                                        const savingsPerCall = m.multiplier - 1;
                                                                                        highMultiplierSavingsEstimate += m.messages * 0.5 * savingsPerCall;
                                                                                      }
                                                                                    }
                                                                                    highMultiplierSavingsEstimate = Math.round(highMultiplierSavingsEstimate * 100) / 100;

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
                                                                                  dailySeries.push({
                                                                                    dateStr: ds,
                                                                                    dayOfMonth: d,
                                                                                    weekdayName: WEEKDAY_SHORT[dt.getDay()],
                                                                                    isWorkday: isWork,
                                                                                    isToday: d === currentDay,
                                                                                    isFuture: d > currentDay,
                                                                                    credits: dayCredits,
                                                                                    messages: bucket?.messages || 0,
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
                                                                                if (d <= currentDay) {
                                                                                  runningUsed = Math.round((runningUsed + dayCredits) * 100) / 100;
                                                                                }
                                                                                if (isWork) {
                                                                                  runningBudget = Math.round((runningBudget + recommendedDailyLimit) * 100) / 100;
                                                                                }
                                                                                if (d > currentDay - 7 && d <= currentDay) {
                                                                                  last7DaysCredits += dayCredits;
                                                                                }
                                                                                const todayBucket = dailyMap[todayStr];
                                                                                const todayUsedCredits = Math.round((todayBucket?.credits || 0) * 100) / 100;
                                                                                const usedBeforeToday = Math.max(0, Math.round((totalUsedCredits - todayUsedCredits) * 100) / 100);
                                                                                const expectedUsedBeforeToday = Math.round(calendar.pastWorkdays * baseDailyLimit * 100) / 100;
                                                                                const netBalance = Math.round((expectedUsedBeforeToday - usedBeforeToday + extraCredits) * 100) / 100;
                                                                                const rolloverExtraCredits = Math.max(0, netBalance);
                                                                                const creditDebt = Math.max(0, -netBalance);
                                                                                const remainingPoolEnteringToday = Math.max(0, totalMonthlyCredits - usedBeforeToday);
                                                                                const effectiveDailyLimit = Math.round((remainingPoolEnteringToday / calendar.remainingWorkdays) * 100) / 100;
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
                                                                                    `Expensive Chats: ${monthTotalExpensiveChats} chat session(s) in ${calendar.monthName} each consumed >=${minExp}% of a full day's budget (${monthExpensive40to60} used ${minExp}-${maxExp}%, ${monthExpensiveOver60} used >${maxExp}%).`
                                                                                  );
                                                                                }
                                                                                if (contextBloatSessionsCount > 0) {
                                                                                  insights.push(
                                                                                    `Long Thread Tax: ${contextBloatSessionsCount} marathon session(s) (>20 turns) spent ~${contextBloatCreditsWasted.toFixed(1)} credits after turn #20. Starting a fresh chat (/new) saves context tokens.`
                                                                                  );
                                                                                }
                                                                                if (highMultiplierSavingsEstimate >= 2) {
                                                                                  insights.push(
                                                                                    `Model Optimizer: Switching 50% of high-cost (>1 cr/msg) model requests to lighter models would save ~${highMultiplierSavingsEstimate.toFixed(1)} credits/month.`
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

                                                                                // Build 24-Hour Series
                                                                                const hourlySeries: HourlyUsagePoint[] = hourlyCredits.map((cr, hr) => ({
                                                                                  hour: hr,
                                                                                  label: `${String(hr).padStart(2, '0')}:00`,
                                                                                  credits: Math.round(cr * 100) / 100,
                                                                                  messages: hourlyMessages[hr]
                                                                                }));
                                                                                const hourlySeries: HourlyUsagePoint[] = hourlyCredits.map((cr, hr) => ({
                                                                                  hour: hr,
                                                                                  label: `${String(hr).padStart(2, '0')}:00`,
                                                                                  credits: Math.round(cr * 100) / 100,
                                                                                  messages: hourlyMessages[hr]
                                                                                }));
                                                                                const dayPct = recommendedDailyLimit > 0 ? Math.round((dayCredits / recommendedDailyLimit) * 1000) / 10 : 0;
                                                                                const dayColor = getColorInfo(dayPct, false);
                                                                                const standardDailyPercent =
                                                                                  recommendedDailyLimit > 0 ? Math.round((todayUsedCredits / recommendedDailyLimit) * 1000) / 10 : 0;
                                                                                const adjustedDailyPercent =
                                                                                  effectiveDailyLimit > 0
                                                                                    ? Math.round((todayUsedCredits / effectiveDailyLimit) * 1000) / 10
                                                                                    : todayUsedCredits > 0
                                                                                      ? 100
                                                                                      : 0;
                                                                                const activeDailyPercent = config.dailyPercentMode === 'standard' ? standardDailyPercent : adjustedDailyPercent;
                                                                                const monthlyExhausted = totalUsedCredits >= totalMonthlyCredits;
                                                                                const colorInfo = getColorInfo(activeDailyPercent, monthlyExhausted);
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
                                                                                  todayMessages: todayBucket?.messages || 0,
                                                                                  todaySessions: todayBucket?.sessionIds.size || 0,
                                                                                  todayExpensive40to60: todayBucket?.exp40to60 || 0,
                                                                                  todayExpensiveOver60: todayBucket?.expOver60 || 0,
                                                                                  todayTotalExpensiveChats: (todayBucket?.exp40to60 || 0) + (todayBucket?.expOver60 || 0),
                                                                                  standardDailyPercent,
                                                                                  adjustedDailyPercent,
                                                                                  activeDailyPercent,
                                                                                  colorTier: colorInfo.tier,
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

                                                                              // 5. Averages: Weekly, Workday, Work-Hour
                                                                              const elapsedWeeks = Math.max(1, currentDay / 7);
                                                                              const weeklyAverageCredits = Math.round((totalUsedCredits / elapsedWeeks) * 100) / 100;
                                                                              const weeklyAverageMessages = Math.round((sessionsTotalMessages / elapsedWeeks) * 10) / 10;
                                                                              const elapsedWeeks = Math.max(1, currentDay / 7);
                                                                              const weeklyAverageCredits = Math.round((totalUsedCredits / elapsedWeeks) * 100) / 100;
                                                                              const weeklyAverageMessages = Math.round((sessionsTotalMessages / elapsedWeeks) * 10) / 10;
                                                                              dailySeries.push({
                                                                                dateStr: ds,
                                                                                dayOfMonth: d,
                                                                                weekdayName: WEEKDAY_SHORT[dt.getDay()],
                                                                                isWorkday: isWork,
                                                                                isToday: d === currentDay,
                                                                                isFuture: d > currentDay,
                                                                                credits: dayCredits,
                                                                                messages: bucket?.messages || 0,
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
                                                                            const dailySeries: DailyUsagePoint[] = [];
                                                                            let runningUsed = 0;
                                                                            let runningBudget = 0;
                                                                            let last7DaysCredits = 0;
                                                                            export function computeHistoryComparison(
                                                                              config: TrackerConfig,
                                                                              realNow: Date,
                                                                              selectedYear: number,
                                                                              selectedMonth: number,
                                                                              sessionsByMonth: Record<string, SessionRecord[]>,
                                                                              currentMonthApiQuota?: ApiQuotaInfo,
                                                                              monthsBack = 6,
                                                                              monthlyArchives?: Record<string, MonthlyArchiveEntry>,
                                                                              dailyQuotaLedger?: Record<string, number>
                                                                            ): HistoryComparison {
                                                                              const realYear = realNow.getFullYear();
                                                                              const realMonth = realNow.getMonth();
                                                                              const realMonthKey = formatMonthKey(realYear, realMonth);
                                                                              const selectedMonthKey = formatMonthKey(selectedYear, selectedMonth);

                                                                              const workdayAverageCredits = Math.round((totalUsedCredits / calendar.elapsedWorkdays) * 100) / 100;
                                                                              const workdayAverageMessages = Math.round((sessionsTotalMessages / calendar.elapsedWorkdays) * 10) / 10;
                                                                              const workdayAverageCredits = Math.round((totalUsedCredits / calendar.elapsedWorkdays) * 100) / 100;
                                                                              const workdayAverageMessages = Math.round((sessionsTotalMessages / calendar.elapsedWorkdays) * 10) / 10;
                                                                              const hourlySeries: HourlyUsagePoint[] = hourlyCredits.map((cr, hr) => ({
                                                                                hour: hr,
                                                                                label: `${String(hr).padStart(2, '0')}:00`,
                                                                                credits: Math.round(cr * 100) / 100,
                                                                                messages: hourlyMessages[hr]
                                                                              }));
                                                                              for (let d = 1; d <= calendar.daysInMonth; d++) {
                                                                                const dt = new Date(year, month, d);
                                                                                const ds = formatDateYMD(dt);
                                                                                const isWork = Boolean(calendar.workdayMap[ds]);
                                                                                const bucket = dailyMap[ds];
                                                                                const dayCredits = Math.round((bucket?.credits || 0) * 100) / 100;
                                                                                const buildSnapshotForMonth = (y: number, m: number): AnalyticsSnapshot => {
                                                                                  const mKey = formatMonthKey(y, m);
                                                                                  const isCurrent = mKey === realMonthKey;
                                                                                  const daysInMonth = new Date(y, m + 1, 0).getDate();
                                                                                  const refDate = isCurrent ? realNow : new Date(y, m, daysInMonth, 23, 59, 59);
                                                                                  const monthSessions = sessionsByMonth[mKey] || [];
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
                                                                                  } else if (!config.overrideApiEntitlement && currentMonthApiQuota && currentMonthApiQuota.entitlement > 0) {
                                                                                    quotaForMonth = {
                                                                                      entitlement: currentMonthApiQuota.entitlement,
                                                                                      used: 0,
                                                                                      remaining: currentMonthApiQuota.entitlement,
                                                                                      unlimited: currentMonthApiQuota.unlimited,
                                                                                      fetchedAt: currentMonthApiQuota.fetchedAt
                                                                                    };
                                                                                  }
                                                                                  return computeAnalytics(config, refDate, monthSessions, quotaForMonth, dailyQuotaLedger);
                                                                                };

                                                                                const workHours = Math.max(1, config.workHoursPerDay || 8);
                                                                                const workHourAverageCredits = Math.round((workdayAverageCredits / workHours) * 100) / 100;
                                                                                const workHourAverageMessages = Math.round((workdayAverageMessages / workHours) * 100) / 100;
                                                                                const workHours = Math.max(1, config.workHoursPerDay || 8);
                                                                                const workHourAverageCredits = Math.round((workdayAverageCredits / workHours) * 100) / 100;
                                                                                const workHourAverageMessages = Math.round((workdayAverageMessages / workHours) * 100) / 100;
                                                                                const elapsedWeeks = Math.max(1, currentDay / 7);
                                                                                const weeklyAverageCredits = Math.round((totalUsedCredits / elapsedWeeks) * 100) / 100;
                                                                                const weeklyAverageMessages = Math.round((sessionsTotalMessages / elapsedWeeks) * 10) / 10;
                                                                                if (d <= currentDay) {
                                                                                  runningUsed = Math.round((runningUsed + dayCredits) * 100) / 100;
                                                                                }
                                                                                if (isWork) {
                                                                                  runningBudget = Math.round((runningBudget + recommendedDailyLimit) * 100) / 100;
                                                                                }
                                                                                if (d > currentDay - 7 && d <= currentDay) {
                                                                                  last7DaysCredits += dayCredits;
                                                                                }
                                                                                const selectedSnapshot = buildSnapshotForMonth(selectedYear, selectedMonth);
                                                                                const prevDate = new Date(selectedYear, selectedMonth - 1, 1);
                                                                                const prevYear = prevDate.getFullYear();
                                                                                const prevMonth = prevDate.getMonth();
                                                                                const previousMonthKey = formatMonthKey(prevYear, prevMonth);
                                                                                const previousMonthLabel = `${MONTH_NAMES[prevMonth]} ${prevYear}`;
                                                                                const previousSnapshot = buildSnapshotForMonth(prevYear, prevMonth);

                                                                                const activeHoursCount = Math.max(1, hourlyCredits.filter(c => c > 0).length);
                                                                                const activeHourAverageCredits = Math.round((totalUsedCredits / activeHoursCount) * 100) / 100;
                                                                                const activeHoursCount = Math.max(1, hourlyCredits.filter(c => c > 0).length);
                                                                                const activeHourAverageCredits = Math.round((totalUsedCredits / activeHoursCount) * 100) / 100;
                                                                                const workdayAverageCredits = Math.round((totalUsedCredits / calendar.elapsedWorkdays) * 100) / 100;
                                                                                const workdayAverageMessages = Math.round((sessionsTotalMessages / calendar.elapsedWorkdays) * 10) / 10;
                                                                                const dayPct = recommendedDailyLimit > 0 ? Math.round((dayCredits / recommendedDailyLimit) * 1000) / 10 : 0;
                                                                                const dayColor = getColorInfo(dayPct, false);
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
                                                                                  const workHours = Math.max(1, config.workHoursPerDay || 8);
                                                                                  const workHourAverageCredits = Math.round((workdayAverageCredits / workHours) * 100) / 100;
                                                                                  const workHourAverageMessages = Math.round((workdayAverageMessages / workHours) * 100) / 100;
                                                                                  dailySeries.push({
                                                                                    dateStr: ds,
                                                                                    dayOfMonth: d,
                                                                                    weekdayName: WEEKDAY_SHORT[dt.getDay()],
                                                                                    isWorkday: isWork,
                                                                                    isToday: d === currentDay,
                                                                                    isFuture: d > currentDay,
                                                                                    credits: dayCredits,
                                                                                    messages: bucket?.messages || 0,
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

                                                                                const workspaces: WorkspaceUsageSummary[] = Object.values(workspaceAgg)
                                                                                  .map(w => ({
                                                                                    ...w,
                                                                                    credits: Math.round(w.credits * 100) / 100,
                                                                                    percentOfCredits: totalUsedCredits > 0 ? Math.round((w.credits / totalUsedCredits) * 1000) / 10 : 0
                                                                                  }))
                                                                                  .sort((a, b) => b.credits - a.credits);
                                                                                const workspaces: WorkspaceUsageSummary[] = Object.values(workspaceAgg)
                                                                                  .map(w => ({
                                                                                    ...w,
                                                                                    credits: Math.round(w.credits * 100) / 100,
                                                                                    percentOfCredits: totalUsedCredits > 0 ? Math.round((w.credits / totalUsedCredits) * 1000) / 10 : 0
                                                                                  }))
                                                                                  .sort((a, b) => b.credits - a.credits || b.messages - a.messages);
                                                                                const activeHoursCount = Math.max(1, hourlyCredits.filter(c => c > 0).length);
                                                                                const activeHourAverageCredits = Math.round((totalUsedCredits / activeHoursCount) * 100) / 100;
                                                                                const hourlySeries: HourlyUsagePoint[] = hourlyCredits.map((cr, hr) => ({
                                                                                  hour: hr,
                                                                                  label: `${String(hr).padStart(2, '0')}:00`,
                                                                                  credits: Math.round(cr * 100) / 100,
                                                                                  messages: hourlyMessages[hr]
                                                                                }));
                                                                                const isCurr = mKey === realMonthKey;
                                                                                const endBalance = isCurr
                                                                                  ? snap.netBalance
                                                                                  : Math.round((snap.totalMonthlyCredits - snap.totalUsedCredits) * 100) / 100;

                                                                                // 7. Expensive Sessions Leaderboard & Counts
                                                                                const monthExpensive40to60 = sessions.filter(s => s.expenseTier === 'heavy-40-60').length;
                                                                                const monthExpensiveOver60 = sessions.filter(s => s.expenseTier === 'mega-60plus').length;
                                                                                const monthTotalExpensiveChats = monthExpensive40to60 + monthExpensiveOver60;
                                                                                const monthExpensive40to60 = sessions.filter(s => s.expenseTier === 'heavy-40-60').length;
                                                                                const monthExpensiveOver60 = sessions.filter(s => s.expenseTier === 'mega-60plus').length;
                                                                                const monthTotalExpensiveChats = monthExpensive40to60 + monthExpensiveOver60;
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

                                                                              const topExpensiveSessions = [...sessions]
                                                                                .sort((a, b) => b.credits - a.credits || b.messages - a.messages)
                                                                                .slice(0, 15);
                                                                              const topExpensiveSessions = [...sessions]
                                                                                .sort((a, b) => b.credits - a.credits || b.messages - a.messages)
                                                                                .slice(0, 15);
                                                                              const workspaces: WorkspaceUsageSummary[] = Object.values(workspaceAgg)
                                                                                .map(w => ({
                                                                                  ...w,
                                                                                  credits: Math.round(w.credits * 100) / 100,
                                                                                  percentOfCredits: totalUsedCredits > 0 ? Math.round((w.credits / totalUsedCredits) * 1000) / 10 : 0
                                                                                }))
                                                                                .sort((a, b) => b.credits - a.credits || b.messages - a.messages);
                                                                              const models: ModelUsageSummary[] = Object.entries(modelAgg)
                                                                                .map(([model, m]) => {
                                                                                  const avgRate = m.messages > 0 ? Math.round((m.credits / m.messages) * 100) / 100 : m.multiplier;
                                                                                  return {
                                                                                    model,
                                                                                    multiplier: avgRate,
                                                                                    messages: m.messages,
                                                                                    credits: Math.round(m.credits * 100) / 100,
                                                                                    estimatedTokens: m.tokens,
                                                                                    percentOfCredits: totalUsedCredits > 0 ? Math.round((m.credits / totalUsedCredits) * 1000) / 10 : 0,
                                                                                    percentOfMessages: sessionsTotalMessages > 0 ? Math.round((m.messages / sessionsTotalMessages) * 1000) / 10 : 0
                                                                                  };
                                                                                })
                                                                                .sort((a, b) => b.credits - a.credits || b.messages - a.messages);
                                                                              const compareDay = Math.min(selectedSnapshot.calendar.currentDay, previousSnapshot.calendar.daysInMonth);
                                                                              const sameDaySelectedCredits =
                                                                                selectedSnapshot.dailySeries[compareDay - 1]?.cumulativeUsed || selectedSnapshot.totalUsedCredits;
                                                                              const sameDayPreviousCredits =
                                                                                previousSnapshot.dailySeries[compareDay - 1]?.cumulativeUsed || previousSnapshot.totalUsedCredits;
                                                                              const momSameDayDeltaCredits = Math.round((sameDaySelectedCredits - sameDayPreviousCredits) * 100) / 100;
                                                                              const momSameDayDeltaPercent =
                                                                                sameDayPreviousCredits > 0
                                                                                  ? Math.round(((sameDaySelectedCredits - sameDayPreviousCredits) / sameDayPreviousCredits) * 1000) / 10
                                                                                  : sameDaySelectedCredits > 0
                                                                                    ? 100
                                                                                    : 0;

                                                                              const activeTodayTopSession = sessions
                                                                                .filter(s => s.dateStr === todayStr)
                                                                                .filter(s => s.dateStr === todayStr || s.turns?.some(t => t.dateStr === todayStr))
                                                                                .sort((a, b) => b.credits - a.credits)[0];
                                                                              const activeTodayTopSession = sessions
                                                                                .filter(s => s.dateStr === todayStr || s.turns?.some(t => t.dateStr === todayStr))
                                                                                .sort((a, b) => b.credits - a.credits)[0];
                                                                              const monthExpensive40to60 = sessions.filter(s => s.expenseTier === 'heavy-40-60').length;
                                                                              const monthExpensiveOver60 = sessions.filter(s => s.expenseTier === 'mega-60plus').length;
                                                                              const monthTotalExpensiveChats = monthExpensive40to60 + monthExpensiveOver60;
                                                                              const workspaces: WorkspaceUsageSummary[] = Object.values(workspaceAgg)
                                                                                .map(w => ({
                                                                                  ...w,
                                                                                  credits: Math.round(w.credits * 100) / 100,
                                                                                  percentOfCredits: totalUsedCredits > 0 ? Math.round((w.credits / totalUsedCredits) * 1000) / 10 : 0
                                                                                }))
                                                                                .sort((a, b) => b.credits - a.credits || b.messages - a.messages);
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

                                                                              // 8. Forecast & Smart Insights
                                                                              const projectedMonthlyCredits = Math.round(workdayAverageCredits * calendar.totalWorkdays * 100) / 100;
                                                                              const projectedEndBalance = Math.round((totalMonthlyCredits - projectedMonthlyCredits) * 100) / 100;
                                                                              const projectedMonthlyCredits = Math.round(workdayAverageCredits * calendar.totalWorkdays * 100) / 100;
                                                                              const projectedEndBalance = Math.round((totalMonthlyCredits - projectedMonthlyCredits) * 100) / 100;
                                                                              const topExpensiveSessions = [...sessions]
                                                                                .sort((a, b) => b.credits - a.credits || b.messages - a.messages)
                                                                                .slice(0, 15);
                                                                              const monthExpensive40to60 = sessions.filter(s => s.expenseTier === 'heavy-40-60').length;
                                                                              const monthExpensiveOver60 = sessions.filter(s => s.expenseTier === 'mega-60plus').length;
                                                                              const monthTotalExpensiveChats = monthExpensive40to60 + monthExpensiveOver60;
                                                                              const momExpensiveChatsDelta =
                                                                                selectedSnapshot.monthTotalExpensiveChats - previousSnapshot.monthTotalExpensiveChats;

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
                                                                              const activeTodayTopSession = sessions
                                                                                .filter(s => s.dateStr === todayStr || s.turns?.some(t => t.dateStr === todayStr))
                                                                                .sort((a, b) => b.credits - a.credits)[0];
                                                                              const topExpensiveSessions = [...sessions]
                                                                                .sort((a, b) => b.credits - a.credits || b.messages - a.messages)
                                                                                .slice(0, 15);

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
                                                                                let highMultiplierSavingsEstimate = 0;
                                                                                for (const m of models) {
                                                                                  if (m.multiplier > 1 && m.messages > 0 && !m.model.startsWith('External')) {
                                                                                    const savingsPerCall = m.multiplier - 1;
                                                                                    highMultiplierSavingsEstimate += (m.messages * 0.5) * savingsPerCall;
                                                                                  }
                                                                                }
                                                                                highMultiplierSavingsEstimate = Math.round(highMultiplierSavingsEstimate * 100) / 100;
                                                                                const projectedMonthlyCredits = Math.round(workdayAverageCredits * calendar.totalWorkdays * 100) / 100;
                                                                                const projectedEndBalance = Math.round((totalMonthlyCredits - projectedMonthlyCredits) * 100) / 100;
                                                                                const activeTodayTopSession = sessions
                                                                                  .filter(s => s.dateStr === todayStr || s.turns?.some(t => t.dateStr === todayStr))
                                                                                  .sort((a, b) => b.credits - a.credits)[0];

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
                                                                                let exhaustionDateStr: string | null = null;
                                                                                if (workdayAverageCredits > 0 && projectedMonthlyCredits > totalMonthlyCredits) {
                                                                                  const remainingCredits = Math.max(0, totalMonthlyCredits - totalUsedCredits);
                                                                                  const workdaysUntilEmpty = Math.floor(remainingCredits / workdayAverageCredits);
                                                                                  let seenWorkdays = 0;
                                                                                  for (let d = currentDay; d <= calendar.daysInMonth; d++) {
                                  
...[truncated for diff preview]
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