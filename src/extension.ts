import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  AnalyticsSnapshot,
  ApiQuotaInfo,
  SessionRecord,
  TrackerConfig,
  computeAnalytics,
  fetchCopilotInternalQuota,
  formatDateYMD,
  resolveModelMultiplier,
  scanLocalChatSessions
} from './tracker';

const MANUAL_SESSIONS_KEY = 'copilotAnalytics.manualSessions.v1';
const LAST_API_QUOTA_KEY = 'copilotAnalytics.lastApiQuota.v1';
const ALERTED_SESSION_IDS_KEY = 'copilotAnalytics.alertedSessions.v1';

let statusBarItem: vscode.StatusBarItem;
let dashboardPanel: vscode.WebviewPanel | undefined;
let latestSnapshot: AnalyticsSnapshot | undefined;
let refreshTimer: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
  // Create bottom-right Status Bar Info Box
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'copilotAnalytics.showDashboard';
  statusBarItem.name = 'Copilot Credit & Daily Limit Monitor';
  statusBarItem.text = '$(sync~spin) Copilot Credits...';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  const refreshAll = async (interactiveAuth = false) => {
    const config = readTrackerConfig();
    const now = new Date();

    // 1. Fetch GitHub Copilot API quota if signed in
    let apiQuota = context.globalState.get<ApiQuotaInfo>(LAST_API_QUOTA_KEY);
    try {
      const session = await vscode.authentication.getSession('github', ['read:user'], {
        createIfNone: interactiveAuth
      });
      if (session?.accessToken) {
        const freshQuota = await fetchCopilotInternalQuota(session.accessToken);
        if (freshQuota) {
          apiQuota = freshQuota;
          await context.globalState.update(LAST_API_QUOTA_KEY, freshQuota);
        }
      }
    } catch {
      // Fallback to cached quota or local calculation
    }

    // 2. Locate workspaceStorage root from globalStorageUri
    // globalStorageUri is typically .../User/globalStorage/<publisher>.<ext>
    const userDir = path.dirname(path.dirname(context.globalStorageUri.fsPath));
    const workspaceStorageRoot = path.join(userDir, 'workspaceStorage');

    const localSessions = scanLocalChatSessions(
      workspaceStorageRoot,
      now.getFullYear(),
      now.getMonth(),
      config.modelMultipliers
    );

    const manualSessions = getManualSessionsForCurrentMonth(context, now.getFullYear(), now.getMonth());
    const allSessions = [...localSessions, ...manualSessions];

    latestSnapshot = computeAnalytics(config, now, allSessions, apiQuota);
    updateStatusBar(latestSnapshot);
    checkActiveSessionWarnings(context, latestSnapshot, config);

    if (dashboardPanel) {
      dashboardPanel.webview.html = renderDashboardHtml(latestSnapshot, config);
    }
  };

  // Register Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('copilotAnalytics.showDashboard', async () => {
      if (!latestSnapshot) {
        await refreshAll(false);
      }
      openDashboardPanel(context, refreshAll);
    }),

    vscode.commands.registerCommand('copilotAnalytics.refresh', async () => {
      await refreshAll(true);
      vscode.window.showInformationMessage('Copilot Credit Analytics refreshed.');
    }),

    vscode.commands.registerCommand('copilotAnalytics.setCredits', async () => {
      const cfg = vscode.workspace.getConfiguration('copilotAnalytics');
      const currentMonthly = cfg.get<number>('monthlyCredits', 300);
      const currentExtra = cfg.get<number>('extraCredits', 0);

      const baseInput = await vscode.window.showInputBox({
        title: 'Set Monthly Base Copilot Credits',
        prompt: 'Enter your monthly Copilot credit limit (e.g. 300 for Pro, 1500 for Pro+, 50 for Free)',
        value: String(currentMonthly),
        validateInput: v => (isNaN(Number(v)) || Number(v) <= 0 ? 'Enter a positive number' : null)
      });
      if (baseInput === undefined) {
        return;
      }

      const extraInput = await vscode.window.showInputBox({
        title: 'Set Extra / Topped-Up Credits for This Month',
        prompt: 'Enter any additional purchased or bonus credits for this month (0 if none)',
        value: String(currentExtra),
        validateInput: v => (isNaN(Number(v)) || Number(v) < 0 ? 'Enter 0 or a positive number' : null)
      });
      if (extraInput === undefined) {
        return;
      }

      await cfg.update('monthlyCredits', Number(baseInput), vscode.ConfigurationTarget.Global);
      await cfg.update('overrideApiEntitlement', true, vscode.ConfigurationTarget.Global);
      await cfg.update('extraCredits', Number(extraInput), vscode.ConfigurationTarget.Global);
      await refreshAll(false);
      vscode.window.showInformationMessage(
        `Updated Copilot budget: ${baseInput} base + ${extraInput} extra credits/month.`
      );
    }),

    vscode.commands.registerCommand('copilotAnalytics.logUsage', async () => {
      await promptLogSession(context);
      await refreshAll(false);
    }),

    vscode.commands.registerCommand('copilotAnalytics.exportData', async () => {
      if (!latestSnapshot) {
        await refreshAll(false);
      }
      if (latestSnapshot) {
        await exportAnalyticsReport(latestSnapshot);
      }
    })
  );

  // Refresh when settings change
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('copilotAnalytics')) {
        refreshAll(false);
      }
    })
  );

  // Initial load + periodic refresh every 2 minutes
  refreshAll(false);
  refreshTimer = setInterval(() => refreshAll(false), 120_000);
  context.subscriptions.push({
    dispose: () => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
    }
  });
}

export function deactivate() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
}

function readTrackerConfig(): TrackerConfig {
  const cfg = vscode.workspace.getConfiguration('copilotAnalytics');
  return {
    monthlyCredits: cfg.get<number>('monthlyCredits', 300),
    overrideApiEntitlement: cfg.get<boolean>('overrideApiEntitlement', false),
    extraCredits: cfg.get<number>('extraCredits', 0),
    workDays: cfg.get<number[]>('workDays', [1, 2, 3, 4, 5]),
    workHoursPerDay: cfg.get<number>('workHoursPerDay', 8),
    holidays: cfg.get<string[]>('holidays', []),
    dailyPercentMode: cfg.get<'adjusted' | 'standard'>('dailyPercentMode', 'adjusted'),
    expensiveSessionMinPercent: cfg.get<number>('expensiveSessionMinPercent', 40),
    expensiveSessionMaxPercent: cfg.get<number>('expensiveSessionMaxPercent', 60),
    modelMultipliers: cfg.get<Record<string, number>>('modelMultipliers', {})
  };
}

