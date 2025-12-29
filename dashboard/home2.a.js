// home-2.js — FULL UPDATED VERSION with Reset button + dynamic repeat rate + combined hourly chart

const MASTER_DATA_URL = "https://raw.githubusercontent.com/Contactinfocenter/dashboard-data/main/data/calls/all_calls.json";

let rawData = {};
let agentList = [];
let agentStats = {};
let selectedDate = new Date().toISOString().split('T')[0];
let currentSelectedAgent = null;

// Chart instances
let avgHourlyChart = null;
let ahtHeatmapChart = null;
let agentVsSystemHourlyChart = null;
let talkTimeComparisonChart = null;
let repeatRateChart = null;

// ==================== MODERN TOOLTIP STYLE ====================
const modernTooltip = {
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    titleColor: '#0f172a',
    bodyColor: '#0f172a',
    borderColor: '#e2e8f0',
    borderWidth: 1.5,
    cornerRadius: 16,
    displayColors: true,
    padding: 16,
    titleFont: { size: 15, weight: 'bold' },
    bodyFont: { size: 14 },
    caretPadding: 12,
    boxPadding: 8
};

// ==================== MODERN LINE CHART BASE OPTIONS ====================
const modernLineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
        legend: { display: false },
        tooltip: modernTooltip
    },
    elements: {
        point: {
            radius: 4,
            hoverRadius: 4.5,
            backgroundColor: '#ffffff',
            borderWidth: 0.9,
            hoverBorderWidth: 4,
            hitRadius: 10
        },
        line: {
            tension: 0.42,
            borderWidth: 2,
            fill: true
        }
    },
    scales: {
        x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { size: 11.5 }, padding: 10 },
            border: { display: false }
        },
        y: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { size: 11.5 }, padding: 14 },
            beginAtZero: true,
            border: { display: false }
        }
    }
};

function destroyChart(chart) {
    if (chart) {
        chart.destroy();
        return null;
    }
    return null;
}

// ==================== LOAD DATA ====================
async function loadDataFromGitHub() {
    try {
        console.log("Fetching latest data...");
        const res = await fetch(MASTER_DATA_URL + '?t=' + Date.now());
        const json = await res.json();
        rawData = json.calls || {};
        processRawData(rawData);
        console.log(`Data loaded – ${Object.keys(rawData).length} days`);
    } catch (err) {
        console.error("Failed to load data", err);
        document.body.insertAdjacentHTML('afterbegin',
            `<div class="fixed inset-0 bg-red-600/95 text-white flex items-center justify-center z-50 text-2xl font-bold text-center p-8">
                Failed to load data<br><small>Check internet or GitHub URL</small>
             </div>`);
    }
}

loadDataFromGitHub();

// ==================== UTILITIES ====================
function safeNum(v) { return Number.isFinite(Number(v)) ? Number(v) : 0; }

function formatSecondsToMinutes(totalSeconds) {
    if (!totalSeconds || totalSeconds < 0) return "0:00";
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function updateSelectedDateDisplay(dateStr) {
    const el1 = document.getElementById('selectedDate');
    const el2 = document.getElementById('volumeChartDate');
    const el3 = document.getElementById('talkTimeChartDate');

    if (el1) el1.textContent = dateStr;
    if (el2) el2.textContent = dateStr;
    if (el3) el3.textContent = dateStr;
}

function getCallsForDate(dateStr) {
    if (rawData[dateStr]) return rawData[dateStr];
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const key = `${parts[0]}-${Number(parts[1])}-${Number(parts[2])}`;
        return rawData[key] || {};
    }
    return {};
}

