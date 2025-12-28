// dashboard/home.js

const MASTER_DATA_URL = "https://raw.githubusercontent.com/Contactinfocenter/dashboard-data/main/data/calls/all_calls.json";

// Register ChartDataLabels if available
if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

// ---------------------------
// PREMIUM MODERN LINE CHART STYLE (for Chart.js only)
// ---------------------------
const modernLineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
        legend: {
            display: true,
            position: 'bottom',
            labels: {
                font: { size: 13, weight: '600' },
                padding: 20,
                usePointStyle: true,
                pointStyle: 'circle'
            }
        },
        title: { display: false },
        tooltip: {
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
        },
        datalabels: { display: false }
    },
    elements: {
        point: { radius: 4, hoverRadius: 7, backgroundColor: '#ffffff', borderWidth: 1, hoverBorderWidth: 1, hitRadius: 10 },
        line: { tension: 0.42, borderWidth: 2, fill: true }
    },
    scales: {
        x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11.5 }, padding: 10 }, border: { display: false } },
        y: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11.5 }, padding: 14 }, beginAtZero: true, border: { display: false } }
    }
};

// ---------------------------
// Config & Globals
// ---------------------------
const BILLING_ISSUE_REASON = "Billing Issue";

const GENERAL_ACHT_COLOR     = '#f59e0b';
const GENERAL_VOLUME_COLOR   = '#3b82f6';
const BILLING_ACHT_COLOR     = '#a855f7';
const BILLING_VOLUME_COLOR   = '#06b6d4';

const REGION_COLORS = {
    'Rural': '#10b981',
    'Urban': '#f59e0b',
    'N/A'  : '#94a3b8'
};

const FCR_COLORS = ['#10b981', '#f97316'];

const charts = {};  // For Chart.js
const echartsInstances = {};  // For ECharts

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
    if (echartsInstances[id]) {
        echartsInstances[id].dispose();
        delete echartsInstances[id];
    }
}

function formatTime(seconds){
    if(!seconds && seconds !== 0) return "0s";
    const m = Math.floor(seconds/60), s = Math.round(seconds%60);
    return m>0 ? `${m}m ${s}s` : `${s}s`;
}

function getHourFromDate(dateStr){
    const d = new Date(dateStr);
    return isNaN(d) ? "00" : String(d.getHours()).padStart(2,'0');
}

function categorizeBillingCall(call){
    return (call.comments || "Comment Not Provided").trim();
}

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
// ECharts Pie (Doughnut with center max % + label)
// ---------------------------
function createEChartsPie(id, labels = [], dataArr = [], isRegion = false) {
    destroyIfExists(id);
    const dom = document.getElementById(id);
    if (!dom) return;

    let finalLabels = labels;
    let finalData = dataArr;

    if (isRegion) {
        const allRegions = ['Rural', 'Urban', 'N/A'];
        finalLabels = allRegions;
        finalData = allRegions.map(r => {
            const idx = labels.indexOf(r);
            return idx !== -1 ? dataArr[idx] : 0;
        });
    }

    const total = finalData.reduce((a, b) => a + b, 0);
    const maxValue = Math.max(...finalData);
    const maxPct = total > 0 ? Math.round((maxValue / total) * 100) : 0;
    const maxLabel = finalLabels[finalData.indexOf(maxValue)];

    const option = {
        tooltip: { trigger: 'item', formatter: '{a} <br/>{b}: {c} ({d}%)' },
        legend: { orient: 'vertical', right: '5%', top: 'middle', textStyle: { fontWeight: '600', fontSize: 13, color: '#012970' } },
        series: [{
            name: 'Calls',
            type: 'pie',
            radius: ['50%', '75%'],
            avoidLabelOverlap: false,
            label: { show: false, position: 'center' },
            emphasis: { label: { show: true, fontSize: 20, fontWeight: 'bold' } },
            labelLine: { show: false },
            data: finalLabels.map((name, i) => ({ value: finalData[i], name }))
        }],
        color: isRegion ? Object.values(REGION_COLORS) : undefined,
        graphic: [
            { type: 'text', left: 'center', top: 'middle', style: { text: `${maxPct}%`, font: 'bold 48px sans-serif', fill: '#0f172a' } },
            { type: 'text', left: 'center', top: '60%', style: { text: maxLabel, font: '16px sans-serif', fill: '#64748b' } }
        ]
    };

    echartsInstances[id] = echarts.init(dom);
    echartsInstances[id].setOption(option);
    window.addEventListener('resize', () => echartsInstances[id]?.resize());
}

// ---------------------------
// Other Chart Helpers (Chart.js) remain unchanged
// ---------------------------
function createButterflyChart(/* same as before */) { /* your code */ }

