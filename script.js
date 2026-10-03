/* =========================================================================
   RANDOM DATE GENERATOR - CORE LOGIC
   ========================================================================= */

const DEFAULT_CONFIG = {
    startDate: "2005-12-15",
    endDateMode: "today", // 'today' or 'custom'
    customEndDate: "",
    excludedRanges: [
        { start: "2006-01-01", end: "2017-12-31" },
        { start: "2019-01-01", end: "2021-12-31" }
    ],
    excludedMonths: [], // Format: "YYYY-MM"
    excludedYears: [2018, 2022],
    excludedDates: [],
    allowedDates: [
        "2018-07-23",
        "2022-03-15",
        "2022-04-19",
        "2022-08-27"
    ],
    avoidRecentCount: 0,
    theme: "system"
};

let config = {};
let validDatesPool = [];
let history = [];

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    loadData();
    applyTheme();
    setupEventListeners();
    buildValidDatesPool();
    updateUI();
});

// ==========================================
// STATE MANAGEMENT & STORAGE
// ==========================================
function loadData() {
    const savedConfig = localStorage.getItem("randomDate_config");
    if (savedConfig) {
        config = JSON.parse(savedConfig);
        // Migrate missing keys if updated
        for (let key in DEFAULT_CONFIG) {
            if (config[key] === undefined) config[key] = DEFAULT_CONFIG[key];
        }
    } else {
        config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }

    const savedHistory = localStorage.getItem("randomDate_history");
    if (savedHistory) history = JSON.parse(savedHistory);
}

function saveData() {
    localStorage.setItem("randomDate_config", JSON.stringify(config));
    buildValidDatesPool(); // Rebuild pool on save
    updateUI();
}

function saveHistory() {
    localStorage.setItem("randomDate_history", JSON.stringify(history));
    renderHistory();
}

function resetDefaults() {
    if(confirm("Are you sure you want to reset all preferences to default?")) {
        config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        saveData();
    }
}

// ==========================================
// DATE MATH & POOL GENERATION
// ==========================================
function getTodayString() {
    try {
        const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });
        return formatter.format(new Date()); // Returns YYYY-MM-DD
    } catch (e) {
        // Fallback to local
        return toYMD(new Date());
    }
}

