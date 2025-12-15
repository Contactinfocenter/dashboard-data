// dashboard/home.js

const MASTER_DATA_URL = "https://raw.githubusercontent.com/Contactinfocenter/dashboard-data/main/data/calls/all_calls.json";

// Register ChartDataLabels if available
if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}
// ---------------------------
// PREMIUM MODERN LINE CHART STYLE 
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
        title: {
            display: false   // Remove title
        },
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
        datalabels: {
            display: false   // ← Removes the floating numbers (72, 65, etc.)
        }
    },
    elements: {
        point: {
            radius: 4,
            hoverRadius: 7,
            backgroundColor: '#ffffff',
            borderWidth: 1,
            hoverBorderWidth: 1,
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
            grid: { display: false },           // ← NO vertical lines
            ticks: { color: '#94a3b8', font: { size: 11.5 }, padding: 10 },
            border: { display: false }
        },
        y: {
            grid: { display: false },           // ← NO horizontal lines
            ticks: { color: '#64748b', font: { size: 11.5 }, padding: 14 },
            beginAtZero: true,
            border: { display: false }
        }
    }
};

// ---------------------------
// Config & Globals
// ---------------------------
const BILLING_ISSUE_REASON = "Billing Issue";

// MAIN PALETTE — Clean, modern, accessible
const GENERAL_ACHT_COLOR     = '#f59e0b';   // Amber-500   → warm, stands out
const GENERAL_VOLUME_COLOR   = '#3b82f6';   // Blue-500    → trust, primary
const BILLING_ACHT_COLOR     = '#a855f7';   // Purple-500  → premium feel
const BILLING_VOLUME_COLOR   = '#06b6d4';   // Cyan-500    → fresh, billing-related

// REGION — Better contrast + softer feel
const REGION_COLORS = {
    'Rural': '#10b981',   // Emerald-500  → natural, calm
    'Urban': '#f59e0b',   // Amber-500    → energy, city
    'N/A'  : '#94a3b8'    // Slate-400    → neutral, not gray
};

// FCR — Strong success vs warning
const FCR_COLORS = ['#10b981', '#f97316'];  // Emerald + Orange-500

const charts = {};
let selectedDate = null;
let groupedData = {};
let availableDates = [];

// ---------------------------
// Utilities
// ---------------------------
function destroyIfExists(id){ 
    if(charts[id]) { 
        charts[id].destroy(); 
        delete charts[id]; 
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
// Chart Helpers
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

    const total = finalData.reduce((a, b) => a + b, 0);
    const maxValue = Math.max(...finalData);
    const maxPercentage = total > 0 ? Math.round((maxValue / total) * 100) : 0;

    charts[id] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: finalLabels,
            datasets: [{
                data: finalData,
                backgroundColor: backgroundColors,
                borderColor: '#ffffff',
                borderWidth: 4,
                borderRadius: 12,
                spacing: 4,
                cutout: '75%',                    // Super thin ring
                hoverOffset: 12
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        font: { size: 13, weight: '600' },
                        color: '#1e293b'
                    }
                },
                tooltip: {
                    ...modernLineChartOptions.plugins.tooltip,
                    callbacks: {
                        label: ctx => {
                            const value = ctx.parsed;
                            const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                            return `${ctx.label}: ${value.toLocaleString()} (${pct}%)`;
                        }
                    }
                }
            }
        },
        plugins: [{
            id: 'centerText',
            afterDraw(chart) {
                const ctx = chart.ctx;
                const width = chart.width;
                const height = chart.height;
                const total = chart.data.datasets[0].data.reduce((a,b) => a+b, 0);
                const max = Math.max(...chart.data.datasets[0].data);
                const pct = Math.round((max / total) * 100);
                const label = chart.data.labels[chart.data.datasets[0].data.indexOf(max)];

                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold 48px Inter';
                ctx.fillStyle = '#0f172a';
                ctx.fillText(`${pct}%`, width / 2, height / 2);
                ctx.font = '16px Inter';
                ctx.fillStyle = '#64748b';
                ctx.fillText(label, width / 2, height / 2 + 30);
                ctx.restore();
            }
        }]
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
                {
                    label: leftLabel,
                    data: leftData,
                    backgroundColor: achtColor,
                    barPercentage: 0.8,
                    categoryPercentage: 0.8,
                    stack: 'stack0',
                    datalabels: { display: false }  // remove old datalabels
                },
                {
                    label: rightLabel,
                    data: rightData,
                    backgroundColor: volumeColor,
                    barPercentage: 0.8,
                    categoryPercentage: 0.8,
                    stack: 'stack0',
                    datalabels: { display: false }
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    position: 'top',
                    ticks: {
                        callback: v => Math.abs(v),
                        font: { size: 13 }
                    },
                    grid: { drawOnChartArea: true, color: 'rgba(0,0,0,0.05)' },
                    border: { display: false }
                },
                y: {
                    ticks: { font: { size: 14, weight: 'bold' } },
                    grid: { drawOnChartArea: false }
                }
            },
            plugins: {
                legend: { display: true, position: 'bottom',align: 'end', },
                title: { display: false, text: title, font: { size: 16 } },
                tooltip: {
                    ...modernLineChartOptions.plugins.tooltip,   // SAME BEAUTIFUL STYLE!
                    callbacks: {
                        label: (ctx) => {
                            const value = Math.abs(ctx.parsed.x);
                            const label = ctx.dataset.label || '';
                            if (label.includes('AHT') || label.includes('ACHT')) {
                                return `${label}: ${formatTime(value)}`;
                            }
                            return `${label}: ${value.toLocaleString()}`;
                        }
                    }
                },
                datalabels: { display: false }   // clean look
            }
        }
    });
}