function processRawData(data) {
    rawData = data || {};
    agentStats = {};

    for (const dateKey in rawData) {
        const calls = rawData[dateKey] || {};
        for (const callId in calls) {
            const call = calls[callId];
            if (!call) continue;

            const agent = (call.full_name || "Unknown").trim();
            const phone = call.phone_number || null;
            const status = call.status || "";
            const acht = safeNum(call.acht);
            const callDate = call.call_date ? new Date(call.call_date) : null;

            if (!agentStats[agent]) {
                agentStats[agent] = {
                    total: 0, fcr: 0, nonFcr: 0, ahtSum: 0,
                    uniqueCallers: new Set(),
                    callerCounts: {},
                    hourly: Array(24).fill().map(() => []),
                    firstPerDay: {}, lastPerDay: {}
                };
            }
            const s = agentStats[agent];
            s.total++;
            s.ahtSum += acht;
            if (status === "FCR") s.fcr++; else s.nonFcr++;
            if (phone) {
                s.uniqueCallers.add(phone);
                s.callerCounts[phone] = (s.callerCounts[phone] || 0) + 1;
            }
            if (callDate && !isNaN(callDate)) {
                const hr = callDate.getHours();
                s.hourly[hr].push(acht);
                const dStr = callDate.toISOString().slice(0, 10);
                if (!s.firstPerDay[dStr] || callDate < s.firstPerDay[dStr]) s.firstPerDay[dStr] = callDate;
                if (!s.lastPerDay[dStr] || callDate > s.lastPerDay[dStr]) s.lastPerDay[dStr] = callDate;
            }
        }
    }

    agentList = Object.keys(agentStats).sort((a, b) => a.localeCompare(b));
    renderKPIs();
    renderAgentChips();
    renderAllChartsAndTables();
}

// ==================== KPIs ====================
function renderKPIs() {
    const totalCalls = Object.values(agentStats).reduce((a, s) => a + s.total, 0);
    const activeAgents = agentList.length;
    const avgAht = totalCalls ? Math.round(Object.values(agentStats).reduce((a, s) => a + s.ahtSum, 0) / totalCalls) : 0;
    const topAgent = Object.entries(agentStats).sort((a, b) => b[1].total - a[1].total)[0]?.[0] || '—';

    // Same-day repeat calls (regardless of agent)
    let repeatCalls = 0;
    let totalCallsAll = 0;

    for (const dateKey in rawData) {
        const calls = rawData[dateKey] || {};
        const callerCount = {};

        for (const id in calls) {
            const call = calls[id];
            totalCallsAll++;
            const phone = call.phone_number;
            if (phone) {
                callerCount[phone] = (callerCount[phone] || 0) + 1;
            }
        }

        for (const count of Object.values(callerCount)) {
            if (count > 1) {
                repeatCalls += (count - 1);
            }
        }
    }

    const repeatPct = totalCallsAll ? Math.round((repeatCalls / totalCallsAll) * 100) : 0;

    const kpiTotalCalls = document.getElementById('kpiTotalCalls');
    const kpiActiveAgents = document.getElementById('kpiActiveAgents');
    const kpiTopAgent = document.getElementById('kpiTopAgent');
    const kpiAvgAHT = document.getElementById('kpiAvgAHT');
    const kpiRepeatPct = document.getElementById('kpiRepeatPct');

    if (kpiTotalCalls) kpiTotalCalls.textContent = totalCalls;
    if (kpiActiveAgents) kpiActiveAgents.textContent = activeAgents;
    if (kpiTopAgent) kpiTopAgent.textContent = topAgent;
    if (kpiAvgAHT) kpiAvgAHT.textContent = formatSecondsToMinutes(avgAht);
    if (kpiRepeatPct) kpiRepeatPct.textContent = repeatPct + '%';
}

function computeAvgHourlyVolume() {
    const h = Array(24).fill(0);
    let days = 0;
    for (const date in rawData) {
        const calls = rawData[date];
        const daily = Array(24).fill(0);
        let has = false;
        for (const id in calls) {
            const d = new Date(calls[id].call_date);
            if (!isNaN(d)) { daily[d.getHours()]++; has = true; }
        }
        if (has) { days++; daily.forEach((c, i) => h[i] += c); }
    }
    return h.map(v => days ? Math.round(v / days) : 0);
}

