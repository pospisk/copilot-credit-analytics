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
exports.DEFAULT_MODEL_MULTIPLIERS = void 0;
exports.formatDateYMD = formatDateYMD;
exports.formatMonthKey = formatMonthKey;
exports.getMonthShortLabel = getMonthShortLabel;
exports.getColorInfo = getColorInfo;
exports.parseNumericValue = parseNumericValue;
exports.normalizeModelName = normalizeModelName;
exports.resolveModelMultiplier = resolveModelMultiplier;
exports.getMonthWorkdays = getMonthWorkdays;
exports.fetchCopilotInternalQuota = fetchCopilotInternalQuota;
exports.getCandidateVSCodeUserDirs = getCandidateVSCodeUserDirs;
exports.readWorkspaceName = readWorkspaceName;
exports.replayJsonlMutationLog = replayJsonlMutationLog;
exports.mineAllChatSessionsByMonthAsync = mineAllChatSessionsByMonthAsync;
exports.mineAllChatSessionsByMonth = mineAllChatSessionsByMonth;
exports.scanLocalChatSessions = scanLocalChatSessions;
exports.computeAnalytics = computeAnalytics;
exports.computeHistoryComparison = computeHistoryComparison;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const https = __importStar(require("https"));
exports.DEFAULT_MODEL_MULTIPLIERS = {
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
function formatDateYMD(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
function formatMonthKey(year, month) {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
}
function getMonthShortLabel(year, month) {
    return `${MONTH_SHORT_NAMES[month] || 'Mon'} ${year}`;
}
/**
 * Returns full color specification for both charts and the bottom-right VS Code Status Bar widget
 * (solid background fill + high-contrast white or dark text).
 */
function getColorInfo(percent, monthlyExhausted = false) {
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
const CREDIT_NUM_SRC = '(?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+|,\\d{1,2})?)';
const STRIP_INLINE_CREDITS_RE = new RegExp(`(?:[\\s*-]+|\\s*[\\(\\[])?(?:~|<|≤)?\\s*${CREDIT_NUM_SRC}(?:\\s*(?:ai[-\\s]*)?(?:credits?|cr|x)|-(?:ai-)?credits?)\\b[\\)\\]]?.*$`, 'i');
const EXTRACT_CREDITS_RE = new RegExp(`(?:~|<|≤)?\\s*(${CREDIT_NUM_SRC})(?:\\s*(?:ai[-\\s]*)?(?:credits?|cr)|-(?:ai-)?credits?)\\b`, 'i');
function parseNumericValue(rawNum) {
    const trimmed = rawNum.replace(/[\s\u00a0]/g, '');
    if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(trimmed)) {
        return parseFloat(trimmed.replace(/,/g, ''));
    }
    if (/^\d+,\d{1,2}$/.test(trimmed)) {
        return parseFloat(trimmed.replace(',', '.'));
    }
    return parseFloat(trimmed.replace(/,/g, ''));
}
function normalizeModelName(rawModel) {
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
function resolveModelMultiplier(modelName, customMap) {
    const clean = normalizeModelName(modelName);
    const map = { ...exports.DEFAULT_MODEL_MULTIPLIERS };
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
function getMonthWorkdays(year, month, currentDay, workDays = [1, 2, 3, 4, 5], holidays = []) {
    const holidaySet = new Set(holidays.map(h => h.trim()));
    const workdaySet = new Set(workDays);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let totalWorkdays = 0;
    let pastWorkdays = 0;
    let elapsedWorkdays = 0;
    let remainingWorkdays = 0;
    let isTodayWorkday = false;
    const workdayMap = {};
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
function fetchCopilotInternalQuota(accessToken) {
    return new Promise(resolve => {
        const req = https.request('https://api.github.com/copilot_internal/user', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'User-Agent': 'VSCode-Copilot-Credit-Analytics/0.3.3',
                Accept: 'application/json'
            },
            timeout: 6000
        }, res => {
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
                    const remaining = typeof pi.quota_remaining === 'number'
                        ? pi.quota_remaining
                        : typeof pi.remaining === 'number'
                            ? pi.remaining
                            : entitlement;
                    const used = typeof pi.used === 'number'
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
                }
                catch {
                    resolve(undefined);
                }
            });
        });
        req.on('error', () => resolve(undefined));
        req.on('timeout', () => {
            req.destroy();
            resolve(undefined);
        });
        req.end();
    });
}
function getWindowsMountRootsInWSL() {
    const mounts = new Set(['/mnt/c', '/c', '/mnt/d', '/d']);
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
                if ((fsType === '9p' || fsType === 'drvfs') &&
                    mountPoint &&
                    !mountPoint.startsWith('/usr/') &&
                    !mountPoint.startsWith('/mnt/wsl')) {
                    mounts.add(mountPoint);
                }
            }
        }
    }
    catch {
        // ignore
    }
    return Array.from(mounts);
}
/**
 * Discovers candidate VS Code User directories across macOS, Windows, Linux, AND Remote-WSL.
 */