function createTopReasonsChart(id, reasonData = {}, title = "Call Reason Distribution", limit = 8) {
    destroyIfExists(id);
    const ctx = document.getElementById(id);
    if (!ctx || !reasonData || Object.keys(reasonData).length === 0) {
        ctx && (ctx.parentElement.innerHTML = `<div class="text-center py-12 text-gray-500 italic">No data available</div>`);
        return;
    }

    // Sort and take top N
    const sorted = Object.entries(reasonData)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

    const total = sorted.reduce((sum, item) => sum + item.count, 0);
    const maxCount = Math.max(...sorted.map(d => d.count), 1);

    charts[id] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(d => d.reason),
            datasets: [{
                label: 'Calls',
                data: sorted.map(d => d.count),
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                borderColor: '#3b82f6',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
                barPercentage: 0.85,
                categoryPercentage: 0.8
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                title: {
                    display: true,
                    text: title,
                    font: { size: 16, weight: '600' },
                    color: '#1e293b',
                    padding: { bottom: 20 }
                },
                legend: { display: false },
                tooltip: {
                    ...modernLineChartOptions.plugins.tooltip,
                    callbacks: {
                        label: (ctx) => {
                            const value = ctx.parsed.x;
                            const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                            return `${value.toLocaleString()} calls (${pct}%)`;
                        }
                    }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'end',
                    color: '#1e293b',
                    font: { weight: 'bold', size: 13 },
                    formatter: (value) => value.toLocaleString(),
                    offset: 8
                }
            },
            scales: {
                x: {
                    display: false,
                    beginAtZero: true
                },
                y: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 13, weight: '500' },
                        color: '#374151',
                        padding: 10
                    },
                    border: { display: false }
                }
            },
            animation: {
                duration: 1200,
                easing: 'easeOutQuart'
            }
        },
        plugins: [ChartDataLabels] // Make sure you have ChartDataLabels registered
    });
}
// ---------------------------
// Init Empty Charts
// ---------------------------
function initEmptyCharts(){
    destroyIfExists("avgHourlyChart");
    destroyIfExists("lastDayHourlyChart");
    createPie("monthRegionPie", [], [], [], false, true);
    createPie("lastDayRegionPie", [], [], [], false, true);
    createPie("monthFCRPie", ['FCR','Non-FCR'], [0,0], FCR_COLORS, true);
    createPie("lastDayFCRPie", ['FCR','Non-FCR'], [0,0], FCR_COLORS, true);
    createButterflyChart("monthButterflyChart1", [], [], [], "Avg ACHT", "Avg Daily Volume", "Top 10 Reasons");
    createButterflyChart("dayButterflyChart", [], [], [], "Avg ACHT", "Daily Volume", "Top 10 Reasons");
    createButterflyChart("monthBillingButterfly", [], [], [], "Avg ACHT", "Avg Daily Volume", "Billing Sub-Reasons", BILLING_ACHT_COLOR, BILLING_VOLUME_COLOR);
    createButterflyChart("dayBillingButterfly", [], [], [], "Avg ACHT", "Daily Volume", "Billing Sub-Reasons", BILLING_ACHT_COLOR, BILLING_VOLUME_COLOR);

}
initEmptyCharts();