function computeSelectedDateHourlyVolume(dateStr) {
    const calls = getCallsForDate(dateStr);
    const h = Array(24).fill(0);
    for (const id in calls) {
        const d = new Date(calls[id].call_date);
        if (!isNaN(d)) h[d.getHours()]++;
    }
    return h.map(v => v > 0 ? v : null);
}

// COMBINED HOURLY CHART
function renderCombinedHourlyChart() {
    const avgData = computeAvgHourlyVolume();
    const todayData = computeSelectedDateHourlyVolume(selectedDate);

    // Destroy previous instance
    if (avgHourlyChart) {
        avgHourlyChart.destroy();
    }

    const options = {
        series: [
            {
                name: 'Average (All Time)',
                data: avgData
            },
            {
                name: selectedDate,
                data: todayData.map(v => v ?? null)  // null to break line if no data
            }
        ],
        chart: {
            type: 'area',
            height: 350,
            toolbar: { show: false },
            animations: { enabled: true }
        },
        stroke: {
            curve: 'smooth',  // ← This gives the SPLINE effect
            width: [3, 4]
        },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.7,
                opacityTo: 0.3,
                stops: [0, 90, 100]
            }
        },
        colors: ['#3b82f6', '#f59e0b'],  // Blue for average, Orange for today
        dataLabels: { enabled: false },
        tooltip: {
            shared: true,
            intersect: false,
            x: { format: 'HH:mm' }
        },
        xaxis: {
            type: 'category',
            categories: Array.from({ length: 24 }, (_, i) => `${i}:00`),
            labels: { style: { fontSize: '12px' } }
        },
        yaxis: {
            title: { text: 'Call Volume' },
            labels: { formatter: val => Math.round(val) }
        },
        legend: {
            position: 'top',
            horizontalAlign: 'center'
        },
        grid: {
            borderColor: '#e2e8f0',
            strokeDashArray: 4
        }
    };

    avgHourlyChart = new ApexCharts(document.getElementById('avgHourlyChart'), options);
    avgHourlyChart.render();
}

function renderAgentChips() {
    const containers = ['agentChipContainer', 'agentChipContainerVolume', 'agentChipContainerTalkTime'];
    containers.forEach(id => {
        const c = document.getElementById(id);
        if (!c) return;
        c.innerHTML = '';
        agentList.forEach(a => {
            const b = document.createElement('button');
            b.textContent = a;
            b.className = a === currentSelectedAgent
                ? 'text-sm text-white bg-[#f39c12] font-semibold px-4 py-2 rounded-full shadow-lg transition'
                : 'text-sm text-gray-700 bg-white/70 hover:bg-white px-4 py-2 rounded-full transition border border-gray-200';
            b.onclick = () => {
                currentSelectedAgent = a;
                containers.forEach(cid => {
                    [...document.getElementById(cid)?.children || []].forEach(btn => {
                        btn.className = btn.textContent === a
                            ? 'text-sm text-white bg-[#f39c12] font-semibold px-4 py-2 rounded-full shadow-lg transition'
                            : 'text-sm text-gray-700 bg-white/70 hover:bg-white px-4 py-2 rounded-full transition border border-gray-200';
                    });
                });
                renderAHTHeatmap(a);
                renderAgentVsSystemHourlyChart(a);
                renderTalkTimeComparisonChart(a);
            };
            c.appendChild(b);
        });
    });

    if (agentList.length && !currentSelectedAgent) {
        currentSelectedAgent = agentList[0];
        renderAgentChips();
    }
}