function getCandidateVSCodeUserDirs(primaryUserDir, extraPaths) {
    const dirs = new Set();
    const home = os.homedir();
    const normalizeCandidate = (p) => {
        const expanded = p.startsWith('~/') || p === '~' ? path.join(home, p.slice(1)) : p.trim();
        return path.basename(expanded) === 'workspaceStorage' ? path.dirname(expanded) : expanded;
    };
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
    if (primaryUserDir) {
        const candidate = normalizeCandidate(primaryUserDir);
        if (fs.existsSync(candidate)) {
            dirs.add(candidate);
        }
    }
    const platform = process.platform;
    const standardRoots = [];
    if (platform === 'darwin') {
        standardRoots.push(path.join(home, 'Library', 'Application Support', 'Code', 'User'), path.join(home, 'Library', 'Application Support', 'Code - Insiders', 'User'));
    }
    else if (platform === 'win32' && process.env.APPDATA) {
        standardRoots.push(path.join(process.env.APPDATA, 'Code', 'User'), path.join(process.env.APPDATA, 'Code - Insiders', 'User'));
    }
    else {
        standardRoots.push(path.join(home, '.vscode-server', 'data', 'User'), path.join(home, '.vscode-server-insiders', 'data', 'User'), path.join(home, '.config', 'Code', 'User'), path.join(home, '.config', 'Code - Insiders', 'User'));
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
                    standardRoots.push(path.join(usersDir, winUser, 'AppData', 'Roaming', 'Code', 'User'), path.join(usersDir, winUser, 'AppData', 'Roaming', 'Code - Insiders', 'User'));
                }
            }
            catch {
                // ignore permission errors on system folders
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
function cleanUriToPath(uriOrPath) {
    try {
        return decodeURIComponent(uriOrPath)
            .replace(/^[a-zA-Z][a-zA-Z0-9+.-]+:(?:\/\/[^/]*)?/, '')
            .replace(/\\/g, '/')
            .replace(/\/+$/, '');
    }
    catch {
        return uriOrPath
            .replace(/^[a-zA-Z][a-zA-Z0-9+.-]+:(?:\/\/[^/]*)?/, '')
            .replace(/\\/g, '/')
            .replace(/\/+$/, '');
    }
}
function extractNameFromWorkspaceConfigObject(rawConfig) {
    try {
        const cfg = JSON.parse(rawConfig);
        if (typeof cfg?.name === 'string' && cfg.name.trim() && cfg.name.trim().toLowerCase() !== 'workspace.json') {
            return cfg.name.trim();
        }
        if (Array.isArray(cfg?.folders) && cfg.folders.length > 0) {
            const names = [];
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
    }
    catch {
        // ignore malformed workspace config
    }
    return undefined;
}
function getCandidateWorkspaceConfigPaths(withoutScheme, hashDir) {
    const candidates = [];
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
        }
        else {
            candidates.push(`/mnt/${drive}/${rest}`, `/${drive}/${rest}`);
        }
    }
    else if (withoutScheme.startsWith('/')) {
        candidates.push(withoutScheme);
    }
    return candidates;
}
function fallbackNameForWorkspaceJsonUri(withoutScheme, overrideName) {
    if (overrideName && overrideName.trim()) {
        return overrideName.trim();
    }
    const parts = withoutScheme.split('/').filter(Boolean);
    for (let i = parts.length - 2; i >= 0; i--) {
        const seg = parts[i];
        const lower = seg.toLowerCase();
        if (lower === '.vscode' ||
            lower === 'workspaces' ||
            lower === 'user' ||
            lower === 'code' ||
            /^\d+$/.test(seg) ||
            /^[0-9a-f]{16,}$/i.test(seg)) {
            continue;
        }
        return seg.replace(/\.code-workspace$/i, '');
    }
    return 'Untitled Workspace';
}
function parseWorkspaceJsonContent(raw, hashDir, readRefFileSync, overrideName) {
    try {
        const content = JSON.parse(raw);
        const wsField = typeof content.workspace === 'string'
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
    }
    catch {
        // ignore
    }
    return overrideName || 'Workspace';
}
async function parseWorkspaceJsonContentAsync(raw, hashDir, overrideName) {
    try {
        const content = JSON.parse(raw);
        const wsField = typeof content.workspace === 'string'
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
                    }
                    catch {
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
    }
    catch {
        // ignore
    }
    return overrideName || 'Workspace';
}
/**
 * Extracts a clean project/repository name from workspace.json, handling single folders,
 * Remote-WSL / SSH URIs, .code-workspace files, and untitled multi-root workspaces (`User/Workspaces/<id>/workspace.json`).
 */