function getManualSessionsForCurrentMonth(
  context: vscode.ExtensionContext,
  year: number,
  month: number
): SessionRecord[] {
  const all = context.globalState.get<SessionRecord[]>(MANUAL_SESSIONS_KEY, []);
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
  return all.filter(s => s.dateStr && s.dateStr.startsWith(prefix));
}

async function promptLogSession(context: vscode.ExtensionContext) {
  const config = readTrackerConfig();
  const modelOptions = [
    { label: 'claude-3.7-sonnet', description: '1x credit/msg' },
    { label: 'claude-3.7-sonnet-thought', description: '1.25x credits/msg' },
    { label: 'claude-opus-4', description: '10x credits/msg (Expensive)' },
    { label: 'claude-opus-4.5', description: '3x credits/msg' },
    { label: 'gemini-2.5-pro', description: '1x credit/msg' },
    { label: 'o3-mini', description: '0.33x credits/msg' },
    { label: 'gpt-4.1', description: '0x credits/msg (Included)' },
    { label: 'gpt-4o', description: '0x credits/msg (Included)' }
  ];

  const pickedModel = await vscode.window.showQuickPick(modelOptions, {
    title: 'Select AI Model Used in Session'
  });
  if (!pickedModel) {
    return;
  }

  const msgInput = await vscode.window.showInputBox({
    title: 'Number of Messages / Turns in Session',
    prompt: 'How many messages were sent in this chat session?',
    value: '8',
    validateInput: v => (isNaN(Number(v)) || Number(v) <= 0 ? 'Enter a positive integer' : null)
  });
  if (!msgInput) {
    return;
  }

  const titleInput = await vscode.window.showInputBox({
    title: 'Session Description / Title',
    prompt: 'Brief title for this chat session',
    value: 'Refactor & debug feature module'
  });
  if (titleInput === undefined) {
    return;
  }

  await addManualSession(context, {
    title: titleInput || 'Manual Chat Session',
    model: pickedModel.label,
    messages: Math.round(Number(msgInput)),
    workspaceName: vscode.workspace.name || 'Current Workspace',
    dateStr: formatDateYMD(new Date()),
    config
  });
}

async function addManualSession(
  context: vscode.ExtensionContext,
  params: {
    title: string;
    model: string;
    messages: number;
    workspaceName: string;
    dateStr: string;
    hour?: number;
    config: TrackerConfig;
  }
) {
  const mult = resolveModelMultiplier(params.model, params.config.modelMultipliers);
  const credits = Math.round(params.messages * mult * 100) / 100;
  const now = new Date();
  const [y, m, d] = params.dateStr.split('-').map(Number);
  const startDt = new Date(y, m - 1, d, params.hour ?? now.getHours(), 15, 0);
  const startTime = startDt.getTime();
  const durationMinutes = Math.max(3, params.messages * 2);
  const directTokens = params.messages * 950;
  const cumulativeContextTokens = Math.round((params.messages * (params.messages + 1) / 2) * 950);
  const post20Turns = Math.max(0, params.messages - 20);

  const rec: SessionRecord = {
    sessionId: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: params.title,
    workspaceName: params.workspaceName,
    dateStr: params.dateStr,
    startTime,
    endTime: startTime + durationMinutes * 60000,
    durationMinutes,
    messages: params.messages,
    credits,
    estimatedTokens: directTokens,
    cumulativeContextTokens,
    modelsUsed: {
      [params.model]: { messages: params.messages, credits }
    },
    primaryModel: params.model,
    dailyLimitPercent: 0,
    expenseTier: 'normal',
    hasContextBloat: params.messages > 20 || cumulativeContextTokens > 60000,
    post20TurnCredits: Math.round(post20Turns * mult * 100) / 100,
    isManual: true
  };

  const existing = context.globalState.get<SessionRecord[]>(MANUAL_SESSIONS_KEY, []);
  existing.push(rec);
  await context.globalState.update(MANUAL_SESSIONS_KEY, existing);
}

/**
 * Seeds realistic sample sessions across the current month so the user can test charts,
 * 40-60% expensive chat counters, extra/debt math, and model breakdowns immediately.
 */
async function seedSampleData(context: vscode.ExtensionContext, config: TrackerConfig) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayDay = now.getDate();

  const sampleTemplates = [
    { dayOffset: -6, hour: 10, title: 'Architecture migration to microservices', model: 'claude-3.7-sonnet-thought', messages: 6, ws: 'backend-api' },
    { dayOffset: -5, hour: 14, title: 'Deep race-condition root cause analysis', model: 'claude-opus-4', messages: 1, ws: 'core-engine' },
    { dayOffset: -4, hour: 11, title: 'Build GraphQL schema & resolvers', model: 'claude-3.7-sonnet', messages: 7, ws: 'backend-api' },
    { dayOffset: -3, hour: 16, title: 'Full-day legacy billing refactor (Marathon)', model: 'claude-3.7-sonnet', messages: 24, ws: 'billing-service' },
    { dayOffset: -2, hour: 9, title: 'Quick unit test generation & linting', model: 'gpt-4.1', messages: 12, ws: 'frontend-web' },
    { dayOffset: -2, hour: 15, title: 'OAuth2 PKCE flow troubleshooting', model: 'gemini-2.5-pro', messages: 8, ws: 'auth-gateway' },
    { dayOffset: -1, hour: 11, title: 'Optimize SQL query planner indexes', model: 'claude-3.7-sonnet', messages: 6, ws: 'backend-api' },
    { dayOffset: 0, hour: 10, title: 'Implement real-time analytics dashboard UI', model: 'claude-3.7-sonnet', messages: 7, ws: 'copilot-analytics' },
    { dayOffset: 0, hour: 14, title: 'Complex AST parser debugging session', model: 'claude-3.7-sonnet-thought', messages: 5, ws: 'core-engine' }
  ];

  for (const tpl of sampleTemplates) {
    const targetDay = Math.max(1, todayDay + tpl.dayOffset);
    const dateStr = formatDateYMD(new Date(year, month, targetDay));
    await addManualSession(context, {
      title: tpl.title,
      model: tpl.model,
      messages: tpl.messages,
      workspaceName: tpl.ws,
      dateStr,
      hour: tpl.hour,
      config
    });
  }
}

