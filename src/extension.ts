import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  AnalyticsSnapshot,
  ApiQuotaInfo,
  HistoryComparison,
  MonthlyArchiveEntry,
  TrackerConfig,
  computeHistoryComparison,
  fetchCopilotInternalQuota,
  formatDateYMD,
  formatMonthKey,
  getCandidateVSCodeUserDirs,
  mineAllChatSessionsByMonthAsync
} from './tracker';

const LAST_API_QUOTA_KEY = 'copilotAnalytics.lastApiQuota.v2';
const DAILY_QUOTA_LEDGER_KEY = 'copilotAnalytics.dailyQuotaLedger.v1';
const MONTHLY_ARCHIVES_KEY = 'copilotAnalytics.monthlyArchives.v1';
const ALERTED_SESSION_IDS_KEY = 'copilotAnalytics.alertedSessions.v1';
const HISTORY_MONTHS_COUNT = 6;
const API_POLL_INTERVAL_MS = 120_000;
const LOCAL_CHAT_POLL_INTERVAL_MS = 30_000;

let statusBarItem: vscode.StatusBarItem;
let dashboardPanel: vscode.WebviewPanel | undefined;
let currentMonthSnapshot: AnalyticsSnapshot | undefined;
let latestHistoryComparison: HistoryComparison | undefined;
let lastScannedDirs: string[] = [];
let selectedYear: number | undefined;
let selectedMonth: number | undefined;
let refreshTimer: NodeJS.Timeout | undefined;
let activeRefreshPromise: Promise<void> | undefined;
let lastApiFetchMs = 0;
let isUpdatingStatusColors = false;

function getCurrentWindowWorkspaceOverrides(context: vscode.ExtensionContext): Record<string, string> {
  const overrides: Record<string, string> = {};
  if (!context.storageUri) {
    return overrides;
  }
  const hashName = path.basename(path.dirname(context.storageUri.fsPath));
  if (!hashName) {
    return overrides;
  }
  const folders = vscode.workspace.workspaceFolders;
  let cleanName = '';
  if (folders && folders.length > 0) {
    const names = folders.map(f => f.name).filter(Boolean);
    if (names.length === 1) {
      cleanName = names[0];
    } else if (names.length === 2) {
      cleanName = `${names[0]} + ${names[1]}`;
    } else if (names.length > 2) {
      cleanName = `${names[0]} + ${names[1]} (+${names.length - 2})`;
    }
  }
  if (!cleanName && vscode.workspace.name) {
    const candidate = vscode.workspace.name.replace(/\s*\(Workspace\)$/i, '').trim();
    if (candidate && candidate.toLowerCase() !== 'untitled' && candidate.toLowerCase() !== 'workspace.json') {
      cleanName = candidate;
    }
  }
  if (cleanName) {
    overrides[hashName] = cleanName;
  }
  return overrides;
}