function readWorkspaceName(hashDir, overrideName) {
    const wsJsonPath = path.join(hashDir, 'workspace.json');
    try {
        if (fs.existsSync(wsJsonPath)) {
            const raw = fs.readFileSync(wsJsonPath, 'utf8');
            return parseWorkspaceJsonContent(raw, hashDir, p => {
                try {
                    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : undefined;
                }
                catch {
                    return undefined;
                }
            }, overrideName);
        }
    }
    catch {
        // ignore malformed workspace.json
    }
    return overrideName || 'Workspace';
}
function getByPath(root, keys) {
    let curr = root;
    for (const k of keys) {
        if (curr === null || curr === undefined) {
            return undefined;
        }
        curr = curr[k];
    }
    return curr;
}
function setByPath(root, keys, value) {
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
function deleteByPath(root, keys) {
    if (!root || keys.length === 0) {
        return;
    }
    const parent = getByPath(root, keys.slice(0, -1));
    if (parent && typeof parent === 'object') {
        const last = keys[keys.length - 1];
        if (Array.isArray(parent) && typeof last === 'number') {
            parent.splice(last, 1);
        }
        else {
            delete parent[last];
        }
    }
}
/**
 * Replays VS Code's objectMutationLog (.jsonl) format (kind 0, 1, 2, 3) plus flat JSONL fallbacks.
 */
function replayJsonlMutationLog(rawContent) {
    const lines = rawContent.split(/\r?\n/);
    let state = undefined;
    const looseRequests = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }
        let obj;
        try {
            obj = JSON.parse(trimmed);
        }
        catch {
            continue;
        }
        if (typeof obj.kind === 'number') {
            if (obj.kind === 0 && obj.v && typeof obj.v === 'object') {
                state = obj.v;
            }
            else if (obj.kind === 1 && state && Array.isArray(obj.k) && obj.k.length > 0) {
                setByPath(state, obj.k, obj.v);
            }
            else if (obj.kind === 2 && state) {
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
                    }
                    else {
                        target.push(...items);
                    }
                }
            }
            else if (obj.kind === 3 && state && Array.isArray(obj.k) && obj.k.length > 0) {
                deleteByPath(state, obj.k);
            }
        }
        else if (Array.isArray(obj.requests)) {
            state = obj;
        }
        else if (obj.requestId || obj.message || obj.prompt) {
            looseRequests.push(obj);
        }
    }
    if (!state && looseRequests.length > 0) {
        return { requests: looseRequests };
    }
    return state;
}
function extractTextLength(node, depth = 0) {
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
        }
        else if (node.value) {
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
function readNumericCredits(obj) {
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
function parseCreditsFromDetailsString(detailsStr) {
    let explicitCredits;
    let explicitMultiplier;
    let explicitTokens;
    const creditMatch = detailsStr.match(EXTRACT_CREDITS_RE);
    if (creditMatch) {
        const parsed = parseNumericValue(creditMatch[1]);
        if (!isNaN(parsed) && parsed >= 0) {
            explicitCredits = parsed;
        }
    }
    else if (/(?:[•·∙⋅|]|\s\*\s|\()\s*(?:free|included)\b/i.test(detailsStr)) {
        explicitCredits = 0;
    }
    const multMatch = detailsStr.match(/(?:[•·∙⋅|*-]|\()\s*(\d+(?:\.\d+)?)\s*x\b/i);
    if (multMatch) {
        const parsedMult = parseFloat(multMatch[1]);
        if (!isNaN(parsedMult) && parsedMult >= 0) {
            explicitMultiplier = parsedMult;
        }
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
    const firstSeg = detailsStr.split(/\s*(?:[•·∙⋅|]|\s+\*\s+|\s+—\s+|\s+–\s+)\s*/)[0] || '';
    const modelPart = firstSeg
        .replace(STRIP_INLINE_CREDITS_RE, '')
        .replace(/(?:[\s*-]+|\s*[\(\[])(?:free|included)\b[\)\]]?.*$/i, '')
        .replace(/[\s*-]+$/g, '')
        .trim();
    return { explicitCredits, explicitMultiplier, explicitTokens, modelPart };
}
function extractTurnCostAndModel(req, sessionState, customMultipliers) {
    const resultObj = req?.result || (!Array.isArray(req?.response) ? req?.response?.result : undefined);
    const detailsStr = typeof resultObj?.details === 'string'
        ? resultObj.details.trim()
        : typeof req?.details === 'string'
            ? req.details.trim()
            : '';
    let explicitCredits;
    let explicitMultiplier;
    let detailsTokens;
    let modelCandidate = '';
    if (detailsStr) {
        const parsed = parseCreditsFromDetailsString(detailsStr);
        explicitCredits = parsed.explicitCredits;
        explicitMultiplier = parsed.explicitMultiplier;
        detailsTokens = parsed.explicitTokens;
        if (parsed.modelPart) {
            modelCandidate = normalizeModelName(parsed.modelPart);
        }
    }
    const metaCredits = readNumericCredits(resultObj) ??
        readNumericCredits(resultObj?.metadata) ??
        readNumericCredits(resultObj?.metadata?.usage) ??
        readNumericCredits(req?.usage) ??
        readNumericCredits(req?.modelState) ??
        readNumericCredits(req);
    if (metaCredits !== undefined) {
        explicitCredits = explicitCredits !== undefined ? Math.max(explicitCredits, metaCredits) : metaCredits;
    }
    if (Array.isArray(resultObj?.metadata?.toolCallRounds)) {
        let roundCreditsSum = 0;
        let foundRoundCredits = false;
        for (const round of resultObj.metadata.toolCallRounds) {
            const rc = readNumericCredits(round) ??
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
    const fallbackModelId = resultObj?.metadata?.modelId ||
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
    if (!modelCandidate || modelCandidate === 'auto') {
        const resolvedFallback = fallbackModelId ? normalizeModelName(fallbackModelId) : '';
        if (resolvedFallback && resolvedFallback !== 'auto') {
            modelCandidate = resolvedFallback;
        }
        else if (!modelCandidate) {
            modelCandidate = normalizeModelName(fallbackModelId);
        }
    }
    const cleanUserOverrides = {};
    for (const [k, v] of Object.entries(customMultipliers || {})) {
        cleanUserOverrides[normalizeModelName(k)] = v;
    }
    const hasExplicitUserOverride = Object.keys(cleanUserOverrides).some(k => modelCandidate.includes(k) && exports.DEFAULT_MODEL_MULTIPLIERS[k] !== cleanUserOverrides[k]);
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
    if (explicitCredits !== undefined && !isNaN(explicitCredits)) {
        return {
            model: modelCandidate,
            multiplier: explicitMultiplier ?? explicitCredits,
            credits: explicitCredits,
            hasExplicitCost: true,
            detailsTokens
        };
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
function parseSessionObject(state, fallbackSessionId, workspaceName, fallbackMtimeMs, multipliers) {
    if (!state || typeof state !== 'object') {
        return undefined;
    }
    const requests = Array.isArray(state.requests) ? state.requests : [];
    if (requests.length === 0) {
        return undefined;
    }
    const sessionId = String(state.sessionId || fallbackSessionId);
    let title = String(state.customTitle || state.computedTitle || '').trim();
    const baseCreationMs = typeof state.creationDate === 'number' && state.creationDate > 1000000000000
        ? state.creationDate
        : fallbackMtimeMs - requests.length * 45000;
    const turns = [];
    requests.forEach((req, idx) => {
        if (!req) {
            return;
        }
        const promptText = typeof req.message === 'string'
            ? req.message
            : req.message?.text ||
                (Array.isArray(req.message?.parts) ? req.message.parts.map((p) => p?.text || '').join(' ') : '') ||
                req.prompt ||
                '';
        if (!title && promptText) {
            title = promptText.replace(/\s+/g, ' ').trim();
        }
        const responseChars = extractTextLength(req.response);
        const resultObj = req?.result || (!Array.isArray(req?.response) ? req?.response?.result : undefined);
        const toolRoundChars = Array.isArray(resultObj?.metadata?.toolCallRounds)
            ? extractTextLength(resultObj.metadata.toolCallRounds)
            : 0;
        const { model, multiplier, credits, hasExplicitCost, detailsTokens } = extractTurnCostAndModel(req, state, multipliers);
        if (req.isCanceled && !hasExplicitCost && responseChars === 0 && toolRoundChars === 0) {
            return;
        }
        const ts = typeof req.timestamp === 'number' && req.timestamp > 1000000000000
            ? req.timestamp
            : typeof req.requestDate === 'number' && req.requestDate > 1000000000000
                ? req.requestDate
                : baseCreationMs + idx * 45000;
        const dt = new Date(ts);
        const usageMeta = resultObj?.metadata?.usage || req.usage;
        let exactTokens = typeof usageMeta?.totalTokens === 'number'
            ? usageMeta.totalTokens
            : typeof usageMeta?.promptTokens === 'number' || typeof usageMeta?.completionTokens === 'number'
                ? (usageMeta.promptTokens || 0) + (usageMeta.completionTokens || 0)
                : 0;
        if (exactTokens === 0 && Array.isArray(resultObj?.metadata?.toolCallRounds)) {
            for (const r of resultObj.metadata.toolCallRounds) {
                const ru = r?.usage;
                if (typeof ru?.totalTokens === 'number') {
                    exactTokens += ru.totalTokens;
                }
                else if (typeof ru?.promptTokens === 'number' || typeof ru?.completionTokens === 'number') {
                    exactTokens += (ru.promptTokens || 0) + (ru.completionTokens || 0);
                }
            }
        }
        const estimatedTokens = exactTokens > 0
            ? exactTokens
            : detailsTokens && detailsTokens > 0
                ? detailsTokens
                : Math.max(60, Math.ceil((promptText.length + responseChars + toolRoundChars) / 4));
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
    if (turns.length === 0) {
        return undefined;
    }
    const sessionLevelCredits = readNumericCredits(state) ??
        readNumericCredits(state.usage) ??
        readNumericCredits(state.stats) ??
        readNumericCredits(state.metadata);
    if (sessionLevelCredits !== undefined) {
        const sumTurns = turns.reduce((acc, t) => acc + t.credits, 0);
        if (sessionLevelCredits > sumTurns + 0.01) {
            if (sumTurns > 0) {
                const ratio = sessionLevelCredits / sumTurns;
                for (const t of turns) {
                    t.credits = Math.round(t.credits * ratio * 1000) / 1000;
                }
            }
            else {
                const perTurn = sessionLevelCredits / turns.length;
                for (const t of turns) {
                    t.credits = Math.round(perTurn * 1000) / 1000;
                }
            }
        }
    }
    return {
        sessionId,
        title: (title || 'Copilot Chat Session').slice(0, 95),
        workspaceName,
        turns
    };
}
function buildMonthlySessionRecord(sessionId, title, workspaceName, monthTurns, totalHistoricalTurnsBeforeMonth = 0, totalSessionCredits, totalSessionMessages) {
    if (monthTurns.length === 0) {
        return undefined;
    }
    const sorted = [...monthTurns].sort((a, b) => a.timestamp - b.timestamp);
    const startTime = sorted[0].timestamp;
    const endTime = sorted[sorted.length - 1].timestamp;
    const durationMinutes = Math.max(1, Math.round((endTime - startTime) / 60000));
    let credits = 0;
    let directTokens = 0;
    let cumulativeContextTokens = 0;
    let runningThreadTokens = totalHistoricalTurnsBeforeMonth * 800;
    let post20TurnCredits = 0;
    const modelsUsed = {};
    const creditsByDay = {};
    sorted.forEach((t, idx) => {
        credits += t.credits;
        directTokens += t.estimatedTokens;
        runningThreadTokens += t.estimatedTokens;
        cumulativeContextTokens += runningThreadTokens;
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
    const primaryDateStr = Object.entries(creditsByDay).sort((a, b) => b[1] - a[1])[0]?.[0] || sorted[0].dateStr;
    const primaryModel = Object.entries(modelsUsed).sort((a, b) => b[1].credits - a[1].credits || b[1].messages - a[1].messages)[0]?.[0] ||
        'claude-sonnet-4';
    const totalThreadTurns = totalHistoricalTurnsBeforeMonth + sorted.length;
    const hasContextBloat = totalThreadTurns > 20 || cumulativeContextTokens > 60000;
    const roundedMonthCredits = Math.round(credits * 100) / 100;
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
        totalSessionCredits: totalSessionCredits !== undefined ? Math.round(totalSessionCredits * 100) / 100 : roundedMonthCredits,
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
// In-memory cache so unchanged .jsonl files over WSL /mnt/c (9P) are never re-read or re-parsed
const sessionFileCache = new Map();
function parseRawSessionContent(fullPath, raw, workspaceName, mtimeMs, multipliers) {
    const baseId = path.basename(fullPath).replace(/\.(jsonl|json)$/i, '');
    const state = fullPath.endsWith('.jsonl') ? replayJsonlMutationLog(raw) : JSON.parse(raw);
    return parseSessionObject(state, baseId, workspaceName, mtimeMs, multipliers);
}
function groupParsedSessionsByMonth(parsedEntries) {
    const parsedById = new Map();
    for (const entry of parsedEntries) {
        if (!entry || entry.turns.length === 0) {
            continue;
        }
        const prev = parsedById.get(entry.sessionId);
        if (!prev || entry.turns.length > prev.turns.length || entry.mtimeMs > prev.mtimeMs) {
            parsedById.set(entry.sessionId, entry);
        }
    }
    const byMonth = {};
    for (const session of parsedById.values()) {
        const sortedTurns = [...session.turns].sort((a, b) => a.timestamp - b.timestamp);
        const totalSessionCredits = sortedTurns.reduce((sum, t) => sum + t.credits, 0);
        const totalSessionMessages = sortedTurns.length;
        const monthTurnGroups = new Map();
        sortedTurns.forEach((turn, idx) => {
            const mKey = turn.dateStr.slice(0, 7);
            let grp = monthTurnGroups.get(mKey);
            if (!grp) {
                grp = { turns: [], priorCount: idx };
                monthTurnGroups.set(mKey, grp);
            }
            grp.turns.push(turn);
        });
        for (const [mKey, grp] of monthTurnGroups.entries()) {
            const rec = buildMonthlySessionRecord(session.sessionId, session.title, session.workspaceName, grp.turns, grp.priorCount, totalSessionCredits, totalSessionMessages);
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
/**
 * Non-blocking async chat session miner optimized for Remote-WSL (`/mnt/c` 9P filesystem)
 * with bounded concurrency and `(mtimeMs, size)` caching.
 */
async function mineAllChatSessionsByMonthAsync(userDirs, earliestTimestampMs, multipliers, workspaceNameOverrides) {
    const fsp = fs.promises;
    const multipliersKey = JSON.stringify(multipliers || {});
    const sessionFiles = [];
    const collectChatDirFiles = async (chatDir, workspaceNameResolver) => {
        let entries;
        try {
            entries = (await fsp.readdir(chatDir)).filter(f => f.endsWith('.jsonl') || f.endsWith('.json'));
        }
        catch {
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
            }
            catch {
                // ignore disappearing temp files
            }
        }
    };
    for (const userDir of userDirs) {
        if (!userDir) {
            continue;
        }
        const wsRoot = path.join(userDir, 'workspaceStorage');
        let hashEntries = [];
        try {
            hashEntries = await fsp.readdir(wsRoot);
        }
        catch {
            hashEntries = [];
        }
        const BATCH = 24;
        for (let i = 0; i < hashEntries.length; i += BATCH) {
            const slice = hashEntries.slice(i, i + BATCH);
            await Promise.all(slice.map(async (hashName) => {
                const hashDir = path.join(wsRoot, hashName);
                const chatDir = path.join(hashDir, 'chatSessions');
                const overrideName = workspaceNameOverrides?.[hashName];
                await collectChatDirFiles(chatDir, async () => {
                    try {
                        const rawWs = await fsp.readFile(path.join(hashDir, 'workspace.json'), 'utf8');
                        return await parseWorkspaceJsonContentAsync(rawWs, hashDir, overrideName);
                    }
                    catch {
                        return overrideName || 'Workspace';
                    }
                });
            }));
        }
        const emptyChatDirs = [path.join(userDir, 'globalStorage', 'emptyWindowChatSessions')];
        const profilesDir = path.join(userDir, 'profiles');
        try {
            const profiles = await fsp.readdir(profilesDir);
            for (const prof of profiles) {
                emptyChatDirs.push(path.join(profilesDir, prof, 'globalStorage', 'emptyWindowChatSessions'));
            }
        }
        catch {
            // no profiles folder
        }
        for (const emptyDir of emptyChatDirs) {
            await collectChatDirFiles(emptyDir, async () => 'Empty Window');
        }
    }
    const parsedEntries = [];
    const READ_BATCH = 16;
    for (let i = 0; i < sessionFiles.length; i += READ_BATCH) {
        const batch = sessionFiles.slice(i, i + READ_BATCH);
        await Promise.all(batch.map(async (item) => {
            const cached = sessionFileCache.get(item.fullPath);
            if (cached &&
                cached.mtimeMs === item.mtimeMs &&
                cached.size === item.size &&
                cached.multipliersKey === multipliersKey) {
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
            }
            catch {
                // Ignore unreadable or partially written file
            }
        }));
    }
    return groupParsedSessionsByMonth(parsedEntries);
}
/**
 * Synchronous chat session miner (used by unit tests and single-folder utilities).
 */
function mineAllChatSessionsByMonth(userDirs, earliestTimestampMs, multipliers, workspaceNameOverrides) {
    const multipliersKey = JSON.stringify(multipliers || {});
    const sessionFiles = [];
    for (const userDir of userDirs) {
        if (!userDir || !fs.existsSync(userDir)) {
            continue;
        }
        const wsRoot = path.join(userDir, 'workspaceStorage');
        if (fs.existsSync(wsRoot)) {
            let hashEntries = [];
            try {
                hashEntries = fs.readdirSync(wsRoot);
            }
            catch {
                hashEntries = [];
            }
            for (const hashName of hashEntries) {
                const hashDir = path.join(wsRoot, hashName);
                const chatDir = path.join(hashDir, 'chatSessions');
                if (!fs.existsSync(chatDir)) {
                    continue;
                }
                let files = [];
                try {
                    files = fs.readdirSync(chatDir).filter(f => f.endsWith('.jsonl') || f.endsWith('.json'));
                }
                catch {
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
                    }
                    catch {
                        // ignore
                    }
                }
            }
        }
        const emptyChatDirs = [path.join(userDir, 'globalStorage', 'emptyWindowChatSessions')];
        const profilesDir = path.join(userDir, 'profiles');
        if (fs.existsSync(profilesDir)) {
            try {
                for (const prof of fs.readdirSync(profilesDir)) {
                    emptyChatDirs.push(path.join(profilesDir, prof, 'globalStorage', 'emptyWindowChatSessions'));
                }
            }
            catch {
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
            }
            catch {
                // ignore
            }
        }
    }
    const parsedEntries = [];
    for (const item of sessionFiles) {
        const cached = sessionFileCache.get(item.fullPath);
        if (cached &&
            cached.mtimeMs === item.mtimeMs &&
            cached.size === item.size &&
            cached.multipliersKey === multipliersKey) {
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
        }
        catch {
            // Ignore unreadable or empty file
        }
    }
    return groupParsedSessionsByMonth(parsedEntries);
}
function scanLocalChatSessions(storagePath, year, month, multipliers) {
    if (!storagePath || !fs.existsSync(storagePath)) {
        return [];
    }
    const userDir = path.basename(storagePath) === 'workspaceStorage' ? path.dirname(storagePath) : storagePath;
    const monthStartMs = new Date(year, month, 1, 0, 0, 0).getTime();
    const byMonth = mineAllChatSessionsByMonth([userDir], monthStartMs, multipliers);
    return byMonth[formatMonthKey(year, month)] || [];
}
function computeAnalytics(config, now, sessionsInput, apiQuota, dailyQuotaLedger) {
    const year = now.getFullYear();
    const month = now.getMonth();
    const currentDay = now.getDate();
    const todayStr = formatDateYMD(now);
    const calendar = getMonthWorkdays(year, month, currentDay, config.workDays, config.holidays);
    const baseMonthlyCredits = !config.overrideApiEntitlement && apiQuota && apiQuota.entitlement > 0
        ? apiQuota.entitlement
        : Math.max(1, config.monthlyCredits || 300);
    const extraCredits = Math.max(0, config.extraCredits || 0);
    const totalMonthlyCredits = baseMonthlyCredits + extraCredits;
    const baseDailyLimit = baseMonthlyCredits / calendar.totalWorkdays;
    const recommendedDailyLimit = totalMonthlyCredits / calendar.totalWorkdays;
    const minExp = config.expensiveSessionMinPercent ?? 40;
    const maxExp = config.expensiveSessionMaxPercent ?? 60;
    const sessions = sessionsInput.map(s => {
        const pct = recommendedDailyLimit > 0 ? (s.credits / recommendedDailyLimit) * 100 : 0;
        let expenseTier = 'normal';
        if (pct > maxExp) {
            expenseTier = 'mega-60plus';
        }
        else if (pct >= minExp) {
            expenseTier = 'heavy-40-60';
        }
        return {
            ...s,
            dailyLimitPercent: Math.round(pct * 10) / 10,
            expenseTier
        };
    });
    const dailyMap = {};
    for (let d = 1; d <= calendar.daysInMonth; d++) {
        const ds = formatDateYMD(new Date(year, month, d));
        dailyMap[ds] = { credits: 0, messages: 0, sessionIds: new Set(), exp40to60: 0, expOver60: 0 };
    }
    const hourlyCredits = new Array(24).fill(0);
    const hourlyMessages = new Array(24).fill(0);
    const modelAgg = {};
    const workspaceAgg = {};
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
        }
        else {
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
        const primaryDayBucket = dailyMap[s.dateStr];
        if (primaryDayBucket) {
            if (s.expenseTier === 'heavy-40-60') {
                primaryDayBucket.exp40to60 += 1;
            }
            else if (s.expenseTier === 'mega-60plus') {
                primaryDayBucket.expOver60 += 1;
            }
            if (!primaryDayBucket.topSessionPercent || s.dailyLimitPercent > primaryDayBucket.topSessionPercent) {
                primaryDayBucket.topSessionPercent = s.dailyLimitPercent;
                primaryDayBucket.topSessionTitle = s.title;
            }
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
        }
        else if (s.expenseTier === 'mega-60plus') {
            workspaceAgg[ws].expensiveChatsOver60 += 1;
            workspaceAgg[ws].totalExpensiveChats += 1;
        }
    }
    if (dailyQuotaLedger) {
        const sortedDates = Object.keys(dailyQuotaLedger).sort();
        for (let i = 1; i < sortedDates.length; i++) {
            const ds = sortedDates[i];
            const prevDs = sortedDates[i - 1];
            if (ds.slice(0, 7) === prevDs.slice(0, 7) &&
                dailyMap[ds] &&
                Math.round((Date.parse(ds) - Date.parse(prevDs)) / 86_400_000) === 1) {
                const apiDelta = Math.max(0, dailyQuotaLedger[ds] - dailyQuotaLedger[prevDs]);
                if (apiDelta > dailyMap[ds].credits) {
                    dailyMap[ds].credits = apiDelta;
                }
            }
        }
    }
    const localMinedCredits = Math.round(sessionsTotalCredits * 100) / 100;
    const totalUsedCredits = apiQuota && apiQuota.used > localMinedCredits ? apiQuota.used : localMinedCredits;
    if (apiQuota && apiQuota.used > localMinedCredits + 0.5) {
        const externalCredits = Math.round((apiQuota.used - localMinedCredits) * 100) / 100;
        modelAgg['External / Non-Chat Copilot Usage'] = {
            multiplier: 0,
            messages: 0,
            credits: externalCredits,
            tokens: 0
        };
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
    const standardDailyPercent = recommendedDailyLimit > 0 ? Math.round((todayUsedCredits / recommendedDailyLimit) * 1000) / 10 : 0;
    const adjustedDailyPercent = effectiveDailyLimit > 0
        ? Math.round((todayUsedCredits / effectiveDailyLimit) * 1000) / 10
        : todayUsedCredits > 0
            ? 100
            : 0;
    const activeDailyPercent = config.dailyPercentMode === 'standard' ? standardDailyPercent : adjustedDailyPercent;
    const monthlyExhausted = totalUsedCredits >= totalMonthlyCredits;
    const colorInfo = getColorInfo(activeDailyPercent, monthlyExhausted);
    const dailySeries = [];
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
    const hourlySeries = hourlyCredits.map((cr, hr) => ({
        hour: hr,
        label: `${String(hr).padStart(2, '0')}:00`,
        credits: Math.round(cr * 100) / 100,
        messages: hourlyMessages[hr]
    }));
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
    const models = Object.entries(modelAgg)
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
    const workspaces = Object.values(workspaceAgg)
        .map(w => ({
        ...w,
        credits: Math.round(w.credits * 100) / 100,
        percentOfCredits: totalUsedCredits > 0 ? Math.round((w.credits / totalUsedCredits) * 1000) / 10 : 0
    }))
        .sort((a, b) => b.credits - a.credits || b.messages - a.messages);
    const monthExpensive40to60 = sessions.filter(s => s.expenseTier === 'heavy-40-60').length;
    const monthExpensiveOver60 = sessions.filter(s => s.expenseTier === 'mega-60plus').length;
    const monthTotalExpensiveChats = monthExpensive40to60 + monthExpensiveOver60;
    const topExpensiveSessions = [...sessions]
        .sort((a, b) => b.credits - a.credits || b.messages - a.messages)
        .slice(0, 15);
    const activeTodayTopSession = sessions
        .filter(s => s.dateStr === todayStr || s.turns?.some(t => t.dateStr === todayStr))
        .sort((a, b) => b.credits - a.credits)[0];
    const projectedMonthlyCredits = Math.round(workdayAverageCredits * calendar.totalWorkdays * 100) / 100;
    const projectedEndBalance = Math.round((totalMonthlyCredits - projectedMonthlyCredits) * 100) / 100;
    let exhaustionDateStr = null;
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
    let highMultiplierSavingsEstimate = 0;
    for (const m of models) {
        if (m.multiplier > 1 && m.messages > 0 && !m.model.startsWith('External')) {
            const savingsPerCall = m.multiplier - 1;
            highMultiplierSavingsEstimate += m.messages * 0.5 * savingsPerCall;
        }
    }
    highMultiplierSavingsEstimate = Math.round(highMultiplierSavingsEstimate * 100) / 100;
    const insights = [];
    if (creditDebt > 0) {
        insights.push(`Credit Debt Alert: You are carrying ${creditDebt.toFixed(1)} credits of debt from earlier workdays. Staying under ${effectiveDailyLimit.toFixed(1)} cr/workday will bring you back on budget.`);
    }
    else if (rolloverExtraCredits > 0) {
        insights.push(`Surplus Banked: You have +${rolloverExtraCredits.toFixed(1)} extra credits banked (rollover + extra credits), boosting your daily allowance from ${baseDailyLimit.toFixed(1)} to ${effectiveDailyLimit.toFixed(1)} cr/workday.`);
    }
    if (monthTotalExpensiveChats > 0) {
        insights.push(`Expensive Chats: ${monthTotalExpensiveChats} chat session(s) in ${calendar.monthName} each consumed >=${minExp}% of a full day's budget (${monthExpensive40to60} used ${minExp}-${maxExp}%, ${monthExpensiveOver60} used >${maxExp}%).`);
    }
    if (contextBloatSessionsCount > 0) {
        insights.push(`Long Thread Tax: ${contextBloatSessionsCount} marathon session(s) (>20 turns) spent ~${contextBloatCreditsWasted.toFixed(1)} credits after turn #20. Starting a fresh chat (/new) saves context tokens.`);
    }
    if (highMultiplierSavingsEstimate >= 2) {
        insights.push(`Model Optimizer: Switching 50% of high-cost (>1 cr/msg) model requests to lighter models would save ~${highMultiplierSavingsEstimate.toFixed(1)} credits/month.`);
    }
    if (exhaustionDateStr) {
        insights.push(`Burn Rate Forecast: At your current workday average (${workdayAverageCredits.toFixed(1)} cr/day), your monthly credits will run out around ${exhaustionDateStr}.`);
    }
    else {
        insights.push(`Burn Rate Forecast: At ${workdayAverageCredits.toFixed(1)} cr/workday, you are on track to finish ${calendar.monthName} with ~${Math.max(0, projectedEndBalance).toFixed(1)} credits to spare.`);
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
function computeHistoryComparison(config, realNow, selectedYear, selectedMonth, sessionsByMonth, currentMonthApiQuota, monthsBack = 6, monthlyArchives, dailyQuotaLedger) {
    const realYear = realNow.getFullYear();
    const realMonth = realNow.getMonth();
    const realMonthKey = formatMonthKey(realYear, realMonth);
    const selectedMonthKey = formatMonthKey(selectedYear, selectedMonth);
    const buildSnapshotForMonth = (y, m) => {
        const mKey = formatMonthKey(y, m);
        const isCurrent = mKey === realMonthKey;
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const refDate = isCurrent ? realNow : new Date(y, m, daysInMonth, 23, 59, 59);
        const monthSessions = sessionsByMonth[mKey] || [];
        let quotaForMonth;
        if (isCurrent) {
            quotaForMonth = currentMonthApiQuota;
        }
        else if (monthlyArchives?.[mKey]) {
            const arch = monthlyArchives[mKey];
            quotaForMonth = {
                entitlement: arch.entitlement,
                used: arch.used,
                remaining: Math.max(0, arch.entitlement - arch.used),
                unlimited: false,
                fetchedAt: arch.updatedAt
            };
        }
        else if (!config.overrideApiEntitlement && currentMonthApiQuota && currentMonthApiQuota.entitlement > 0) {
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
    const selectedSnapshot = buildSnapshotForMonth(selectedYear, selectedMonth);
    const prevDate = new Date(selectedYear, selectedMonth - 1, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth();
    const previousMonthKey = formatMonthKey(prevYear, prevMonth);
    const previousMonthLabel = `${MONTH_NAMES[prevMonth]} ${prevYear}`;
    const previousSnapshot = buildSnapshotForMonth(prevYear, prevMonth);
    const monthsHistory = [];
    for (let offset = monthsBack - 1; offset >= 0; offset--) {
        const dt = new Date(realYear, realMonth - offset, 1);
        const y = dt.getFullYear();
        const m = dt.getMonth();
        const mKey = formatMonthKey(y, m);
        const snap = mKey === selectedMonthKey
            ? selectedSnapshot
            : mKey === previousMonthKey
                ? previousSnapshot
                : buildSnapshotForMonth(y, m);
        const dailyCumulative = new Array(31).fill(0);
        const dailyCredits = new Array(31).fill(0);
        let lastCum = 0;
        for (let d = 1; d <= 31; d++) {
            const pt = snap.dailySeries[d - 1];
            if (pt) {
                dailyCredits[d - 1] = pt.credits;
                if (!pt.isFuture) {
                    lastCum = pt.cumulativeUsed;
                }
                dailyCumulative[d - 1] = pt.isFuture ? lastCum : pt.cumulativeUsed;
            }
            else {
                dailyCumulative[d - 1] = lastCum;
            }
        }
        const isCurr = mKey === realMonthKey;
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
    const compareDay = Math.min(selectedSnapshot.calendar.currentDay, previousSnapshot.calendar.daysInMonth);
    const sameDaySelectedCredits = selectedSnapshot.dailySeries[compareDay - 1]?.cumulativeUsed || selectedSnapshot.totalUsedCredits;
    const sameDayPreviousCredits = previousSnapshot.dailySeries[compareDay - 1]?.cumulativeUsed || previousSnapshot.totalUsedCredits;
    const momSameDayDeltaCredits = Math.round((sameDaySelectedCredits - sameDayPreviousCredits) * 100) / 100;
    const momSameDayDeltaPercent = sameDayPreviousCredits > 0
        ? Math.round(((sameDaySelectedCredits - sameDayPreviousCredits) / sameDayPreviousCredits) * 1000) / 10
        : sameDaySelectedCredits > 0
            ? 100
            : 0;
    const momWorkdayAvgDeltaCredits = Math.round((selectedSnapshot.workdayAverageCredits - previousSnapshot.workdayAverageCredits) * 100) / 100;
    const momWorkdayAvgDeltaPercent = previousSnapshot.workdayAverageCredits > 0
        ? Math.round(((selectedSnapshot.workdayAverageCredits - previousSnapshot.workdayAverageCredits) /
            previousSnapshot.workdayAverageCredits) *
            1000) / 10
        : 0;
    const momExpensiveChatsDelta = selectedSnapshot.monthTotalExpensiveChats - previousSnapshot.monthTotalExpensiveChats;
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
//# sourceMappingURL=tracker.js.map