function createMonthOverMonthChart(/* same */) { /* your code */ }

function createFCRTrendChart(/* same */) { /* your code */ }

// ---------------------------
// Monthly Aggregates – Now uses ECharts for line and pie
// ---------------------------
function renderAveragesAndMonthPies(){
    // ... your aggregation code same ...

    const hours = Array.from({length:24},(_,i)=>String(i).padStart(2,'0'));
    const daysCount = Math.max(1, availableDates.length);
    const avgTotalArr = hours.map(h => Math.round(sumTotal[h] / daysCount));
    const avgUniqueArr = hours.map(h => Math.round(sumUnique[h] / daysCount));
    const avgAgentsArr = hours.map(h => Math.round(sumAgents[h] / daysCount));

    // ECharts Line: Average Hourly (All Time)
    destroyIfExists("avgHourlyChart");
    const avgDom = document.getElementById('avgHourlyChart');
    if (avgDom) {
        echartsInstances["avgHourlyChart"] = echarts.init(avgDom);
        echartsInstances["avgHourlyChart"].setOption({
            tooltip: { trigger: 'axis' },
            legend: { bottom: 10 },
            grid: { left: '5%', right: '5%', top: '15%', bottom: '20%', containLabel: true },
            xAxis: { type: 'category', data: hours.map(h => `${h}:00`) },
            yAxis: { type: 'value' },
            series: [
                { name: 'Avg Calls / Hour', data: avgTotalArr, type: 'line', smooth: true, areaStyle: { opacity: 0.2 }, lineStyle: { width: 4 }, itemStyle: { color: '#3b82f6' } },
                { name: 'Avg Unique Callers', data: avgUniqueArr, type: 'line', smooth: true, areaStyle: { opacity: 0.2 }, lineStyle: { width: 4 }, itemStyle: { color: '#f59e0b' } },
                { name: 'Avg Agents Online', data: avgAgentsArr, type: 'line', smooth: true, areaStyle: { opacity: 0.2 }, lineStyle: { width: 4 }, itemStyle: { color: '#10b981' } }
            ]
        });
        window.addEventListener('resize', () => echartsInstances["avgHourlyChart"]?.resize());
    }

    // ECharts Pies
    createEChartsPie("monthRegionPie", Object.keys(regionMonth), Object.values(regionMonth), true);

    // Butterflies remain Chart.js
    // ... your butterfly code ...
}

// ---------------------------
// Daily View – ECharts line + pie
// ---------------------------
function renderForSelectedDate(){
    // ... your KPI and aggregation code ...

    const hours = Array.from({length:24},(_,i)=>String(i).padStart(2,'0'));

    // ECharts Line: Selected Date Hourly
    destroyIfExists("lastDayHourlyChart");
    const lastDom = document.getElementById('lastDayHourlyChart');
    if (lastDom) {
        echartsInstances["lastDayHourlyChart"] = echarts.init(lastDom);
        echartsInstances["lastDayHourlyChart"].setOption({
            tooltip: { trigger: 'axis' },
            legend: { bottom: 10 },
            grid: { left: '5%', right: '5%', top: '15%', bottom: '20%', containLabel: true },
            xAxis: { type: 'category', data: hours.map(h => `${h}:00`) },
            yAxis: { type: 'value' },
            series: [
                { name: 'Total Calls', data: hours.map(h => totals[h] || 0), type: 'line', smooth: true, areaStyle: { opacity: 0.2 }, lineStyle: { width: 4 }, itemStyle: { color: '#f59e0b' } },
                { name: 'Unique Callers', data: hours.map(h => unique[h]?.size || 0), type: 'line', smooth: true, areaStyle: { opacity: 0.2 }, lineStyle: { width: 4 }, itemStyle: { color: '#3b82f6' } },
                { name: 'Agents Online', data: hours.map(h => agents[h]?.size || 0), type: 'line', smooth: true, areaStyle: { opacity: 0.2 }, lineStyle: { width: 4 }, itemStyle: { color: '#10b981' } }
            ]
        });
        window.addEventListener('resize', () => echartsInstances["lastDayHourlyChart"]?.resize());
    }

    createEChartsPie("lastDayRegionPie", Object.keys(region), Object.values(region), true);

    // ... rest of your daily code (butterfly, spikes, worst hour) ...
}

// ... rest of your functions (createMonthOverMonthChart, createFCRTrendChart, renderSpikingReasons, renderWorstHourBadge, fetchAndRefresh) remain unchanged ...

// Initial load
fetchAndRefresh();

window.__dashboard = { fetchDataAndProcess, groupedData, charts, normalizeRegion };