// ---------------------------
// Flatpickr & Reload
// ---------------------------
const fp = flatpickr("#datePicker", {
    dateFormat:"Y-m-d",
    allowInput:true,
    disableMobile:true,
    onChange:(selectedDates, dateStr) => {
        if(!dateStr) return;
        selectedDate = dateStr;
        document.getElementById('selectedDate').textContent = selectedDate;
        syncDateEverywhere();        // ← This is the magic line
        renderForSelectedDate();
    }
});
document.getElementById('btnReload')?.addEventListener('click', ()=>{ if(availableDates.length) selectLatestDate(); fetchAndRefresh(); });

// ---------------------------
// Data Normalization (FIXED Syntax)
// ---------------------------
function normalizeFromRows(rows){
    const normalized = {};
    rows.forEach((row, idx) => {
        const rawDate = row.call_date || row.call_date_time || row.callDate || '';
        if(!rawDate) return;

        const dateObj = new Date(rawDate);
        if(isNaN(dateObj.getTime())) return;

        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth()+1).padStart(2,'0');
        const dd = String(dateObj.getDate()).padStart(2,'0');
        const datePart = `${yyyy}-${mm}-${dd}`;

        const rawPhone = row.phone_number ?? row.phone ?? "";
        const cleanedPhone = rawPhone ? String(Math.floor(Number(rawPhone))).trim() : "";
        const timestamp = Math.floor(dateObj.getTime() / 1000);
        const id = cleanedPhone ? `${cleanedPhone}_${timestamp}` : `${datePart}_${idx}`;

        const achtVal = Number(row.acht || row.ACHT || row.length_in_sec || 0) || 0;

        const callRegion = normalizeRegion(row.region ?? row.Region ?? row.zone ?? row.Zone ?? '');

        normalized[datePart] = normalized[datePart] || {};
        normalized[datePart][id] = {
            call_date: rawDate,
            phone_number: cleanedPhone,
            status: (row.status || "").toString().toUpperCase(),
            full_name: row.full_name || row.name || row.email || "Unknown",
            Region: callRegion,
            "Call Reason": row["Call Reason"] || row.call_reason || row.reason || "Unknown",
            acht: achtVal,
            comments: row.comments || row.Comments || "",
            campaign_id: row.campaign_id || row.campaign || "",
            ACR: row.acr || row.ACR || "",
            Zone: row.zone || row.Zone || "",
            Client_type: row["Client type"] || row.client_type || ""
        };
    });
    return normalized;
}

// ---------------------------
// Main Process
// ---------------------------
function processData(grouped) {
    groupedData = grouped || {};
    availableDates = Object.keys(groupedData).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    if(!availableDates.length){
        document.getElementById('selectedDate').textContent = "No data";
        initEmptyCharts();
        return;
    }
    if(!selectedDate || !groupedData[selectedDate]) selectLatestDate();
    renderAveragesAndMonthPies();
    renderForSelectedDate();
    createMonthOverMonthChart();
    createFCRTrendChart();
}

function selectLatestDate(){
    const validDates = availableDates.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if(!validDates.length) return;
    selectedDate = validDates[validDates.length-1];
    document.getElementById('selectedDate').textContent = selectedDate;
    try { fp.setDate(selectedDate, true, "Y-m-d"); } catch(e){ /* ignore */ }
}

// NEW: Sync selected date to all places automatically
function syncDateEverywhere() {
    const date = document.getElementById('selectedDate')?.textContent || '—';
    document.querySelectorAll('.date-mirror').forEach(el => {
        el.textContent = date;
    });
}