function parseDateLocal(ymdStr) {
    if (!ymdStr) return new Date();
    const parts = ymdStr.split('-');
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function toYMD(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function buildValidDatesPool() {
    const startStr = config.startDate || getTodayString();
    const endStr = config.endDateMode === 'today' ? getTodayString() : (config.customEndDate || getTodayString());
    
    let current = parseDateLocal(startStr);
    let end = parseDateLocal(endStr);
    
    validDatesPool = [];

    // Safety fallback for inverted dates
    if (current > end) return;

    while (current <= end) {
        let dStr = toYMD(current);
        
        // Check Explicitly Allowed (Overrides exclusions)
        if (config.allowedDates.includes(dStr)) {
            validDatesPool.push(dStr);
        } else if (!isExcluded(dStr, current)) {
            validDatesPool.push(dStr);
        }
        
        // Move to next day
        current.setDate(current.getDate() + 1);
    }
}

function isExcluded(dStr, dateObj) {
    const year = dateObj.getFullYear();
    const ymStr = dStr.substring(0, 7); // "YYYY-MM"

    // 1. Year Exclusion
    if (config.excludedYears.includes(year)) return true;
    
    // 2. Month Exclusion
    if (config.excludedMonths.includes(ymStr)) return true;
    
    // 3. Specific Date Exclusion
    if (config.excludedDates.includes(dStr)) return true;
    
    // 4. Range Exclusion
    for (let range of config.excludedRanges) {
        if (dStr >= range.start && dStr <= range.end) return true;
    }
    
    return false;
}

// ==========================================
// RANDOM GENERATOR
// ==========================================
function generateDate() {
    let pool = [...validDatesPool];
    
    // Filter out recently generated dates
    const avoidCount = parseInt(config.avoidRecentCount);
    if (avoidCount > 0 && history.length > 0) {
        const recentDates = history.slice(0, avoidCount).map(h => h.date);
        pool = pool.filter(d => !recentDates.includes(d));
    }

    const btn = document.getElementById('btn-generate');
    const labelDate = document.getElementById('generated-date');
    const labelDay = document.getElementById('generated-day');

    if (pool.length === 0) {
        labelDate.textContent = "No dates available";
        labelDate.style.color = "var(--danger)";
        labelDay.textContent = "Adjust preferences";
        return;
    }

    labelDate.style.color = "var(--primary)";

    // Cryptographically secure uniform random selection
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    const randomIndex = array[0] % pool.length;
    const selectedDate = pool[randomIndex];

    // Animation & Display
    labelDate.classList.remove('animating');
    void labelDate.offsetWidth; // trigger reflow
    labelDate.classList.add('animating');

    labelDate.textContent = formatDateDisplay(selectedDate);
    labelDay.textContent = formatDayOfWeek(selectedDate);

    // Save to history
    const now = new Date();
    history.unshift({
        date: selectedDate,
        timestamp: `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`
    });
    saveHistory();
}

// ==========================================
// UI FORMATTING & UPDATES
// ==========================================
function formatDateDisplay(ymdStr) {
    const date = parseDateLocal(ymdStr);
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function formatDayOfWeek(ymdStr) {
    const date = parseDateLocal(ymdStr);
    return new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(date);
}

function updateUI() {
    // 1. Prefs inputs
    document.getElementById('pref-start-date').value = config.startDate;
    document.querySelector(`input[name="endMode"][value="${config.endDateMode}"]`).checked = true;
    document.getElementById('pref-end-date').value = config.customEndDate;
    document.getElementById('pref-avoid-recent').value = config.avoidRecentCount;
    
    toggleEndDateInput();
    renderRules();
    renderHistory();
    
    // 2. Stats
    const count = validDatesPool.length;
    const countStr = count.toLocaleString();
    
    document.getElementById('main-valid-count').textContent = countStr;
    document.getElementById('prefs-valid-count').textContent = `${countStr} dates`;
    
    const endStr = config.endDateMode === 'today' ? getTodayString() : config.customEndDate;
    
    if(count === 0) {
        document.getElementById('prefs-date-range').textContent = "No valid dates inside range";
        document.getElementById('btn-generate').disabled = true;
    } else {
        document.getElementById('prefs-date-range').textContent = `${formatDateDisplay(config.startDate)} → ${formatDateDisplay(endStr)}`;
        document.getElementById('btn-generate').disabled = false;
    }
}

// ==========================================
// RULE EDITOR UI
// ==========================================
function renderRules() {
    const list = document.getElementById('rules-list');
    list.innerHTML = '';

    const createChip = (typeText, valText, typeClass, deleteFn) => {
        const div = document.createElement('div');
        div.className = `rule-chip ${typeClass}`;
        div.innerHTML = `
            <div><span class="rule-type">${typeText}:</span> ${valText}</div>
            <button class="btn-remove" aria-label="Remove rule">&times;</button>
        `;
        div.querySelector('.btn-remove').onclick = deleteFn;
        list.appendChild(div);
    };

    config.excludedRanges.forEach((r, idx) => {
        createChip('Exclude Range', `${r.start} to ${r.end}`, 'excluded', () => {
            config.excludedRanges.splice(idx, 1); saveData();
        });
    });

    config.excludedYears.forEach((y, idx) => {
        createChip('Exclude Year', y, 'excluded', () => {
            config.excludedYears.splice(idx, 1); saveData();
        });
    });

    config.excludedMonths.forEach((m, idx) => {
        createChip('Exclude Month', m, 'excluded', () => {
            config.excludedMonths.splice(idx, 1); saveData();
        });
    });

    config.excludedDates.forEach((d, idx) => {
        createChip('Exclude Date', d, 'excluded', () => {
            config.excludedDates.splice(idx, 1); saveData();
        });
    });

    config.allowedDates.forEach((d, idx) => {
        createChip('Allowed Date', d, 'allowed', () => {
            config.allowedDates.splice(idx, 1); saveData();
        });
    });

    if (list.innerHTML === '') {
        list.innerHTML = '<div style="color:var(--text-sub); font-size: 14px;">No custom rules active.</div>';
    }
}

function handleRuleTypeChange() {
    const type = document.getElementById('rule-type').value;
    const container = document.getElementById('rule-input-container');
    container.innerHTML = '';

    if (type === 'exclude-range') {
        container.innerHTML = `
            <div class="form-group"><label>From</label><input type="date" id="new-rule-start"></div>
            <div class="form-group"><label>To</label><input type="date" id="new-rule-end"></div>
        `;
    } else if (type === 'exclude-year') {
        container.innerHTML = `<div class="form-group"><label>Year</label><input type="number" id="new-rule-year" placeholder="e.g. 2018" class="rule-input-field"></div>`;
    } else if (type === 'exclude-month') {
        container.innerHTML = `<div class="form-group"><label>Month</label><input type="month" id="new-rule-month"></div>`;
    } else if (type === 'exclude-date' || type === 'allow-date') {
        container.innerHTML = `<div class="form-group"><label>Date</label><input type="date" id="new-rule-date"></div>`;
    }
}

function addRule() {
    const type = document.getElementById('rule-type').value;

    if (type === 'exclude-range') {
        const s = document.getElementById('new-rule-start').value;
        const e = document.getElementById('new-rule-end').value;
        if (s && e && s <= e) config.excludedRanges.push({start: s, end: e});
    } else if (type === 'exclude-year') {
        const y = parseInt(document.getElementById('new-rule-year').value);
        if (y) config.excludedYears.push(y);
    } else if (type === 'exclude-month') {
        const m = document.getElementById('new-rule-month').value;
        if (m) config.excludedMonths.push(m);
    } else if (type === 'exclude-date') {
        const d = document.getElementById('new-rule-date').value;
        if (d) config.excludedDates.push(d);
    } else if (type === 'allow-date') {
        const d = document.getElementById('new-rule-date').value;
        if (d) config.allowedDates.push(d);
    }
    
    saveData();
    handleRuleTypeChange(); // Reset inputs
}

// ==========================================
// HISTORY
// ==========================================
function renderHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    
    if (history.length === 0) {
        list.innerHTML = '<div class="history-empty">No dates generated yet.</div>';
        return;
    }

    history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div class="history-date">${formatDateDisplay(item.date)}</div>
            <div class="history-time">Generated ${item.timestamp}</div>
        `;
        list.appendChild(div);
    });
}

function clearHistory() {
    if(confirm("Clear all generated history?")) {
        history = [];
        saveHistory();
    }
}

// ==========================================
// THEME & UTILS
// ==========================================
function applyTheme() {
    const icon = document.getElementById('theme-icon');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    let isDark = false;
    if (config.theme === 'dark') isDark = true;
    else if (config.theme === 'light') isDark = false;
    else isDark = prefersDark;

    if (isDark) {
        document.body.classList.add('dark-theme');
        document.getElementById('meta-theme-color').content = "#000000";
        icon.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
    } else {
        document.body.classList.remove('dark-theme');
        document.getElementById('meta-theme-color').content = "#ffffff";
        icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
    }
}

function toggleTheme() {
    config.theme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
    saveData();
    applyTheme();
}

function showToast() {
    const t = document.getElementById('toast');
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
}

// ==========================================
// EVENT LISTENERS & NAVIGATION
// ==========================================
function switchTab(target) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${target}`).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelector(`.nav-item[data-target="${target}"]`).classList.add('active');
}

function toggleEndDateInput() {
    const isCustom = document.querySelector('input[name="endMode"]:checked').value === 'custom';
    document.getElementById('pref-end-date').classList.toggle('hidden', !isCustom);
}

function setupEventListeners() {
    // Nav
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.target));
    });

    // Theme
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // Generation
    document.getElementById('btn-generate').addEventListener('click', generateDate);
    document.getElementById('generated-date').addEventListener('click', () => {
        const text = document.getElementById('generated-date').textContent;
        if(text && text !== "— — —" && text !== "No dates available") {
            navigator.clipboard.writeText(text);
            showToast();
        }
    });

    // Prefs Updates
    document.getElementById('pref-start-date').addEventListener('change', (e) => { config.startDate = e.target.value; saveData(); });
    document.getElementById('pref-end-date').addEventListener('change', (e) => { config.customEndDate = e.target.value; saveData(); });
    document.querySelectorAll('input[name="endMode"]').forEach(r => {
        r.addEventListener('change', (e) => { 
            config.endDateMode = e.target.value; 
            toggleEndDateInput(); saveData(); 
        });
    });
    document.getElementById('pref-avoid-recent').addEventListener('change', (e) => { config.avoidRecentCount = e.target.value; saveData(); });
    
    // Rules
    document.getElementById('rule-type').addEventListener('change', handleRuleTypeChange);
    document.getElementById('btn-add-rule').addEventListener('click', addRule);
    document.getElementById('btn-reset').addEventListener('click', resetDefaults);

    // History
    document.getElementById('btn-clear-history').addEventListener('click', clearHistory);
    
    // Init rule inputs
    handleRuleTypeChange();
}

// Ensure theme updates if system preferences change while app is open
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if(config.theme === 'system') applyTheme();
});