function renderAgentVsSystemHourlyChart(agent) {
    const agentData = getAgentHourlyVolumeOnSelectedDate(agent, selectedDate);
    const systemData = computeSelectedDateHourlyVolume(selectedDate);

    // Destroy previous ApexCharts instance if exists
    if (agentVsSystemHourlyChart) {
        agentVsSystemHourlyChart.destroy();
    }

    const options = {
        series: [
            {
                name: agent,
                data: agentData.map(v => v ?? null)  // null breaks line if no data
            },
            {
                name: 'Team Total',
                data: systemData.map(v => v ?? null)
            }
        ],
        chart: {
            type: 'area',
            height: 380,
            toolbar: { show: false },
            animations: { enabled: true }
        },
        stroke: {
            curve: 'smooth',   // ← Perfect Spline effect
            width: [4, 3]
        },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.6,
                opacityTo: 0.1,
                stops: [0, 90, 100]
            }
        },
        colors: ['#f59e0b', '#3b82f6'],  // Orange for agent, Blue for team
        dataLabels: { enabled: false },
        tooltip: {
            shared: true,
            intersect: false,
            x: { format: 'HH:mm' },
            y: {
                formatter: val => val ? val.toString() : '0'
            }
        },
        xaxis: {
            type: 'category',
            categories: Array.from({ length: 24 }, (_, i) => `${i}:00`),
            labels: { style: { fontSize: '12px', colors: '#64748b' } },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            title: { text: 'Call Volume', style: { color: '#64748b' } },
            labels: {
                style: { colors: '#64748b' },
                formatter: val => Math.round(val)
            }
        },
        legend: {
            position: 'top',
            horizontalAlign: 'center',
            fontSize: '14px',
            fontWeight: 600,
            markers: { width: 12, height: 12, radius: 12 }
        },
        grid: {
            borderColor: '#e2e8f0',
            strokeDashArray: 4,
            padding: { left: 20, right: 20 }
        }
    };

    agentVsSystemHourlyChart = new ApexCharts(
        document.getElementById('agentVsSystemHourlyCanvas'),
        options
    );
    agentVsSystemHourlyChart.render();
}