// ---------------------------
// Monthly Aggregates with Modern Line Chart
// ---------------------------
function renderAveragesAndMonthPies(){
    const sumTotal = {}, sumUnique = {}, sumAgents = {};
    for(let i=0;i<24;i++){ const h=String(i).padStart(2,'0'); sumTotal[h]=0; sumUnique[h]=0; sumAgents[h]=0; }

    const regionMonth = {}, reasonStats = {}, billingSubReasonStats = {};
    let monthFCR=0, monthNonFCR=0;

    for(const dateKey of availableDates){
        const callsForDate = groupedData[dateKey];
        const dayTotals = {}, dayUnique = {}, dayAgents = {};
        for(const id in callsForDate){
            const call = callsForDate[id];
            const hour = getHourFromDate(call.call_date);
            const phone = call.phone_number;
            const agent = call.full_name || "Unknown";
            const region = call.Region || "N/A";
            const reason = call["Call Reason"] || "Unknown";
            const status = (call.status || "").toUpperCase();
            const duration = Number(call.acht) || 0;

            regionMonth[region] = (regionMonth[region] || 0) + 1;

            if(!reasonStats[reason]) reasonStats[reason] = { count:0, sumAcht:0 };
            reasonStats[reason].count += 1;
            reasonStats[reason].sumAcht += duration;

            if(reason === BILLING_ISSUE_REASON){
                const sub = categorizeBillingCall(call);
                if(!billingSubReasonStats[sub]) billingSubReasonStats[sub] = { count:0, sumAcht:0 };
                billingSubReasonStats[sub].count += 1;
                billingSubReasonStats[sub].sumAcht += duration;
            }

            if(status === "FCR") monthFCR++; else monthNonFCR++;

            dayTotals[hour] = (dayTotals[hour] || 0) + 1;
            if(!dayUnique[hour]) dayUnique[hour] = new Set();
            if(phone) dayUnique[hour].add(phone);
            if(!dayAgents[hour]) dayAgents[hour] = new Set();
            dayAgents[hour].add(agent);
        }
        for(let i=0;i<24;i++){
            const h = String(i).padStart(2,'0');
            sumTotal[h] += (dayTotals[h] || 0);
            sumUnique[h] += (dayUnique[h] ? dayUnique[h].size : 0);
            sumAgents[h] += (dayAgents[h] ? dayAgents[h].size : 0);
        }
    }

    const hours = Array.from({length:24},(_,i)=>String(i).padStart(2,'0'));
    const daysCount = Math.max(1, availableDates.length);
    const avgTotalArr = hours.map(h => Math.round(sumTotal[h] / daysCount));
    const avgUniqueArr = hours.map(h => Math.round(sumUnique[h] / daysCount));
    const avgAgentsArr = hours.map(h => Math.round(sumAgents[h] / daysCount));

    // MODERN LINE CHART: Average Hourly (All Time)
    console.log('Creating modern avgHourlyChart...'); // Debug
    destroyIfExists("avgHourlyChart");
    const avgCtx = document.getElementById("avgHourlyChart");
    if (avgCtx) {
        charts["avgHourlyChart"] = new Chart(avgCtx, {
            type: 'line',
            data: {
                labels: hours.map(h => `${h}:00`),
                datasets: [
                    {
                        label: 'Avg Calls / Hour',
                        data: avgTotalArr,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.14)',
                        pointBackgroundColor: '#3b82f6',
                        pointBorderColor: '#ffffff'
                    },
                    {
                        label: 'Avg Unique Callers',
                        data: avgUniqueArr,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(251, 146, 11, 0.14)',
                        pointBackgroundColor: '#f59e0b',
                        pointBorderColor: '#ffffff'
                    },
                    {
                        label: 'Avg Agents Online',
                        data: avgAgentsArr,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.14)',
                        pointBackgroundColor: '#10b981',
                        pointBorderColor: '#ffffff'
                    }
                ]
            },
            options: {
                ...modernLineChartOptions,
                plugins: {
                    ...modernLineChartOptions.plugins,
                    title: { display: false, text: 'Average Hourly Activity (All Time)', font: { size: 16 } }
                }
            }
        });
        console.log('avgHourlyChart created successfully');
    } else {
        console.error('Canvas "avgHourlyChart" not found!');
    }

    // Monthly Pies & Butterflies
    createPie("monthRegionPie", Object.keys(regionMonth), Object.keys(regionMonth).map(l => regionMonth[l]), [], false, true);
    createPie("monthFCRPie", ['FCR','Non-FCR'], [monthFCR, monthNonFCR], FCR_COLORS, true);

    const reasonDataArr = Object.keys(reasonStats).map(r => {
        const s = reasonStats[r];
        return { reason: r, leftMetric: s.count>0 ? Math.ceil(s.sumAcht / s.count) : 0, rightMetric: Math.ceil(s.count / daysCount) };
    }).sort((a,b)=>b.rightMetric - a.rightMetric).slice(0,10);
    createButterflyChart("monthButterflyChart1", reasonDataArr.map(i=>i.reason), reasonDataArr.map(i=>-i.leftMetric), reasonDataArr.map(i=>i.rightMetric));

    const billingDataArr = Object.keys(billingSubReasonStats).map(r => {
        const s = billingSubReasonStats[r];
        return { subReason: r, leftMetric: s.count>0 ? Math.ceil(s.sumAcht / s.count) : 0, rightMetric: Math.ceil(s.count / daysCount) };
    }).sort((a,b)=>b.rightMetric - a.rightMetric).slice(0,10);
    createButterflyChart("monthBillingButterfly", billingDataArr.map(i=>i.subReason), billingDataArr.map(i=>-i.leftMetric), billingDataArr.map(i=>i.rightMetric), "Avg ACHT", "Avg Daily Volume", "Billing Sub-Reasons", BILLING_ACHT_COLOR, BILLING_VOLUME_COLOR);
}