export function activate(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(
    'copilotAnalytics.statusBar',
    vscode.StatusBarAlignment.Right,
    -1000
  );
  statusBarItem.command = 'copilotAnalytics.showDashboard';
  statusBarItem.name = 'Copilot Credit & Daily Limit Monitor';
  statusBarItem.text = '$(sync~spin) Copilot: Mining Chats...';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  const runRefresh = async (interactiveAuth = false, forceApi = false) => {
    const config = readTrackerConfig();
    const now = new Date();
    if (selectedYear === undefined || selectedMonth === undefined) {
      selectedYear = now.getFullYear();
      selectedMonth = now.getMonth();
    }

      const currentMonthKey = formatMonthKey(now.getFullYear(), now.getMonth());
      const todayStr = formatDateYMD(now);

      // 1. Fetch GitHub Copilot API quota (aggregate monthly entitlement & used total)
      let apiQuota = context.globalState.get<ApiQuotaInfo>(LAST_API_QUOTA_KEY);
      const shouldFetchApi = interactiveAuth || forceApi || Date.now() - lastApiFetchMs >= API_POLL_INTERVAL_MS;
      if (shouldFetchApi) {
        try {
          const session = await vscode.authentication.getSession('github', ['read:user'], {
            createIfNone: interactiveAuth
          });
          if (session?.accessToken) {
            const freshQuota = await fetchCopilotInternalQuota(session.accessToken);
            lastApiFetchMs = Date.now();
            if (freshQuota) {
              apiQuota = freshQuota;
              await context.globalState.update(LAST_API_QUOTA_KEY, freshQuota);
            }
            // 1. Fetch GitHub Copilot API quota (aggregate monthly entitlement & used total)
            let apiQuota = context.globalState.get<ApiQuotaInfo>(LAST_API_QUOTA_KEY);
            const shouldFetchApi = interactiveAuth || forceApi || Date.now() - lastApiFetchMs >= API_POLL_INTERVAL_MS;
            if (shouldFetchApi) {
              try {
                const session = await vscode.authentication.getSession('github', ['read:user'], {
                  createIfNone: interactiveAuth
                });
                if (session?.accessToken) {
                  const freshQuota = await fetchCopilotInternalQuota(session.accessToken);
                  lastApiFetchMs = Date.now();
                  if (freshQuota) {
                    apiQuota = freshQuota;
                    await context.globalState.update(LAST_API_QUOTA_KEY, freshQuota);
                  }
                } catch {
                  // Fallback to cached quota or local session calculation
                }
              } catch {
                // Fallback to cached quota or local session calculation
              }
              // 1. Fetch GitHub Copilot API quota (aggregate monthly entitlement & used total)
              let apiQuota = context.globalState.get<ApiQuotaInfo>(LAST_API_QUOTA_KEY);
              const shouldFetchApi = interactiveAuth || forceApi || Date.now() - lastApiFetchMs >= API_POLL_INTERVAL_MS;
              if (shouldFetchApi) {
                try {
                  const session = await vscode.authentication.getSession('github', ['read:user'], {
                    createIfNone: interactiveAuth
                  });
                  if (session?.accessToken) {
                    const freshQuota = await fetchCopilotInternalQuota(session.accessToken);
                    lastApiFetchMs = Date.now();
                    if (freshQuota) {
                      apiQuota = freshQuota;
                      await context.globalState.update(LAST_API_QUOTA_KEY, freshQuota);
                    }
                  }
                } catch {
                  // Fallback to cached quota or local session calculation
                }
              }
            }

            // Persist daily API quota ledger & monthly archive so non-chat deltas and past months are retained
            const dailyLedger = { ...context.globalState.get<Record<string, number>>(DAILY_QUOTA_LEDGER_KEY, {}) };
            const monthlyArchives = { ...context.globalState.get<Record<string, MonthlyArchiveEntry>>(MONTHLY_ARCHIVES_KEY, {}) };
            // Persist daily API quota ledger & monthly archive so non-chat deltas and past months are retained
            const dailyLedger = { ...context.globalState.get<Record<string, number>>(DAILY_QUOTA_LEDGER_KEY, {}) };
            const monthlyArchives = { ...context.globalState.get<Record<string, MonthlyArchiveEntry>>(MONTHLY_ARCHIVES_KEY, {}) };
            // Persist daily API quota ledger & monthly archive so non-chat deltas and past months are retained
            const dailyLedger = { ...context.globalState.get<Record<string, number>>(DAILY_QUOTA_LEDGER_KEY, {}) };
            const monthlyArchives = { ...context.globalState.get<Record<string, MonthlyArchiveEntry>>(MONTHLY_ARCHIVES_KEY, {}) };

            if (apiQuota) {
              dailyLedger[todayStr] = apiQuota.used;
              monthlyArchives[currentMonthKey] = {
                entitlement: apiQuota.entitlement,
                used: apiQuota.used,
                updatedAt: now.toISOString()
              };
              await context.globalState.update(DAILY_QUOTA_LEDGER_KEY, dailyLedger);
              await context.globalState.update(MONTHLY_ARCHIVES_KEY, monthlyArchives);
            }
            if (apiQuota) {
              dailyLedger[todayStr] = apiQuota.used;
              monthlyArchives[currentMonthKey] = {
                entitlement: apiQuota.entitlement,
                used: apiQuota.used,
                updatedAt: now.toISOString()
              };
              await context.globalState.update(DAILY_QUOTA_LEDGER_KEY, dailyLedger);
              await context.globalState.update(MONTHLY_ARCHIVES_KEY, monthlyArchives);
            }
            if (apiQuota) {
              dailyLedger[todayStr] = apiQuota.used;
              monthlyArchives[currentMonthKey] = {
                entitlement: apiQuota.entitlement,
                used: apiQuota.used,
                updatedAt: now.toISOString()
              };
              await context.globalState.update(DAILY_QUOTA_LEDGER_KEY, dailyLedger);
              await context.globalState.update(MONTHLY_ARCHIVES_KEY, monthlyArchives);
            }

            // 2. Mine local VS Code Copilot Chat sessions asynchronously (.jsonl mutation logs + .json + WSL /mnt/c bridge)
            const primaryUserDir = path.dirname(path.dirname(context.globalStorageUri.fsPath));
            const userDirs = getCandidateVSCodeUserDirs(primaryUserDir, config.chatStoragePaths);
            lastScannedDirs = userDirs;
            // 2. Mine local VS Code Copilot Chat sessions asynchronously (.jsonl mutation logs + .json + WSL /mnt/c bridge)
            const primaryUserDir = path.dirname(path.dirname(context.globalStorageUri.fsPath));
            const userDirs = getCandidateVSCodeUserDirs(primaryUserDir, config.chatStoragePaths);
            lastScannedDirs = userDirs;
            // 2. Mine local VS Code Copilot Chat sessions asynchronously (.jsonl mutation logs + .json + WSL /mnt/c bridge)
            const primaryUserDir = path.dirname(path.dirname(context.globalStorageUri.fsPath));
            const userDirs = getCandidateVSCodeUserDirs(primaryUserDir, config.chatStoragePaths);
            lastScannedDirs = userDirs;

            const earliestYear = Math.min(now.getFullYear(), selectedYear);
            const earliestMonth = Math.min(now.getMonth() - HISTORY_MONTHS_COUNT, selectedMonth - 1);
            const earliestDateMs = new Date(earliestYear, earliestMonth, 1, 0, 0, 0).getTime();
            const earliestDateMs = Math.min(
              new Date(now.getFullYear(), now.getMonth() - HISTORY_MONTHS_COUNT, 1, 0, 0, 0).getTime(),
              new Date(selectedYear, selectedMonth - 1, 1, 0, 0, 0).getTime()
            );
            const earliestDateMs = Math.min(
              new Date(now.getFullYear(), now.getMonth() - HISTORY_MONTHS_COUNT, 1, 0, 0, 0).getTime(),
              new Date(selectedYear, selectedMonth - 1, 1, 0, 0, 0).getTime()
            );

            const sessionsByMonth = await mineAllChatSessionsByMonthAsync(userDirs, earliestDateMs, config.modelMultipliers);
            const workspaceOverrides = getCurrentWindowWorkspaceOverrides(context);
            const sessionsByMonth = await mineAllChatSessionsByMonthAsync(
              userDirs,
              earliestDateMs,
              config.modelMultipliers,
              workspaceOverrides
            );
            const workspaceOverrides = getCurrentWindowWorkspaceOverrides(context);
            const sessionsByMonth = await mineAllChatSessionsByMonthAsync(
              userDirs,
              earliestDateMs,
              config.modelMultipliers,
              workspaceOverrides
            );

            // 3. Compute analytics & history comparison
            latestHistoryComparison = computeHistoryComparison(
              config,
              now,
              selectedYear,
              selectedMonth,
              sessionsByMonth,
              apiQuota,
              HISTORY_MONTHS_COUNT,
              monthlyArchives,
              dailyLedger
            );
            // 3. Compute analytics & history comparison
            latestHistoryComparison = computeHistoryComparison(
              config,
              now,
              selectedYear,
              selectedMonth,
              sessionsByMonth,
              apiQuota,
              HISTORY_MONTHS_COUNT,
              monthlyArchives,
              dailyLedger
            );
            // 3. Compute analytics & history comparison
            latestHistoryComparison = computeHistoryComparison(
              config,
              now,
              selectedYear,
              selectedMonth,
              sessionsByMonth,
              apiQuota,
              HISTORY_MONTHS_COUNT,
              monthlyArchives,
              dailyLedger
            );

            currentMonthSnapshot =
              latestHistoryComparison.selectedMonthKey === currentMonthKey
                ? latestHistoryComparison.selectedSnapshot
                : computeHistoryComparison(
                  currentMonthSnapshot =
                  latestHistoryComparison.selectedMonthKey === currentMonthKey
                    ? latestHistoryComparison.selectedSnapshot
                    : computeHistoryComparison(
                      config,
                      now,
                      now.getFullYear(),
                      now.getMonth(),
                      sessionsByMonth,
                      apiQuota,
                      2,
                      monthlyArchives,
                      dailyLedger
                    ).selectedSnapshot;
            currentMonthSnapshot =
              latestHistoryComparison.selectedMonthKey === currentMonthKey
                ? latestHistoryComparison.selectedSnapshot
                : computeHistoryComparison(
                  config,
                  now,
                  now.getFullYear(),
                  now.getMonth(),
                  sessionsByMonth,
                  apiQuota,
                  2,
                  monthlyArchives,
                  dailyLedger
                ).selectedSnapshot;

            await updateStatusBar(currentMonthSnapshot, config);
            checkActiveSessionWarnings(context, currentMonthSnapshot, config);
            await updateStatusBar(currentMonthSnapshot, config);
            checkActiveSessionWarnings(context, currentMonthSnapshot, config);
            await updateStatusBar(currentMonthSnapshot, config);
            checkActiveSessionWarnings(context, currentMonthSnapshot, config);

            if (dashboardPanel && latestHistoryComparison) {
              dashboardPanel.webview.html = renderDashboardHtml(latestHistoryComparison, config);
            }
          };
          if (dashboardPanel && latestHistoryComparison) {
            dashboardPanel.webview.html = renderDashboardHtml(latestHistoryComparison, config);
          }
        };

        const refreshAll = async (interactiveAuth = false) => {
          if (activeRefreshPromise && !interactiveAuth) {
            return activeRefreshPromise;
          }
          const p = runRefresh(interactiveAuth, interactiveAuth).finally(() => {
            if (activeRefreshPromise === p) {
              activeRefreshPromise = undefined;
            }
          });
          activeRefreshPromise = p;
          return p;
        };
        const refreshAll = async (interactiveAuth = false) => {
          if (activeRefreshPromise && !interactiveAuth) {
            return activeRefreshPromise;
          }
          const p = runRefresh(interactiveAuth, interactiveAuth).finally(() => {
            if (activeRefreshPromise === p) {
              activeRefreshPromise = undefined;
            }
          });
          activeRefreshPromise = p;
          return p;
        };

        // Register Commands
        context.subscriptions.push(
          vscode.commands.registerCommand('copilotAnalytics.showDashboard', async () => {
            if (!latestHistoryComparison) {
              await refreshAll(false);
            }
            openDashboardPanel(refreshAll);
          }),
          // Register Commands
          context.subscriptions.push(
            vscode.commands.registerCommand('copilotAnalytics.showDashboard', async () => {
              if (!latestHistoryComparison) {
                await refreshAll(false);
              }
              openDashboardPanel(refreshAll);
            }),

            vscode.commands.registerCommand('copilotAnalytics.refresh', async () => {
              await refreshAll(true);
              vscode.window.showInformationMessage('Copilot Credit Analytics refreshed.');
            }),
            vscode.commands.registerCommand('copilotAnalytics.refresh', async () => {
              await refreshAll(true);
              vscode.window.showInformationMessage('Copilot Credit Analytics refreshed.');
            }),
            vscode.commands.registerCommand('copilotAnalytics.refresh', async () => {
              await refreshAll(true);
              vscode.window.showInformationMessage('Copilot Credit Analytics refreshed.');
            }),

            vscode.commands.registerCommand('copilotAnalytics.setCredits', async () => {
              const cfg = vscode.workspace.getConfiguration('copilotAnalytics');
              const currentMonthly = cfg.get<number>('monthlyCredits', 300);
              const currentExtra = cfg.get<number>('extraCredits', 0);
              vscode.commands.registerCommand('copilotAnalytics.setCredits', async () => {
                const cfg = vscode.workspace.getConfiguration('copilotAnalytics');
                const currentMonthly = cfg.get<number>('monthlyCredits', 300);
                const currentExtra = cfg.get<number>('extraCredits', 0);
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
                  const baseInput = await vscode.window.showInputBox({
                    title: 'Set Monthly Base Copilot Credits',
                    prompt: 'Enter your monthly Copilot credit limit (e.g. 300 for Pro, 1500 for Pro+, 50 for Free)',
                    value: String(currentMonthly),
                    validateInput: v => (isNaN(Number(v)) || Number(v) <= 0 ? 'Enter a positive number' : null)
                  });
                  if (baseInput === undefined) {
                    return;
                  }
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
                  const extraInput = await vscode.window.showInputBox({
                    title: 'Set Extra / Topped-Up Credits for This Month',
                    prompt: 'Enter any additional purchased or bonus credits for this month (0 if none)',
                    value: String(currentExtra),
                    validateInput: v => (isNaN(Number(v)) || Number(v) < 0 ? 'Enter 0 or a positive number' : null)
                  });
                  if (extraInput === undefined) {
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
                  await cfg.update('monthlyCredits', Number(baseInput), vscode.ConfigurationTarget.Global);
                await cfg.update('overrideApiEntitlement', true, vscode.ConfigurationTarget.Global);
                await cfg.update('extraCredits', Number(extraInput), vscode.ConfigurationTarget.Global);
                await refreshAll(false);
                vscode.window.showInformationMessage(
                  `Updated Copilot budget: ${baseInput} base + ${extraInput} extra credits/month.`
                );
              }),

                vscode.commands.registerCommand('copilotAnalytics.exportData', async () => {
                  if (!latestHistoryComparison) {
                    await refreshAll(false);
                  }
                  if (latestHistoryComparison) {
                    await exportAnalyticsReport(latestHistoryComparison);
                  }
                })
    );
        vscode.commands.registerCommand('copilotAnalytics.exportData', async () => {
          if (!latestHistoryComparison) {
            await cfg.update('monthlyCredits', Number(baseInput), vscode.ConfigurationTarget.Global);
            await cfg.update('overrideApiEntitlement', true, vscode.ConfigurationTarget.Global);
            await cfg.update('extraCredits', Number(extraInput), vscode.ConfigurationTarget.Global);
            await refreshAll(false);
          }
          if (latestHistoryComparison) {
            await exportAnalyticsReport(latestHistoryComparison);
          }
        })
  );
  vscode.window.showInformationMessage(
    `Updated Copilot budget: ${baseInput} base + ${extraInput} extra credits/month.`
  );
}),

context.subscriptions.push(
  vscode.workspace.onDidChangeConfiguration(e => {
    if (!isUpdatingStatusColors && e.affectsConfiguration('copilotAnalytics')) {
      void refreshAll(false);
      vscode.commands.registerCommand('copilotAnalytics.exportData', async () => {
        if (!latestHistoryComparison) {
          await refreshAll(false);
        }
        if (latestHistoryComparison) {
          await exportAnalyticsReport(latestHistoryComparison);
        }
      })
  );

context.subscriptions.push(
  vscode.workspace.onDidChangeConfiguration(e => {
    if (!isUpdatingStatusColors && e.affectsConfiguration('copilotAnalytics')) {
      void refreshAll(false);
    }
  })
);

// Defer initial scan by 50ms so activation completes immediately on window reload
const initialStartupTimer = setTimeout(() => {
  void refreshAll(false);
}, 50);
// Defer initial scan by 50ms so activation completes immediately on window reload
const initialStartupTimer = setTimeout(() => {
  void refreshAll(false);
}, 50);

refreshTimer = setInterval(() => {
  void refreshAll(false);
}, LOCAL_CHAT_POLL_INTERVAL_MS);
refreshTimer = setInterval(() => {
  void refreshAll(false);
}, LOCAL_CHAT_POLL_INTERVAL_MS);

context.subscriptions.push({
  dispose: () => {
    clearTimeout(initialStartupTimer);
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }
  }
});
}
context.subscriptions.push({
  dispose: () => {
    clearTimeout(initialStartupTimer);
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
    colorStatusBarBackground: cfg.get<boolean>('colorStatusBarBackground', true),
    expensiveSessionMinPercent: cfg.get<number>('expensiveSessionMinPercent', 40),
    expensiveSessionMaxPercent: cfg.get<number>('expensiveSessionMaxPercent', 60),
    chatStoragePaths: cfg.get<string[]>('chatStoragePaths', []),
    modelMultipliers: cfg.get<Record<string, number>>('modelMultipliers', {})
  };
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
    colorStatusBarBackground: cfg.get<boolean>('colorStatusBarBackground', true),
    expensiveSessionMinPercent: cfg.get<number>('expensiveSessionMinPercent', 40),
    expensiveSessionMaxPercent: cfg.get<number>('expensiveSessionMaxPercent', 60),
    chatStoragePaths: cfg.get<string[]>('chatStoragePaths', []),
    modelMultipliers: cfg.get<Record<string, number>>('modelMultipliers', {})
  };
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
function makeAsciiBar(percent: number, width = 14): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));
}

/**
 * Applies solid status-colored background fill (Green / Yellow / Orange / Red) with high-contrast
 * white or dark text to the bottom-right Status Bar widget.
 */
async function syncStatusBarWidgetColors(snap: AnalyticsSnapshot, config: TrackerConfig) {
  if (!config.colorStatusBarBackground) {
    statusBarItem.color = snap.colorHex;
    statusBarItem.backgroundColor =
      snap.colorTier === 'red'
        ? new vscode.ThemeColor('statusBarItem.errorBackground')
        : snap.colorTier === 'orange'
          ? new vscode.ThemeColor('statusBarItem.warningBackground')
          : undefined;
    return;
  }
  /**
   * Applies solid status-colored background fill (Green / Yellow / Orange / Red) with high-contrast
   * white or dark text to the bottom-right Status Bar widget.
   */
  async function syncStatusBarWidgetColors(snap: AnalyticsSnapshot, config: TrackerConfig) {
    if (!config.colorStatusBarBackground) {
      statusBarItem.color = snap.colorHex;
      statusBarItem.backgroundColor =
        snap.colorTier === 'red'
          ? new vscode.ThemeColor('statusBarItem.errorBackground')
          : snap.colorTier === 'orange'
            ? new vscode.ThemeColor('statusBarItem.warningBackground')
            : undefined;
      return;
    }

    // Use errorBackground token for Red, and warningBackground token for Green / Yellow / Orange
    const isRed = snap.colorTier === 'red';
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      isRed ? 'statusBarItem.errorBackground' : 'statusBarItem.warningBackground'
    );
    statusBarItem.color = snap.widgetFgHex;
    const isRed = snap.colorTier === 'red';
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      isRed ? 'statusBarItem.errorBackground' : 'statusBarItem.warningBackground'
    );
    statusBarItem.color = snap.widgetFgHex;
    const isRed = snap.colorTier === 'red';
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      isRed ? 'statusBarItem.errorBackground' : 'statusBarItem.warningBackground'
    );
    statusBarItem.color = snap.widgetFgHex;

    const wbConfig = vscode.workspace.getConfiguration('workbench');
    const existing = wbConfig.inspect<Record<string, any>>('colorCustomizations')?.globalValue || {};
    const wbConfig = vscode.workspace.getConfiguration('workbench');
    const existing = wbConfig.inspect<Record<string, any>>('colorCustomizations')?.globalValue || {};
    const wbConfig = vscode.workspace.getConfiguration('workbench');
    const existing = wbConfig.inspect<Record<string, any>>('colorCustomizations')?.globalValue || {};

    const bgKey = isRed ? 'statusBarItem.errorBackground' : 'statusBarItem.warningBackground';
    const fgKey = isRed ? 'statusBarItem.errorForeground' : 'statusBarItem.warningForeground';
    const hoverBgKey = isRed ? 'statusBarItem.errorHoverBackground' : 'statusBarItem.warningHoverBackground';
    const hoverFgKey = isRed ? 'statusBarItem.errorHoverForeground' : 'statusBarItem.warningHoverForeground';
    const bgKey = isRed ? 'statusBarItem.errorBackground' : 'statusBarItem.warningBackground';
    const fgKey = isRed ? 'statusBarItem.errorForeground' : 'statusBarItem.warningForeground';
    const hoverBgKey = isRed ? 'statusBarItem.errorHoverBackground' : 'statusBarItem.warningHoverBackground';
    const hoverFgKey = isRed ? 'statusBarItem.errorHoverForeground' : 'statusBarItem.warningHoverForeground';
    const bgKey = isRed ? 'statusBarItem.errorBackground' : 'statusBarItem.warningBackground';
    const fgKey = isRed ? 'statusBarItem.errorForeground' : 'statusBarItem.warningForeground';
    const hoverBgKey = isRed ? 'statusBarItem.errorHoverBackground' : 'statusBarItem.warningHoverBackground';
    const hoverFgKey = isRed ? 'statusBarItem.errorHoverForeground' : 'statusBarItem.warningHoverForeground';

    if (
      existing[bgKey] === snap.widgetBgHex &&
      existing[fgKey] === snap.widgetFgHex &&
      existing[hoverBgKey] === snap.widgetHoverBgHex &&
      existing[hoverFgKey] === snap.widgetFgHex
    ) {
      return;
    }
    if (
      existing[bgKey] === snap.widgetBgHex &&
      existing[fgKey] === snap.widgetFgHex &&
      existing[hoverBgKey] === snap.widgetHoverBgHex &&
      existing[hoverFgKey] === snap.widgetFgHex
    ) {
      return;
    }
    if (
      existing[bgKey] === snap.widgetBgHex &&
      existing[fgKey] === snap.widgetFgHex &&
      existing[hoverBgKey] === snap.widgetHoverBgHex &&
      existing[hoverFgKey] === snap.widgetFgHex
    ) {
      return;
    }

    const updated = {
      ...existing,
      [bgKey]: snap.widgetBgHex,
      [fgKey]: snap.widgetFgHex,
      [hoverBgKey]: snap.widgetHoverBgHex,
      [hoverFgKey]: snap.widgetFgHex
    };
    const updated = {
      ...existing,
      [bgKey]: snap.widgetBgHex,
      [fgKey]: snap.widgetFgHex,
      [hoverBgKey]: snap.widgetHoverBgHex,
      [hoverFgKey]: snap.widgetFgHex
    };
    const updated = {
      ...existing,
      [bgKey]: snap.widgetBgHex,
      [fgKey]: snap.widgetFgHex,
      [hoverBgKey]: snap.widgetHoverBgHex,
      [hoverFgKey]: snap.widgetFgHex
    };

    try {
      isUpdatingStatusColors = true;
      await wbConfig.update('colorCustomizations', updated, vscode.ConfigurationTarget.Global);
    } catch {
      // Ignore if user settings are read-only
    } finally {
      isUpdatingStatusColors = false;
    }
  }
  try {
    isUpdatingStatusColors = true;
    await wbConfig.update('colorCustomizations', updated, vscode.ConfigurationTarget.Global);
  } catch {
    // Ignore if user settings are read-only
  } finally {
    isUpdatingStatusColors = false;
  }
}

async function updateStatusBar(snap: AnalyticsSnapshot, config: TrackerConfig) {
  const pctText = `${snap.activeDailyPercent.toFixed(0)}%`;
  const targetLimit =
    config.dailyPercentMode === 'standard'
      ? snap.recommendedDailyLimit
      : snap.effectiveDailyLimit;
  async function updateStatusBar(snap: AnalyticsSnapshot, config: TrackerConfig) {
    const pctText = `${snap.activeDailyPercent.toFixed(0)}%`;
    const targetLimit =
      config.dailyPercentMode === 'standard'
        ? snap.recommendedDailyLimit
        : snap.effectiveDailyLimit;

    const balanceBadge =
      snap.creditDebt > 0
        ? `-${snap.creditDebt.toFixed(1)} Debt`
        : `+${snap.rolloverExtraCredits.toFixed(1)} Extra`;
    const balanceBadge =
      snap.creditDebt > 0
        ? `-${snap.creditDebt.toFixed(1)} Debt`
        : `+${snap.rolloverExtraCredits.toFixed(1)} Extra`;
    const balanceBadge =
      snap.creditDebt > 0
        ? `-${snap.creditDebt.toFixed(1)} Debt`
        : `+${snap.rolloverExtraCredits.toFixed(1)} Extra`;

    const expChatTag =
      snap.todayTotalExpensiveChats > 0 ? ` | ${snap.todayTotalExpensiveChats} Heavy` : '';
    const expChatTag =
      snap.todayTotalExpensiveChats > 0 ? ` | ${snap.todayTotalExpensiveChats} Heavy` : '';
    const expChatTag =
      snap.todayTotalExpensiveChats > 0 ? ` | ${snap.todayTotalExpensiveChats} Heavy` : '';

    statusBarItem.text = `$(copilot) ${pctText} Daily (${snap.todayUsedCredits.toFixed(1)}/${targetLimit.toFixed(1)} cr) | ${balanceBadge}${expChatTag}`;
    statusBarItem.text = `$(copilot) ${pctText} Daily (${snap.todayUsedCredits.toFixed(1)}/${targetLimit.toFixed(1)} cr) | ${balanceBadge}${expChatTag}`;
    statusBarItem.text = `$(copilot) ${pctText} Daily (${snap.todayUsedCredits.toFixed(1)}/${targetLimit.toFixed(1)} cr) | ${balanceBadge}${expChatTag}`;

    await syncStatusBarWidgetColors(snap, config);
    await syncStatusBarWidgetColors(snap, config);
    await syncStatusBarWidgetColors(snap, config);

    const md = new vscode.MarkdownString('', true);
    md.isTrusted = true;
    md.supportHtml = true;
    const md = new vscode.MarkdownString('', true);
    md.isTrusted = true;
    md.supportHtml = true;
    const md = new vscode.MarkdownString('', true);
    md.isTrusted = true;
    md.supportHtml = true;

    const dailyBar = makeAsciiBar(snap.activeDailyPercent, 16);
    const monthlyBar = makeAsciiBar(snap.monthlyUsedPercent, 16);
    const dailyBar = makeAsciiBar(snap.activeDailyPercent, 16);
    const monthlyBar = makeAsciiBar(snap.monthlyUsedPercent, 16);
    const dailyBar = makeAsciiBar(snap.activeDailyPercent, 16);
    const monthlyBar = makeAsciiBar(snap.monthlyUsedPercent, 16);

    md.appendMarkdown(
      `<span style="background-color:${snap.widgetBgHex};color:${snap.widgetFgHex};padding:3px 8px;border-radius:4px;font-weight:bold;">` +
      md.appendMarkdown(
        `<span style="background-color:${snap.widgetBgHex};color:${snap.widgetFgHex};padding:3px 8px;border-radius:4px;font-weight:bold;">` +
        `&nbsp;COPILOT DAILY BUDGET: ${snap.activeDailyPercent.toFixed(1)}% (${snap.colorTier.toUpperCase()})&nbsp;` +
        `</span>\n\n`
      );
    md.appendMarkdown(`**Daily Progress:** \`${dailyBar}\` **${snap.todayUsedCredits.toFixed(2)} / ${targetLimit.toFixed(2)} cr**\n\n`);
    md.appendMarkdown(`| Metric | Value | Details |\n| :--- | :--- | :--- |\n`);
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
      `| **Credit Debt** | **${snap.creditDebt > 0 ? `-${snap.creditDebt.toFixed(2)} cr` : '0.00 cr'}** | ${snap.creditDebt > 0 ? 'Overspent on prior workdays' : 'No debt — on or under budget'} |\n`
    );
    md.appendMarkdown(
      `| **Expensive Chats Today** | **${snap.todayTotalExpensiveChats}** | \`40-60%\`: **${snap.todayExpensive40to60}** · \`>60%\`: **${snap.todayExpensiveOver60}** (Month: **${snap.monthTotalExpensiveChats}**) |\n`
    );
    md.appendMarkdown(
      `| **Monthly Progress** | \`${monthlyBar}\` | **${snap.totalUsedCredits.toFixed(1)} / ${snap.totalMonthlyCredits} cr** (${snap.monthlyUsedPercent.toFixed(1)}%) |\n\n`
    );
    md.appendMarkdown(
      `<span style="background-color:${snap.widgetBgHex};color:${snap.widgetFgHex};padding:3px 8px;border-radius:4px;font-weight:bold;">` +
      `&nbsp;COPILOT DAILY BUDGET: ${snap.activeDailyPercent.toFixed(1)}% (${snap.colorTier.toUpperCase()})&nbsp;` +
      `</span>\n\n`
    );
    md.appendMarkdown(`**Daily Progress:** \`${dailyBar}\` **${snap.todayUsedCredits.toFixed(2)} / ${targetLimit.toFixed(2)} cr**\n\n`);
    md.appendMarkdown(`| Metric | Value | Details |\n| :--- | :--- | :--- |\n`);
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
      `| **Credit Debt** | **${snap.creditDebt > 0 ? `-${snap.creditDebt.toFixed(2)} cr` : '0.00 cr'}** | ${snap.creditDebt > 0 ? 'Overspent on prior workdays' : 'No debt — on or under budget'} |\n`
    );
    md.appendMarkdown(
      `| **Expensive Chats Today** | **${snap.todayTotalExpensiveChats}** | \`40-60%\`: **${snap.todayExpensive40to60}** · \`>60%\`: **${snap.todayExpensiveOver60}** (Month: **${snap.monthTotalExpensiveChats}**) |\n`
    );
    md.appendMarkdown(
      `| **Monthly Progress** | \`${monthlyBar}\` | **${snap.totalUsedCredits.toFixed(1)} / ${snap.totalMonthlyCredits} cr** (${snap.monthlyUsedPercent.toFixed(1)}%) |\n\n`
    );
  );
    md.appendMarkdown(`**Daily Progress:** \`${dailyBar}\` **${snap.todayUsedCredits.toFixed(2)} / ${targetLimit.toFixed(2)} cr**\n\n`);
    md.appendMarkdown(`| Metric | Value | Details |\n| :--- | :--- | :--- |\n`);
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
      `| **Credit Debt** | **${snap.creditDebt > 0 ? `-${snap.creditDebt.toFixed(2)} cr` : '0.00 cr'}** | ${snap.creditDebt > 0 ? 'Overspent on prior workdays' : 'No debt — on or under budget'} |\n`
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
    md.appendMarkdown(
      `**Averages:** Weekly: **${snap.weeklyAverageCredits.toFixed(1)} cr** · Workday: **${snap.workdayAverageCredits.toFixed(1)} cr** · Work Hour: **${snap.workHourAverageCredits.toFixed(2)} cr/hr**\n\n`
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
    const chatModels = snap.models.filter(m => !m.model.startsWith('External'));
    if (chatModels.length > 0) {
      const topModels = chatModels
        .slice(0, 3)
        .map(m => `\`${m.model}\` (${m.messages} msgs, ${m.credits.toFixed(1)} cr)`)
        .join(' · ');
      md.appendMarkdown(`**Top Models:** ${topModels}\n\n`);
    }
    const chatModels = snap.models.filter(m => !m.model.startsWith('External'));
    if (chatModels.length > 0) {
      const topModels = chatModels
        .slice(0, 3)
        .map(m => `\`${m.model}\` (${m.messages} msgs, ${m.credits.toFixed(1)} cr)`)
        .join(' · ');
      md.appendMarkdown(`**Top Models:** ${topModels}\n\n`);
    }

    md.appendMarkdown(
      `[$(graph) Open Dashboard](command:copilotAnalytics.showDashboard) &nbsp;|&nbsp; ` +
      md.appendMarkdown(
        `[$(graph) Open Dashboard](command:copilotAnalytics.showDashboard) &nbsp;|&nbsp; ` +
        `[$(sliders) Set Credits](command:copilotAnalytics.setCredits) &nbsp;|&nbsp; ` +
        `[$(sync) Refresh](command:copilotAnalytics.refresh)`
      );
    md.appendMarkdown(
      `[$(graph) Open Dashboard](command:copilotAnalytics.showDashboard) &nbsp;|&nbsp; ` +
      `[$(sliders) Set Credits](command:copilotAnalytics.setCredits) &nbsp;|&nbsp; ` +
      `[$(sync) Refresh](command:copilotAnalytics.refresh)`
    );
  );

    statusBarItem.tooltip = md;
  }
  statusBarItem.tooltip = md;
}

