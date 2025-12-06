// app-git.js — Full Professional Dashboard (All Charts + 3 Regions Always Visible)
// Requirements: Chart.js 4+, chartjs-plugin-datalabels, flatpickr

const MASTER_DATA_URL = "https://raw.githubusercontent.com/Contactinfocenter/dashboard-data/main/data/calls/all_calls.json";

// Register datalabels plugin
if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

// ---------------------------
// Colors & Config
// ---------------------------
const BILLING_ISSUE_REASON = "Billing Issue";

const GENERAL_ACHT_COLOR = '#FF8A42';
const GENERAL_VOLUME_COLOR = '#124E8C';
const BILLING_ACHT_COLOR = 'rgba(208, 0, 110, 0.7)';
const BILLING_VOLUME_COLOR = 'rgba(0, 201, 167, 0.7)';

// High-contrast, beautiful region colors
const REGION_COLORS = {
    'Rural': '#3B82F6',   // Blue-blue-500
    'Urban': '#10B981',   // emerald-500
    'N/A'  : '#8B5CF6'    // violet-500 — always stands out
};

const FCR_COLORS = ['#10B981', '#EF4444']; // Green = FCR, Red = Non-FCR

const charts = {};
let selectedDate = null;
let groupedData = {};
let availableDates = [];

// ---------------------------
// Utilities
// ---------------------------
function destroyIfExists(id) {
    if (charts[id]) {
        charts[id].destroy();
        delete charts[id];
    }
}

function formatTime(seconds) {
    if (!seconds && seconds !== 0) return "0s";
    const m = Math.floor(seconds / 60), s = Math.round(seconds % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function getHourFromDate(dateStr) {
    try {
        return String(new Date(dateStr).getHours()).padStart(2, '0');
    } catch (e) {
        return "00";
    }
}

function categorizeBillingCall(call) {
    return (call.comments || "Comment Not Provided").trim();
}

// ---------------------------
// Region Normalizer
// ---------------------------
function normalizeRegion(raw) {
    if (raw === null || raw === undefined) return "N/A";
    const v = String(raw).trim().toLowerCase();
    if (!v) return "N/A";

    const ruralSet = new Set(['rural','r','ru','village','vlg','rural area']);
    const urbanSet = new Set(['urban','u','city','town','urban area','metro','metropolitan']);
    const naSet = new Set(['n/a','na','none','-','null','undefined','unknown','unk']);

    if (ruralSet.has(v)) return "Rural";
    if (urbanSet.has(v)) return "Urban";
    if (naSet.has(v)) return "N/A";
    if (v.includes('rural')) return "Rural";
    if (v.includes('urban')) return "Urban";
    return "N/A";
}

// ---------------------------
// ENHANCED PIE CHART — Always shows Rural / Urban / N/A
// ---------------------------
function createPie(id, labels = [], dataArr = [], colors = [], isFCR = false, isRegion = false) {
    destroyIfExists(id);
    const ctx = document.getElementById(id);
    if (!ctx) return;

    let finalLabels = labels;
    let finalData = dataArr;
    let backgroundColors = colors;

    if (isRegion) {
        const allRegions = ['Rural', 'Urban', 'N/A'];
        finalLabels = allRegions;
        finalData = allRegions.map(r => {
            const idx = labels.indexOf(r);
            return idx !== -1 ? dataArr[idx] : 0;
        });
        backgroundColors = allRegions.map(r => REGION_COLORS[r]);
    } else if (isFCR) {
        backgroundColors = FCR_COLORS;
    }

    charts[id] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: finalLabels,
            datasets: [{
                data: finalData,
                backgroundColor: backgroundColors,
                borderColor: '#ffffff',
                borderWidth: 4,
                cutout: '68%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        font: { size: 13, weight: '600' },
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        color: '#1e293b'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const v = ctx.parsed;
                            const total = ctx.dataset.data.reduce((a,b) => a+b, 0);
                            const perc = total > 0 ? Math.round((v/total)*100) : 0;
                            return `${ctx.label}: ${v.toLocaleString()} (${perc}%)`;
                        }
                    }
                },
                datalabels: {
                    color: '#ffffff',
                    font: { weight: 'bold', size: 14 },
                    textStrokeColor: '#000',
                    textStrokeWidth: 3,
                    textShadowBlur: 6,
                    textShadowColor: 'rgba(0,0,0,0.7)',
                    formatter: (value) => {
                        if (value === 0) return '';
                        return value >= 100 ? value.toLocaleString() : value;
                    }
                }
            }
        }
    });
}