function checkActiveSessionWarnings(
  context: vscode.ExtensionContext,
  snap: AnalyticsSnapshot,
  config: TrackerConfig
) {
  const topToday = snap.activeTodayTopSession;
  if (!topToday || topToday.expenseTier === 'normal') {
    return;
  }
  const alerted = new Set(context.globalState.get<string[]>(ALERTED_SESSION_IDS_KEY, []));
  const key = `${topToday.sessionId}:${topToday.expenseTier}`;
  if (alerted.has(key)) {
    return;
  }
  alerted.add(key);
  context.globalState.update(ALERTED_SESSION_IDS_KEY, Array.from(alerted));

  if (topToday.expenseTier === 'mega-60plus') {
    vscode.window.showWarningMessage(
      `Copilot Heavy Session Alert: "${topToday.title}" has used ${topToday.dailyLimitPercent.toFixed(0)}% (${topToday.credits} cr) of your daily limit (> ${config.expensiveSessionMaxPercent}%). Consider starting a new chat (/new) to reduce context bloat.`
    );
  } else if (topToday.expenseTier === 'heavy-40-60') {
    vscode.window.showInformationMessage(
      `Copilot Session Notice: "${topToday.title}" has reached ${topToday.dailyLimitPercent.toFixed(0)}% (${topToday.credits} cr) of your daily credit budget (${config.expensiveSessionMinPercent}-${config.expensiveSessionMaxPercent}% tier).`
    );
  }
}

function makeAsciiBar(percent: number, width = 14): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));
}

/**
 * Updates the bottom-right Status Bar Info Box with color coding, daily limit %, extra credits & debt,
 * and a rich interactive Markdown tooltip card.
 */
function updateStatusBar(snap: AnalyticsSnapshot) {
  const pctText = `${snap.activeDailyPercent.toFixed(0)}%`;
  const targetLimit =
    readTrackerConfig().dailyPercentMode === 'standard'
      ? snap.recommendedDailyLimit
      : snap.effectiveDailyLimit;

  const balanceBadge =
    snap.creditDebt > 0
      ? `-${snap.creditDebt.toFixed(1)} Debt`
      : `+${snap.rolloverExtraCredits.toFixed(1)} Extra`;

  const expChatTag =
    snap.todayTotalExpensiveChats > 0 ? ` | 🔥${snap.todayTotalExpensiveChats} Heavy` : '';

  statusBarItem.text = `${snap.statusEmoji} Copilot: ${pctText} (${snap.todayUsedCredits.toFixed(1)}/${targetLimit.toFixed(1)} cr) | ${balanceBadge}${expChatTag}`;
  statusBarItem.color = snap.colorHex;

  if (snap.colorTier === 'red') {
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  } else if (snap.colorTier === 'orange') {
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  } else {
    statusBarItem.backgroundColor = undefined;
  }

  // Build Rich Hover Info Box
  const md = new vscode.MarkdownString('', true);
  md.isTrusted = true;
  md.supportHtml = true;

  const dailyBar = makeAsciiBar(snap.activeDailyPercent, 16);
  const monthlyBar = makeAsciiBar(snap.monthlyUsedPercent, 16);

  md.appendMarkdown(`### ${snap.statusEmoji} Copilot Credit & Daily Limit Monitor\n\n`);
  md.appendMarkdown(
    `**Today's Daily Limit:** \`${dailyBar}\` **${snap.activeDailyPercent.toFixed(1)}%** *(Color: ${snap.colorTier.toUpperCase()})*\n\n`
  );
  md.appendMarkdown(
    `| Metric | Value | Details |\n| :--- | :--- | :--- |\n`
  );
  md.appendMarkdown(
    `| **Today's Usage** | **${snap.todayUsedCredits.toFixed(2)} cr** | ${snap.todayMessages} msgs across ${snap.todaySessions} chat(s) |\n`
  );
  md.appendMarkdown(
    `| **Base Daily Limit** | **${snap.recommendedDailyLimit.toFixed(2)} cr/day** | ${snap.totalMonthlyCredits} cr ÷ ${snap.calendar.totalWorkdays} workdays in ${snap.calendar.monthName} |\n`
  );
  md.appendMarkdown(
    `| **Adjusted Daily Limit** | **${snap.effectiveDailyLimit.toFixed(2)} cr/day** | Includes Extra Credits & Debt over ${snap.calendar.remainingWorkdays} remaining workdays |\n`
  );
  md.appendMarkdown(
    `| **Extra Credits (Surplus)** | **+${snap.rolloverExtraCredits.toFixed(2)} cr** | Rollover saved + ${snap.extraCredits} purchased extra credits |\n`
  );
  md.appendMarkdown(
    `| **Credit Debt** | **${snap.creditDebt > 0 ? `-${snap.creditDebt.toFixed(2)} cr 🔴` : '0.00 cr 🟢'}** | ${snap.creditDebt > 0 ? 'Overspent on prior workdays' : 'No debt — on or under budget'} |\n`
  );
  md.appendMarkdown(
    `| **Expensive Chats Today** | **${snap.todayTotalExpensiveChats}** | \`40-60%\`: **${snap.todayExpensive40to60}** · \`>60%\`: **${snap.todayExpensiveOver60}** (Month: **${snap.monthTotalExpensiveChats}**) |\n`
  );
  md.appendMarkdown(
    `| **Monthly Progress** | \`${monthlyBar}\` | **${snap.totalUsedCredits.toFixed(1)} / ${snap.totalMonthlyCredits} cr** (${snap.monthlyUsedPercent.toFixed(1)}%) |\n\n`
  );

  md.appendMarkdown(
    `**Averages:** Weekly: **${snap.weeklyAverageCredits.toFixed(1)} cr** · Workday: **${snap.workdayAverageCredits.toFixed(1)} cr** · Work Hour: **${snap.workHourAverageCredits.toFixed(2)} cr/hr**\n\n`
  );

  if (snap.models.length > 0) {
    const topModels = snap.models
      .slice(0, 3)
      .map(m => `\`${m.model}\` (${m.messages} msgs, ${m.credits.toFixed(1)} cr)`)
      .join(' · ');
    md.appendMarkdown(`**Top Models:** ${topModels}\n\n`);
  }

  md.appendMarkdown(
    `[$(graph) Open Dashboard](command:copilotAnalytics.showDashboard) &nbsp;|&nbsp; ` +
    `[$(sliders) Set Credits](command:copilotAnalytics.setCredits) &nbsp;|&nbsp; ` +
    `[$(add) Log Session](command:copilotAnalytics.logUsage) &nbsp;|&nbsp; ` +
    `[$(sync) Refresh](command:copilotAnalytics.refresh)`
  );

  statusBarItem.tooltip = md;
}