function openDashboardPanel(refreshAll: (interactiveAuth?: boolean) => Promise<void>) {
  if (dashboardPanel) {
    dashboardPanel.reveal(vscode.ViewColumn.One);
    if (latestHistoryComparison) {
      dashboardPanel.webview.html = renderDashboardHtml(latestHistoryComparison, readTrackerConfig());
    }
    return;
  }
  function openDashboardPanel(refreshAll: (interactiveAuth?: boolean) => Promise<void>) {
    if (dashboardPanel) {
      dashboardPanel.reveal(vscode.ViewColumn.One);
      if (latestHistoryComparison) {
        dashboardPanel.webview.html = renderDashboardHtml(latestHistoryComparison, readTrackerConfig());
      }
      return;

      dashboardPanel = vscode.window.createWebviewPanel(
        'copilotCreditAnalyticsDashboard',
        'Copilot Credit & Session Analytics',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      dashboardPanel = vscode.window.createWebviewPanel(
        'copilotCreditAnalyticsDashboard',
        'Copilot Credit & Session Analytics',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );
      dashboardPanel = vscode.window.createWebviewPanel(
        'copilotCreditAnalyticsDashboard',
        'Copilot Credit & Session Analytics',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );
      if (latestHistoryComparison) {
        dashboardPanel.webview.html = renderDashboardHtml(latestHistoryComparison, readTrackerConfig());
      }

      if (latestHistoryComparison) {
        dashboardPanel.webview.html = renderDashboardHtml(latestHistoryComparison, readTrackerConfig());
      }
      if (latestHistoryComparison) {
        dashboardPanel.webview.html = renderDashboardHtml(latestHistoryComparison, readTrackerConfig());
      }

      dashboardPanel.webview.onDidReceiveMessage(async msg => {
        const cfg = vscode.workspace.getConfiguration('copilotAnalytics');
        if (msg.type === 'selectMonth' && typeof msg.monthKey === 'string') {
          const [yStr, mStr] = msg.monthKey.split('-');
          const y = Number(yStr);
          const m = Number(mStr) - 1;
          if (!isNaN(y) && !isNaN(m)) {
            selectedYear = y;
            selectedMonth = m;
            await refreshAll(false);
          }
        } else if (msg.type === 'stepMonth' && typeof msg.delta === 'number') {
          const now = new Date();
          const dt = new Date(selectedYear ?? now.getFullYear(), (selectedMonth ?? now.getMonth()) + msg.delta, 1);
          if (dt.getFullYear() < now.getFullYear() || (dt.getFullYear() === now.getFullYear() && dt.getMonth() <= now.getMonth())) {
            selectedYear = dt.getFullYear();
            selectedMonth = dt.getMonth();
            await refreshAll(false);
          }
        } else if (msg.type === 'updateBudget') {
          await cfg.update('monthlyCredits', Number(msg.monthlyCredits) || 300, vscode.ConfigurationTarget.Global);
          await cfg.update('overrideApiEntitlement', true, vscode.ConfigurationTarget.Global);
          await cfg.update('extraCredits', Math.max(0, Number(msg.extraCredits) || 0), vscode.ConfigurationTarget.Global);
          await cfg.update('workHoursPerDay', Math.max(1, Number(msg.workHoursPerDay) || 8), vscode.ConfigurationTarget.Global);
          await cfg.update('dailyPercentMode', msg.dailyPercentMode === 'standard' ? 'standard' : 'adjusted', vscode.ConfigurationTarget.Global);
          dashboardPanel.webview.onDidReceiveMessage(async msg => {
            const cfg = vscode.workspace.getConfiguration('copilotAnalytics');
            if (msg.type === 'selectMonth' && typeof msg.monthKey === 'string') {
              const [yStr, mStr] = msg.monthKey.split('-');
              const y = Number(yStr);
              const m = Number(mStr) - 1;
              if (!isNaN(y) && !isNaN(m)) {
                selectedYear = y;
                selectedMonth = m;
                await refreshAll(false);
              } else if (msg.type === 'refresh') {
                await refreshAll(true);
              } else if (msg.type === 'export') {
                if (latestHistoryComparison) {
                  await exportAnalyticsReport(latestHistoryComparison);
                }
              }
            });
          dashboardPanel.webview.onDidReceiveMessage(async msg => {
            const cfg = vscode.workspace.getConfiguration('copilotAnalytics');
            if (msg.type === 'selectMonth' && typeof msg.monthKey === 'string') {
              const [yStr, mStr] = msg.monthKey.split('-');
              const y = Number(yStr);
              const m = Number(mStr) - 1;
              if (!isNaN(y) && !isNaN(m)) {
                selectedYear = y;
                selectedMonth = m;
                await refreshAll(false);
              }
            } else if (msg.type === 'stepMonth' && typeof msg.delta === 'number') {
              const now = new Date();
              const dt = new Date(selectedYear ?? now.getFullYear(), (selectedMonth ?? now.getMonth()) + msg.delta, 1);
              if (
                dt.getFullYear() < now.getFullYear() ||
                (dt.getFullYear() === now.getFullYear() && dt.getMonth() <= now.getMonth())
              ) {
                selectedYear = dt.getFullYear();
                selectedMonth = dt.getMonth();
                await refreshAll(false);
              }
            } else if (msg.type === 'updateBudget') {
              await cfg.update('monthlyCredits', Number(msg.monthlyCredits) || 300, vscode.ConfigurationTarget.Global);
              await cfg.update('overrideApiEntitlement', true, vscode.ConfigurationTarget.Global);
              await cfg.update('extraCredits', Math.max(0, Number(msg.extraCredits) || 0), vscode.ConfigurationTarget.Global);
              await cfg.update('workHoursPerDay', Math.max(1, Number(msg.workHoursPerDay) || 8), vscode.ConfigurationTarget.Global);
              await cfg.update(
                'dailyPercentMode',
                msg.dailyPercentMode === 'standard' ? 'standard' : 'adjusted',
                vscode.ConfigurationTarget.Global
              );
            } else if (msg.type === 'stepMonth' && typeof msg.delta === 'number') {
              const now = new Date();
              const dt = new Date(selectedYear ?? now.getFullYear(), (selectedMonth ?? now.getMonth()) + msg.delta, 1);
              if (
                dt.getFullYear() < now.getFullYear() ||
                (dt.getFullYear() === now.getFullYear() && dt.getMonth() <= now.getMonth())
              ) {
                selectedYear = dt.getFullYear();
                selectedMonth = dt.getMonth();
                await refreshAll(false);
              } else if (msg.type === 'refresh') {
                await refreshAll(true);
              } else if (msg.type === 'export') {
                if (latestHistoryComparison) {
                  await exportAnalyticsReport(latestHistoryComparison);
                }
              }
            });
        } else if (msg.type === 'updateBudget') {
          await cfg.update('monthlyCredits', Number(msg.monthlyCredits) || 300, vscode.ConfigurationTarget.Global);
          await cfg.update('overrideApiEntitlement', true, vscode.ConfigurationTarget.Global);
          await cfg.update('extraCredits', Math.max(0, Number(msg.extraCredits) || 0), vscode.ConfigurationTarget.Global);
          await cfg.update('workHoursPerDay', Math.max(1, Number(msg.workHoursPerDay) || 8), vscode.ConfigurationTarget.Global);
          await cfg.update(
            'dailyPercentMode',
            msg.dailyPercentMode === 'standard' ? 'standard' : 'adjusted',
            vscode.ConfigurationTarget.Global
          );
          await refreshAll(false);
        } else if (msg.type === 'refresh') {
          await refreshAll(true);
        } else if (msg.type === 'export') {
          if (latestHistoryComparison) {
            await exportAnalyticsReport(latestHistoryComparison);
          }
        }
      });

      dashboardPanel.onDidDispose(() => {
        dashboardPanel = undefined;
      });
    }
    dashboardPanel.onDidDispose(() => {
      dashboardPanel = undefined;
    });
  }

  async function exportAnalyticsReport(historyComp: HistoryComparison) {
    const snap = historyComp.selectedSnapshot;
    const formatPick = await vscode.window.showQuickPick(['JSON (Full Report + History)', 'CSV (Daily, Sessions & Multi-Month History)'], {
      title: 'Export Copilot Credit Analytics Report'
    });
    const formatPick = await vscode.window.showQuickPick(
      ['JSON (Full Report + History)', 'CSV (Daily, Sessions & Multi-Month History)'],
      {
        title: 'Export Copilot Credit Analytics Report'
      }
    );
    if (!formatPick) {
      return;
    }
    async function exportAnalyticsReport(historyComp: HistoryComparison) {
      const snap = historyComp.selectedSnapshot;
      const formatPick = await vscode.window.showQuickPick(
        ['JSON (Full Report + History)', 'CSV (Daily, Sessions & Multi-Month History)'],
        {
          title: 'Export Copilot Credit Analytics Report'
        }
      );
      if (!formatPick) {
        return;
      }

      const isJson = formatPick.startsWith('JSON');
      const defaultExt = isJson ? 'json' : 'csv';
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(
          path.join(
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.env.HOME || '.',
            `copilot-analytics-${historyComp.selectedMonthKey}.${defaultExt}`
          )
  const isJson = formatPick.startsWith('JSON');
        const defaultExt = isJson ? 'json' : 'csv';
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(
            path.join(
              vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.env.HOME || '.',
              `copilot-analytics-${historyComp.selectedMonthKey}.${defaultExt}`
            )
    });
        if(!uri) {
          return;
    )
    });
    if (!uri) {
      return;
    }

    if (isJson) {
      fs.writeFileSync(uri.fsPath, JSON.stringify(historyComp, null, 2), 'utf8');
    } else {
      const lines: string[] = [
        'Section,DateOrName,Workday,Messages,Credits,DailyLimitPercent,Expensive40to60,ExpensiveOver60,WorkspaceOrMultiplier'
      ];
      for (const mh of historyComp.monthsHistory) {
        lines.push(
          `HistoryMonth,${mh.monthKey},${mh.totalWorkdays},-,${mh.usedCredits},${mh.usedPercent}%,${mh.expensive40to60},${mh.expensiveOver60},Avg:${mh.workdayAverageCredits}/day`
        );
      }
      const isJson = formatPick.startsWith('JSON');
      const defaultExt = isJson ? 'json' : 'csv';
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(
          path.join(
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.env.HOME || '.',
            `copilot-analytics-${historyComp.selectedMonthKey}.${defaultExt}`
          )
        )
      });
      if (!uri) {
        return;
        for (const d of snap.dailySeries) {
          lines.push(
            `Daily,${d.dateStr},${d.isWorkday},${d.messages},${d.credits},${d.dailyPercent}%,${d.expensiveChats40to60},${d.expensiveChatsOver60},Limit:${d.recommendedLimit}`
          );
        }

        if (isJson) {
          fs.writeFileSync(uri.fsPath, JSON.stringify(historyComp, null, 2), 'utf8');
        } else {
          const lines: string[] = [
            'Section,DateOrName,Workday,Messages,Credits,DailyLimitPercent,Expensive40to60,ExpensiveOver60,WorkspaceOrMultiplier'
          ];
          for (const mh of historyComp.monthsHistory) {
            lines.push(
              `HistoryMonth,${mh.monthKey},${mh.totalWorkdays},-,${mh.usedCredits},${mh.usedPercent}%,${mh.expensive40to60},${mh.expensiveOver60},Avg:${mh.workdayAverageCredits}/day`
            );
          }
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
          for (const m of snap.models) {
            const msgCell = m.model.startsWith('External') && m.messages === 0 ? '-' : String(m.messages);
            const rateCell = m.model.startsWith('External') && m.messages === 0 ? '-' : `${m.multiplier}cr/msg`;
            lines.push(`Model,"${m.model}",-,${msgCell},${m.credits},${m.percentOfCredits}%,-,-,${rateCell}`);
          }
          if (isJson) {
            fs.writeFileSync(uri.fsPath, JSON.stringify(historyComp, null, 2), 'utf8');
          } else {
            const lines: string[] = [
              'Section,DateOrName,Workday,Messages,Credits,DailyLimitPercent,Expensive40to60,ExpensiveOver60,WorkspaceOrMultiplier'
            ];
            for (const mh of historyComp.monthsHistory) {
              lines.push(
                `HistoryMonth,${mh.monthKey},${mh.totalWorkdays},-,${mh.usedCredits},${mh.usedPercent}%,${mh.expensive40to60},${mh.expensiveOver60},Avg:${mh.workdayAverageCredits}/day`
              );
            }
            for (const d of snap.dailySeries) {
              lines.push(
                `Daily,${d.dateStr},${d.isWorkday},${d.messages},${d.credits},${d.dailyPercent}%,${d.expensiveChats40to60},${d.expensiveChatsOver60},Limit:${d.recommendedLimit}`
              );
            }
            for (const m of snap.models) {
              const msgCell = m.model.startsWith('External') && m.messages === 0 ? '-' : String(m.messages);
              const rateCell = m.model.startsWith('External') && m.messages === 0 ? '-' : `${m.multiplier}cr/msg`;
              lines.push(`Model,"${m.model}",-,${msgCell},${m.credits},${m.percentOfCredits}%,-,-,${rateCell}`);
            }
            for (const s of snap.topExpensiveSessions) {
              lines.push(
                `Session,"${s.title.replace(/"/g, '""')}",${s.dateStr},${s.messages},${s.credits},${s.dailyLimitPercent}%,${s.expenseTier === 'heavy-40-60' ? 1 : 0},${s.expenseTier === 'mega-60plus' ? 1 : 0},"${s.workspaceName}"`
              );
            }
            fs.writeFileSync(uri.fsPath, lines.join('\n'), 'utf8');
            for (const s of snap.topExpensiveSessions) {
              lines.push(
                `Session,"${s.title.replace(/"/g, '""')}",${s.dateStr},${s.messages},${s.credits},${s.dailyLimitPercent}%,${s.expenseTier === 'heavy-40-60' ? 1 : 0},${s.expenseTier === 'mega-60plus' ? 1 : 0},"${s.workspaceName}"`
              );
            }
            fs.writeFileSync(uri.fsPath, lines.join('\n'), 'utf8');
          }

          vscode.window.showInformationMessage(`Exported Copilot Analytics report to ${uri.fsPath}`);
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
      function escapeHtml(str: string): string {
        return (str || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      function renderDashboardHtml(historyComp: HistoryComparison, config: TrackerConfig): string {
        const snap = historyComp.selectedSnapshot;
        const prevSnap = historyComp.previousSnapshot;
        const nowKey = formatMonthKey(new Date().getFullYear(), new Date().getMonth());
        const isViewingCurrentMonth = historyComp.selectedMonthKey === nowKey;
        function renderDashboardHtml(historyComp: HistoryComparison, config: TrackerConfig): string {
          const snap = historyComp.selectedSnapshot;
          const prevSnap = historyComp.previousSnapshot;
          const nowKey = formatMonthKey(new Date().getFullYear(), new Date().getMonth());
          const isViewingCurrentMonth = historyComp.selectedMonthKey === nowKey;

          const tierColors: Record<string, string> = {
            green: '#22c55e',
            yellow: '#eab308',
            orange: '#f97316',
            red: '#ef4444'
          };
          const tierColors: Record<string, string> = {
            green: '#22c55e',
            yellow: '#eab308',
            orange: '#f97316',
            red: '#ef4444'
          };
          const tierColors: Record<string, string> = {
            green: 'var(--green)',
            yellow: 'var(--yellow)',
            orange: 'var(--orange)',
            red: 'var(--red)'
          };

          const chartW = 760;
          const chartH = 220;
          const padL = 42;
          const padR = 20;
          const padT = 28;
          const padB = 34;
          const plotW = chartW - padL - padR;
          const plotH = chartH - padT - padB;
          const chartW = 760;
          const chartH = 220;
          const padL = 42;
          const padR = 20;
          const padT = 28;
          const padB = 34;
          const plotW = chartW - padL - padR;
          const plotH = chartH - padT - padB;
          const chartW = 760;
          const chartH = 220;
          const padL = 42;
          const padR = 20;
          const padT = 28;
          const padB = 34;
          const plotW = chartW - padL - padR;
          const plotH = chartH - padT - padB;

          // --- SVG 1: Daily Usage Bar Chart + Recommended Daily Limit Line + Expensive Chat Markers ---
          const maxDailyCredits = Math.max(
            snap.recommendedDailyLimit * 1.4,
            ...snap.dailySeries.map(d => d.credits),
            5
          );
          // --- SVG 1: Daily Usage Bar Chart + Recommended Daily Limit Line + Expensive Chat Markers ---
          const maxDailyCredits = Math.max(
            snap.recommendedDailyLimit * 1.4,
            ...snap.dailySeries.map(d => d.credits),
            5
          );
          // --- SVG 1: Daily Usage Bar Chart + Recommended Daily Limit Line + Expensive Chat Markers ---
          const maxDailyCredits = Math.max(
            snap.recommendedDailyLimit * 1.4,
            ...snap.dailySeries.map(d => d.credits),
            5
          );

          const barStep = plotW / snap.dailySeries.length;
          const barW = Math.max(6, barStep * 0.68);
          const limitY = padT + plotH - (snap.recommendedDailyLimit / maxDailyCredits) * plotH;
          const barStep = plotW / snap.dailySeries.length;
          const barW = Math.max(6, barStep * 0.68);
          const limitY = padT + plotH - (snap.recommendedDailyLimit / maxDailyCredits) * plotH;
          const barStep = plotW / snap.dailySeries.length;
          const barW = Math.max(6, barStep * 0.68);
          const limitY = padT + plotH - (snap.recommendedDailyLimit / maxDailyCredits) * plotH;

          const dailyBarsSvg = snap.dailySeries
            .map((d, i) => {
              const x = padL + i * barStep + (barStep - barW) / 2;
              const barH = d.credits > 0
                ? Math.max(4, (d.credits / maxDailyCredits) * plotH)
                : (d.isFuture ? 0 : 2);
              const y = padT + plotH - barH;
              const fill = d.isFuture
                ? 'rgba(148,163,184,0.10)'
                : d.credits > 0
                  ? (tierColors[d.colorTier] || '#22c55e')
                  : 'rgba(148,163,184,0.25)';
              const opacity = d.isWorkday ? '0.92' : '0.45';
              const todayStroke = d.isToday && isViewingCurrentMonth ? 'stroke="#38bdf8" stroke-width="2"' : '';
              const dailyBarsSvg = snap.dailySeries
                .map((d, i) => {
                  const x = padL + i * barStep + (barStep - barW) / 2;
                  const barH = d.credits > 0 ? Math.max(4, (d.credits / maxDailyCredits) * plotH) : d.isFuture ? 0 : 2;
                  const y = padT + plotH - barH;
                  const fill = d.isFuture
                    ? 'rgba(148,163,184,0.10)'
                    : d.credits > 0
                      ? tierColors[d.colorTier] || '#22c55e'
                      : 'rgba(148,163,184,0.25)';
                  const opacity = d.isWorkday ? '0.92' : '0.45';
                  const todayStroke = d.isToday && isViewingCurrentMonth ? 'stroke="#38bdf8" stroke-width="2"' : '';
                  const dailyBarsSvg = snap.dailySeries
                    .map((d, i) => {
                      const x = padL + i * barStep + (barStep - barW) / 2;
                      const barH = d.credits > 0 ? Math.max(4, (d.credits / maxDailyCredits) * plotH) : d.isFuture ? 0 : 2;
                      const y = padT + plotH - barH;
                      const fill = d.isFuture
                        ? 'var(--chart-future)'
                        : d.credits > 0
                          ? tierColors[d.colorTier] || 'var(--green)'
                          : 'var(--chart-empty)';
                      const opacity = d.isWorkday ? '0.92' : '0.45';
                      const todayStroke = d.isToday && isViewingCurrentMonth ? 'stroke="var(--accent)" stroke-width="2"' : '';

                      let expMarker = '';
                      if (d.totalExpensiveChats > 0) {
                        const badgeColor = d.expensiveChatsOver60 > 0 ? '#ef4444' : '#f97316';
                        const markerY = Math.max(12, y - 8);
                        expMarker = `
      let expMarker = '';
      if (d.totalExpensiveChats > 0) {
        const badgeColor = d.expensiveChatsOver60 > 0 ? '#ef4444' : '#f97316';
        const badgeColor = d.expensiveChatsOver60 > 0 ? 'var(--red)' : 'var(--orange)';
        const markerY = Math.max(12, y - 8);
        expMarker = `
                          < circle cx = "${(x + barW / 2).toFixed(1)}" cy = "${markerY.toFixed(1)}" r = "7" fill = "${badgeColor}" />
                            <text x="${(x + barW / 2).toFixed(1)}" y = "${(markerY + 3.5).toFixed(1)}" text - anchor="middle" fill = "#fff" font - size="9" font - weight="bold" > ${ d.totalExpensiveChats } </text>
                              `;
              }
          <circle cx="${(x + barW / 2).toFixed(1)}" cy="${markerY.toFixed(1)}" r="7" fill="${badgeColor}" />
          <text x="${(x + barW / 2).toFixed(1)}" y="${(markerY + 3.5).toFixed(1)}" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold">${d.totalExpensiveChats}</text>
        `;
                      }

                      const showDayLabel = d.dayOfMonth === 1 || d.dayOfMonth % 3 === 0 || (d.isToday && isViewingCurrentMonth) || d.dayOfMonth === snap.calendar.daysInMonth;
                      const dayLabel = showDayLabel
                        ? `< text x = "${(x + barW / 2).toFixed(1)}" y = "${chartH - 10}" text - anchor="middle" fill = "${d.isToday && isViewingCurrentMonth ? '#38bdf8' : '#94a3b8'}" font - size="10" font - weight="${d.isToday && isViewingCurrentMonth ? '700' : '400'}" > ${d.dayOfMonth} </text>`
                        : '';
                      const showDayLabel =
                        d.dayOfMonth === 1 ||
                        d.dayOfMonth % 3 === 0 ||
                        (d.isToday && isViewingCurrentMonth) ||
                        d.dayOfMonth === snap.calendar.daysInMonth;
                      const dayLabel = showDayLabel
                        ? `<text x="${(x + barW / 2).toFixed(1)}" y="${chartH - 10}" text-anchor="middle" fill="${d.isToday && isViewingCurrentMonth ? '#38bdf8' : '#94a3b8'}" font-size="10" font-weight="${d.isToday && isViewingCurrentMonth ? '700' : '400'}">${d.dayOfMonth}</text>`
                        : '';
                      const showDayLabel =
                        d.dayOfMonth === 1 ||
                        d.dayOfMonth % 3 === 0 ||
                        (d.isToday && isViewingCurrentMonth) ||
                        d.dayOfMonth === snap.calendar.daysInMonth;
                      const dayLabel = showDayLabel
                        ? `<text x="${(x + barW / 2).toFixed(1)}" y="${chartH - 10}" text-anchor="middle" fill="${d.isToday && isViewingCurrentMonth ? 'var(--accent)' : 'var(--chart-label)'}" font-size="10" font-weight="${d.isToday && isViewingCurrentMonth ? '700' : '400'}">${d.dayOfMonth}</text>`
                        : '';

                      const tooltip = `${d.dateStr} (${d.weekdayName}${d.isWorkday ? ' - Workday' : ' - Weekend/Holiday'}): ${d.credits} cr (${d.dailyPercent}% of limit) | ${d.messages} msgs | Expensive chats: ${d.expensiveChats40to60} (40-60%), ${d.expensiveChatsOver60} (>60%)`;
                      const tooltip = `${d.dateStr} (${d.weekdayName}${d.isWorkday ? ' - Workday' : ' - Weekend/Holiday'}): ${d.credits} cr (${d.dailyPercent}% of limit) | ${d.messages} msgs | Expensive chats: ${d.expensiveChats40to60} (40-60%), ${d.expensiveChatsOver60} (>60%)`;
                      const tooltip = `${d.dateStr} (${d.weekdayName}${d.isWorkday ? ' - Workday' : ' - Weekend/Holiday'}): ${d.credits} cr (${d.dailyPercent}% of limit) | ${d.messages} msgs | Expensive chats: ${d.expensiveChats40to60} (40-60%), ${d.expensiveChatsOver60} (>60%)`;

                      return `
      return `
                        < g >
                        <title>${ escapeHtml(tooltip) } </title>
                          < rect x = "${x.toFixed(1)}" y = "${y.toFixed(1)}" width = "${barW.toFixed(1)}" height = "${barH.toFixed(1)}" rx = "3" fill = "${fill}" fill - opacity="${opacity}" ${ todayStroke } />
          ${ expMarker }
          ${ dayLabel }
                      </g>
                        < g >
                        <title>${ escapeHtml(tooltip) } </title>
                          < rect x = "${x.toFixed(1)}" y = "${y.toFixed(1)}" width = "${barW.toFixed(1)}" height = "${barH.toFixed(1)}" rx = "3" fill = "${fill}" fill - opacity="${opacity}" ${ todayStroke } />
          ${ expMarker }
          ${ dayLabel }
                      </g>
                        `;
            })
            .join('');
    })
    .join('');

          // --- SVG 2: Cumulative Burn-Up Trajectory (Actual Used vs Workday Budget Trajectory) ---
          const maxCum = Math.max(snap.totalMonthlyCredits * 1.1, snap.totalUsedCredits * 1.1, 10);
          const budgetPoints: string[] = [];
          const actualPoints: string[] = [];
          let liveApiDotSvg = '';
  // --- SVG 2: Cumulative Burn-Up Trajectory (Actual Used vs Workday Budget Trajectory) ---
  const maxCum = Math.max(snap.totalMonthlyCredits * 1.1, snap.totalUsedCredits * 1.1, 10);
  const budgetPoints: string[] = [];
  const actualPoints: string[] = [];
  let liveApiDotSvg = '';

          snap.dailySeries.forEach((d, i) => {
            const cx = padL + i * barStep + barStep / 2;
            const by = padT + plotH - (d.cumulativeBudget / maxCum) * plotH;
            budgetPoints.push(`${ cx.toFixed(1) },${ by.toFixed(1) } `);
            if (!d.isFuture) {
              const ay = padT + plotH - (d.cumulativeUsed / maxCum) * plotH;
              actualPoints.push(`${ cx.toFixed(1) },${ ay.toFixed(1) } `);
            }
            if (d.isToday && snap.totalUsedCredits > d.cumulativeUsed + 0.5) {
              const apiY = padT + plotH - (snap.totalUsedCredits / maxCum) * plotH;
              liveApiDotSvg = `
                      snap.dailySeries.forEach((d, i) => {
                        const cx = padL + i * barStep + barStep / 2;
                        const by = padT + plotH - (d.cumulativeBudget / maxCum) * plotH;
                        budgetPoints.push(`${cx.toFixed(1)},${by.toFixed(1)}`);
                        if (!d.isFuture) {
                          const ay = padT + plotH - (d.cumulativeUsed / maxCum) * plotH;
                          actualPoints.push(`${cx.toFixed(1)},${ay.toFixed(1)}`);
                        }
                        if (d.isToday && snap.totalUsedCredits > d.cumulativeUsed + 0.5) {
                          const apiY = padT + plotH - (snap.totalUsedCredits / maxCum) * plotH;
                          liveApiDotSvg = `
        <circle cx="${cx.toFixed(1)}" cy="${apiY.toFixed(1)}" r="5" fill="#38bdf8" stroke="#0f172a" stroke-width="1.5">
  snap.dailySeries.forEach((d, i) => {
    const cx = padL + i * barStep + barStep / 2;
    const by = padT + plotH - (d.cumulativeBudget / maxCum) * plotH;
    budgetPoints.push(`${ cx.toFixed(1) },${ by.toFixed(1) } `);
    if (!d.isFuture) {
      const ay = padT + plotH - (d.cumulativeUsed / maxCum) * plotH;
      actualPoints.push(`${ cx.toFixed(1) },${ ay.toFixed(1) } `);
    }
    if (d.isToday && snap.totalUsedCredits > d.cumulativeUsed + 0.5) {
      const apiY = padT + plotH - (snap.totalUsedCredits / maxCum) * plotH;
      liveApiDotSvg = `
                            < circle cx = "${cx.toFixed(1)}" cy = "${apiY.toFixed(1)}" r = "5" fill = "var(--accent)" stroke = "var(--card)" stroke - width="1.5" >
                              <title>GitHub API Total Used: ${ snap.totalUsedCredits.toFixed(1) } cr </title>
                                </circle>
                                < text x = "${Math.min(chartW - padR - 4, cx + 8).toFixed(1)}" y = "${(apiY + 4).toFixed(1)}" fill = "#38bdf8" font - size="10" font - weight="600" > API: ${ snap.totalUsedCredits.toFixed(0) } cr </text>
                                  < text x = "${Math.min(chartW - padR - 4, cx + 8).toFixed(1)}" y = "${(apiY + 4).toFixed(1)}" fill = "var(--accent)" font - size="10" font - weight="600" > API: ${ snap.totalUsedCredits.toFixed(0) } cr </text>
                                    `;
      }
    });
  }
});
    }
  });

// --- SVG 3: History Comparison Graph A — Selected Month vs Previous Month Cumulative Pace (Days 1..31) ---
const hasPrevMonthActivity = prevSnap.totalUsedCredits > 0;
const maxCompareCum = Math.max(
  snap.totalMonthlyCredits * 1.05,
  snap.totalUsedCredits * 1.1,
  prevSnap.totalUsedCredits * 1.1,
  10
);
const day31Step = plotW / 31;
const selectedCumPoints: string[] = [];
const prevOrIdealCumPoints: string[] = [];
const compareDayMarkersSvg: string[] = [];
// --- SVG 3: History Comparison Graph A — Selected Month vs Previous Month Cumulative Pace (Days 1..31) ---
const hasPrevMonthActivity = prevSnap.totalUsedCredits > 0;
const maxCompareCum = Math.max(
  snap.totalMonthlyCredits * 1.05,
  snap.totalUsedCredits * 1.1,
  prevSnap.totalUsedCredits * 1.1,
  10
);
const day31Step = plotW / 31;
const selectedCumPoints: string[] = [];
const prevOrIdealCumPoints: string[] = [];
const compareDayMarkersSvg: string[] = [];
  // --- SVG 3: History Comparison Graph A — Selected Month vs Previous Month Cumulative Pace (Days 1..31) ---
  const hasPrevMonthActivity = prevSnap.totalUsedCredits > 0;
  const maxCompareCum = Math.max(
    snap.totalMonthlyCredits * 1.05,
    snap.totalUsedCredits * 1.1,
    prevSnap.totalUsedCredits * 1.1,
    10
  );
  const day31Step = plotW / 31;
  const selectedCumPoints: string[] = [];
  const prevOrIdealCumPoints: string[] = [];
  const compareDayMarkersSvg: string[] = [];

for (let d = 1; d <= 31; d++) {
  const cx = padL + (d - 0.5) * day31Step;
  if (hasPrevMonthActivity) {
    const prevPt = prevSnap.dailySeries[d - 1];
    if (prevPt) {
      const py = padT + plotH - (prevPt.cumulativeUsed / maxCompareCum) * plotH;
      prevOrIdealCumPoints.push(`${ cx.toFixed(1) },${ py.toFixed(1) } `);
    }
  } else {
    // First month of usage: compare against the ideal workday budget trajectory so graph is never blank
    const selBudgetPt = snap.dailySeries[d - 1];
    if (selBudgetPt) {
      const iy = padT + plotH - (selBudgetPt.cumulativeBudget / maxCompareCum) * plotH;
      prevOrIdealCumPoints.push(`${ cx.toFixed(1) },${ iy.toFixed(1) } `);
    }
  }
  for (let d = 1; d <= 31; d++) {
    const cx = padL + (d - 0.5) * day31Step;
    if (hasPrevMonthActivity) {
      const prevPt = prevSnap.dailySeries[d - 1];
      if (prevPt) {
        const py = padT + plotH - (prevPt.cumulativeUsed / maxCompareCum) * plotH;
        prevOrIdealCumPoints.push(`${ cx.toFixed(1) },${ py.toFixed(1) } `);
      }
    } else {
      const selBudgetPt = snap.dailySeries[d - 1];
      if (selBudgetPt) {
        const iy = padT + plotH - (selBudgetPt.cumulativeBudget / maxCompareCum) * plotH;
        prevOrIdealCumPoints.push(`${ cx.toFixed(1) },${ iy.toFixed(1) } `);
      }
    }

    const selPt = snap.dailySeries[d - 1];
    if (selPt && !selPt.isFuture) {
      // Scale cumulative line smoothly if API total exceeds local sessions so current day matches totalUsedCredits
      const cumVal =
        selPt.isToday && snap.localMinedCredits === 0 && snap.totalUsedCredits > 0
          ? snap.totalUsedCredits
          : selPt.cumulativeUsed;
      const sy = padT + plotH - (cumVal / maxCompareCum) * plotH;
      selectedCumPoints.push(`${ cx.toFixed(1) },${ sy.toFixed(1) } `);
    }
    const selPt = snap.dailySeries[d - 1];
    if (selPt && !selPt.isFuture) {
      const cumVal =
        selPt.isToday && snap.localMinedCredits === 0 && snap.totalUsedCredits > 0
          ? snap.totalUsedCredits
          : selPt.cumulativeUsed;
      const sy = padT + plotH - (cumVal / maxCompareCum) * plotH;
      selectedCumPoints.push(`${ cx.toFixed(1) },${ sy.toFixed(1) } `);
    }

    if (d === 1 || d % 5 === 0 || d === 31) {
      compareDayMarkersSvg.push(
        `< text x = "${cx.toFixed(1)}" y = "${chartH - 10}" text - anchor="middle" fill = "#94a3b8" font - size="10" > D${ d } </text>`
                            `<text x="${cx.toFixed(1)}" y="${chartH - 10}" text-anchor="middle" fill="var(--chart-label)" font-size="10">D${d}</text>`
      );
                    }
  }
  if (d === 1 || d % 5 === 0 || d === 31) {
                compareDayMarkersSvg.push(
                  `<text x="${cx.toFixed(1)}" y="${chartH - 10}" text-anchor="middle" fill="#94a3b8" font-size="10">D${d}</text>`
                );
              }
            }

// --- SVG 4: History Comparison Graph B — 6-Month Historical Credits & Expensive Chats Bar Chart ---
const maxMonthHistoryCr = Math.max(
              ...historyComp.monthsHistory.map(m => Math.max(m.totalMonthlyCredits, m.usedCredits)),
              50
            );
          const mCount = historyComp.monthsHistory.length;
          const mStep = plotW / mCount;
          const mBarW = Math.max(22, mStep * 0.48);
          // --- SVG 4: History Comparison Graph B — 6-Month Historical Credits & Expensive Chats Bar Chart ---
          const maxMonthHistoryCr = Math.max(
            ...historyComp.monthsHistory.map(m => Math.max(m.totalMonthlyCredits, m.usedCredits)),
            50
          );
          const mCount = historyComp.monthsHistory.length;
          const mStep = plotW / mCount;
          const mBarW = Math.max(22, mStep * 0.48);
          // --- SVG 4: History Comparison Graph B — 6-Month Historical Credits & Expensive Chats Bar Chart ---
          const maxMonthHistoryCr = Math.max(
            ...historyComp.monthsHistory.map(m => Math.max(m.totalMonthlyCredits, m.usedCredits)),
            50
          );
          const mCount = historyComp.monthsHistory.length;
          const mStep = plotW / mCount;
          const mBarW = Math.max(22, mStep * 0.48);

          const multiMonthBarsSvg = historyComp.monthsHistory
            .map((mh, idx) => {
              const x = padL + idx * mStep + (mStep - mBarW) / 2;
              const capH = (mh.totalMonthlyCredits / maxMonthHistoryCr) * plotH;
              const capY = padT + plotH - capH;
              const usedH = Math.max(mh.usedCredits > 0 ? 4 : 0, (mh.usedCredits / maxMonthHistoryCr) * plotH);
              const usedY = padT + plotH - usedH;
              const barColor =
                mh.usedPercent >= 100
                  ? '#ef4444'
                  : mh.usedPercent >= 85
                    ? '#f97316'
                    : mh.isSelected
                      ? '#38bdf8'
                      : '#22c55e';
              const strokeAttr = mh.isSelected ? 'stroke="#f8fafc" stroke-width="2"' : '';
              const multiMonthBarsSvg = historyComp.monthsHistory
                .map((mh, idx) => {
                  const x = padL + idx * mStep + (mStep - mBarW) / 2;
                  const capH = (mh.totalMonthlyCredits / maxMonthHistoryCr) * plotH;
                  const capY = padT + plotH - capH;
                  const usedH = Math.max(mh.usedCredits > 0 ? 4 : 0, (mh.usedCredits / maxMonthHistoryCr) * plotH);
                  const usedY = padT + plotH - usedH;
                  const barColor =
                    mh.usedPercent >= 100
                      ? '#ef4444'
                      : mh.usedPercent >= 85
                        ? '#f97316'
                        : mh.isSelected
                          ? '#38bdf8'
                          : '#22c55e';
                  const strokeAttr = mh.isSelected ? 'stroke="#f8fafc" stroke-width="2"' : '';
                  const multiMonthBarsSvg = historyComp.monthsHistory
                    .map((mh, idx) => {
                      const x = padL + idx * mStep + (mStep - mBarW) / 2;
                      const capH = (mh.totalMonthlyCredits / maxMonthHistoryCr) * plotH;
                      const capY = padT + plotH - capH;
                      const usedH = Math.max(mh.usedCredits > 0 ? 4 : 0, (mh.usedCredits / maxMonthHistoryCr) * plotH);
                      const usedY = padT + plotH - usedH;
                      const barColor =
                        mh.usedPercent >= 100
                          ? 'var(--red)'
                          : mh.usedPercent >= 85
                            ? 'var(--orange)'
                            : mh.isSelected
                              ? 'var(--accent)'
                              : 'var(--green)';
                      const strokeAttr = mh.isSelected ? 'stroke="var(--selected-stroke)" stroke-width="2"' : '';

                      let expBadge = '';
                      if (mh.totalExpensiveChats > 0) {
                        const by = Math.max(14, usedY - 18);
                        expBadge = `
      let expBadge = '';
      if (mh.totalExpensiveChats > 0) {
        const by = Math.max(14, usedY - 18);
        expBadge = `
                          < rect x = "${(x + mBarW / 2 - 18).toFixed(1)}" y = "${(by - 9).toFixed(1)}" width = "36" height = "14" rx = "7" fill = "rgba(249,115,22,0.25)" stroke = "#f97316" stroke - width="1" />
                            <text x="${(x + mBarW / 2).toFixed(1)}" y = "${(by + 1).toFixed(1)}" text - anchor="middle" fill = "#fb923c" font - size="9" font - weight="bold" >🔥${ mh.totalExpensiveChats } </text>
                              `;
              }
          <rect x="${(x + mBarW / 2 - 18).toFixed(1)}" y="${(by - 9).toFixed(1)}" width="36" height="14" rx="7" fill="rgba(249,115,22,0.20)" stroke="var(--orange)" stroke-width="1" />
          <text x="${(x + mBarW / 2).toFixed(1)}" y="${(by + 1).toFixed(1)}" text-anchor="middle" fill="var(--pill-orange-fg)" font-size="9" font-weight="bold">🔥${mh.totalExpensiveChats}</text>
        `;
                      }

                      return `
          return `
                      return `
        <g style="cursor:pointer;" onclick="selectMonth('${mh.monthKey}')">
          <title>${mh.label}: ${mh.usedCredits.toFixed(1)} / ${mh.totalMonthlyCredits} cr (${mh.usedPercent.toFixed(1)}%) | Workday Avg: ${mh.workdayAverageCredits.toFixed(2)} cr/d | Expensive Chats: ${mh.totalExpensiveChats} (Click to inspect month)</title>
          <rect x="${x.toFixed(1)}" y="${capY.toFixed(1)}" width="${mBarW.toFixed(1)}" height="${capH.toFixed(1)}" rx="4" fill="rgba(148,163,184,0.12)" />
          <rect x="${x.toFixed(1)}" y="${capY.toFixed(1)}" width="${mBarW.toFixed(1)}" height="${capH.toFixed(1)}" rx="4" fill="var(--chart-cap)" />
          <rect x="${x.toFixed(1)}" y="${usedY.toFixed(1)}" width="${mBarW.toFixed(1)}" height="${usedH.toFixed(1)}" rx="4" fill="${barColor}" ${strokeAttr} />
          <text x="${(x + mBarW / 2).toFixed(1)}" y="${Math.max(12, usedY - 4).toFixed(1)}" text-anchor="middle" fill="#e2e8f0" font-size="10" font-weight="600">${mh.usedCredits.toFixed(0)} cr</text>
          <text x="${(x + mBarW / 2).toFixed(1)}" y="${Math.max(12, usedY - 4).toFixed(1)}" text-anchor="middle" fill="var(--chart-value)" font-size="10" font-weight="600">${mh.usedCredits.toFixed(0)} cr</text>
          ${expBadge}
          <text x="${(x + mBarW / 2).toFixed(1)}" y="${chartH - 10}" text-anchor="middle" fill="${mh.isSelected ? '#38bdf8' : '#94a3b8'}" font-size="10.5" font-weight="${mh.isSelected ? '700' : '500'}">${mh.label}</text>
          <text x="${(x + mBarW / 2).toFixed(1)}" y="${chartH - 10}" text-anchor="middle" fill="${mh.isSelected ? 'var(--accent)' : 'var(--chart-label)'}" font-size="10.5" font-weight="${mh.isSelected ? '700' : '500'}">${mh.label}</text>
        </g>
      `;
                    })
                    .join('');
                })
                .join('');
            })
            .join('');

          // --- SVG 5: 24-Hour Work Hour Usage Chart ---
          const maxHourCr = Math.max(...snap.hourlySeries.map(h => h.credits), ...snap.hourlySeries.map(h => h.messages * 0.2), 1);
          const hrStep = plotW / 24;
          const hrBarW = Math.max(8, hrStep * 0.65);
          const hourlyBarsSvg = snap.hourlySeries
            .map((h, i) => {
              const x = padL + i * hrStep + (hrStep - hrBarW) / 2;
              // Show bar height for either paid credits or 0x-model message activity
              const metricVal = h.credits > 0 ? h.credits : h.messages * 0.15;
              const barH = metricVal > 0 ? Math.max(4, (metricVal / maxHourCr) * plotH) : 2;
              const y = padT + plotH - barH;
              const fill = h.credits > 0 ? '#38bdf8' : (h.messages > 0 ? '#64748b' : 'rgba(148,163,184,0.18)');
              const showLabel = i % 3 === 0;
              return `
  // --- SVG 5: 24-Hour Work Hour Usage Chart ---
  const maxHourCr = Math.max(
    ...snap.hourlySeries.map(h => h.credits),
    ...snap.hourlySeries.map(h => h.messages * 0.2),
    1
  );
  const hrStep = plotW / 24;
  const hrBarW = Math.max(8, hrStep * 0.65);
  const hourlyBarsSvg = snap.hourlySeries
    .map((h, i) => {
      const x = padL + i * hrStep + (hrStep - hrBarW) / 2;
      const metricVal = h.credits > 0 ? h.credits : h.messages * 0.15;
      const barH = metricVal > 0 ? Math.max(4, (metricVal / maxHourCr) * plotH) : 2;
      const y = padT + plotH - barH;
      const fill = h.credits > 0 ? '#38bdf8' : h.messages > 0 ? '#64748b' : 'rgba(148,163,184,0.18)';
      const fill = h.credits > 0 ? 'var(--accent)' : h.messages > 0 ? '#64748b' : 'var(--chart-empty)';
      const showLabel = i % 3 === 0;
      return `
                < g >
                <title>${ h.label } — ${ h.credits } credits, ${ h.messages } messages </title>
                  < rect x = "${x.toFixed(1)}" y = "${y.toFixed(1)}" width = "${hrBarW.toFixed(1)}" height = "${barH.toFixed(1)}" rx = "3" fill = "${fill}" fill - opacity="0.88" />
                    ${ showLabel ? `<text x="${(x + hrBarW / 2).toFixed(1)}" y="${chartH - 10}" text-anchor="middle" fill="#94a3b8" font-size="10">${h.hour}h</text>` : '' }
              </g>
                < g >
                <title>${ h.label } — ${ h.credits } credits, ${ h.messages } messages </title>
                  < rect x = "${x.toFixed(1)}" y = "${y.toFixed(1)}" width = "${hrBarW.toFixed(1)}" height = "${barH.toFixed(1)}" rx = "3" fill = "${fill}" fill - opacity="0.88" />
                    ${ showLabel ? `<text x="${(x + hrBarW / 2).toFixed(1)}" y="${chartH - 10}" text-anchor="middle" fill="var(--chart-label)" font-size="10">${h.hour}h</text>` : '' }
              </g>
                `;
            })
            .join('');
    })
    .join('');

          const historyTableRows = [...historyComp.monthsHistory]
            .reverse()
            .map(mh => {
              const balColor = mh.endBalance >= 0 ? 'pill-green' : 'pill-red';
              const balText = mh.endBalance >= 0 ? `+ ${ mh.endBalance.toFixed(1) } Extra` : `${ mh.endBalance.toFixed(1) } Debt`;
              return `
              const historyTableRows = [...historyComp.monthsHistory]
                .reverse()
                .map(mh => {
                  const balColor = mh.endBalance >= 0 ? 'pill-green' : 'pill-red';
                  const balText = mh.endBalance >= 0 ? `+${mh.endBalance.toFixed(1)} Extra` : `${mh.endBalance.toFixed(1)} Debt`;
                  return `
        <tr style="${mh.isSelected ? 'background:rgba(56,189,248,0.10);' : ''}">
  const historyTableRows = [...historyComp.monthsHistory]
    .reverse()
    .map(mh => {
      const balColor = mh.endBalance >= 0 ? 'pill-green' : 'pill-red';
      const balText = mh.endBalance >= 0 ? `+ ${ mh.endBalance.toFixed(1) } Extra` : `${ mh.endBalance.toFixed(1) } Debt`;
      return `
                    < tr style = "${mh.isSelected ? 'background:rgba(56,189,248,0.12);' : ''}" >
                      <td>
                      <strong>${ mh.label } </strong>
            ${ mh.isCurrentMonth ? '<span class="ws-tag" style="margin-left:6px;">Current</span>' : '' }
            ${ mh.isSelected ? '<span class="pill pill-green" style="margin-left:4px;">Viewing</span>' : '' }
                  </td>
                    < td > ${ mh.elapsedWorkdays } / ${mh.totalWorkdays} d</td >
                      <td><strong>${ mh.usedCredits.toFixed(1) } </strong> / ${ mh.totalMonthlyCredits } cr(${ mh.usedPercent.toFixed(1) } %) </td>
                        < td > <strong>${ mh.workdayAverageCredits.toFixed(2) } cr / d < /strong></td >
                          <td>${ mh.workHourAverageCredits.toFixed(2) } cr / hr </td>
                            < td >
                            <span class="pill pill-orange" > ${ mh.expensive40to60 } (40 - 60 %) </span>
                              < span class="pill pill-red" > ${ mh.expensiveOver60 } (& gt; 60 %) </span>
                </td>
                < td > <code>${ escapeHtml(mh.topModel)
            }</code></td >
            <td><span class="pill ${balColor}" > ${ balText } < /span></td >
            <td>
            ${
              mh.isSelected
                ? '<span class="muted">Selected</span>'
                : `<button onclick="selectMonth('${mh.monthKey}')" style="padding:3px 8px;font-size:11px;">Inspect Month</button>`
            }
            ${
              mh.isSelected
                ? '<span class="muted">Selected</span>'
                : `<button onclick="selectMonth('${mh.monthKey}')" style="padding:3px 8px;font-size:11px;">Inspect Month</button>`
            }
            ${
              mh.isSelected
                ? '<span class="muted">Selected</span>'
                : `<button onclick="selectMonth('${mh.monthKey}')" style="padding:3px 8px;font-size:11px;">Inspect Month</button>`
            }
            </td>
            </tr>
              `;
      })
      .join('');
  })
  .join('');
    })
    .join('');

const expensiveDaysRows = snap.dailySeries
  .filter(d => d.totalExpensiveChats > 0)
  .sort((a, b) => b.dayOfMonth - a.dayOfMonth)
  .map(
    d => `
  const expensiveDaysRows = snap.dailySeries
            .filter(d => d.totalExpensiveChats > 0)
            .sort((a, b) => b.dayOfMonth - a.dayOfMonth)
            .map(
              d => `
      < tr >
      <td><strong>${d.dateStr} < /strong> <span class="muted">(${d.weekdayName})</span > </td>
      < td > <span class="pill pill-orange" > ${d.expensiveChats40to60} chats < /span></td >
  <td><span class="pill pill-red" > ${d.expensiveChatsOver60} chats < /span></td >
  <td><strong>${d.totalExpensiveChats} < /strong> / ${d.sessionsCount} total </td>
  < td > ${d.credits.toFixed(2)} cr(${d.dailyPercent.toFixed(0)} %) </td>
  < td class= "muted" > ${escapeHtml(d.topSessionTitle || '-')} (${(d.topSessionPercent || 0).toFixed(0)}%)</td>
    </tr>
      `
            )
            .join('');
          <tr>
            <td><strong>${ d.dateStr } </strong> <span class="muted">(${d.weekdayName})</span > </td>
              < td > <span class="pill pill-orange" > ${ d.expensiveChats40to60 } chats < /span></td >
                <td><span class="pill pill-red" > ${ d.expensiveChatsOver60 } chats < /span></td >
                  <td><strong>${ d.totalExpensiveChats } </strong> / ${ d.sessionsCount } total </td>
                    < td > ${ d.credits.toFixed(2) } cr(${ d.dailyPercent.toFixed(0) } %) </td>
                      < td class="muted" > ${ escapeHtml(d.topSessionTitle || '-') } (${ (d.topSessionPercent || 0).toFixed(0) }%)</td>
                        </tr>
                          `
    )
    .join('');

          const topSessionsRows = snap.topExpensiveSessions
            .map((s, idx) => {
              const badge =
                s.expenseTier === 'mega-60plus'
                  ? `< span class="pill pill-red" >& gt;${ config.expensiveSessionMaxPercent }% Mega(${ s.dailyLimitPercent.toFixed(0) } %) </span>`
                  : s.expenseTier === 'heavy-40-60'
            ? `<span class="pill pill-orange">${config.expensiveSessionMinPercent}-${config.expensiveSessionMaxPercent}% Heavy (${s.dailyLimitPercent.toFixed(0)}%)</span>`
            : `<span class="pill pill-green">${s.dailyLimitPercent.toFixed(0)}% Daily</span>`;
          const topSessionsRows = snap.topExpensiveSessions
            .map((s, idx) => {
              const badge =
                s.expenseTier === 'mega-60plus'
                  ? `<span class="pill pill-red">&gt;${config.expensiveSessionMaxPercent}% Mega (${s.dailyLimitPercent.toFixed(0)}%)</span>`
                  : s.expenseTier === 'heavy-40-60'
                    ? `<span class="pill pill-orange">${config.expensiveSessionMinPercent}-${config.expensiveSessionMaxPercent}% Heavy (${s.dailyLimitPercent.toFixed(0)}%)</span>`
                    : `<span class="pill pill-green">${s.dailyLimitPercent.toFixed(0)}% Daily</span>`;
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
                  const bloatBadge = s.hasContextBloat
                    ? `<span class="pill pill-yellow" title="Over 20 turns or 60k cumulative tokens — high context re-send tax">⚠️ Context Bloat</span>`
                    : '';
                  const bloatBadge = s.hasContextBloat
                    ? `<span class="pill pill-yellow" title="Over 20 turns or 60k cumulative tokens — high context re-send tax">⚠️ Context Bloat</span>`
                    : '';

                  const modelsText = Object.entries(s.modelsUsed)
                    .map(([m, st]) => `${escapeHtml(m)} (${st.messages})`)
                    .join(', ');
                  const modelsText = Object.entries(s.modelsUsed)
                    .map(([m, st]) => `${escapeHtml(m)} (${st.messages})`)
                    .join(', ');
                  const modelsText = Object.entries(s.modelsUsed)
                    .map(([m, st]) => `${escapeHtml(m)} (${st.messages})`)
                    .join(', ');

                  return `
      const crossMonthNote =
        s.totalSessionCredits !== undefined && s.totalSessionCredits > s.credits + 0.01
          ? `< div class="muted" style = "font-size:11px;" > Whole session: ${ s.totalSessionCredits.toFixed(2) } cr(${ s.totalSessionMessages ?? s.messages } turns) </div>`
                    ? `<div class="muted" style="font-size:11px;">Whole session: ${s.totalSessionCredits.toFixed(2)} cr (${s.totalSessionMessages ?? s.messages} turns)</div>`
                    : '';

                  return `
      return `
                    < tr >
                    <td>#${ idx + 1 } </td>
                      < td >
                      <div style="font-weight:600;" > ${ escapeHtml(s.title) } </div>
                        < div class="muted" style = "font-size:11px;" > ${ modelsText } </div>
                          </td>
                          < td > <span class="ws-tag" > ${ escapeHtml(s.workspaceName) } </span></td >
                            <td>${ s.dateStr } <span class="muted" >· ${ s.durationMinutes } m < /span></td >
                              <td>${ s.messages } turns ${ bloatBadge } </td>
                                < td > <strong>${ s.credits.toFixed(2) } cr < /strong> <span class="muted">(~${(s.cumulativeContextTokens / 1000).toFixed(1)
            }k ctx tok) < /span></td >
            <td>
            <strong>${ s.credits.toFixed(2)
        } cr < /strong> <span class="muted">(~${(s.cumulativeContextTokens / 1000).toFixed(1)
      }k ctx tok)</span>
            ${ crossMonthNote }
      </td>
        < td > ${ badge } </td>
          </tr>
            `;
            })
            .join('');
    })
    .join('');

const modelsRows = snap.models
  .map(
    m => `
      const modelsRows = snap.models
        .map(m => {
          const isExternal = m.model.startsWith('External') && m.messages === 0;
          const rateBadge = isExternal ? `< span class= "muted" > -</span>` : `<span class="ws-tag">${m.multiplier} cr/msg </span>`;
          const msgText = isExternal ? '-' : String(m.messages);
          return `
      const rateBadge = isExternal ? `< span class="muted" > -</span>` : `<span class="ws-tag">${m.multiplier} cr/msg </span>`;
          const msgText = isExternal ? '-' : String(m.messages);
          return `
      <tr>
        <td><strong>${escapeHtml(m.model)}</strong></td>
        <td><span class="ws-tag">${m.multiplier}x cr/msg</span></td>
        <td>${m.messages}</td>
        <td>${rateBadge}</td>
        <td>${msgText}</td>
        <td><strong>${m.credits.toFixed(2)} cr</strong></td>
        <td>${m.estimatedTokens > 0 ? `~${(m.estimatedTokens / 1000).toFixed(1)}k` : '-'}</td>
        <td style="min-width:140px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="progress-track" style="flex:1;height:8px;">
              <div class="progress-fill" style="width:${Math.min(100, m.percentOfCredits)}%;background:#38bdf8;"></div>
              <div class="progress-fill" style="width:${Math.min(100, m.percentOfCredits)}%;background:var(--accent);"></div>
            </div>
            <span style="font-size:11px;width:38px;text-align:right;">${m.percentOfCredits.toFixed(1)}%</span>
          </div>
        </td>
      </tr>
    `
            )
        .join('');
      `;
    `;
    })
    .join('');

    const workspaceRows = snap.workspaces
      .map(
        w => `
const workspaceRows = snap.workspaces
  .map(
    w => `
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
    )
    .join('');

    const monthOptionsHtml = historyComp.monthsHistory
      .map(
        mh =>
          `<option value="${mh.monthKey}" ${mh.isSelected ? 'selected' : ''}>${mh.label}${mh.isCurrentMonth ? ' (Current)' : ''}</option>`
      )
      .reverse()
      .join('');
    const monthOptionsHtml = historyComp.monthsHistory
      .map(
        mh =>
          `<option value="${mh.monthKey}" ${mh.isSelected ? 'selected' : ''}>${mh.label}${mh.isCurrentMonth ? ' (Current)' : ''}</option>`
      )
      .reverse()
      .join('');
    const monthOptionsHtml = historyComp.monthsHistory
      .map(
        mh =>
          `<option value="${mh.monthKey}" ${mh.isSelected ? 'selected' : ''}>${mh.label}${mh.isCurrentMonth ? ' (Current)' : ''}</option>`
      )
      .reverse()
      .join('');

    const momDeltaSign = historyComp.momSameDayDeltaCredits >= 0 ? '+' : '';
    const momDeltaColor = historyComp.momSameDayDeltaCredits > 0 ? 'var(--orange)' : 'var(--green)';
    const momDeltaSign = historyComp.momSameDayDeltaCredits >= 0 ? '+' : '';
    const momDeltaColor = historyComp.momSameDayDeltaCredits > 0 ? 'var(--orange)' : 'var(--green)';
    const momDeltaSign = historyComp.momSameDayDeltaCredits >= 0 ? '+' : '';
    const momDeltaColor = historyComp.momSameDayDeltaCredits > 0 ? 'var(--orange)' : 'var(--green)';
    const statusColorVar = `var(--${snap.colorTier})`;

    return `<!DOCTYPE html>
  return `< !DOCTYPE html >
      <html lang="en" >
        <head>
        <meta charset="UTF-8" />
          <meta name="viewport" content = "width=device-width, initial-scale=1.0" />
            <title>Copilot Credit & Token Analytics </title>
              <style>
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
  --purple: #a855f7;
  --green: #22c55e;
  --yellow: #eab308;
  --orange: #f97316;
  --red: #ef4444;
}
    * { box- sizing: border - box; }
      color-scheme: dark;
      --bg: #0f172a;
      --card: #1e293b;
      --input-bg: #0f172a;
      --track-bg: #0f172a;
      --border: #334155;
      --row-border: rgba(148, 163, 184, 0.14);
      --text: #f8fafc;
      --subtext: #cbd5e1;
      --muted: #94a3b8;
      --btn-bg: #334155;
      --btn-hover: #475569;
      --btn-border: #475569;
      --btn-text: #f8fafc;
      --accent: #38bdf8;
      --purple: #a855f7;
      --green: #22c55e;
      --yellow: #eab308;
      --orange: #f97316;
      --red: #ef4444;
      --pill-green-fg: #4ade80;
      --pill-yellow-fg: #facc15;
      --pill-orange-fg: #fb923c;
      --pill-red-fg: #f87171;
      --ws-tag-fg: #7dd3fc;
      --chart-axis: #334155;
      --chart-label: #94a3b8;
      --chart-value: #e2e8f0;
      --chart-empty: rgba(148, 163, 184, 0.25);
      --chart-future: rgba(148, 163, 184, 0.10);
      --chart-cap: rgba(148, 163, 184, 0.12);
      --selected-stroke: #f8fafc;
    }
    body.vscode-light:not([data-theme="dark"]),
    body.vscode-high-contrast-light:not([data-theme="dark"]),
    body[data-theme="light"] {
      color-scheme: light;
      --bg: #f8fafc;
      --card: #ffffff;
      --input-bg: #f8fafc;
      --track-bg: #e2e8f0;
      --border: #cbd5e1;
      --row-border: rgba(100, 116, 139, 0.18);
      --text: #0f172a;
      --subtext: #334155;
      --muted: #64748b;
      --btn-bg: #f1f5f9;
      --btn-hover: #e2e8f0;
      --btn-border: #cbd5e1;
      --btn-text: #0f172a;
      --accent: #0284c7;
      --purple: #9333ea;
      --green: #16a34a;
      --yellow: #ca8a04;
      --orange: #ea580c;
      --red: #dc2626;
      --pill-green-fg: #15803d;
      --pill-yellow-fg: #a16207;
      --pill-orange-fg: #c2410c;
      --pill-red-fg: #b91c1c;
      --ws-tag-fg: #0369a1;
      --chart-axis: #cbd5e1;
      --chart-label: #64748b;
      --chart-value: #1e293b;
      --chart-empty: rgba(100, 116, 139, 0.22);
      --chart-future: rgba(100, 116, 139, 0.10);
      --chart-cap: rgba(100, 116, 139, 0.14);
      --selected-stroke: #0f172a;
    }
    * { box-sizing: border-box; }
    body {
  margin: 0;
  padding: 20px 24px 40px;
  font - family: -apple - system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans - serif;
  background: var(--bg);
  color: var(--text);
  line - height: 1.45;
}
      margin: 0;
      padding: 20px 24px 40px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.45;
    }
    .header {
  display: flex;
  justify - content: space - between;
  align - items: center;
  flex - wrap: wrap;
  gap: 12px;
  margin - bottom: 20px;
  padding - bottom: 14px;
  border - bottom: 1px solid var(--border);
}
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
  font - size: 20px;
  display: flex;
  align - items: center;
  gap: 10px;
  flex - wrap: wrap;
}
    .btn - group { display: flex; gap: 8px; flex - wrap: wrap; align - items: center; }
      margin: 0;
      font-size: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .btn-group { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    button {
  background: #334155;
  color: #f8fafc;
  border: 1px solid #475569;
  border - radius: 6px;
  padding: 6px 12px;
  font - size: 12px;
  font - weight: 600;
  cursor: pointer;
}
button:hover { background: #475569; }
button.primary { background: #0284c7; border - color: #38bdf8; }
button.primary:hover { background: #0369a1; }
    .month - switcher {
  display: inline - flex;
  align - items: center;
  gap: 6px;
  background: #1e293b;
  border: 1px solid #475569;
  padding: 4px 8px;
  border - radius: 8px;
}
    .kpi - grid {
  display: grid;
  grid - template - columns: repeat(auto - fit, minmax(220px, 1fr));
  gap: 14px;
  margin - bottom: 20px;
}
      background: var(--btn-bg);
      color: var(--btn-text);
      border: 1px solid var(--btn-border);
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover { background: var(--btn-hover); }
    button.primary { background: #0284c7; color: #ffffff; border-color: #0284c7; }
    button.primary:hover { background: #0369a1; border-color: #0369a1; }
    .month-switcher {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--card);
      border: 1px solid var(--btn-border);
      padding: 4px 8px;
      border-radius: 8px;
    }
    .month-switcher option {
      background: var(--card);
      color: var(--text);
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
      margin-bottom: 20px;
    }
    .card {
  background: var(--card);
  border: 1px solid var(--border);
  border - radius: 10px;
  padding: 16px;
}
    .card - title {
  font - size: 12px;
  text - transform: uppercase;
  letter - spacing: 0.05em;
  color: var(--muted);
  margin - bottom: 6px;
  font - weight: 600;
}
    .big - num {
  font - size: 26px;
  font - weight: 700;
  margin: 4px 0;
}
    .sub - row {
  font - size: 12px;
  color: var(--muted);
  display: flex;
  justify - content: space - between;
  margin - top: 5px;
}
    .progress - track {
  width: 100 %;
  height: 10px;
  background: #0f172a;
  border - radius: 99px;
  overflow: hidden;
  margin: 8px 0;
}
    .progress - fill {
  height: 100 %;
  border - radius: 99px;
  transition: width 0.3s ease;
}
    .charts - grid {
  display: grid;
  grid - template - columns: repeat(auto - fit, minmax(360px, 1fr));
  gap: 16px;
  margin - bottom: 20px;
}
    .section - title {
  font - size: 15px;
  font - weight: 700;
  margin: 0 0 12px 0;
  display: flex;
  justify - content: space - between;
  align - items: center;
  flex - wrap: wrap;
  gap: 8px;
}
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
    .sub-row strong { color: var(--text); }
    .progress-track {
      width: 100%;
      height: 10px;
      background: var(--track-bg);
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
      flex-wrap: wrap;
      gap: 8px;
    }
    table {
  width: 100 %;
  border - collapse: collapse;
  font - size: 12.5px;
}
th, td {
  text - align: left;
  padding: 9px 10px;
  border - bottom: 1px solid rgba(148, 163, 184, 0.14);
}
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
    }
    th, td {
      text-align: left;
      padding: 9px 10px;
      border-bottom: 1px solid var(--row-border);
    }
    th {
  color: var(--muted);
  font - weight: 600;
  font - size: 11.5px;
  text - transform: uppercase;
}
      color: var(--muted);
      font-weight: 600;
      font-size: 11.5px;
      text-transform: uppercase;
    }
    .muted { color: var(--muted); }
    .pill {
  display: inline - block;
  padding: 2px 8px;
  border - radius: 99px;
  font - size: 11px;
  font - weight: 600;
}
    .pill - green { background: rgba(34, 197, 94, 0.18); color: #4ade80; }
    .pill - yellow { background: rgba(234, 179, 8, 0.18); color: #facc15; }
    .pill - orange { background: rgba(249, 115, 22, 0.2); color: #fb923c; }
    .pill - red { background: rgba(239, 68, 68, 0.22); color: #f87171; }
    .ws - tag {
  background: rgba(56, 189, 248, 0.14);
  color: #7dd3fc;
  padding: 2px 7px;
  border - radius: 5px;
  font - size: 11px;
}
    .insights - list {
  margin: 0;
  padding - left: 18px;
  font - size: 13px;
}
    .insights - list li { margin - bottom: 6px; }
    .form - row {
  display: flex;
  flex - wrap: wrap;
  gap: 12px;
  align - items: flex - end;
}
    .form - field {
  display: flex;
  flex - direction: column;
  gap: 4px;
  font - size: 11.5px;
  color: var(--muted);
}
input, select {
  background: #0f172a;
  border: 1px solid var(--border);
  color: var(--text);
  padding: 6px 9px;
  border - radius: 6px;
  font - size: 12.5px;
}
    svg { width: 100 %; height: auto; display: block; }
</style>
  </head>
  < body >
  <div class="header" >
      display: inline-block;
      padding: 2px 8px;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 600;
    }
    .pill-green { background: rgba(34, 197, 94, 0.16); color: var(--pill-green-fg); }
    .pill-yellow { background: rgba(234, 179, 8, 0.18); color: var(--pill-yellow-fg); }
    .pill-orange { background: rgba(249, 115, 22, 0.18); color: var(--pill-orange-fg); }
    .pill-red { background: rgba(239, 68, 68, 0.18); color: var(--pill-red-fg); }
    .ws-tag {
      background: rgba(56, 189, 248, 0.14);
      color: var(--ws-tag-fg);
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
      gap: 12px;
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
      background: var(--input-bg);
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
    <span>Copilot Credit & Session Analytics </span>
      < span class="pill" style = "background:${snap.widgetBgHex};color:${snap.widgetFgHex};padding:3px 10px;" >
        ${isViewingCurrentMonth ? 'Today' : snap.calendar.monthName}: ${snap.activeDailyPercent.toFixed(1)}% (${snap.colorTier.toUpperCase()})
</span>
  </h1>
  < div class="muted" style = "font-size:12px;margin-top:4px;" >
    <strong>${snap.calendar.monthName} ${snap.calendar.year} </strong> · ${snap.calendar.totalWorkdays} Workdays (${snap.calendar.elapsedWorkdays} elapsed, ${snap.calendar.remainingWorkdays} remaining)
        · Mined < strong > ${snap.minedSessionsCount} </strong> local chat session(s) across <strong>${snap.minedWorkspacesCount}</strong > workspace(s)
        ${snap.apiQuota?.login ? ` · GitHub: <strong>@${escapeHtml(snap.apiQuota.login)}</strong> (${escapeHtml(snap.apiQuota.plan || 'Copilot')})` : ''}
</div>
      <h1>
        <span>Copilot Credit & Session Analytics</span>
        <span class="pill" style="background:${snap.widgetBgHex};color:${snap.widgetFgHex};padding:3px 10px;">
          ${isViewingCurrentMonth ? 'Today' : snap.calendar.monthName}: ${snap.activeDailyPercent.toFixed(1)}% (${snap.colorTier.toUpperCase()})
        </span>
      </h1>
      <div class="muted" style="font-size:12px;margin-top:4px;">
        <strong>${snap.calendar.monthName} ${snap.calendar.year}</strong> · ${snap.calendar.totalWorkdays} Workdays (${snap.calendar.elapsedWorkdays} elapsed, ${snap.calendar.remainingWorkdays} remaining)
        · Mined <strong>${snap.minedSessionsCount}</strong> local chat session(s) across <strong>${snap.minedWorkspacesCount}</strong> workspace(s)
        ${snap.apiQuota?.login ? ` · GitHub: <strong>@${escapeHtml(snap.apiQuota.login)}</strong> (${escapeHtml(snap.apiQuota.plan || 'Copilot')})` : ''}
      </div>
    </div>

    <div class="btn-group">
      <div class="month-switcher">
        <button onclick="stepMonth(-1)" title="Previous Month" style="padding:4px 8px;">◀ Prev</button>
        <select id="monthSelect" onchange="selectMonth(this.value)" style="border:none;background:transparent;font-weight:700;">
          ${monthOptionsHtml}
        </select>
        <button onclick="stepMonth(1)" title="Next Month" style="padding:4px 8px;" ${isViewingCurrentMonth ? 'disabled style="opacity:0.4;cursor:default;padding:4px 8px;"' : ''}>Next ▶</button>
      </div>
      <button id="themeBtn" onclick="toggleTheme()" title="Toggle Light / Dark mode (follows VS Code theme by default)">🌓 Theme</button>
      <button onclick="sendMsg({type:'export'})">📥 Export CSV / JSON</button>
      <button class="primary" onclick="sendMsg({type:'refresh'})">🔄 Refresh</button>
    </div>
  </div>

  < div class="btn-group" >
    <div class="month-switcher" >
      <button onclick="stepMonth(-1)" title = "Previous Month" style = "padding:4px 8px;" >◀ Prev </button>
        < select id = "monthSelect" onchange = "selectMonth(this.value)" style = "border:none;background:transparent;font-weight:700;" >
          ${monthOptionsHtml}
</select>
  < button onclick = "stepMonth(1)" title = "Next Month" style = "padding:4px 8px;" ${isViewingCurrentMonth ? 'disabled style="opacity:0.4;cursor:default;padding:4px 8px;"' : ''}> Next ▶</button>
  <!-- 5 Core KPI Cards -->
  <div class="kpi-grid">
    <div class="card" style="border-color:${snap.colorHex}88;">
      <div class="card-title">1. ${isViewingCurrentMonth ? "Today's Daily Limit" : 'Last Day Limit'} (${config.dailyPercentMode})</div>
      <div class="big-num" style="color:${statusColorVar};">
        ${snap.activeDailyPercent.toFixed(1)}%
        <span style="font-size:14px;font-weight:500;color:var(--muted);">(${snap.todayUsedCredits.toFixed(2)} cr)</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${Math.min(100, snap.activeDailyPercent)}%;background:${statusColorVar};"></div>
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
    < button onclick = "sendMsg({type:'export'})" >📥 Export CSV / JSON </button>
      < button class="primary" onclick = "sendMsg({type:'refresh'})" >🔄 Refresh </button>
        </div>
        </div>

        < !--5 Core KPI Cards-- >
          <div class="kpi-grid" >
            <div class="card" style = "border-color:${snap.colorHex}88;" >
              <div class="card-title" > 1. ${isViewingCurrentMonth ? "Today's Daily Limit" : 'Last Day Limit'} (${config.dailyPercentMode})</div>
                < div class="big-num" style = "color:${snap.colorHex};" >
                  ${snap.activeDailyPercent.toFixed(1)}%
                    <span style="font-size:14px;font-weight:500;color:var(--muted);" > (${snap.todayUsedCredits.toFixed(2)} cr)</span>
                      </div>
                      < div class="progress-track" >
                        <div class="progress-fill" style = "width:${Math.min(100, snap.activeDailyPercent)}%;background:${snap.colorHex};" > </div>
                          </div>
                          < div class="sub-row" >
                            <span>Base Daily Limit: </span>
                              < strong > ${snap.recommendedDailyLimit.toFixed(2)} cr / day </strong>
                                </div>
                                < div class="sub-row" >
                                  <span>Adjusted Limit(w / Extra & Debt): </span>
                                    < strong > ${snap.effectiveDailyLimit.toFixed(2)} cr / day </strong>
                                      </div>
                                      </div>
    <div class="card">
      <div class="card-title">2. ${snap.calendar.monthName} Credits & Workdays</div>
      <div class="big-num">
        ${snap.totalUsedCredits.toFixed(1)} <span style="font-size:15px;color:var(--muted);">/ ${snap.totalMonthlyCredits} cr</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${Math.min(100, snap.monthlyUsedPercent)}%;background:var(--accent);"></div>
      </div>
      <div class="sub-row">
        <span>vs. ${historyComp.previousMonthLabel} (Day ${Math.min(snap.calendar.currentDay, prevSnap.calendar.daysInMonth)}):</span>
        <strong style="color:${momDeltaColor};">${momDeltaSign}${historyComp.momSameDayDeltaCredits.toFixed(1)} cr (${momDeltaSign}${historyComp.momSameDayDeltaPercent.toFixed(0)}%)</strong>
      </div>
      <div class="sub-row">
        <span>Remaining Credits:</span>
        <strong>${snap.remainingMonthlyCredits.toFixed(1)} cr (${snap.calendar.remainingWorkdays} workdays)</strong>
      </div>
    </div>

                                      < div class="card" >
                                        <div class="card-title" > 2. ${snap.calendar.monthName} Credits & Workdays </div>
                                          < div class="big-num" >
                                            ${snap.totalUsedCredits.toFixed(1)} <span style="font-size:15px;color:var(--muted);" > / ${snap.totalMonthlyCredits} cr</span >
                                              </div>
                                              < div class="progress-track" >
                                                <div class="progress-fill" style = "width:${Math.min(100, snap.monthlyUsedPercent)}%;background:#38bdf8;" > </div>
                                                  </div>
                                                  < div class="sub-row" >
                                                    <span>vs.${historyComp.previousMonthLabel} (Day ${Math.min(snap.calendar.currentDay, prevSnap.calendar.daysInMonth)}): </span>
                                                      < strong style = "color:${momDeltaColor};" > ${momDeltaSign}${historyComp.momSameDayDeltaCredits.toFixed(1)} cr(${momDeltaSign}${historyComp.momSameDayDeltaPercent.toFixed(0)} %) </strong>
                                                        </div>
                                                        < div class="sub-row" >
                                                          <span>Remaining Credits: </span>
                                                            < strong > ${snap.remainingMonthlyCredits.toFixed(1)} cr(${snap.calendar.remainingWorkdays} workdays) </strong>
                                                              </div>
                                                              </div>
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

                                                              < div class="card" >
                                                                <div class="card-title" > 3. Extra Credits & Credit Debt </div>
                                                                  < div class="big-num" style = "color:${snap.creditDebt > 0 ? 'var(--red)' : 'var(--green)'};" >
                                                                    ${snap.creditDebt > 0 ? `-${snap.creditDebt.toFixed(2)} Debt` : `+${snap.rolloverExtraCredits.toFixed(2)} Extra`}
</div>
  < div class="sub-row" >
    <span>Expected Used Before Today: </span>
      < strong > ${snap.expectedUsedBeforeToday.toFixed(1)} cr(${snap.calendar.pastWorkdays}d) </strong>
        </div>
        < div class="sub-row" >
          <span>Actual Used Before Today: </span>
            < strong > ${snap.usedBeforeToday.toFixed(1)} cr </strong>
              </div>
              < div class="sub-row" >
                <span>Purchased Extra Credits: </span>
                  < strong > +${snap.extraCredits.toFixed(1)} cr </strong>
                    </div>
                    </div>
    <div class="card">
      <div class="card-title">4. Usage Averages (${snap.calendar.monthName})</div>
      <div class="big-num" style="color:var(--accent);">
        ${snap.workdayAverageCredits.toFixed(2)} <span style="font-size:14px;color:var(--muted);">cr / workday</span>
      </div>
      <div class="sub-row">
        <span>Weekly Average:</span>
        <strong>${snap.weeklyAverageCredits.toFixed(1)} cr/wk (${snap.weeklyAverageMessages.toFixed(0)} msgs)</strong>
      </div>
      <div class="sub-row">
        <span>Work Day Avg (vs Prev Month):</span>
        <strong>${snap.workdayAverageCredits.toFixed(2)} cr (${historyComp.momWorkdayAvgDeltaCredits >= 0 ? '+' : ''}${historyComp.momWorkdayAvgDeltaCredits.toFixed(2)})</strong>
      </div>
      <div class="sub-row">
        <span>Work Hour Average (${config.workHoursPerDay}h/day):</span>
        <strong>${snap.workHourAverageCredits.toFixed(2)} cr/hr (${snap.workHourAverageMessages.toFixed(2)} msgs/hr)</strong>
      </div>
    </div>

                    < div class="card" >
                      <div class="card-title" > 4. Usage Averages(${snap.calendar.monthName}) </div>
                        < div class="big-num" style = "color:#38bdf8;" >
                          ${snap.workdayAverageCredits.toFixed(2)} <span style="font-size:14px;color:var(--muted);" > cr / workday </span>
                            </div>
                            < div class="sub-row" >
                              <span>Weekly Average: </span>
                                < strong > ${snap.weeklyAverageCredits.toFixed(1)} cr / wk(${snap.weeklyAverageMessages.toFixed(0)} msgs) </strong>
                                  </div>
                                  < div class="sub-row" >
                                    <span>Work Day Avg(vs Prev Month): </span>
                                      < strong > ${snap.workdayAverageCredits.toFixed(2)} cr(${historyComp.momWorkdayAvgDeltaCredits >= 0 ? '+' : ''}${historyComp.momWorkdayAvgDeltaCredits.toFixed(2)}) </strong>
                                        </div>
                                        < div class="sub-row" >
                                          <span>Work Hour Average(${config.workHoursPerDay}h / day): </span>
                                            < strong > ${snap.workHourAverageCredits.toFixed(2)} cr / hr(${snap.workHourAverageMessages.toFixed(2)} msgs / hr) </strong>
                                              </div>
                                              </div>

                                              < div class="card" >
                                                <div class="card-title" > 5. Expensive Chats(40–60 % + Limit) </div>
                                                  < div class="big-num" style = "color:${snap.monthTotalExpensiveChats > 0 ? 'var(--orange)' : 'var(--green)'};" >
                                                    ${snap.monthTotalExpensiveChats} in ${snap.calendar.monthName.slice(0, 3)}
<span style="font-size:14px;color:var(--muted);" > (Prev: ${prevSnap.monthTotalExpensiveChats})</span>
    <div class="card">
      <div class="card-title">5. Expensive Chats (40–60%+ Limit)</div>
      <div class="big-num" style="color:${snap.monthTotalExpensiveChats > 0 ? 'var(--orange)' : 'var(--green)'};">
        ${snap.monthTotalExpensiveChats} in ${snap.calendar.monthName.slice(0, 3)}
        <span style="font-size:14px;color:var(--muted);">(Prev: ${prevSnap.monthTotalExpensiveChats})</span>
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
  < div class="sub-row" >
    <span>40–60 % Daily Limit Chats: </span>
      < strong > ${snap.todayExpensive40to60} today · ${snap.monthExpensive40to60} month </strong>
        </div>
        < div class="sub-row" >
          <span>& gt; 60 % Mega Chats: </span>
            < strong > ${snap.todayExpensiveOver60} today · ${snap.monthExpensiveOver60} month </strong>
              </div>
              < div class="sub-row" >
                <span>Avg Session / Context Bloat: </span>
                  < strong > ${snap.avgCreditsPerSession.toFixed(2)} cr / chat · ${snap.contextBloatSessionsCount} bloated </strong>
                    </div>
                    </div>
                    </div>

                    < !--Daily & Cumulative Burn - Up Graphs-- >
                      <div class="charts-grid" >
                        <div class="card" >
                          <div class="section-title" >
                            <span>📊 ${snap.calendar.monthName} Daily Usage vs.Daily Limit(${snap.recommendedDailyLimit.toFixed(1)} cr) </span>
                              < span class="muted" style = "font-size:11px;" > Circles above bars = Expensive Chats(& ge;${config.expensiveSessionMinPercent}% limit)</span>
                                </div>
                                < svg viewBox = "0 0 ${chartW} ${chartH}" >
                                  <line x1="${padL}" y1 = "${padT + plotH}" x2 = "${chartW - padR}" y2 = "${padT + plotH}" stroke = "#334155" stroke - width="1" />
                                    <line x1="${padL}" y1 = "${limitY.toFixed(1)}" x2 = "${chartW - padR}" y2 = "${limitY.toFixed(1)}" stroke = "#38bdf8" stroke - width="1.5" stroke - dasharray="5,4" />
                                      <text x="${chartW - padR - 4}" y = "${Math.max(12, limitY - 5).toFixed(1)}" text - anchor="end" fill = "#38bdf8" font - size="10" font - weight="600" >
                                        Daily Limit: ${snap.recommendedDailyLimit.toFixed(1)} cr
                                          </text>
        ${dailyBarsSvg}
</svg>
  </div>
  <!-- Daily & Cumulative Burn-Up Graphs -->
  <div class="charts-grid">
    <div class="card">
      <div class="section-title">
        <span>📊 ${snap.calendar.monthName} Daily Usage vs. Daily Limit (${snap.recommendedDailyLimit.toFixed(1)} cr)</span>
        <span class="muted" style="font-size:11px;">Circles above bars = Expensive Chats (&ge;${config.expensiveSessionMinPercent}% limit)</span>
      </div>
      <svg viewBox="0 0 ${chartW} ${chartH}">
        <line x1="${padL}" y1="${padT + plotH}" x2="${chartW - padR}" y2="${padT + plotH}" stroke="var(--chart-axis)" stroke-width="1" />
        <line x1="${padL}" y1="${limitY.toFixed(1)}" x2="${chartW - padR}" y2="${limitY.toFixed(1)}" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="5,4" />
        <text x="${chartW - padR - 4}" y="${Math.max(12, limitY - 5).toFixed(1)}" text-anchor="end" fill="var(--accent)" font-size="10" font-weight="600">
          Daily Limit: ${snap.recommendedDailyLimit.toFixed(1)} cr
        </text>
        ${dailyBarsSvg}
      </svg>
    </div>

  < div class="card" >
    <div class="section-title" >
      <span>📈 ${snap.calendar.monthName} Cumulative Burn - Up vs.Workday Budget </span>
        < span class="muted" style = "font-size:11px;" > Dashed = Ideal Workday Pace · Solid = Local Chats </span>
          </div>
          < svg viewBox = "0 0 ${chartW} ${chartH}" >
            <line x1="${padL}" y1 = "${padT + plotH}" x2 = "${chartW - padR}" y2 = "${padT + plotH}" stroke = "#334155" stroke - width="1" />
              <polyline fill="none" stroke = "#64748b" stroke - width="2" stroke - dasharray="5,4" points = "${budgetPoints.join(' ')}" />
                ${actualPoints.length > 1 ? `<polyline fill="none" stroke="${snap.creditDebt > 0 ? '#ef4444' : '#22c55e'}" stroke-width="2.8" points="${actualPoints.join(' ')}" />` : ''}
        ${liveApiDotSvg}
<text x="${padL + 6}" y = "${padT + 14}" fill = "#94a3b8" font - size="11" >
  Monthly Cap: ${snap.totalMonthlyCredits} cr | Used: ${snap.totalUsedCredits.toFixed(1)} cr | Projected EOM: ${snap.projectedMonthlyCredits.toFixed(1)} cr
    </text>
    </svg>
    <div class="card">
      <div class="section-title">
        <span>📈 ${snap.calendar.monthName} Cumulative Burn-Up vs. Workday Budget</span>
        <span class="muted" style="font-size:11px;">Dashed = Ideal Workday Pace · Solid = Local Chats</span>
      </div>
      <svg viewBox="0 0 ${chartW} ${chartH}">
        <line x1="${padL}" y1="${padT + plotH}" x2="${chartW - padR}" y2="${padT + plotH}" stroke="var(--chart-axis)" stroke-width="1" />
        <polyline fill="none" stroke="#64748b" stroke-width="2" stroke-dasharray="5,4" points="${budgetPoints.join(' ')}" />
        ${actualPoints.length > 1 ? `<polyline fill="none" stroke="${snap.creditDebt > 0 ? 'var(--red)' : 'var(--green)'}" stroke-width="2.8" points="${actualPoints.join(' ')}" />` : ''}
        ${liveApiDotSvg}
        <text x="${padL + 6}" y="${padT + 14}" fill="var(--chart-label)" font-size="11">
          Monthly Cap: ${snap.totalMonthlyCredits} cr | Used: ${snap.totalUsedCredits.toFixed(1)} cr | Projected EOM: ${snap.projectedMonthlyCredits.toFixed(1)} cr
        </text>
      </svg>
    </div>
    </div>
  </div>

    < !--History Comparison Graphs-- >
      <div class="charts-grid" >
        <div class="card" style = "border-color:rgba(168,85,247,0.45);" >
          <div class="section-title" >
            <span>🔄 History Comparison: ${snap.calendar.monthName} vs.${hasPrevMonthActivity ? historyComp.previousMonthLabel : 'Ideal Budget Pace'} </span>
              < span class="muted" style = "font-size:11px;" >
                <span style="color:#38bdf8;font-weight:700;" >━ ${snap.calendar.monthName.slice(0, 3)} (${snap.totalUsedCredits.toFixed(1)} cr)</span> &nbsp;·&nbsp;
<span style="color:#a855f7;font-weight:700;" >┅ ${hasPrevMonthActivity ? `${historyComp.previousMonthLabel.slice(0, 3)} (${prevSnap.totalUsedCredits.toFixed(1)} cr)` : 'Ideal Workday Pace'} </span>
  </span>
  </div>
  < svg viewBox = "0 0 ${chartW} ${chartH}" >
    <line x1="${padL}" y1 = "${padT + plotH}" x2 = "${chartW - padR}" y2 = "${padT + plotH}" stroke = "#334155" stroke - width="1" />
      ${prevOrIdealCumPoints.length > 1 ? `<polyline fill="none" stroke="#a855f7" stroke-width="2.2" stroke-dasharray="6,4" points="${prevOrIdealCumPoints.join(' ')}" />` : ''}
        ${selectedCumPoints.length > 1 ? `<polyline fill="none" stroke="#38bdf8" stroke-width="3" points="${selectedCumPoints.join(' ')}" />` : ''}
        ${compareDayMarkersSvg.join('')}
<text x="${padL + 6}" y = "${padT + 14}" fill = "#cbd5e1" font - size="11" >
  ${hasPrevMonthActivity
      < !--History Comparison Graphs-- >
        <div class="charts-grid" >
          <div class="card" style = "border-color:rgba(168,85,247,0.45);" >
            <div class="section-title" >
              <span>🔄 History Comparison: ${ snap.calendar.monthName } vs.${ hasPrevMonthActivity ? historyComp.previousMonthLabel : 'Ideal Budget Pace' } </span>
                < span class="muted" style = "font-size:11px;" >
                  <span style="color:var(--accent);font-weight:700;" >━ ${ snap.calendar.monthName.slice(0, 3) } (${ snap.totalUsedCredits.toFixed(1) } cr)</span> &nbsp;·&nbsp;
    <span style="color:var(--purple);font-weight:700;" >┅ ${ hasPrevMonthActivity ? `${historyComp.previousMonthLabel.slice(0, 3)} (${prevSnap.totalUsedCredits.toFixed(1)} cr)` : 'Ideal Workday Pace' } </span>
      </span>
      </div>
      < svg viewBox = "0 0 ${chartW} ${chartH}" >
        <line x1="${padL}" y1 = "${padT + plotH}" x2 = "${chartW - padR}" y2 = "${padT + plotH}" stroke = "var(--chart-axis)" stroke - width="1" />
          ${ prevOrIdealCumPoints.length > 1 ? `<polyline fill="none" stroke="var(--purple)" stroke-width="2.2" stroke-dasharray="6,4" points="${prevOrIdealCumPoints.join(' ')}" />` : '' }
        ${ selectedCumPoints.length > 1 ? `<polyline fill="none" stroke="var(--accent)" stroke-width="3" points="${selectedCumPoints.join(' ')}" />` : '' }
        ${ compareDayMarkersSvg.join('') }
    <text x="${padL + 6}" y = "${padT + 14}" fill = "var(--subtext)" font - size="11" >
      ${
      hasPrevMonthActivity
        ? `Through Day ${Math.min(snap.calendar.currentDay, prevSnap.calendar.daysInMonth)}: ${snap.calendar.monthName.slice(0, 3)} = ${historyComp.sameDaySelectedCredits.toFixed(1)} cr vs ${historyComp.previousMonthLabel.slice(0, 3)} = ${historyComp.sameDayPreviousCredits.toFixed(1)} cr (${momDeltaSign}${historyComp.momSameDayDeltaCredits.toFixed(1)} cr)`
        : `No ${historyComp.previousMonthLabel} activity found — comparing ${snap.calendar.monthName} against your Ideal Workday Pace`
    }
  }
  </text>
    </svg>
    </div>
  hasPrevMonthActivity
    ? `Through Day ${Math.min(snap.calendar.currentDay, prevSnap.calendar.daysInMonth)}: ${snap.calendar.monthName.slice(0, 3)} = ${historyComp.sameDaySelectedCredits.toFixed(1)} cr vs ${historyComp.previousMonthLabel.slice(0, 3)} = ${historyComp.sameDayPreviousCredits.toFixed(1)} cr (${momDeltaSign}${historyComp.momSameDayDeltaCredits.toFixed(1)} cr)`
    : `No ${historyComp.previousMonthLabel} activity found — comparing ${snap.calendar.monthName} against your Ideal Workday Pace`
}
</text>
  </svg>
  </div>

  < div class="card" style = "border-color:rgba(56,189,248,0.4);" >
    <div class="section-title" >
      <span>🗓️ 6 - Month Credit History & Expensive Chats Comparison </span>
        < span class="muted" style = "font-size:11px;" > Click any month bar to view its full report </span>
          </div>
          < svg viewBox = "0 0 ${chartW} ${chartH}" >
            <line x1="${padL}" y1 = "${padT + plotH}" x2 = "${chartW - padR}" y2 = "${padT + plotH}" stroke = "#334155" stroke - width="1" />
              ${ multiMonthBarsSvg }
</svg>
  < div class="card" style = "border-color:rgba(56,189,248,0.4);" >
    <div class="section-title" >
      <span>🗓️ 6 - Month Credit History & Expensive Chats Comparison </span>
        < span class="muted" style = "font-size:11px;" > Click any month bar to view its full report </span>
          </div>
          < svg viewBox = "0 0 ${chartW} ${chartH}" >
            <line x1="${padL}" y1 = "${padT + plotH}" x2 = "${chartW - padR}" y2 = "${padT + plotH}" stroke = "var(--chart-axis)" stroke - width="1" />
              ${ multiMonthBarsSvg }
</svg>
  </div>
  </div>
  </div>

  < !--6 - Month Historical Statistics Table-- >
    <div class="card" style = "margin-bottom:20px;" >
      <div class="section-title" >
        <span>📚 Multi - Month History & Previous Month Statistics </span>
          < span class="muted" style = "font-size:12px;" > Compare monthly usage, workday averages, expensive sessions, and surplus / debt </span>
            </div>
            < table >
            <thead>
            <tr>
            <th>Month </th>
            < th > Workdays </th>
            < th > Credits Used / Cap </th>
              < th > Workday Avg </th>
                < th > Work Hour Avg </th>
                  < th > Expensive Chats </th>
                    < th > Top Model </th>
                      < th > End Balance </th>
                        < th > Action </th>
                        </tr>
                        </thead>
                        <tbody>
        ${ historyTableRows }
</tbody>
  </table>
  < !--6 - Month Historical Statistics Table-- >
    <div class="card" style = "margin-bottom:20px;" >
      <div class="section-title" >
        <span>📚 Multi - Month History & Previous Month Statistics </span>
          < span class="muted" style = "font-size:12px;" > Compare monthly usage, workday averages, expensive sessions, and surplus / debt </span>
            </div>
            < table >
            <thead>
            <tr>
            <th>Month </th>
            < th > Workdays </th>
            < th > Credits Used / Cap </th>
              < th > Workday Avg </th>
                < th > Work Hour Avg </th>
                  < th > Expensive Chats </th>
                    < th > Top Model </th>
                      < th > End Balance </th>
                        < th > Action </th>
                        </tr>
                        </thead>
                        <tbody>
        ${ historyTableRows }
</tbody>
  </table>
  </div>

  < div class="charts-grid" >
    <div class="card" >
      <div class="section-title" >
        <span>⏰ ${ snap.calendar.monthName } Usage by Hour of Day </span>
          < span class="muted" style = "font-size:11px;" > Active Coding Hour Avg: ${ snap.activeHourAverageCredits.toFixed(2) } cr / hr </span>
            </div>
            < svg viewBox = "0 0 ${chartW} ${chartH}" >
              <line x1="${padL}" y1 = "${padT + plotH}" x2 = "${chartW - padR}" y2 = "${padT + plotH}" stroke = "#334155" stroke - width="1" />
                ${ hourlyBarsSvg }
</svg>
  </div>
  < div class="charts-grid" >
    <div class="card" >
      <div class="section-title" >
        <span>⏰ ${ snap.calendar.monthName } Usage by Hour of Day </span>
          < span class="muted" style = "font-size:11px;" > Active Coding Hour Avg: ${ snap.activeHourAverageCredits.toFixed(2) } cr / hr </span>
            </div>
            < svg viewBox = "0 0 ${chartW} ${chartH}" >
              <line x1="${padL}" y1 = "${padT + plotH}" x2 = "${chartW - padR}" y2 = "${padT + plotH}" stroke = "var(--chart-axis)" stroke - width="1" />
                ${ hourlyBarsSvg }
</svg>
  </div>

  < div class="card" >
    <div class="section-title" >
      <span>💡 Smart Budget, Debt & Session Insights(${ snap.calendar.monthName }) </span>
        </div>
        < ul class="insights-list" >
          ${ snap.insights.map(item => `<li>${escapeHtml(item)}</li>`).join('') }
</ul>
  < div class="card" >
    <div class="section-title" >
      <span>💡 Smart Budget, Debt & Session Insights(${ snap.calendar.monthName }) </span>
        </div>
        < ul class="insights-list" >
          ${ snap.insights.map(item => `<li>${escapeHtml(item)}</li>`).join('') }
</ul>
  </div>
  </div>
  </div>

  < !--Most Expensive Sessions Leaderboard-- >
    <div class="card" style = "margin-bottom:20px;" >
      <div class="section-title" >
        <span>🔥 Most Expensive Chat Sessions(${ snap.calendar.monthName } ${ snap.calendar.year }) </span>
          < span class="muted" style = "font-size:12px;" >
            Flags sessions using < strong > ${ config.expensiveSessionMinPercent }–${ config.expensiveSessionMaxPercent }% (Heavy) < /strong> or <strong>&gt;${config.expensiveSessionMaxPercent}% (Mega)</strong > of Daily Limit(${ snap.recommendedDailyLimit.toFixed(2) } cr)
              </span>
              </div>
              < !--Most Expensive Sessions Leaderboard-- >
                <div class="card" style = "margin-bottom:20px;" >
                  <div class="section-title" >
                    <span>🔥 Most Expensive Chat Sessions(${ snap.calendar.monthName } ${ snap.calendar.year }) </span>
                      < span class="muted" style = "font-size:12px;" >
                        Flags sessions using < strong > ${ config.expensiveSessionMinPercent }–${ config.expensiveSessionMaxPercent }% (Heavy) < /strong> or <strong>&gt;${config.expensiveSessionMaxPercent}% (Mega)</strong > of Daily Limit(${ snap.recommendedDailyLimit.toFixed(2) } cr)
                          </span>
                          </div>
    ${
  topSessionsRows
    ? `<table>
    ${topSessionsRows
      ? `<table>
      topSessionsRows
        ? `< table >
      <thead>
      <tr>
      <th>Rank </th>
      < th > Session Title & Models </th>
        < th > Workspace </th>
        < th > Date & Duration </th>
        < th > Messages / Context </th>
        < th > Credits Used </th>
          <th> % of Daily Limit </th>
            </tr>
            </thead>
            < tbody > ${ topSessionsRows } </tbody>
              </table>`
      : `<div class="muted" style="padding:12px 0;">
        : `< div class="muted" style = "padding:12px 0;" >
    No local VS Code Copilot Chat sessions found for ${ snap.calendar.monthName } ${ snap.calendar.year }.<br/>
      < span style = "font-size:11px;opacity:0.8;" > Scanned directories: ${ escapeHtml(lastScannedDirs.join(' · ') || 'none') } (override via <code> copilotAnalytics.chatStoragePaths < /code> if needed)</span >
        </div>`
}
</div>
    }
</div>

  < !--Daily Expensive Chats Breakdown-- >
    <div class="card" style = "margin-bottom:20px;" >
      <div class="section-title" >
        <span>📅 Daily Expensive Chats Breakdown(${ snap.calendar.monthName } — Days with 40–60 % or & gt; 60 % Sessions)</span>
          </div>
          < !--Daily Expensive Chats Breakdown-- >
            <div class="card" style = "margin-bottom:20px;" >
              <div class="section-title" >
                <span>📅 Daily Expensive Chats Breakdown(${ snap.calendar.monthName } — Days with 40–60 % or & gt; 60 % Sessions)</span>
                  </div>
    ${
  expensiveDaysRows
    ? `<table>
    ${expensiveDaysRows
      ? `< table >
      <thead>
      <tr>
      <th>Date </th>
      < th > 40–60 % Heavy Chats </th>
        <th> & gt; 60 % Mega Chats </th>
          < th > Expensive / Total Chats </th>
            < th > Total Day Credits </th>
              < th > Most Expensive Chat of Day </th>
                </tr>
                </thead>
                < tbody > ${expensiveDaysRows} </tbody>
                  </table>`
      : `<div class="muted" style="padding:8px 0;">No single chat session in ${snap.calendar.monthName} exceeded ${config.expensiveSessionMinPercent}% (${((snap.recommendedDailyLimit * config.expensiveSessionMinPercent) / 100).toFixed(1)} cr) of your daily limit.</div>`
    }
</div>
        ? `< table >
    <thead>
    <tr>
    <th>Date </th>
    < th > 40–60 % Heavy Chats </th>
      <th> & gt; 60 % Mega Chats </th>
        < th > Expensive / Total Chats </th>
          < th > Total Day Credits </th>
            < th > Most Expensive Chat of Day </th>
              </tr>
              </thead>
              < tbody > ${ expensiveDaysRows } </tbody>
                </table>`
        : `<div class="muted" style="padding:8px 0;">No single chat session in ${snap.calendar.monthName} exceeded ${config.expensiveSessionMinPercent}% (${((snap.recommendedDailyLimit * config.expensiveSessionMinPercent) / 100).toFixed(1)} cr) of your daily limit.</div>`
}
</div>
  </div>

  < !--AI Models & Workspaces Side - by - Side-- >
    <div class="charts-grid" >
      <div class="card" >
        <div class="section-title" >
          <span>🤖 AI Models Usage Breakdown(${ snap.calendar.monthName }) </span>
            < span class="muted" style = "font-size:11px;" > Model Name · Messages · Credit Usage </span>
              </div>
              < !--AI Models & Workspaces Side - by - Side-- >
                <div class="charts-grid" >
                  <div class="card" >
                    <div class="section-title" >
                      <span>🤖 AI Models Usage Breakdown(${ snap.calendar.monthName }) </span>
                        < span class="muted" style = "font-size:11px;" > Model Name · Messages · Credit Usage </span>
                          </div>
                          < !--AI Models & Workspaces Side - by - Side-- >
                            <div class="charts-grid" >
                              <div class="card" >
                                <div class="section-title" >
                                  <span>🤖 AI Models Usage Breakdown(${ snap.calendar.monthName }) </span>
                                    < span class="muted" style = "font-size:11px;" > Model Name · Messages · Credit Usage </span>
                                      </div>
      ${
  modelsRows
    ? `<table>
        modelsRows
          ? `< table >
    <thead>
    <tr>
    <th>Model Name </th>
      < th > Multiplier </th>
      < th > Avg Cost </th>
        < th > Messages </th>
        < th > Credits </th>
        < th > Est.Tokens </th>
        < th > Share </th>
        </tr>
        </thead>
        < tbody > ${ modelsRows } </tbody>
          </table>`
    : `<div class="muted">No model activity recorded for ${snap.calendar.monthName}.</div>`
}
</div>
  ? `<table>
              <thead>
                <tr>
                  <th>Model Name</th>
                  <th>Avg Cost</th>
                  <th>Messages</th>
                  <th>Credits</th>
                  <th>Est. Tokens</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>${modelsRows}</tbody>
            </table>`
  : `<div class="muted">No model activity recorded for ${snap.calendar.monthName}.</div>`
      }
</div>
  </div>

  < div class="card" >
    <div class="section-title" >
      <span>📁 Workspace / Repository Cost Ranking(${ snap.calendar.monthName }) </span>
        < span class="muted" style = "font-size:11px;" > Which projects spawn expensive chats </span>
          </div>
          < div class="card" >
            <div class="section-title" >
              <span>📁 Workspace / Repository Cost Ranking(${ snap.calendar.monthName }) </span>
                < span class="muted" style = "font-size:11px;" > Which projects spawn expensive chats </span>
                  </div>
                  < div class="card" >
                    <div class="section-title" >
                      <span>📁 Workspace / Repository Cost Ranking(${ snap.calendar.monthName }) </span>
                        < span class="muted" style = "font-size:11px;" > Which projects spawn expensive chats </span>
                          </div>
      ${
  workspaceRows
    ? `<table>
        workspaceRows
          ? `< table >
    <thead>
    <tr>
    <th>Workspace </th>
    < th > Sessions </th>
    < th > Expensive Chats </th>
      < th > Messages </th>
      < th > Credits </th>
      </tr>
      </thead>
      < tbody > ${ workspaceRows } </tbody>
        </table>`
    : `<div class="muted">No workspace chat sessions recorded for ${snap.calendar.monthName}.</div>`
}
</div>
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
  : `<div class="muted">No workspace chat sessions recorded for ${snap.calendar.monthName}.</div>`
      }
</div>
  </div>
  </div>

  < !--Budget & Workday Settings-- >
    <div class="card" >
      <div class="section-title" >⚙️ Budget & Workday Settings </div>
        < div class="form-row" >
          <div class="form-field" >
            <label>Monthly Base Credits </label>
              < input id = "monthlyCredits" type = "number" value = "${snap.baseMonthlyCredits}" style = "width:120px;" />
                </div>
                < div class="form-field" >
                  <label>Extra Credits(Month) </label>
                    < input id = "extraCredits" type = "number" value = "${snap.extraCredits}" style = "width:120px;" />
                      </div>
                      < div class="form-field" >
                        <label>Work Hours / Day </label>
                          < input id = "workHoursPerDay" type = "number" value = "${config.workHoursPerDay}" style = "width:100px;" />
                            </div>
                            < div class="form-field" >
                              <label>Status Bar % Mode </label>
                                < select id = "dailyPercentMode" >
                                  <option value="adjusted" ${ config.dailyPercentMode === 'adjusted' ? 'selected' : '' }> Debt / Extra Adjusted </option>
                                    < option value = "standard" ${ config.dailyPercentMode === 'standard' ? 'selected' : '' }> Fixed Base Limit </option>
                                      </select>
                                      </div>
                                      < button class="primary" onclick = "saveBudget()" > Save Budget </button>
                                        </div>
                                        </div>
                                        < !--Budget & Workday Settings-- >
                                          <div class="card" >
                                            <div class="section-title" >⚙️ Budget & Workday Settings </div>
                                              < div class="form-row" >
                                                <div class="form-field" >
                                                  <label>Monthly Base Credits </label>
                                                    < input id = "monthlyCredits" type = "number" value = "${snap.baseMonthlyCredits}" style = "width:120px;" />
                                                      </div>
                                                      < div class="form-field" >
                                                        <label>Extra Credits(Month) </label>
                                                          < input id = "extraCredits" type = "number" value = "${snap.extraCredits}" style = "width:120px;" />
                                                            </div>
                                                            < div class="form-field" >
                                                              <label>Work Hours / Day </label>
                                                                < input id = "workHoursPerDay" type = "number" value = "${config.workHoursPerDay}" style = "width:100px;" />
                                                                  </div>
                                                                  < div class="form-field" >
                                                                    <label>Status Bar % Mode </label>
                                                                      < select id = "dailyPercentMode" >
                                                                        <option value="adjusted" ${ config.dailyPercentMode === 'adjusted' ? 'selected' : '' }> Debt / Extra Adjusted </option>
                                                                          < option value = "standard" ${ config.dailyPercentMode === 'standard' ? 'selected' : '' }> Fixed Base Limit </option>
                                                                            </select>
                                                                            </div>
                                                                            < button class="primary" onclick = "saveBudget()" > Save Budget </button>
                                                                              </div>
                                                                              </div>
                                                                              < !--Budget & Workday Settings-- >
                                                                                <div class="card" >
                                                                                  <div class="section-title" >⚙️ Budget & Workday Settings </div>
                                                                                    < div class="form-row" >
                                                                                      <div class="form-field" >
                                                                                        <label>Monthly Base Credits </label>
                                                                                          < input id = "monthlyCredits" type = "number" value = "${snap.baseMonthlyCredits}" style = "width:120px;" />
                                                                                            </div>
                                                                                            < div class="form-field" >
                                                                                              <label>Extra Credits(Month) </label>
                                                                                                < input id = "extraCredits" type = "number" value = "${snap.extraCredits}" style = "width:120px;" />
                                                                                                  </div>
                                                                                                  < div class="form-field" >
                                                                                                    <label>Work Hours / Day </label>
                                                                                                      < input id = "workHoursPerDay" type = "number" value = "${config.workHoursPerDay}" style = "width:100px;" />
                                                                                                        </div>
                                                                                                        < div class="form-field" >
                                                                                                          <label>Status Bar % Mode </label>
                                                                                                            < select id = "dailyPercentMode" >
                                                                                                              <option value="adjusted" ${ config.dailyPercentMode === 'adjusted' ? 'selected' : '' }> Debt / Extra Adjusted </option>
                                                                                                                < option value = "standard" ${ config.dailyPercentMode === 'standard' ? 'selected' : '' }> Fixed Base Limit </option>
                                                                                                                  </select>
                                                                                                                  </div>
                                                                                                                  < button class="primary" onclick = "saveBudget()" > Save Budget </button>
                                                                                                                    </div>
                                                                                                                    </div>

                                                                                                                    <script>
const vscode = acquireVsCodeApi();
function sendMsg(msg) {
  vscode.postMessage(msg);
  <script>
    const vscode = acquireVsCodeApi();
  function sendMsg(msg) {
    vscode.postMessage(msg);
  }
  function selectMonth(monthKey) {
    vscode.postMessage({ type: 'selectMonth', monthKey });
  }
  function stepMonth(delta) {
    vscode.postMessage({ type: 'stepMonth', delta });
  }
  function saveBudget() {
    vscode.postMessage({
      type: 'updateBudget',
      monthlyCredits: document.getElementById('monthlyCredits').value,
      extraCredits: document.getElementById('extraCredits').value,
      workHoursPerDay: document.getElementById('workHoursPerDay').value,
      dailyPercentMode: document.getElementById('dailyPercentMode').value
    function isEffectiveLight() {
      const explicit = document.body.getAttribute('data-theme');
      if(explicit) {
        return explicit === 'light';
      }
      return(
        document.body.classList.contains('vscode-light') ||
          document.body.classList.contains('vscode-high-contrast-light')
      );
  }
  function syncThemeButton() {
    const btn = document.getElementById('themeBtn');
    if (btn) {
      btn.textContent = isEffectiveLight() ? '🌙 Dark' : '☀️ Light';
    }
  }
  function toggleTheme() {
    const next = isEffectiveLight() ? 'dark' : 'light';
    document.body.setAttribute('data-theme', next);
    vscode.setState({ ...(vscode.getState() || {}), theme: next });
    syncThemeButton();
  }
  const savedState = vscode.getState();
  if (savedState && (savedState.theme === 'light' || savedState.theme === 'dark')) {
    document.body.setAttribute('data-theme', savedState.theme);
  }
  syncThemeButton();
  new MutationObserver(syncThemeButton).observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
  });
}

function sendMsg(msg) {
  vscode.postMessage(msg);
}
function selectMonth(monthKey) {
  vscode.postMessage({ type: 'selectMonth', monthKey });
}
function stepMonth(delta) {
  vscode.postMessage({ type: 'stepMonth', delta });
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
</script>
  </body>
  </html>`;
</body>
  </html>`;
}