// ---------------------------
// Other Chart Types (unchanged but cleaned)
// ---------------------------
function createMixed(id, labels = [], datasets = []) {
    destroyIfExists(id);
    const ctx = document.getElementById(id);
    if (!ctx) return;

    charts[id] = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top' },
                datalabels: { display: false }
            },
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, grid: { borderDash: [3,4] } }
            }
        }
    });
}

function createButterflyChart(id, labels = [], leftData = [], rightData = [], leftLabel = 'Avg ACHT', rightLabel = 'Volume', title = 'Top 10 Reasons', achtColor = GENERAL_ACHT_COLOR, volumeColor = GENERAL_VOLUME_COLOR) {
    destroyIfExists(id);
    const ctx = document.getElementById(id);
    if (!ctx) return;

    charts[id] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: leftLabel,  data: leftData,  backgroundColor: achtColor,   stack: 'stack0', barPercentage: 0.8 },
                { label: rightLabel, data: rightData, backgroundColor: volumeColor, stack: 'stack0', barPercentage: 0.8 }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    position: 'top',
                    ticks: { callback: v => Math.abs(v), font: 13 },
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    border: { display: false }
                },
                y: { grid: { drawOnChartArea: false } }
            },
            plugins: {
                legend: { display: true },
                tooltip: { callbacks: { label: ctx => ctx.dataset.label + ": " + Math.abs(ctx.raw) } },
                title: { display: true, text: title, font: { size: 16 }, padding: 20 }
            }
        }
    });
}