function openDashboardPanel(
  context: vscode.ExtensionContext,
  refreshAll: (interactiveAuth?: boolean) => Promise<void>
) {
  if (dashboardPanel) {
    dashboardPanel.reveal(vscode.ViewColumn.One);
    if (latestSnapshot) {
      dashboardPanel.webview.html = renderDashboardHtml(latestSnapshot, readTrackerConfig());
    }
    return;
  }

  dashboardPanel = vscode.window.createWebviewPanel(
    'copilotCreditAnalyticsDashboard',
    'Copilot Credit & Session Analytics',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  if (latestSnapshot) {
    dashboardPanel.webview.html = renderDashboardHtml(latestSnapshot, readTrackerConfig());
  }

  dashboardPanel.webview.onDidReceiveMessage(async msg => {
    const cfg = vscode.workspace.getConfiguration('copilotAnalytics');
    if (msg.type === 'updateBudget') {
      await cfg.update('monthlyCredits', Number(msg.monthlyCredits) || 300, vscode.ConfigurationTarget.Global);
      await cfg.update('overrideApiEntitlement', true, vscode.ConfigurationTarget.Global);
      await cfg.update('extraCredits', Math.max(0, Number(msg.extraCredits) || 0), vscode.ConfigurationTarget.Global);
      await cfg.update('workHoursPerDay', Math.max(1, Number(msg.workHoursPerDay) || 8), vscode.ConfigurationTarget.Global);
      await cfg.update('dailyPercentMode', msg.dailyPercentMode === 'standard' ? 'standard' : 'adjusted', vscode.ConfigurationTarget.Global);
      await refreshAll(false);
    } else if (msg.type === 'logSession') {
      const config = readTrackerConfig();
      await addManualSession(context, {
        title: msg.title || 'Logged Chat Session',
        model: msg.model || 'claude-3.7-sonnet',
        messages: Math.max(1, Number(msg.messages) || 5),
        workspaceName: msg.workspaceName || vscode.workspace.name || 'Workspace',
        dateStr: msg.dateStr || formatDateYMD(new Date()),
        config
      });
      await refreshAll(false);
    } else if (msg.type === 'seedDemo') {
      await seedSampleData(context, readTrackerConfig());
      await refreshAll(false);
      vscode.window.showInformationMessage('Loaded sample Copilot sessions across the month.');
    } else if (msg.type === 'clearManual') {
      await context.globalState.update(MANUAL_SESSIONS_KEY, []);
      await refreshAll(false);
      vscode.window.showInformationMessage('Cleared simulated/manual sessions.');
    } else if (msg.type === 'refresh') {
      await refreshAll(true);
    } else if (msg.type === 'export') {
      if (latestSnapshot) {
        await exportAnalyticsReport(latestSnapshot);
      }
    }
  });

  dashboardPanel.onDidDispose(() => {
    dashboardPanel = undefined;
  });
}

async function exportAnalyticsReport(snap: AnalyticsSnapshot) {
  const formatPick = await vscode.window.showQuickPick(['JSON (Full Report)', 'CSV (Daily & Sessions Summary)'], {
    title: 'Export Copilot Credit Analytics Report'
  });
  if (!formatPick) {
    return;
  }

  const isJson = formatPick.startsWith('JSON');
  const defaultExt = isJson ? 'json' : 'csv';
  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(
      path.join(
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.env.HOME || '.',
        `copilot-analytics-${snap.calendar.year}-${String(snap.calendar.month + 1).padStart(2, '0')}.${defaultExt}`
      )
    )
  });
  if (!uri) {
    return;
  }

  if (isJson) {
    fs.writeFileSync(uri.fsPath, JSON.stringify(snap, null, 2), 'utf8');
  } else {
    const lines: string[] = [
      'Section,DateOrName,Workday,Messages,Credits,DailyLimitPercent,Expensive40to60,ExpensiveOver60,WorkspaceOrMultiplier'
    ];
    for (const d of snap.dailySeries) {
      lines.push(
        `Daily,${d.dateStr},${d.isWorkday},${d.messages},${d.credits},${d.dailyPercent}%,${d.expensiveChats40to60},${d.expensiveChatsOver60},Limit:${d.recommendedLimit}`
      );
    }
    for (const m of snap.models) {
      lines.push(
        `Model,"${m.model}",-,${m.messages},${m.credits},${m.percentOfCredits}%,-,-,${m.multiplier}x`
      );
    }
    for (const s of snap.topExpensiveSessions) {
      lines.push(
        `Session,"${s.title.replace(/"/g, '""')}",${s.dateStr},${s.messages},${s.credits},${s.dailyLimitPercent}%,${s.expenseTier === 'heavy-40-60' ? 1 : 0},${s.expenseTier === 'mega-60plus' ? 1 : 0},"${s.workspaceName}"`
      );
    }
    fs.writeFileSync(uri.fsPath, lines.join('\n'), 'utf8');
  }

  vscode.window.showInformationMessage(`Exported Copilot Analytics report to ${uri.fsPath}`);
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Generates the interactive Dashboard Webview HTML with pure SVG charts, color-coded gauges,
 * Most Expensive Sessions leaderboard, Daily 40-60% / >60% Expensive Chat counters,
 * Model breakdown, Workspace breakdown, and inline budget controls.
 */