function renderTalkTimeComparisonChart(agent) {
    const { systemData, agentData } = getHourlyTalkTime(agent, selectedDate);
    const ctx = document.getElementById('talkTimeComparisonChart').getContext('2d');
    talkTimeComparisonChart = destroyChart(talkTimeComparisonChart);

    talkTimeComparisonChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({length: 24}, (_, i) => `${i}:00`),
            datasets: [
                {
                    label: `Talk Time: ${agent}`,
                    data: agentData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#ffffff'
                },
                {
                    label: 'Team Total',
                    data: systemData,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    pointBackgroundColor: '#ef4444',
                    pointBorderColor: '#ffffff'
                }
            ]
        },
        options: {
            ...modernLineChartOptions,
            plugins: {
                ...modernLineChartOptions.plugins,
                tooltip: {
                    ...modernTooltip,
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${formatSecondsToMinutes(ctx.parsed.y)}`
                    }
                },
                legend: { display: true, position: 'top' }
            }
        }
    });
}

function getHourlyTalkTime(agent, dateStr) {
    const calls = getCallsForDate(dateStr);
    const sys = Array(24).fill(0), ag = Array(24).fill(0);
    for (const id in calls) {
        const c = calls[id];
        const d = new Date(c.call_date);
        const aht = safeNum(c.acht);
        const name = (c.full_name || "Unknown").trim();
        if (!isNaN(d)) {
            const h = d.getHours();
            sys[h] += aht;
            if (name === agent) ag[h] += aht;
        }
    }
    return { systemData: sys.map(v => v > 0 ? v : null), agentData: ag.map(v => v > 0 ? v : null) };
}

function getAgentHourlyVolumeOnSelectedDate(agent, dateStr) {
    const calls = getCallsForDate(dateStr);
    const h = Array(24).fill(0);
    for (const id in calls) {
        if ((calls[id].full_name || "Unknown").trim() === agent) {
            const d = new Date(calls[id].call_date);
            if (!isNaN(d)) h[d.getHours()]++;
        }
    }
    return h.map(v => v > 0 ? v : null);
}

function computeAhtPerHour(agent) {
    const s = agentStats[agent];
    if (!s) return Array(24).fill(0);
    return s.hourly.map(arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
}

function renderAHTHeatmap(agent) {
    const data = computeAhtPerHour(agent);
    const ctx = document.getElementById('ahtHeatmapCanvas').getContext('2d');
    ahtHeatmapChart = destroyChart(ahtHeatmapChart);

    ahtHeatmapChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Array.from({length: 24}, (_, i) => `${i}:00`),
            datasets: [{
                label: `Avg AHT — ${agent}`,
                data,
                backgroundColor: data.map(v => v === 0 ? '#e2e8f0' : v > 400 ? '#f59e0b' : '#60a5fa'),
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            plugins: {
                legend: { display: false },
                tooltip: {
                    ...modernTooltip,
                    callbacks: { label: c => `${c.dataset.label}: ${formatSecondsToMinutes(c.parsed.y)}` }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: formatSecondsToMinutes, color: '#64748b' }
                }
            },
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function renderLoginSummary() {
    const c = document.getElementById('loginSummaryContainer');
    if (!c) return;
    let html = '<table class="min-w-full text-sm"><thead class="bg-gray-100 sticky"><tr><th class="px-3 py-2 text-left">Agent</th><th class="px-3 py-2 text-center">Active Days</th><th class="px-3 py-2 text-center">Total Hours</th><th class="px-3 py-2 text-center">Avg Hours/Day</th></tr></thead><tbody>';
    agentList.forEach(agent => {
        const s = agentStats[agent];
        const days = Object.keys(s.firstPerDay).map(d => {
            const f = s.firstPerDay[d], l = s.lastPerDay[d] || f;
            return { hours: Math.max(0, (l - f) / 3600000) };
        });
        const totalDays = days.length;
        const totalH = days.reduce((a, b) => a + b.hours, 0).toFixed(2);
        const avgH = totalDays ? (totalH / totalDays).toFixed(2) : '0.00';
        html += `<tr class="hover:bg-gray-50"><td class="px-3 py-2 font-semibold">${agent}</td><td class="px-3 py-2 text-center">${totalDays}</td><td class="px-3 py-2 text-center">${totalH}</td><td class="px-3 py-2 text-center">${avgH}</td></tr>`;
    });
    html += '</tbody></table>';
    c.innerHTML = html;
}

// DYNAMIC REPEAT RATE — only agents with calls on selected date
function renderRepeatRateChartForSelectedDate() {
    const calls = getCallsForDate(selectedDate);
    const agentStatsToday = {};

    for (const id in calls) {
        const c = calls[id];
        const agent = (c.full_name || "Unknown").trim();
        const phone = c.phone_number;

        if (!agentStatsToday[agent]) {
            agentStatsToday[agent] = { total: 0, unique: new Set() };
        }
        agentStatsToday[agent].total++;
        if (phone) agentStatsToday[agent].unique.add(phone);
    }

    // Only agents who have calls today
    const activeAgentsToday = Object.keys(agentStatsToday).sort((a, b) => a.localeCompare(b));

    const labels = [];
    const data = [];

    activeAgentsToday.forEach(agent => {
        const s = agentStatsToday[agent];
        const total = s.total;
        const unique = s.unique.size;
        const repeatRate = total > 0 ? Math.round(((total - unique) / total) * 100) : 0;
        labels.push(agent);
        data.push(repeatRate);
    });

    const ctx = document.getElementById('repeatRateChart').getContext('2d');
    if (repeatRateChart) repeatRateChart.destroy();

    repeatRateChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Repeat Rate %',
                data,
                backgroundColor: data.map(v => v > 30 ? '#e74c3c' : v > 15 ? '#f39c12' : '#27ae60'),
                borderRadius: 6
            }]
        },
        options: {
            plugins: {
                title: { display: true, text: `Repeat Caller Rate – ${selectedDate}`, font: { size: 16 } },
                legend: { display: false },
                tooltip: modernTooltip
            },
            scales: {
                y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } }
            },
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function renderLeaderboard() {
    const c = document.getElementById('leaderboardContainer');
    if (!c) return;
    const ranked = Object.entries(agentStats)
        .map(([a, s]) => ({ agent: a, total: s.total, fcr: s.fcr, aht: s.total ? Math.round(s.ahtSum / s.total) : 0 }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 50);
    c.innerHTML = ranked.map((r, i) => `
        <div class="flex items-center justify-between p-3 rounded-lg ${i < 3 ? 'bg-[#fef3c7]' : 'bg-white/60'} shadow">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-[#004c99] text-white flex items-center justify-center font-bold">${i + 1}</div>
                <div><div class="font-semibold">${r.agent}</div><div class="text-xs text-gray-600">Calls: ${r.total} • FCR: ${r.fcr} • AHT: ${formatSecondsToMinutes(r.aht)}</div></div>
            </div>
            <div class="text-right"><div class="text-lg font-bold">${r.total}</div><div class="text-xs text-gray-500">calls</div></div>
        </div>`).join('');
}

function renderCallSummaryTable() {
    const c = document.getElementById('callSummaryTable');
    if (!c) return;
    let html = '<table class="min-w-full text-sm"><thead class="bg-gray-100 sticky"><tr><th class="px-3 py-2 text-left">Agent</th><th class="px-3 py-2 text-center">Total Calls</th><th class="px-3 py-2 text-center">Unique Callers</th><th class="px-3 py-2 text-center">FCR</th><th class="px-3 py-2 text-center">Avg AHT</th></tr></thead><tbody>';
    agentList.forEach(a => {
        const s = agentStats[a];
        const avg = s.total ? Math.round(s.ahtSum / s.total) : 0;
        html += `<tr class="hover:bg-gray-50"><td class="px-3 py-2 font-semibold">${a}</td><td class="px-3 py-2 text-center">${s.total}</td><td class="text-center">${s.uniqueCallers.size}</td><td class="px-3 py-2 text-center">${s.fcr}</td><td class="px-3 py-2 text-center">${formatSecondsToMinutes(avg)}</td></tr>`;
    });
    html += '</tbody></table>';
    c.innerHTML = html;
}

function renderAllChartsAndTables() {
    const dates = Object.keys(rawData).sort().reverse();
    if (!selectedDate || !getCallsForDate(selectedDate)) {
        selectedDate = dates[0] || new Date().toISOString().split('T')[0];
    }
    updateSelectedDateDisplay(selectedDate);

    renderCombinedHourlyChart();

    renderLoginSummary();
    renderRepeatRateChartForSelectedDate();
    renderLeaderboard();
    renderCallSummaryTable();

    if (agentList.length) {
        const agent = currentSelectedAgent || agentList[0];
        currentSelectedAgent = agent;
        renderAHTHeatmap(agent);
        renderAgentVsSystemHourlyChart(agent);
        renderTalkTimeComparisonChart(agent);
        renderAgentChips();
    }
}

// Tabs & Events
document.addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('text-[#004c99]', 'font-semibold', 'border-b-2', 'border-[#004c99]');
        b.classList.add('text-gray-600');
    });
    btn.classList.add('text-[#004c99]', 'font-semibold', 'border-b-2', 'border-[#004c99]');
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    document.querySelector(`.tab-panel[data-panel="${btn.dataset.tab}"]`)?.classList.remove('hidden');
});

// RESET BUTTON — resets to today
function resetToToday() {
    selectedDate = new Date().toISOString().split('T')[0];
    updateSelectedDateDisplay(selectedDate);
    renderAllChartsAndTables();
}

document.getElementById('btnReload')?.addEventListener('click', resetToToday);

setTimeout(() => document.querySelector('.tab-btn[data-tab="aht"]')?.click(), 200);

try {
    flatpickr('#datePicker', {
        altInput: true,
        altFormat: "F j, Y",
        dateFormat: "Y-m-d",
        defaultDate: selectedDate,
        onChange: (dates, dateStr) => {
            selectedDate = dateStr;
            renderAllChartsAndTables();
        }
    });
} catch (e) { console.warn("flatpickr not loaded"); }