function createRadar(id, labels = [], dataArr = [], labelName = "Volume") {
    destroyIfExists(id);
    const ctx = document.getElementById(id);
    if (!ctx) return;

    charts[id] = new Chart(ctx, {
        type: 'radar',
        data: {
            labels,
            datasets: [{
                label: labelName,
                data: dataArr,
                fill: true,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderColor: '#3B82F6',
                pointBackgroundColor: '#3B82F6',
                borderWidth: 2,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { r: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.1)' } } },
            plugins: { legend: { position: 'top' } }
        }
    });
}

// ---------------------------
// Init All Empty Charts
// ---------------------------
function initEmptyCharts() {
    createMixed("avgHourlyChart", [], []);
    createMixed("lastDayHourlyChart", [], []);
    createPie("monthRegionPie", [], [], [], false, true);
    createPie("lastDayRegionPie", [], [], [], false, true);
    createPie("monthFCRPie", ['FCR','Non-FCR'], [0,0], FCR_COLORS, true);
    createPie("lastDayFCRPie", ['FCR','Non-FCR'], [0,0], FCR_COLORS, true);
    createButterflyChart("monthButterflyChart1", [], [], []);
    createButterflyChart("dayButterflyChart", [], [], []);
    createButterflyChart("monthBillingButterfly", [], [], [], "Avg ACHT", "Avg Daily Volume", "Monthly Billing Sub-Reasons", BILLING_ACHT_COLOR, BILLING_VOLUME_COLOR);
    createButterflyChart("dayBillingButterfly", [], [], [], "Avg ACHT", "Volume", "Daily Billing Sub-Reasons", BILLING_ACHT_COLOR, BILLING_VOLUME_COLOR);
    createRadar("reasonRadarmonthly", [], []);
    createRadar("reasonRadardaily", [], []);
    createRadar("billingReasonRadarmonthly", [], []);
    createRadar("billingReasonRadardaily", [], []);
}
initEmptyCharts();

// ---------------------------
// Flatpickr
// ---------------------------
const fp = flatpickr("#datePicker", {
    dateFormat: "Y-m-d",
    allowInput: true,
    disableMobile: true,
    onChange: (selectedDates, dateStr) => {
        if (dateStr) {
            selectedDate = dateStr;
            document.getElementById('selectedDate').textContent = selectedDate;
            renderForSelectedDate();
        }
    }
});

document.getElementById('btnReload')?.addEventListener('click', () => {
    if (availableDates.length) selectLatestDate();
    fetchAndRefresh();
});

// ---------------------------
// Data Processing
// ---------------------------
function normalizeFromRows(rows) {
    const normalized = {};
    rows.forEach((row, idx) => {
        const rawDate = row.call_date || row.call_date_time || row.callDate || '';
        if (!rawDate) return;
        const dateObj = new Date(rawDate);
        if (isNaN(dateObj)) return;
        const datePart = dateObj.toISOString().slice(0,10);

        const phone = String(Math.floor(Number(row.phone_number || row.phone || "0"))).trim();
        const id = phone ? `${phone}_${Math.floor(dateObj.getTime()/1000)}` : `${datePart}_${idx}`;

        const region = normalizeRegion(row.region || row.Region || row.zone || row.Zone || '');

        if (!normalized[datePart]) normalized[datePart] = {};
        normalized[datePart][id] = {
            call_date: rawDate,
            phone_number: phone,
            status: (row.status || "").toString().toUpperCase(),
            full_name: row.full_name || row.name || row.email || "Unknown",
            Region: region,
            "Call Reason": row["Call Reason"] || row.call_reason || row.reason || "Unknown",
            acht: Number(row.acht || row.ACHT || row.length_in_sec || 0),
            comments: row.comments || row.Comments || ""
        };
    });
    return normalized;
}

// ---------------------------
// Full Rendering Functions (with fixed region pies)
// ---------------------------
function renderAveragesAndMonthPies() {
    const regionMonth = { Rural: 0, Urban: 0, 'N/A': 0 };
    const reasonStats = {};
    const billingSubReasonStats = {};
    let monthFCR = 0, monthNonFCR = 0;
    const daysCount = Math.max(1, availableDates.length);

    // Hourly accumulators
    const hourly = Array.from({length:24}, () => ({total:0, unique:new Set(), agents:new Set()}));

    availableDates.forEach(dateKey => {
        const day = groupedData[dateKey];
        Object.values(day).forEach(call => {
            const h = getHourFromDate(call.call_date);
            const idx = parseInt(h);
            hourly[idx].total++;
            if (call.phone_number) hourly[idx].unique.add(call.phone_number);
            hourly[idx].agents.add(call.full_name || "Unknown");

            regionMonth[call.Region] = (regionMonth[call.Region] || 0) + 1;

            const reason = call["Call Reason"];
            if (!reasonStats[reason]) reasonStats[reason] = {count:0, sumAcht:0};
            reasonStats[reason].count++;
            reasonStats[reason].sumAcht += call.acht;

            if (reason === BILLING_ISSUE_REASON) {
                const sub = categorizeBillingCall(call);
                if (!billingSubReasonStats[sub]) billingSubReasonStats[sub] = {count:0, sumAcht:0};
                billingSubReasonStats[sub].count++;
                billingSubReasonStats[sub].sumAcht += call.acht;
            }

            if (call.status === "FCR") monthFCR++; else monthNonFCR++;
        });
    });

    // Hourly average chart
    const hours = Array.from({length:24},(_,i)=>String(i).padStart(2,'0'));
    const avgCalls = hours.map((_,i) => Math.round(hourly[i].total / daysCount));
    const avgUnique = hours.map((_,i) => Math.round(hourly[i].unique.size / daysCount));
    const avgAgents = hours.map((_,i) => Math.round(hourly[i].agents.size / daysCount));

    createMixed("avgHourlyChart", hours, [
        { type:'bar', label:'Avg Calls', data:avgCalls, backgroundColor:'rgba(74,144,226,0.7)', borderRadius:6 },
        { type:'line', label:'Avg Unique', data:avgUnique, borderColor:'#ff6b6b', tension:0.4 },
        { type:'line', label:'Avg Agents', data:avgAgents, borderColor:'#51cf66', tension:0.4 }
    ]);

    // Region & FCR pies
    createPie("monthRegionPie", Object.keys(regionMonth), Object.values(regionMonth), [], false, true);
    createPie("monthFCRPie", ['FCR','Non-FCR'], [monthFCR, monthNonFCR], FCR_COLORS, true);

    // Top 10 Reasons Butterfly
    const topReasons = Object.entries(reasonStats)
        .map(([r,s]) => ({reason:r, avgAcht: s.count ? Math.ceil(s.sumAcht/s.count) : 0, avgVol: Math.ceil(s.count/daysCount)}))
        .sort((a,b)=>b.avgVol - a.avgVol)
        .slice(0,10);
    createButterflyChart("monthButterflyChart1", topReasons.map(x=>x.reason), topReasons.map(x=>-x.avgAcht), topReasons.map(x=>x.avgVol));

    // Billing Sub-Reasons
    const topBilling = Object.entries(billingSubReasonStats)
        .map(([sub,s]) => ({sub, avgAcht: s.count ? Math.ceil(s.sumAcht/s.count) : 0, avgVol: Math.ceil(s.count/daysCount)}))
        .sort((a,b)=>b.avgVol - a.avgVol)
        .slice(0,10);
    createButterflyChart("monthBillingButterfly", topBilling.map(x=>x.sub), topBilling.map(x=>-x.avgAcht), topBilling.map(x=>x.avgVol));

    // Radar charts
    createRadar("reasonRadarmonthly", Object.keys(reasonStats), Object.values(reasonStats).map(s=>s.count), "Monthly Reason Volume");
    createRadar("billingReasonRadarmonthly", Object.keys(billingSubReasonStats), Object.values(billingSubReasonStats).map(s=>s.count), "Monthly Billing Sub-Reason Volume");
}

function renderForSelectedDate() {
    if (!selectedDate || !groupedData[selectedDate]) return;
    const day = groupedData[selectedDate];
    const calls = Object.values(day);

    const regionDay = { Rural:0, Urban:0, 'N/A':0 };
    let fcr = 0, nonFcr = 0, totalAcht = 0;
    const reasonStats = {}, billingStats = {};
    const hourly = Array.from({length:24}, () => ({total:0, unique:new Set(), agents:new Set()}));

    calls.forEach(call => {
        const h = parseInt(getHourFromDate(call.call_date));
        hourly[h].total++;
        if (call.phone_number) hourly[h].unique.add(call.phone_number);
        hourly[h].agents.add(call.full_name || "Unknown");

        regionDay[call.Region]++;
        if (call.status === "FCR") fcr++; else nonFcr++;
        totalAcht += call.acht;

        const reason = call["Call Reason"];
        if (!reasonStats[reason]) reasonStats[reason] = {count:0, sum:0};
        reasonStats[reason].count++;
        reasonStats[reason].sum += call.acht;

        if (reason === BILLING_ISSUE_REASON) {
            const sub = categorizeBillingCall(call);
            if (!billingStats[sub]) billingStats[sub] = {count:0, sum:0};
            billingStats[sub].count++;
            billingStats[sub].sum += call.acht;
        }
    });

    // KPIs
    const totalCalls = calls.length;
    document.getElementById('kpiTotalCalls').textContent = totalCalls.toLocaleString();
    document.getElementById('kpiUniqueCallers').textContent = new Set(calls.map(c=>c.phone_number).filter(Boolean)).size.toLocaleString();
    document.getElementById('kpiActiveAgents').textContent = new Set(calls.map(c=>c.full_name)).size.toLocaleString();
    document.getElementById('kpiFCRPercent').textContent = (fcr+nonFcr ? Math.round(fcr/(fcr+nonFcr)*100) : 0) + "%";
    document.getElementById('kpiAvgHandleTime').textContent = formatTime(totalCalls ? Math.round(totalAcht/totalCalls) : 0);

    // Charts
    const hours = Array.from({length:24},(_,i)=>String(i).padStart(2,'0'));
    createMixed("lastDayHourlyChart", hours, [
        { type:'bar', label:'Calls', data:hours.map((_,i)=>hourly[i].total), backgroundColor:'rgba(251,146,60,0.8)' },
        { type:'line', label:'Unique', data:hours.map((_,i)=>hourly[i].unique.size), borderColor:'#ff6b6b' },
        { type:'line', label:'Agents', data:hours.map((_,i)=>hourly[i].agents.size), borderColor:'#51cf66' }
    ]);

    createPie("lastDayRegionPie", Object.keys(regionDay), Object.values(regionDay), [], false, true);
    createPie("lastDayFCRPie", ['FCR','Non-FCR'], [fcr, nonFcr], FCR_COLORS, true);

    const topDayReasons = Object.entries(reasonStats)
        .map(([r,s]) => ({r, vol:s.count, acht: s.count ? Math.ceil(s.sum/s.count) : 0}))
        .sort((a,b)=>b.vol - a.vol).slice(0,10);
    createButterflyChart("dayButterflyChart", topDayReasons.map(x=>x.r), topDayReasons.map(x=>-x.acht), topDayReasons.map(x=>x.vol));

    const topDayBilling = Object.entries(billingStats)
        .map(([sub,s]) => ({sub, vol:s.count, acht: s.count ? Math.ceil(s.sum/s.count) : 0}))
        .sort((a,b)=>b.vol - a.vol).slice(0,10);
    createButterflyChart("dayBillingButterfly", topDayBilling.map(x=>x.sub), topDayBilling.map(x=>-x.acht), topDayBilling.map(x=>x.vol));

    createRadar("reasonRadardaily", Object.keys(reasonStats), Object.values(reasonStats).map(s=>s.count), "Daily Reason Volume");
    createRadar("billingReasonRadardaily", Object.keys(billingStats), Object.values(billingStats).map(s=>s.count), "Daily Billing Volume");
}

function processData(grouped) {
    groupedData = grouped || {};
    availableDates = Object.keys(groupedData).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    if (!availableDates.length) {
        document.getElementById('selectedDate').textContent = "No data";
        initEmptyCharts();
        return;
    }
    if (!selectedDate || !groupedData[selectedDate]) selectLatestDate();
    renderAveragesAndMonthPies();
    renderForSelectedDate();
}

function selectLatestDate() {
    selectedDate = availableDates[availableDates.length - 1];
    document.getElementById('selectedDate').textContent = selectedDate;
    try { fp.setDate(selectedDate); } catch(e) {}
}

// ---------------------------
// Fetch & Start
// ---------------------------
async function fetchAndRefresh() {
    try {
        const res = await fetch(MASTER_DATA_URL);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const { calls } = await res.json();

        let rows = [];
        for (const date in calls) {
            const dayData = calls[date];
            if (dayData && typeof dayData === 'object') {
                rows.push(...Object.values(dayData));
            }
        }

        const grouped = normalizeFromRows(rows);
        processData(grouped);
    } catch (err) {
        console.error(err);
        document.getElementById('selectedDate').textContent = "ERROR";
    } finally {
        window.hideDashboardLoader?.();
    }
}

function selectLatestDateAndLoad() {
    selectLatestDate();
    fetchAndRefresh();
}

// Start
fetchAndRefresh();

window.__dashboard = { fetchDataAndProcess: fetchAndRefresh, groupedData, charts };