function renderDashboardHtml(snap: AnalyticsSnapshot, config: TrackerConfig): string {
  const tierColors: Record<string, string> = {
    green: '#22c55e',
    yellow: '#eab308',
    orange: '#f97316',
    red: '#ef4444'
  };

  // --- SVG 1: Daily Usage Bar Chart + Recommended Daily Limit Line + Expensive Chat Markers ---
  const chartW = 760;
  const chartH = 220;
  const padL = 42;
  const padR = 20;
  const padT = 28;
  const padB = 34;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const maxDailyCredits = Math.max(
    snap.recommendedDailyLimit * 1.4,
    ...snap.dailySeries.map(d => d.credits),
    5
  );

  const barStep = plotW / snap.dailySeries.length;
  const barW = Math.max(6, barStep * 0.68);
  const limitY = padT + plotH - (snap.recommendedDailyLimit / maxDailyCredits) * plotH;

  const dailyBarsSvg = snap.dailySeries
    .map((d, i) => {
      const x = padL + i * barStep + (barStep - barW) / 2;
      const barH = Math.max(d.credits > 0 ? 3 : 0, (d.credits / maxDailyCredits) * plotH);
      const y = padT + plotH - barH;
      const fill = d.isFuture
        ? 'rgba(148,163,184,0.15)'
        : tierColors[d.colorTier] || '#22c55e';
      const opacity = d.isWorkday ? '0.92' : '0.45';
      const todayStroke = d.isToday ? 'stroke="#38bdf8" stroke-width="2"' : '';

      // Expensive chat badge above bar if any 40-60% or >60% chats occurred on that day
      let expMarker = '';
      if (d.totalExpensiveChats > 0) {
        const badgeColor = d.expensiveChatsOver60 > 0 ? '#ef4444' : '#f97316';
        const markerY = Math.max(12, y - 8);
        expMarker = `
          <circle cx="${(x + barW / 2).toFixed(1)}" cy="${markerY.toFixed(1)}" r="7" fill="${badgeColor}" />
          <text x="${(x + barW / 2).toFixed(1)}" y="${(markerY + 3.5).toFixed(1)}" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold">${d.totalExpensiveChats}</text>
        `;
      }

      const showDayLabel = d.dayOfMonth === 1 || d.dayOfMonth % 3 === 0 || d.isToday || d.dayOfMonth === snap.calendar.daysInMonth;
      const dayLabel = showDayLabel
        ? `<text x="${(x + barW / 2).toFixed(1)}" y="${chartH - 10}" text-anchor="middle" fill="${d.isToday ? '#38bdf8' : '#94a3b8'}" font-size="10" font-weight="${d.isToday ? '700' : '400'}">${d.dayOfMonth}</text>`
        : '';

      const tooltip = `${d.dateStr} (${d.weekdayName}${d.isWorkday ? ' - Workday' : ' - Weekend/Holiday'}): ${d.credits} cr (${d.dailyPercent}% of limit) | ${d.messages} msgs | Expensive chats: ${d.expensiveChats40to60} (40-60%), ${d.expensiveChatsOver60} (>60%)`;

      return `
        <g>
          <title>${escapeHtml(tooltip)}</title>
          <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" rx="3" fill="${fill}" fill-opacity="${opacity}" ${todayStroke} />
          ${expMarker}
          ${dayLabel}
        </g>
      `;
    })
    .join('');

  // --- SVG 2: Cumulative Burn-Up Trajectory (Actual Used vs Workday Budget Trajectory) ---
  const maxCum = Math.max(snap.totalMonthlyCredits * 1.1, snap.totalUsedCredits * 1.1, 10);
  const budgetPoints: string[] = [];
  const actualPoints: string[] = [];

  snap.dailySeries.forEach((d, i) => {
    const cx = padL + i * barStep + barStep / 2;
    const by = padT + plotH - (d.cumulativeBudget / maxCum) * plotH;
    budgetPoints.push(`${cx.toFixed(1)},${by.toFixed(1)}`);
    if (!d.isFuture) {
      const ay = padT + plotH - (d.cumulativeUsed / maxCum) * plotH;
      actualPoints.push(`${cx.toFixed(1)},${ay.toFixed(1)}`);
    }
  });

  // --- SVG 3: 24-Hour Work Hour Usage Chart ---
  const maxHourCr = Math.max(...snap.hourlySeries.map(h => h.credits), 2);
  const hrStep = plotW / 24;
  const hrBarW = Math.max(8, hrStep * 0.65);
  const hourlyBarsSvg = snap.hourlySeries
    .map((h, i) => {
      const x = padL + i * hrStep + (hrStep - hrBarW) / 2;
      const barH = Math.max(h.credits > 0 ? 3 : 0, (h.credits / maxHourCr) * plotH);
      const y = padT + plotH - barH;
      const showLabel = i % 3 === 0;
      return `
        <g>
          <title>${h.label} — ${h.credits} credits, ${h.messages} messages</title>
          <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${hrBarW.toFixed(1)}" height="${barH.toFixed(1)}" rx="3" fill="#38bdf8" fill-opacity="0.85" />
          ${showLabel ? `<text x="${(x + hrBarW / 2).toFixed(1)}" y="${chartH - 10}" text-anchor="middle" fill="#94a3b8" font-size="10">${h.hour}h</text>` : ''}
        </g>
      `;
    })
    .join('');

  // Days that had expensive sessions
  const expensiveDaysRows = snap.dailySeries
    .filter(d => d.totalExpensiveChats > 0)
    .sort((a, b) => b.dayOfMonth - a.dayOfMonth)
    .map(
      d => `
      <tr>
        <td><strong>${d.dateStr}</strong> <span class="muted">(${d.weekdayName})</span></td>
        <td><span class="pill pill-orange">${d.expensiveChats40to60} chats</span></td>
        <td><span class="pill pill-red">${d.expensiveChatsOver60} chats</span></td>
        <td><strong>${d.totalExpensiveChats}</strong> / ${d.sessionsCount} total</td>
        <td>${d.credits.toFixed(2)} cr (${d.dailyPercent.toFixed(0)}%)</td>
        <td class="muted">${escapeHtml(d.topSessionTitle || '-')} (${(d.topSessionPercent || 0).toFixed(0)}%)</td>
      </tr>
    `
    )
    .join('');

  const topSessionsRows = snap.topExpensiveSessions
    .map((s, idx) => {
      const badge =
        s.expenseTier === 'mega-60plus'
          ? `<span class="pill pill-red">&gt;${config.expensiveSessionMaxPercent}% Mega (${s.dailyLimitPercent.toFixed(0)}%)</span>`
          : s.expenseTier === 'heavy-40-60'
          ? `<span class="pill pill-orange">${config.expensiveSessionMinPercent}-${config.expensiveSessionMaxPercent}% Heavy (${s.dailyLimitPercent.toFixed(0)}%)</span>`
          : `<span class="pill pill-green">${s.dailyLimitPercent.toFixed(0)}% Daily</span>`;

      const bloatBadge = s.hasContextBloat
        ? `<span class="pill pill-yellow" title="Over 20 turns or 60k cumulative tokens — high context re-send tax">⚠️ Context Bloat</span>`
        : '';

      const modelsText = Object.entries(s.modelsUsed)
        .map(([m, st]) => `${escapeHtml(m)} (${st.messages})`)
        .join(', ');

      return `
        <tr>
          <td>#${idx + 1}</td>
          <td>
            <div style="font-weight:600;">${escapeHtml(s.title)}</div>
            <div class="muted" style="font-size:11px;">${modelsText}</div>
          </td>
          <td><span class="ws-tag">${escapeHtml(s.workspaceName)}</span></td>
          <td>${s.dateStr} <span class="muted">· ${s.durationMinutes}m</span></td>
          <td>${s.messages} turns ${bloatBadge}</td>
          <td><strong>${s.credits.toFixed(2)} cr</strong> <span class="muted">(~${(s.cumulativeContextTokens / 1000).toFixed(1)}k ctx tok)</span></td>
          <td>${badge}</td>
        </tr>
      `;
    })
    .join('');

  const modelsRows = snap.models
    .map(
      m => `
      <tr>
        <td><strong>${escapeHtml(m.model)}</strong></td>
        <td><span class="ws-tag">${m.multiplier}x cr/msg</span></td>
        <td>${m.messages}</td>
        <td><strong>${m.credits.toFixed(2)} cr</strong></td>
        <td>~${(m.estimatedTokens / 1000).toFixed(1)}k</td>
        <td style="min-width:140px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="progress-track" style="flex:1;height:8px;">
              <div class="progress-fill" style="width:${Math.min(100, m.percentOfCredits)}%;background:#38bdf8;"></div>
            </div>
            <span style="font-size:11px;width:38px;text-align:right;">${m.percentOfCredits.toFixed(1)}%</span>
          </div>
        </td>
      </tr>
    `
    )
    .join('');

  const workspaceRows = snap.workspaces
    .map(
      w => `
      <tr>
        <td><strong>${escapeHtml(w.workspaceName)}</strong></td>
        <td>${w.sessions}</td>
        <td>
          <span class="pill pill-orange">${w.expensiveChats40to60} (40-60%)</span>
          <span class="pill pill-red">${w.expensiveChatsOver60} (&gt;60%)</span>
        </td>
        <td>${w.messages}</td>
        <td><strong>${w.credits.toFixed(2)} cr</strong> (${w.percentOfCredits.toFixed(1)}%)</td>
      </tr>
    `
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Copilot Credit & Token Analytics</title>
  <style>
    :root {
      --bg: #0f172a;
      --card: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --muted: #94a3b8;
      --accent: #38bdf8;
      --green: #22c55e;
      --yellow: #eab308;
      --orange: #f97316;
      --red: #ef4444;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px 24px 40px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.45;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 20px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--border);
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .btn-group { display: flex; gap: 8px; flex-wrap: wrap; }
    button {
      background: #334155;
      color: #f8fafc;
      border: 1px solid #475569;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover { background: #475569; }
    button.primary { background: #0284c7; border-color: #38bdf8; }
    button.primary:hover { background: #0369a1; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
      margin-bottom: 20px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
    }
    .card-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      margin-bottom: 6px;
      font-weight: 600;
    }
    .big-num {
      font-size: 26px;
      font-weight: 700;
      margin: 4px 0;
    }
    .sub-row {
      font-size: 12px;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
      margin-top: 5px;
    }
    .progress-track {
      width: 100%;
      height: 10px;
      background: #0f172a;
      border-radius: 99px;
      overflow: hidden;
      margin: 8px 0;
    }
    .progress-fill {
      height: 100%;
      border-radius: 99px;
      transition: width 0.3s ease;
    }
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 15px;
      font-weight: 700;
      margin: 0 0 12px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
    }
    th, td {
      text-align: left;
      padding: 9px 10px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.14);
    }
    th {
      color: var(--muted);
      font-weight: 600;
      font-size: 11.5px;
      text-transform: uppercase;
    }
    .muted { color: var(--muted); }
    .pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 600;
    }
    .pill-green { background: rgba(34, 197, 94, 0.18); color: #4ade80; }
    .pill-yellow { background: rgba(234, 179, 8, 0.18); color: #facc15; }
    .pill-orange { background: rgba(249, 115, 22, 0.2); color: #fb923c; }
    .pill-red { background: rgba(239, 68, 68, 0.22); color: #f87171; }
    .ws-tag {
      background: rgba(56, 189, 248, 0.14);
      color: #7dd3fc;
      padding: 2px 7px;
      border-radius: 5px;
      font-size: 11px;
    }
    .insights-list {
      margin: 0;
      padding-left: 18px;
      font-size: 13px;
    }
    .insights-list li { margin-bottom: 6px; }
    .form-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: flex-end;
    }
    .form-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 11.5px;
      color: var(--muted);
    }
    input, select {
      background: #0f172a;
      border: 1px solid var(--border);
      color: var(--text);
      padding: 6px 9px;
      border-radius: 6px;
      font-size: 12.5px;
    }
    svg { width: 100%; height: auto; display: block; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>
        <span>${snap.statusEmoji} Copilot Credit & Session Analytics</span>
        <span class="pill" style="background:${snap.colorHex}22;color:${snap.colorHex};border:1px solid ${snap.colorHex}66;">
          Today: ${snap.activeDailyPercent.toFixed(1)}% (${snap.colorTier.toUpperCase()})
        </span>
      </h1>
      <div class="muted" style="font-size:12px;margin-top:4px;">
        ${snap.calendar.monthName} ${snap.calendar.year} · ${snap.calendar.totalWorkdays} Workdays (${snap.calendar.elapsedWorkdays} elapsed, ${snap.calendar.remainingWorkdays} remaining)
        ${snap.apiQuota?.login ? ` · Signed in as <strong>@${escapeHtml(snap.apiQuota.login)}</strong> (${escapeHtml(snap.apiQuota.plan || 'Copilot')})` : ''}
      </div>
    </div>
    <div class="btn-group">
      <button onclick="sendMsg({type:'seedDemo'})">✨ Load Sample Month Data</button>
      <button onclick="sendMsg({type:'clearManual'})">🗑️ Clear Sample/Manual</button>
      <button onclick="sendMsg({type:'export'})">📥 Export CSV / JSON</button>
      <button class="primary" onclick="sendMsg({type:'refresh'})">🔄 Refresh Now</button>
    </div>
  </div>

  <!-- 5 Core KPI Cards -->
  <div class="kpi-grid">
    <!-- 1. Daily Limit Status Box -->
    <div class="card" style="border-color:${snap.colorHex}88;">
      <div class="card-title">1. Today's Daily Limit (${config.dailyPercentMode})</div>
      <div class="big-num" style="color:${snap.colorHex};">
        ${snap.activeDailyPercent.toFixed(1)}%
        <span style="font-size:14px;font-weight:500;color:var(--muted);">(${snap.todayUsedCredits.toFixed(2)} cr used)</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${Math.min(100, snap.activeDailyPercent)}%;background:${snap.colorHex};"></div>
      </div>
      <div class="sub-row">
        <span>Base Daily Limit:</span>
        <strong>${snap.recommendedDailyLimit.toFixed(2)} cr/day</strong>
      </div>
      <div class="sub-row">
        <span>Adjusted Limit (w/ Extra & Debt):</span>
        <strong>${snap.effectiveDailyLimit.toFixed(2)} cr/day</strong>
      </div>
    </div>

    <!-- 2. Monthly Credits & Workdays -->
    <div class="card">
      <div class="card-title">2. Monthly Credits & Workdays</div>
      <div class="big-num">
        ${snap.totalUsedCredits.toFixed(1)} <span style="font-size:15px;color:var(--muted);">/ ${snap.totalMonthlyCredits} cr</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${Math.min(100, snap.monthlyUsedPercent)}%;background:#38bdf8;"></div>
      </div>
      <div class="sub-row">
        <span>Base + Extra Credits:</span>
        <strong>${snap.baseMonthlyCredits} + ${snap.extraCredits} cr</strong>
      </div>
      <div class="sub-row">
        <span>Remaining Credits:</span>
        <strong>${snap.remainingMonthlyCredits.toFixed(1)} cr (${snap.calendar.remainingWorkdays} workdays left)</strong>
      </div>
    </div>

    <!-- 3. Extra Credits (Surplus) & Credit Debt -->
    <div class="card">
      <div class="card-title">3. Extra Credits & Credit Debt</div>
      <div class="big-num" style="color:${snap.creditDebt > 0 ? 'var(--red)' : 'var(--green)'};">
        ${snap.creditDebt > 0 ? `-${snap.creditDebt.toFixed(2)} Debt` : `+${snap.rolloverExtraCredits.toFixed(2)} Extra`}
      </div>
      <div class="sub-row">
        <span>Expected Used Before Today:</span>
        <strong>${snap.expectedUsedBeforeToday.toFixed(1)} cr (${snap.calendar.pastWorkdays}d)</strong>
      </div>
      <div class="sub-row">
        <span>Actual Used Before Today:</span>
        <strong>${snap.usedBeforeToday.toFixed(1)} cr</strong>
      </div>
      <div class="sub-row">
        <span>Purchased Extra Credits:</span>
        <strong>+${snap.extraCredits.toFixed(1)} cr</strong>
      </div>
    </div>

    <!-- 4. Weekly / Workday / Work-Hour Averages -->
    <div class="card">
      <div class="card-title">4. Usage Averages</div>
      <div class="big-num" style="color:#38bdf8;">
        ${snap.workdayAverageCredits.toFixed(2)} <span style="font-size:14px;color:var(--muted);">cr / workday</span>
      </div>
      <div class="sub-row">
        <span>Weekly Average (Last 7d: ${snap.last7DaysCredits.toFixed(1)} cr):</span>
        <strong>${snap.weeklyAverageCredits.toFixed(1)} cr/wk (${snap.weeklyAverageMessages.toFixed(0)} msgs)</strong>
      </div>
      <div class="sub-row">
        <span>Work Day Average:</span>
        <strong>${snap.workdayAverageCredits.toFixed(2)} cr/day (${snap.workdayAverageMessages.toFixed(1)} msgs)</strong>
      </div>
      <div class="sub-row">
        <span>Work Hour Average (${config.workHoursPerDay}h/day):</span>
        <strong>${snap.workHourAverageCredits.toFixed(2)} cr/hr (${snap.workHourAverageMessages.toFixed(2)} msgs/hr)</strong>
      </div>
    </div>

    <!-- 5. Expensive Chats Tracker (40-60% and >60%) -->
    <div class="card">
      <div class="card-title">5. Expensive Chats (40–60%+ Daily Limit)</div>
      <div class="big-num" style="color:${snap.monthTotalExpensiveChats > 0 ? 'var(--orange)' : 'var(--green)'};">
        ${snap.todayTotalExpensiveChats} Today <span style="font-size:14px;color:var(--muted);">/ ${snap.monthTotalExpensiveChats} Month</span>
      </div>
      <div class="sub-row">
        <span>40–60% Daily Limit Chats:</span>
        <strong>${snap.todayExpensive40to60} today · ${snap.monthExpensive40to60} month</strong>
      </div>
      <div class="sub-row">
        <span>&gt;60% Mega Chats:</span>
        <strong>${snap.todayExpensiveOver60} today · ${snap.monthExpensiveOver60} month</strong>
      </div>
      <div class="sub-row">
        <span>Avg Session / Context Bloat:</span>
        <strong>${snap.avgCreditsPerSession.toFixed(2)} cr/chat · ${snap.contextBloatSessionsCount} bloated</strong>
      </div>
    </div>
  </div>

  <!-- Interactive SVG Graphs -->
  <div class="charts-grid">
    <div class="card">
      <div class="section-title">
        <span>📊 Daily Credit Usage vs. Recommended Daily Limit (${snap.recommendedDailyLimit.toFixed(1)} cr)</span>
        <span class="muted" style="font-size:11px;">Circles above bars = Expensive Chats (&ge;${config.expensiveSessionMinPercent}% limit)</span>
      </div>
      <svg viewBox="0 0 ${chartW} ${chartH}">
        <!-- Horizontal Grid & Recommended Daily Limit Line -->
        <line x1="${padL}" y1="${padT + plotH}" x2="${chartW - padR}" y2="${padT + plotH}" stroke="#334155" stroke-width="1" />
        <line x1="${padL}" y1="${limitY.toFixed(1)}" x2="${chartW - padR}" y2="${limitY.toFixed(1)}" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="5,4" />
        <text x="${chartW - padR - 4}" y="${Math.max(12, limitY - 5).toFixed(1)}" text-anchor="end" fill="#38bdf8" font-size="10" font-weight="600">
          Daily Limit: ${snap.recommendedDailyLimit.toFixed(1)} cr
        </text>
        ${dailyBarsSvg}
      </svg>
    </div>

    <div class="card">
      <div class="section-title">
        <span>📈 Cumulative Burn-Up vs. Workday Budget (Surplus / Debt)</span>
        <span class="muted" style="font-size:11px;">Dashed = Ideal Workday Pace · Solid = Actual Used</span>
      </div>
      <svg viewBox="0 0 ${chartW} ${chartH}">
        <line x1="${padL}" y1="${padT + plotH}" x2="${chartW - padR}" y2="${padT + plotH}" stroke="#334155" stroke-width="1" />
        <polyline fill="none" stroke="#64748b" stroke-width="2" stroke-dasharray="5,4" points="${budgetPoints.join(' ')}" />
        ${actualPoints.length > 1 ? `<polyline fill="none" stroke="${snap.creditDebt > 0 ? '#ef4444' : '#22c55e'}" stroke-width="2.8" points="${actualPoints.join(' ')}" />` : ''}
        <text x="${padL + 6}" y="${padT + 14}" fill="#94a3b8" font-size="11">
          Monthly Cap: ${snap.totalMonthlyCredits} cr | Projected EOM: ${snap.projectedMonthlyCredits.toFixed(1)} cr
        </text>
      </svg>
    </div>
  </div>

  <div class="charts-grid">
    <!-- 24-Hour Work Hour Activity -->
    <div class="card">
      <div class="section-title">
        <span>⏰ Usage by Hour of Day (Work Hour Distribution)</span>
        <span class="muted" style="font-size:11px;">Active Coding Hour Avg: ${snap.activeHourAverageCredits.toFixed(2)} cr/hr</span>
      </div>
      <svg viewBox="0 0 ${chartW} ${chartH}">
        <line x1="${padL}" y1="${padT + plotH}" x2="${chartW - padR}" y2="${padT + plotH}" stroke="#334155" stroke-width="1" />
        ${hourlyBarsSvg}
      </svg>
    </div>

    <!-- Smart Insights & Recommendations -->
    <div class="card">
      <div class="section-title">
        <span>💡 Smart Budget, Debt & Session Insights</span>
      </div>
      <ul class="insights-list">
        ${snap.insights.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>
    </div>
  </div>

  <!-- Most Expensive Sessions Leaderboard -->
  <div class="card" style="margin-bottom:20px;">
    <div class="section-title">
      <span>🔥 Most Expensive Chat Sessions Leaderboard</span>
      <span class="muted" style="font-size:12px;">
        Flags sessions using <strong>${config.expensiveSessionMinPercent}–${config.expensiveSessionMaxPercent}% (Heavy)</strong> or <strong>&gt;${config.expensiveSessionMaxPercent}% (Mega)</strong> of Daily Limit (${snap.recommendedDailyLimit.toFixed(2)} cr)
      </span>
    </div>
    ${
      topSessionsRows
        ? `<table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Session Title & Models</th>
                <th>Workspace</th>
                <th>Date & Duration</th>
                <th>Messages / Context</th>
                <th>Credits Used</th>
                <th>% of Daily Limit</th>
              </tr>
            </thead>
            <tbody>${topSessionsRows}</tbody>
          </table>`
        : `<div class="muted" style="padding:12px 0;">No chat sessions recorded for this month yet. Click <strong>"✨ Load Sample Month Data"</strong> above or log a session below to test!</div>`
    }
  </div>

  <!-- Daily Expensive Chats Breakdown -->
  <div class="card" style="margin-bottom:20px;">
    <div class="section-title">
      <span>📅 Daily Expensive Chats Breakdown (Days with 40–60% or &gt;60% Daily Limit Sessions)</span>
    </div>
    ${
      expensiveDaysRows
        ? `<table>
            <thead>
              <tr>
                <th>Date</th>
                <th>40–60% Heavy Chats</th>
                <th>&gt;60% Mega Chats</th>
                <th>Expensive / Total Chats</th>
                <th>Total Day Credits</th>
                <th>Most Expensive Chat of Day</th>
              </tr>
            </thead>
            <tbody>${expensiveDaysRows}</tbody>
          </table>`
        : `<div class="muted" style="padding:8px 0;">No days have had a single session exceed ${config.expensiveSessionMinPercent}% of the daily limit yet.</div>`
    }
  </div>

  <!-- AI Models & Workspaces Side-by-Side -->
  <div class="charts-grid">
    <div class="card">
      <div class="section-title">
        <span>🤖 AI Models Usage Breakdown</span>
        <span class="muted" style="font-size:11px;">Model Name · Messages · Credit Usage</span>
      </div>
      ${
        modelsRows
          ? `<table>
              <thead>
                <tr>
                  <th>Model Name</th>
                  <th>Multiplier</th>
                  <th>Messages</th>
                  <th>Credits</th>
                  <th>Est. Tokens</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>${modelsRows}</tbody>
            </table>`
          : `<div class="muted">No model activity recorded yet.</div>`
      }
    </div>

    <div class="card">
      <div class="section-title">
        <span>📁 Workspace / Repository Cost Ranking</span>
        <span class="muted" style="font-size:11px;">Which projects spawn expensive chats</span>
      </div>
      ${
        workspaceRows
          ? `<table>
              <thead>
                <tr>
                  <th>Workspace</th>
                  <th>Sessions</th>
                  <th>Expensive Chats</th>
                  <th>Messages</th>
                  <th>Credits</th>
                </tr>
              </thead>
              <tbody>${workspaceRows}</tbody>
            </table>`
          : `<div class="muted">No workspace activity recorded yet.</div>`
      }
    </div>
  </div>

  <!-- Quick Settings & Session Simulator Controls -->
  <div class="charts-grid">
    <div class="card">
      <div class="section-title">⚙️ Budget & Workday Settings</div>
      <div class="form-row">
        <div class="form-field">
          <label>Monthly Base Credits</label>
          <input id="monthlyCredits" type="number" value="${snap.baseMonthlyCredits}" style="width:110px;" />
        </div>
        <div class="form-field">
          <label>Extra Credits (Month)</label>
          <input id="extraCredits" type="number" value="${snap.extraCredits}" style="width:110px;" />
        </div>
        <div class="form-field">
          <label>Work Hours / Day</label>
          <input id="workHoursPerDay" type="number" value="${config.workHoursPerDay}" style="width:90px;" />
        </div>
        <div class="form-field">
          <label>Status Bar % Mode</label>
          <select id="dailyPercentMode">
            <option value="adjusted" ${config.dailyPercentMode === 'adjusted' ? 'selected' : ''}>Debt/Extra Adjusted</option>
            <option value="standard" ${config.dailyPercentMode === 'standard' ? 'selected' : ''}>Fixed Base Limit</option>
          </select>
        </div>
        <button class="primary" onclick="saveBudget()">Save Budget</button>
      </div>
    </div>

    <div class="card">
      <div class="section-title">➕ Log / Simulate a Chat Session</div>
      <div class="form-row">
        <div class="form-field">
          <label>Session Title</label>
          <input id="simTitle" type="text" value="Refactor auth middleware" style="width:160px;" />
        </div>
        <div class="form-field">
          <label>AI Model</label>
          <select id="simModel">
            <option value="claude-3.7-sonnet">claude-3.7-sonnet (1x)</option>
            <option value="claude-3.7-sonnet-thought">claude-3.7-sonnet-thought (1.25x)</option>
            <option value="claude-opus-4">claude-opus-4 (10x)</option>
            <option value="claude-opus-4.5">claude-opus-4.5 (3x)</option>
            <option value="gemini-2.5-pro">gemini-2.5-pro (1x)</option>
            <option value="o3-mini">o3-mini (0.33x)</option>
            <option value="gpt-4.1">gpt-4.1 (0x)</option>
          </select>
        </div>
        <div class="form-field">
          <label>Messages</label>
          <input id="simMessages" type="number" value="7" style="width:70px;" />
        </div>
        <div class="form-field">
          <label>Workspace</label>
          <input id="simWs" type="text" value="my-project" style="width:110px;" />
        </div>
        <button class="primary" onclick="logSession()">Add Session</button>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function sendMsg(msg) {
      vscode.postMessage(msg);
    }
    function saveBudget() {
      vscode.postMessage({
        type: 'updateBudget',
        monthlyCredits: document.getElementById('monthlyCredits').value,
        extraCredits: document.getElementById('extraCredits').value,
        workHoursPerDay: document.getElementById('workHoursPerDay').value,
        dailyPercentMode: document.getElementById('dailyPercentMode').value
      });
    }
    function logSession() {
      vscode.postMessage({
        type: 'logSession',
        title: document.getElementById('simTitle').value,
        model: document.getElementById('simModel').value,
        messages: document.getElementById('simMessages').value,
        workspaceName: document.getElementById('simWs').value
      });
    }
  </script>
</body>
</html>`;
}