// ---------------------------
// Daily View with Modern Line Chart
// ---------------------------
function renderForSelectedDate(){
    if(!selectedDate || !groupedData[selectedDate]) return;
    const callsForDate = groupedData[selectedDate];

    const totals = {}, unique = {}, agents = {}, region = {};
    let fcr = 0, nonFcr = 0, totalAcht = 0;
    const dayReasonStats = {}, dayBillingSubReasonStats = {};

    for(const id in callsForDate){
        const call = callsForDate[id];
        const hour = getHourFromDate(call.call_date);
        const ph = call.phone_number;
        const ag = call.full_name || "Unknown";
        const rg = call.Region || "N/A";
        const reason = call["Call Reason"] || "Unknown";
        const st = (call.status || "").toUpperCase();
        const duration = Number(call.acht) || 0;

        totals[hour] = (totals[hour] || 0) + 1;
        if(!unique[hour]) unique[hour] = new Set();
        if(ph) unique[hour].add(ph);
        if(!agents[hour]) agents[hour] = new Set();
        agents[hour].add(ag);

        region[rg] = (region[rg] || 0) + 1;

        if(st === "FCR") fcr++; else nonFcr++;
        totalAcht += duration;

        if(!dayReasonStats[reason]) dayReasonStats[reason] = { count:0, sumAcht:0 };
        dayReasonStats[reason].count += 1; dayReasonStats[reason].sumAcht += duration;

        if(reason === BILLING_ISSUE_REASON){
            const sub = categorizeBillingCall(call);
            if(!dayBillingSubReasonStats[sub]) dayBillingSubReasonStats[sub] = { count:0, sumAcht:0 };
            dayBillingSubReasonStats[sub].count += 1;
            dayBillingSubReasonStats[sub].sumAcht += duration;
        }
    }

    const totalCalls = Object.values(totals).reduce((a,b)=>a+b,0);
    document.getElementById('kpiTotalCalls').textContent = (totalCalls || 0).toLocaleString();

    const uniqueCount = new Set(Object.values(callsForDate).map(c => c.phone_number).filter(Boolean)).size;
    document.getElementById('kpiUniqueCallers').textContent = uniqueCount.toLocaleString();

    const agentCount = new Set(Object.values(callsForDate).map(c => c.full_name || c.email).filter(Boolean)).size;
    document.getElementById('kpiActiveAgents').textContent = agentCount.toLocaleString();

    const fcrPercent = fcr + nonFcr > 0 ? Math.round((fcr/(fcr+nonFcr))*100) : 0;
    document.getElementById('kpiFCRPercent').textContent = fcrPercent + "%";

    const avgHandle = totalCalls > 0 ? Math.round(totalAcht / totalCalls) : 0;
    document.getElementById('kpiAvgHandleTime').textContent = formatTime(avgHandle);

    const hours = Array.from({length:24},(_,i)=>String(i).padStart(2,'0'));

    // MODERN LINE CHART: Selected Date Hourly
    console.log('Creating modern lastDayHourlyChart...'); // Debug
    destroyIfExists("lastDayHourlyChart");
    const lastCtx = document.getElementById("lastDayHourlyChart");
    if (lastCtx) {
        charts["lastDayHourlyChart"] = new Chart(lastCtx, {
            type: 'line',
            data: {
                labels: hours.map(h => `${h}:00`),
                datasets: [
                    {
                        label: 'Total Calls',
                        data: hours.map(h => totals[h] || 0),
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(251, 146, 11, 0.16)',
                        pointBackgroundColor: '#f59e0b',
                        pointBorderColor: '#ffffff'
                    },
                    {
                        label: 'Unique Callers',
                        data: hours.map(h => unique[h]?.size || 0),
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.14)',
                        pointBackgroundColor: '#3b82f6',
                        pointBorderColor: '#ffffff'
                    },
                    {
                        label: 'Agents Online',
                        data: hours.map(h => agents[h]?.size || 0),
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.14)',
                        pointBackgroundColor: '#10b981',
                        pointBorderColor: '#ffffff'
                    }
                ]
            },
            options: {
                ...modernLineChartOptions,
                plugins: {
                    ...modernLineChartOptions.plugins,
                    title: { display: false, text: `Hourly Call – ${selectedDate}`, font: { size: 16 } }
                }
            }
        });
        console.log('lastDayHourlyChart created successfully');
    } else {
        console.error('Canvas "lastDayHourlyChart" not found!');
    }

    createPie("lastDayRegionPie", Object.keys(region), Object.keys(region).map(l => region[l]), [], false, true);
    createPie("lastDayFCRPie", ['FCR','Non-FCR'], [fcr, nonFcr], FCR_COLORS, true);

    const dayTop = Object.keys(dayReasonStats).map(r=>{
        const s = dayReasonStats[r];
        return { reason:r, volume:s.count, acht: s.count>0 ? Math.ceil(s.sumAcht/s.count) : 0 };
    }).sort((a,b)=>b.volume - a.volume).slice(0,10);
    createButterflyChart("dayButterflyChart", dayTop.map(i=>i.reason), dayTop.map(i=>-i.acht), dayTop.map(i=>i.volume));

    const billingDayTop = Object.keys(dayBillingSubReasonStats).map(r=>{
        const s = dayBillingSubReasonStats[r];
        return { subReason:r, volume:s.count, acht: s.count>0 ? Math.ceil(s.sumAcht/s.count) : 0 };
    }).sort((a,b)=>b.volume - a.volume).slice(0,10);
    createButterflyChart("dayBillingButterfly", billingDayTop.map(i=>i.subReason), billingDayTop.map(i=>-i.acht), billingDayTop.map(i=>i.volume), "Avg ACHT", "Daily Volume", "Daily Billing Sub-Reasons", BILLING_ACHT_COLOR, BILLING_VOLUME_COLOR);
    
    renderSpikingReasons();
    renderWorstHourBadge();
}

