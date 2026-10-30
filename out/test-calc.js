"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const tracker_1 = require("./tracker");
function runTests() {
    console.log('Running Copilot Credit & Session Analytics verification suite...');
    // 1. Test Workdays in October 2026
    const calOct = (0, tracker_1.getMonthWorkdays)(2026, 9, 15, [1, 2, 3, 4, 5], []);
    assert.strictEqual(calOct.totalWorkdays, 22, 'October 2026 should have 22 workdays');
    assert.strictEqual(calOct.pastWorkdays, 10, 'Oct 1..14 2026 should have 10 past workdays');
    assert.strictEqual(calOct.elapsedWorkdays, 11, 'Oct 1..15 2026 should have 11 elapsed workdays');
    assert.strictEqual(calOct.remainingWorkdays, 12, 'Oct 15..31 2026 should have 12 remaining workdays');
    // 2. Test Model Multipliers
    assert.strictEqual((0, tracker_1.resolveModelMultiplier)('claude-3.7-sonnet-thought'), 1.25);
    assert.strictEqual((0, tracker_1.resolveModelMultiplier)('Claude Sonnet 4.5'), 1);
    assert.strictEqual((0, tracker_1.resolveModelMultiplier)('claude-opus-4.5'), 3);
    assert.strictEqual((0, tracker_1.resolveModelMultiplier)('claude-opus-4'), 10);
    assert.strictEqual((0, tracker_1.resolveModelMultiplier)('gpt-4.1'), 0);
    // 3. Test Color Coding & Widget Background/Foreground Contrast Specs
    const greenSpec = (0, tracker_1.getColorInfo)(35);
    assert.strictEqual(greenSpec.tier, 'green');
    assert.strictEqual(greenSpec.bgHex, '#16a34a');
    assert.strictEqual(greenSpec.fgHex, '#ffffff', 'Green widget should have white text');
    const yellowSpec = (0, tracker_1.getColorInfo)(65);
    assert.strictEqual(yellowSpec.tier, 'yellow');
    assert.strictEqual(yellowSpec.bgHex, '#facc15');
    assert.strictEqual(yellowSpec.fgHex, '#111827', 'Yellow widget should have dark text');
    const orangeSpec = (0, tracker_1.getColorInfo)(90);
    assert.strictEqual(orangeSpec.tier, 'orange');
    assert.strictEqual(orangeSpec.bgHex, '#f97316');
    assert.strictEqual(orangeSpec.fgHex, '#111827', 'Orange widget should have dark text');
    const redSpec = (0, tracker_1.getColorInfo)(105);
    assert.strictEqual(redSpec.tier, 'red');
    assert.strictEqual(redSpec.bgHex, '#dc2626');
    assert.strictEqual(redSpec.fgHex, '#ffffff', 'Red widget should have white text');
    // 4. Test VS Code 1.109+ .jsonl objectMutationLog Replay (kind: 0, 1, 2)
    const jsonlLines = [
        JSON.stringify({
            kind: 0,
            v: {
                version: 3,
                sessionId: 'jsonl-mut-1',
                creationDate: new Date(2026, 9, 20, 10, 0).getTime(),
                inputState: { selectedModel: { identifier: 'copilot/claude-sonnet-4' } },
                requests: [
                    {
                        requestId: 'req-1',
                        timestamp: new Date(2026, 9, 20, 10, 1).getTime(),
                        message: { text: 'Initial prompt in jsonl' },
                        response: [{ value: 'Initial response' }]
                    }
                ]
            }
        }),
        // kind 1: update customTitle
        JSON.stringify({
            kind: 1,
            k: ['customTitle'],
            v: 'JSONL Replayed Session'
        }),
        // kind 1: set result.details with explicit multiplier on req 0
        JSON.stringify({
            kind: 1,
            k: ['requests', 0, 'result'],
            v: { details: 'Claude Sonnet 4.5 • 1x', metadata: { usage: { totalTokens: 1800 } } }
        }),
        // kind 2: append second request to requests array at index 1
        JSON.stringify({
            kind: 2,
            k: ['requests'],
            i: 1,
            v: [
                {
                    requestId: 'req-2',
                    timestamp: new Date(2026, 9, 20, 14, 30).getTime(),
                    message: { text: 'Follow up with Opus 4.5' },
                    response: [{ value: [{ kind: 'markdownContent', value: 'Deep analysis output' }] }],
                    result: { details: 'Claude Opus 4.5 • 3x' }
                }
            ]
        })
    ].join('\n');
    const replayed = (0, tracker_1.replayJsonlMutationLog)(jsonlLines);
    assert.strictEqual(replayed.customTitle, 'JSONL Replayed Session');
    assert.strictEqual(replayed.requests.length, 2, 'Should replay kind:0 + kind:2 into 2 requests');
    // Test full filesystem mining across workspaceStorage + emptyWindowChatSessions
    const tmpUserDir = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-user-dir-'));
    const hashDir = path.join(tmpUserDir, 'workspaceStorage', 'hash999');
    const chatDir = path.join(hashDir, 'chatSessions');
    const emptyWinDir = path.join(tmpUserDir, 'globalStorage', 'emptyWindowChatSessions');
    fs.mkdirSync(chatDir, { recursive: true });
    fs.mkdirSync(emptyWinDir, { recursive: true });
    fs.writeFileSync(path.join(hashDir, 'workspace.json'), JSON.stringify({ folder: 'file:///Users/dev/payment-gateway' }), 'utf8');
    fs.writeFileSync(path.join(chatDir, 'jsonl-mut-1.jsonl'), jsonlLines, 'utf8');
    fs.writeFileSync(path.join(emptyWinDir, 'empty-win-1.jsonl'), JSON.stringify({
        kind: 0,
        v: {
            version: 3,
            sessionId: 'empty-win-1',
            computedTitle: 'Quick Regex Question',
            requests: [
                {
                    requestId: 'r1',
                    timestamp: new Date(2026, 9, 21, 9, 15).getTime(),
                    message: { text: 'Regex for ISO date' },
                    response: [{ value: 'Use ^\\d{4}-\\d{2}-\\d{2}$' }],
                    result: { details: 'GPT-4.1 • 0x' }
                }
            ]
        }
    }), 'utf8');
    const minedByMonth = (0, tracker_1.mineAllChatSessionsByMonth)([tmpUserDir], new Date(2026, 8, 1).getTime(), {});
    const octMined = minedByMonth['2026-10'] || [];
    assert.strictEqual(octMined.length, 2, 'Should mine both workspace .jsonl and emptyWindow .jsonl sessions');
    const wsSession = octMined.find(s => s.sessionId === 'jsonl-mut-1');
    assert.strictEqual(wsSession.workspaceName, 'payment-gateway');
    assert.strictEqual(wsSession.title, 'JSONL Replayed Session');
    assert.strictEqual(wsSession.messages, 2);
    assert.strictEqual(wsSession.credits, 4, '1x Sonnet 4.5 + 3x Opus 4.5 = 4 credits');
    const emptySession = octMined.find(s => s.sessionId === 'empty-win-1');
    assert.strictEqual(emptySession.workspaceName, 'Empty Window');
    assert.strictEqual(emptySession.credits, 0, 'GPT-4.1 0x should use 0 credits');
    const singleScan = (0, tracker_1.scanLocalChatSessions)(path.join(tmpUserDir, 'workspaceStorage'), 2026, 9, {});
    assert.strictEqual(singleScan.length, 2, 'scanLocalChatSessions should also discover sessions from parent User dir');
    // Verify Remote-WSL workspace.json URI resolution
    const wslHashDir = path.join(tmpUserDir, 'workspaceStorage', 'wslhash1');
    fs.mkdirSync(wslHashDir, { recursive: true });
    fs.writeFileSync(path.join(wslHashDir, 'workspace.json'), JSON.stringify({ folder: 'vscode-remote://wsl+Ubuntu/home/pospisk/work-monorepo' }), 'utf8');
    assert.strictEqual((0, tracker_1.readWorkspaceName)(wslHashDir), 'work-monorepo', 'Should extract repo name from vscode-remote://wsl URI');
    fs.rmSync(tmpUserDir, { recursive: true, force: true });
    // 5. Test Core Budget, Extra Credits, Credit Debt, Averages, and 40-60% Expensive Sessions
    const config = {
        monthlyCredits: 220,
        overrideApiEntitlement: true,
        extraCredits: 22,
        workDays: [1, 2, 3, 4, 5],
        workHoursPerDay: 8,
        holidays: [],
        dailyPercentMode: 'standard',
        colorStatusBarBackground: true,
        expensiveSessionMinPercent: 40,
        expensiveSessionMaxPercent: 60,
        modelMultipliers: {}
    };
    const now = new Date(2026, 9, 15, 14, 30, 0);
    const sessions = [
        {
            sessionId: 's1',
            title: 'Heavy 50% Session Today',
            workspaceName: 'repo-alpha',
            dateStr: '2026-10-15',
            startTime: new Date(2026, 9, 15, 10, 0).getTime(),
            endTime: new Date(2026, 9, 15, 10, 40).getTime(),
            durationMinutes: 40,
            messages: 5,
            credits: 5.5,
            estimatedTokens: 6000,
            cumulativeContextTokens: 18000,
            modelsUsed: { 'claude-sonnet-4': { messages: 5, credits: 5.5 } },
            primaryModel: 'claude-sonnet-4',
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
            credits: 7.7,
            estimatedTokens: 25000,
            cumulativeContextTokens: 95000,
            modelsUsed: { 'claude-sonnet-4': { messages: 25, credits: 7.7 } },
            primaryModel: 'claude-sonnet-4',
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
    const snap = (0, tracker_1.computeAnalytics)(config, now, sessions);
    assert.strictEqual(snap.baseDailyLimit, 10);
    assert.strictEqual(snap.recommendedDailyLimit, 11);
    assert.strictEqual(snap.creditDebt, 8);
    assert.strictEqual(snap.todayExpensive40to60, 1);
    assert.strictEqual(snap.todayExpensiveOver60, 1);
    assert.strictEqual(snap.widgetBgHex, '#dc2626');
    assert.strictEqual(snap.widgetFgHex, '#ffffff');
    // 6. Test History Comparison
    const historyComp = (0, tracker_1.computeHistoryComparison)(config, now, 2026, 9, { '2026-10': sessions }, undefined, 6);
    assert.strictEqual(historyComp.monthsHistory.length, 6);
    assert.strictEqual(historyComp.previousSnapshot.totalUsedCredits, 0);
    assert.strictEqual(historyComp.sameDaySelectedCredits, 143.2);
    console.log('✅ All Copilot Credit & Session Analytics tests passed!');
}
runTests();
//# sourceMappingURL=test-calc.js.map