// ---------------------------
// Month-over-Month Charts
// ---------------------------
function createMonthOverMonthChart() {
    destroyIfExists("monthOverMonthChart");

    const monthlyStats = {};
    for (const dateKey in groupedData) {
        const [y, m] = dateKey.split('-');
        const monthKey = `${y}-${m}`;
        if (!monthlyStats[monthKey]) {
            monthlyStats[monthKey] = { calls: 0, achtSum: 0, days: 0 };
        }
        const day = groupedData[dateKey];
        const dayCalls = Object.keys(day).length;
        let dayAchtSum = 0;
        for (const id in day) {
            dayAchtSum += Number(day[id].acht) || 0;
        }
        monthlyStats[monthKey].calls += dayCalls;
        monthlyStats[monthKey].achtSum += dayAchtSum;
        monthlyStats[monthKey].days += 1;
    }

    const sortedMonths = Object.keys(monthlyStats).sort();
    const labels = sortedMonths.map(m => {
        const [y, mNum] = m.split('-');
        return new Date(y, mNum - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    });

    const volumeData = sortedMonths.map(m => Math.round(monthlyStats[m].calls / monthlyStats[m].days));
    const ahtData = sortedMonths.map(m => {
        const avg = monthlyStats[m].calls > 0 ? monthlyStats[m].achtSum / monthlyStats[m].calls : 0;
        return Math.round(avg);
    });

    charts["monthOverMonthChart"] = new Chart(document.getElementById("monthOverMonthChart"), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'bar',
                    label: 'Avg Daily Calls',
                    data: volumeData,
                    backgroundColor: 'rgba(74, 144, 226, 0.75)',
                    borderColor: '#3b82f6',
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false,
                    barPercentage: 0.8,
                    yAxisID: 'y'
                },
                {
                    type: 'line',
                    label: 'Avg AHT (seconds)',
                    data: ahtData,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    borderWidth: 5,
                    tension: 0.4,
                    pointBackgroundColor: '#ef4444',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 4,
                    pointRadius: 8,
                    pointHoverRadius: 11,
                    fill: true,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                title: {
                    display: false,
                    text: 'Month-over-Month: Volume vs AHT',
                    font: { size: 16, weight: '600' },
                    color: '#1e293b',
                    padding: { top: 10, bottom: 20 }
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: { size: 13, weight: '600' },
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        color: '#1e293b'
                    },
                    onHover: (e) => e.native.target.style.cursor = 'pointer'
                },
                tooltip: {
                    ...modernLineChartOptions.plugins.tooltip,   // SAME PREMIUM STYLE!
                    callbacks: {
                        title: (ctx) => ctx[0].label,
                        label: (ctx) => {
                            if (ctx.dataset.label.includes('AHT')) {
                                const secs = ctx.parsed.y;
                                const mins = Math.floor(secs / 60);
                                const sec = secs % 60;
                                return `${ctx.dataset.label}: ${mins}m ${sec}s`;
                            }
                            return `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748b', font: { size: 12 } },
                    border: { display: false }
                },
                y: {
                    position: 'left',
                    beginAtZero: true,
                    title: { display: true, text: 'Avg Daily Calls', color: '#3b82f6', font: { size: 13 } },
                    grid: { color: 'rgba(148, 163, 184, 0.15)', drawOnChartArea: true },
                    ticks: { color: '#64748b', padding: 10 }
                },
                y1: {
                    position: 'right',
                    beginAtZero: true,
                    title: { display: true, text: 'Avg AHT (seconds)', color: '#ef4444', font: { size: 13 } },
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#ef4444', padding: 10 }
                }
            },
            animation: {
                duration: 1200,
                easing: 'easeOutQuart'
            }
        }
    });
}

// ---------------------------
// FCR Trend Chart 
// ---------------------------
function createFCRTrendChart() {
    destroyIfExists("fcrTrendChart");

    const monthlyFCR = {};
    for (const dateKey in groupedData) {
        const [y, m] = dateKey.split('-');
        const monthKey = `${y}-${m}`;
        if (!monthlyFCR[monthKey]) monthlyFCR[monthKey] = { fcr: 0, total: 0 };
        const day = groupedData[dateKey];
        for (const id in day) {
            if ((day[id].status || "").toUpperCase() === "FCR") monthlyFCR[monthKey].fcr++;
            monthlyFCR[monthKey].total++;
        }
    }

    const sorted = Object.keys(monthlyFCR).sort();
    const labels = sorted.map(m => {
        const [y, mNum] = m.split('-');
        return new Date(y, mNum - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    });

    const fcrPercent = sorted.map(m => {
        const data = monthlyFCR[m];
        return data.total > 0 ? Math.round((data.fcr / data.total) * 100) : 0;
    });

    charts["fcrTrendChart"] = new Chart(document.getElementById("fcrTrendChart"), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'FCR %',
                data: fcrPercent,
                borderColor: '#10b981',                    // Emerald green
                backgroundColor: 'rgba(16, 185, 129, 0.18)', // Soft fill
                borderWidth: 5,
                tension: 0.42,
                fill: true,
                pointBackgroundColor: '#10b981',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 4,
                pointRadius: 8,
                pointHoverRadius: 11,
                pointHoverBackgroundColor: '#ffffff',
                pointHoverBorderColor: '#10b981',
                pointHoverBorderWidth: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                title: {
                    display: false,
                    text: 'First Call Resolution (FCR%) Trend',
                    font: { size: 16, weight: '600' },
                    color: '#1e293b',
                    padding: { top: 10, bottom: 25 }
                },
                legend: { display: false },
                tooltip: {
                    ...modernLineChartOptions.plugins.tooltip,   // SAME PREMIUM TOOLTIP!
                    callbacks: {
                        label: (ctx) => `FCR: ${ctx.parsed.y}%`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748b', font: { size: 12 } },
                    border: { display: false }
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: 'rgba(148, 163, 184, 0.15)', lineWidth: 1.5 },
                    ticks: {
                        callback: v => v + '%',
                        color: '#64748b',
                        font: { size: 12 },
                        padding: 10
                    },
                    border: { display: false }
                }
            },
            elements: {
                line: { borderJoinStyle: 'round' }
            },
            animation: {
                duration: 1200,
                easing: 'easeOutQuart'
            }
        }
    });
}


// ---------------------------
// Spiking Reasons 
// ---------------------------
function renderSpikingReasons() {
    if (!selectedDate || !groupedData[selectedDate]) {
        document.getElementById('spikesContainer').innerHTML = '<div style="color:#94a3b8; font-style:italic;">No data available</div>';
        return;
    }

    const today = selectedDate;
    const recentDates = availableDates.filter(d => d < today).slice(-7);

    const todayCount = {};
    const historyCount = {};

    Object.values(groupedData[today] || {}).forEach(c => {
        const r = c["Call Reason"] || "Unknown";
        todayCount[r] = (todayCount[r] || 0) + 1;
    });

    recentDates.forEach(date => {
        Object.values(groupedData[date] || {}).forEach(c => {
            const r = c["Call Reason"] || "Unknown";
            historyCount[r] = (historyCount[r] || 0) + 1;
        });
    });

    const spikes = [];
    const avgDays = recentDates.length || 1;

    for (const reason of new Set([...Object.keys(todayCount), ...Object.keys(historyCount)])) {
        const today = todayCount[reason] || 0;
        const avg7 = (historyCount[reason] || 0) / avgDays;
        const diff = today - avg7;
        // Use 1000 for New Spike when avg7 is 0, to ensure it shows up significantly
        const pct = avg7 > 0 ? (today / avg7 - 1) * 100 : (today > 0 ? 1000 : 0); 

        // Retained original spike logic: absolute difference >= 8 OR absolute percentage >= 40
        if (Math.abs(diff) >= 8 || Math.abs(pct) >= 40) {
            spikes.push({ reason, today, avg7: Math.round(avg7), diff: Math.round(diff), pct: Math.round(pct) });
        }
    }

    spikes.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    const container = document.getElementById('spikesContainer');

    if (spikes.length === 0) {
        container.innerHTML = `<div style="color:#16a34a; font-weight:600; font-size:15px;">No significant spikes – smooth day!</div>`;
        return;
    }

    // --- UPDATED VISUAL RENDERING LOGIC ---

    const colors = ['#38a1f4', '#f59e0b', '#ef4444', '#4ade80', '#3b82f6', '#f97316', '#a855f7', '#64748b']; // Colors for the reason dot

    const topSpikes = spikes.slice(0, 8);

    let htmlContent = `
        <div style="font-size:18px; font-weight:600; color:#1f2937; margin-bottom:12px;">
            Spike Reasons <span style="font-size:14px; color:#6b7280; float:right;"></span>
        </div>
        <div style="border-top: 1px solid #e5e7eb;"></div>
        <div style="display:flex; flex-direction:column; gap:4px; padding-top:12px;">
    `;

    htmlContent += topSpikes.map((s, index) => {
        const color = colors[index % colors.length];

        const pctText = s.pct > 999 ? 'New Spike' : (s.pct >= 0 ? '+' + s.pct : s.pct) + '%';
        const trendSymbol = s.diff > 0 ? '↑' : '↓';
        const trendColor = s.diff > 0 ? '#dc2626' : '#16a34a'; // Red for up, Green for down

        return `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                
                <div style="display:flex; align-items:center;">
                    <div style="width:10px; height:10px; background-color:${color}; border-radius:2px; margin-right:8px;"></div>
                    
                    <div style="font-size:16px; color:#1f2937; font-weight:500;">${s.reason}</div>
                    
                    <div style="font-size:16px; font-weight:600; color:#1f2937; margin-left:8px;">
                        ${s.today.toLocaleString()}
                    </div>

                </div>
                
                <div style="font-size:15px; color:${trendColor}; font-weight:600; white-space:nowrap;">
                    (${pctText}) ${trendSymbol}
                </div>
            </div>
        `;
    }).join('');

    htmlContent += '</div>';

    container.innerHTML = htmlContent;
}

// ---------------------------
// Worst Hour Badges
// ---------------------------

function renderWorstHourBadge() {
    if (!selectedDate || !groupedData[selectedDate]) {
        document.getElementById('worstHourBadge').textContent = '— : —';
        return;
    }

    const hourly = Array(24).fill(0);
    Object.values(groupedData[selectedDate]).forEach(c => {
        const h = parseInt(getHourFromDate(c.call_date));
        if (!isNaN(h)) hourly[h]++;
    });

    let max = 0, worst = 0;
    for (let h = 0; h < 24; h++) {
        if (hourly[h] > max) { max = hourly[h]; worst = h; }
    }

    const start = String(worst).padStart(2, '0');
    const end = String(worst + 1).padStart(2, '0');
    const badge = document.getElementById('worstHourBadge');

    badge.innerHTML = `
        <div class="text-2xl font-bold">${start}:00</div>
        <div class="text-sm text-gray-600">${max.toLocaleString()} calls</div>
    `;

    // Optional: color based on severity
    if (max > 800) badge.className = 'text-red-600';
    else if (max > 500) badge.className = 'text-orange-600';
    else badge.className = 'text-gray-900';
}
// ---------------------------
// Fetch & Load
// ---------------------------
async function fetchAndRefresh(){
    document.getElementById('selectedDate').textContent = "Loading...";
    try {
        const res = await fetch(MASTER_DATA_URL);
        if(!res.ok) throw new Error("HTTP " + res.status);
        const wrapper = await res.json();

        const callsByDate = wrapper.calls;
        if(!callsByDate || typeof callsByDate !== 'object') throw new Error("'calls' object missing or invalid in JSON");

        let rows = [];
        for(const dayKey in callsByDate){
            const dayObj = callsByDate[dayKey];
            if(!dayObj || typeof dayObj !== 'object') continue;
            rows = rows.concat(Object.values(dayObj));
        }

        const grouped = normalizeFromRows(rows);
        processData(grouped);

    } catch(err){
        console.error("Failed to fetch/process MASTER_DATA_URL:", err);
        document.getElementById('selectedDate').textContent = "ERROR loading data";
    } finally {
        window.hideDashboardLoader?.();
    }
}

function fetchDataAndProcess(){ return fetchAndRefresh(); }

// Initial load
fetchAndRefresh();

window.__dashboard = { fetchDataAndProcess, groupedData, charts, normalizeRegion };