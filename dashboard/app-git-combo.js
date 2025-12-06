// app-git.js — Single-file dashboard (JSON from GitHub)
// Requirements: Chart.js, chartjs-plugin-datalabels, flatpickr must be loaded in HTML.

const MASTER_DATA_URL = "https://raw.githubusercontent.com/Contactinfocenter/dashboard-data/main/data/calls/all_calls.json";

// Ensure ChartDataLabels is registered if available globally
if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

// ---------------------------
// Config & Globals
// ---------------------------
const BILLING_ISSUE_REASON = "Billing Issue";

const GENERAL_ACHT_COLOR = '#FF8A42';
const GENERAL_VOLUME_COLOR = '#124E8C';
const BILLING_ACHT_COLOR = 'rgba(208, 0, 110, 0.5)';
const BILLING_VOLUME_COLOR = 'rgba(0, 201, 167, 0.5)';

const REGION_COLORS = { 'Rural':'#4A90E2', 'Urban':'#7ED321', 'N/A':'#555555' };
const FCR_COLORS = ['#4A90E2','#fb923c'];

const charts = {};
let selectedDate = null;
let groupedData = {};
let availableDates = [];

// ---------------------------
// Utilities
// ---------------------------
function destroyIfExists(id){ if(charts[id]) { charts[id].destroy(); delete charts[id]; } }
function formatTime(seconds){ if(!seconds && seconds !== 0) return "0s"; const m=Math.floor(seconds/60), s=Math.round(seconds%60); return m>0?`${m}m ${s}s`:`${s}s`; }
function getHourFromDate(dateStr){ try{ return String(new Date(dateStr).getHours()).padStart(2,'0'); }catch(e){ return "00"; } }
function categorizeBillingCall(call){ return (call.comments || "Comment Not Provided").trim(); }

// ---------------------------
// Region normalizer (STRICT: only Rural / Urban / N/A)
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

  // If the raw string contains 'rural' or 'urban' as substring, prefer that
  if (v.includes('rural')) return "Rural";
  if (v.includes('urban')) return "Urban";

  // default to N/A
  return "N/A";
}

// ---------------------------
// Chart helpers
// ---------------------------
function createMixed(id, labels=[], datasets=[]){
  destroyIfExists(id);
  const ctx = document.getElementById(id);
  if(!ctx) return;
  charts[id] = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      interaction:{ mode:'index', intersect:false },
      plugins:{ legend:{ position:'top' }, datalabels: { display:false } },
      scales:{ x:{ grid:{ display:false } }, y:{ beginAtZero:true, grid:{ borderDash:[2,4] } } }
    }
  });
}

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

function createButterflyChart(id, labels=[], leftData=[], rightData=[], leftLabel='Avg ACHT', rightLabel='Volume', title='Top 10 Reasons', achtColor=GENERAL_ACHT_COLOR, volumeColor=GENERAL_VOLUME_COLOR){
  destroyIfExists(id);
  const ctx = document.getElementById(id);
  if(!ctx) return;
  charts[id] = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[
      { label:leftLabel, data:leftData, backgroundColor:achtColor, barPercentage:0.8, categoryPercentage:0.8, stack:'stack0', datalabels:{ color:'#000', anchor:'middle', align:'left', formatter:v=>Math.abs(v) } },
      { label:rightLabel, data:rightData, backgroundColor:volumeColor, barPercentage:0.8, categoryPercentage:0.8, stack:'stack0', datalabels:{ color:'#000', anchor:'end', align:'right' } }
    ]},
    options:{
      indexAxis:'y',
      responsive:true,
      maintainAspectRatio:false,
      scales:{ x:{ position:'top', ticks:{ callback:v=>Math.abs(v), font:{ size:13 } }, grid:{ drawOnChartArea:true, color:'rgba(0,0,0,0.05)' }, border:{ display:false } }, y:{ ticks:{ font:{ size:14, weight:'bold' } }, grid:{ drawOnChartArea:false } } },
      plugins:{ legend:{ display:true }, tooltip:{ callbacks:{ label: ctx => ctx.dataset.label + ": " + Math.abs(ctx.raw) } }, title:{ display:true, text:title, font:{ size:16 } } }
    }
  });
}

function createRadar(id, labels = [], dataArr = [], labelName = "Count") {
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
                borderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                backgroundColor: "rgba(74,144,226,0.25)",
                borderColor: "#4A90E2"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    min: 0,
                    grid: { color: "rgba(0,0,0,0.1)" },
                    angleLines: { color: "rgba(0,0,0,0.15)" },
                    ticks: { backdropColor: "transparent" }
                }
            },
            plugins: {
                legend: { display: true }
            }
        }
    });
}

// ---------------------------
// Create empty charts first so DOM is stable
// ---------------------------
function initEmptyCharts(){
  createMixed("avgHourlyChart", [], []);
  createMixed("lastDayHourlyChart", [], []);
  createPie("monthRegionPie", [], [], [], false, true);
  createPie("lastDayRegionPie", [], [], [], false, true);
  createPie("monthFCRPie", ['FCR','Non-FCR'], [0,0], FCR_COLORS, true);
  createPie("lastDayFCRPie", ['FCR','Non-FCR'], [0,0], FCR_COLORS, true);
  createButterflyChart("monthButterflyChart1", [], [], [], "Avg ACHT", "Avg Daily Volume", "Top 10 Reasons");
  createButterflyChart("dayButterflyChart", [], [], [], "Avg ACHT", "Daily Volume", "Top 10 Reasons");
  createButterflyChart("monthBillingButterfly", [], [], [], "Avg ACHT", "Avg Daily Volume", "Billing Sub-Reasons", BILLING_ACHT_COLOR, BILLING_VOLUME_COLOR);
  createButterflyChart("dayBillingButterfly", [], [], [], "Avg ACHT", "Daily Volume", "Billing Sub-Reasons", BILLING_ACHT_COLOR, BILLING_VOLUME_COLOR);
  
  // Radar charts from original request
  createRadar("reasonRadarmonthly", [], []);
  createRadar("reasonRadardaily", [], []);
    
  // New Radar charts for Billing Sub-Reasons
  createRadar("billingReasonRadarmonthly", [], []);
  createRadar("billingReasonRadardaily", [], []);
}
initEmptyCharts();

// ---------------------------
// Flatpickr
// ---------------------------
const fp = flatpickr("#datePicker", {
  dateFormat:"Y-m-d",
  allowInput:true,
  disableMobile:true,
  onChange:(selectedDates, dateStr) => { if(!dateStr) return; selectedDate = dateStr; document.getElementById('selectedDate').textContent = selectedDate; renderForSelectedDate(); }
});
document.getElementById('btnReload')?.addEventListener('click', ()=>{ if(availableDates.length) selectLatestDate(); fetchAndRefresh(); });

// ---------------------------
// Normalization: from flattened rows -> grouped-by-date object
// ---------------------------
function normalizeFromRows(rows){
  const normalized = {};
  rows.forEach((row, idx) => {
    // call_date may be "2025-11-01 00:08:00"
    const rawDate = row.call_date || row.call_date_time || row.callDate || '';
    if(!rawDate) return; // skip rows without date

    // date part for grouping
    const datePartRaw = String(rawDate).split(' ')[0];
    // ensure yyyy-mm-dd with zero padded month/day
    const dateObj = new Date(rawDate);
    if(Number.isNaN(dateObj.getTime())) return; // skip invalid date rows
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth()+1).padStart(2,'0');
    const dd = String(dateObj.getDate()).padStart(2,'0');
    const datePart = `${yyyy}-${mm}-${dd}`;

    // create ID: phone_acht_idx to reduce collisions
    const rawPhone = row.phone_number ?? row.phone ?? "";
    const cleanedPhone = rawPhone ? String(Math.floor(Number(rawPhone))).trim() : "";
    const achtVal = (row.acht === null || row.acht === undefined) ? 0 : Number(row.acht || row.ACHT || row.length_in_sec || 0);

    const id = cleanedPhone ? `${cleanedPhone}_${Math.max(0, Math.floor(new Date(rawDate).getTime()/1000))}` : `${datePart}_${idx}`;

    const callRegion = normalizeRegion(row.region ?? row.Region ?? row.zone ?? row.Zone ?? '');

    normalized[datePart] = normalized[datePart] || {};
    normalized[datePart][id] = {
      call_date: rawDate,
      phone_number: cleanedPhone,
      status: (row.status || "").toString().toUpperCase(),
      full_name: row.full_name || row.name || row.email || "Unknown",
      Region: callRegion,
      "Call Reason": row["Call Reason"] || row.call_reason || row.reason || "Unknown",
      acht: Number(achtVal || 0),
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
// Main process functions
// ---------------------------
function processData(grouped) {
  groupedData = grouped || {};
  availableDates = Object.keys(groupedData).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if(!availableDates.length){
    document.getElementById('selectedDate').textContent = "No data";
    // reset charts to empty
    initEmptyCharts();
    return;
  }
  // pick latest valid date if none selected or selected not present
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
  try { fp.setDate(selectedDate, true, "Y-m-d"); } catch(e){ /* ignore flatpickr errors */ }
}

// ---------------------------
// Rendering: Aggregations & Charts
// ---------------------------
function renderAveragesAndMonthPies(){
  // initialize
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
    // accumulate per day into month totals
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

  createMixed("avgHourlyChart", hours, [
    { type:'bar', label:'Avg Calls', data:avgTotalArr, backgroundColor:'rgba(74,144,226,0.6)', borderRadius:4, barPercentage:0.6 },
    { type:'line', label:'Avg Unique', data:avgUniqueArr, borderColor:'rgba(255,99,132,1.0)', borderWidth:2, tension:0.4, pointRadius:3 },
    { type:'line', label:'Avg Agents', data:avgAgentsArr, borderColor:'rgba(86,201,138,1.0)', borderWidth:2, tension:0.4, pointRadius:3 }
  ]);

  const monthRegionLabels = Object.keys(regionMonth);
  const monthRegionVals = monthRegionLabels.map(l => regionMonth[l]);
  createPie("monthRegionPie", monthRegionLabels, monthRegionVals, [], false, true);
  createPie("monthFCRPie", ['FCR','Non-FCR'], [monthFCR, monthNonFCR], FCR_COLORS, true);

  // Month reasons butterfly (top 10)
  const reasonDataArr = Object.keys(reasonStats).map(r => {
    const s = reasonStats[r];
    return { reason: r, leftMetric: s.count>0 ? Math.ceil(s.sumAcht / s.count) : 0, rightMetric: Math.ceil(s.count / daysCount) };
  }).sort((a,b)=>b.rightMetric - a.rightMetric).slice(0,10);

  createButterflyChart("monthButterflyChart1", reasonDataArr.map(i=>i.reason), reasonDataArr.map(i=>-i.leftMetric), reasonDataArr.map(i=>i.rightMetric));

  // Month billing breakdown
  const billingDataArr = Object.keys(billingSubReasonStats).map(r => {
    const s = billingSubReasonStats[r];
    return { subReason: r, leftMetric: s.count>0 ? Math.ceil(s.sumAcht / s.count) : 0, rightMetric: Math.ceil(s.count / daysCount) };
  }).sort((a,b)=>b.rightMetric - a.rightMetric).slice(0,10);

  createButterflyChart("monthBillingButterfly", billingDataArr.map(i=>i.subReason), billingDataArr.map(i=>-i.leftMetric), billingDataArr.map(i=>i.rightMetric), "Avg ACHT", "Avg Daily Volume", "Monthly Billing Sub-Reasons", BILLING_ACHT_COLOR, BILLING_VOLUME_COLOR);
  
  // FIX: Monthly Radar: Total Call Reason Volume
  const monthlyReasonLabels = Object.keys(reasonStats);
  const monthlyReasonCounts = monthlyReasonLabels.map(r => reasonStats[r].count);

  createRadar(
      "reasonRadarmonthly",
      monthlyReasonLabels,
      monthlyReasonCounts,
      "Monthly Volume"
  );
    
  // NEW: Monthly Radar: Billing Sub-Reason Volume
  const monthlyBillingReasonLabels = Object.keys(billingSubReasonStats);
  const monthlyBillingReasonCounts = monthlyBillingReasonLabels.map(r => billingSubReasonStats[r].count);

  createRadar(
      "billingReasonRadarmonthly",
      monthlyBillingReasonLabels,
      monthlyBillingReasonCounts,
      "Monthly Billing Sub-Reason Volume"
  );
}

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
      dayBillingSubReasonStats[sub].count += 1; dayBillingSubReasonStats[sub].sumAcht += duration;
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
  createMixed("lastDayHourlyChart", hours, [
    { type:'bar', label:'Total', data: hours.map(h => totals[h] || 0), backgroundColor:'rgba(255,179,64,0.7)', borderRadius:4, barPercentage:0.6 },
    { type:'line', label:'Unique', data: hours.map(h => unique[h]?.size || 0), borderColor:'rgba(255,99,132,1.0)', borderWidth:2, tension:0.4, pointRadius:3 },
    { type:'line', label:'Agents', data: hours.map(h => agents[h]?.size || 0), borderColor:'rgba(86,201,138,1.0)', borderWidth:2, tension:0.4, pointRadius:3 }
  ]);

  const regLabels = Object.keys(region);
  const regVals = regLabels.map(l => region[l]);
  createPie("lastDayRegionPie", regLabels, regVals, [], false, true);
  createPie("lastDayFCRPie", ['FCR','Non-FCR'], [fcr, nonFcr], FCR_COLORS, true);

  // Day reasons
  const dayTop = Object.keys(dayReasonStats).map(r=>{
    const s = dayReasonStats[r];
    return { reason:r, volume:s.count, acht: s.count>0 ? Math.ceil(s.sumAcht/s.count) : 0 };
  }).sort((a,b)=>b.volume - a.volume).slice(0,10);

  createButterflyChart("dayButterflyChart", dayTop.map(i=>i.reason), dayTop.map(i=>-i.acht), dayTop.map(i=>i.volume));

  // Day billing
  const billingDayTop = Object.keys(dayBillingSubReasonStats).map(r=>{
    const s = dayBillingSubReasonStats[r];
    return { subReason:r, volume:s.count, acht: s.count>0 ? Math.ceil(s.sumAcht/s.count) : 0 };
  }).sort((a,b)=>b.volume - a.volume).slice(0,10);

  createButterflyChart("dayBillingButterfly", billingDayTop.map(i=>i.subReason), billingDayTop.map(i=>-i.acht), billingDayTop.map(i=>i.volume), "Avg ACHT", "Daily Volume", "Daily Billing Sub-Reasons", BILLING_ACHT_COLOR, BILLING_VOLUME_COLOR);
    
  // FIX: Daily Radar: Selected Date Call Reason Counts
  const dailyReasonLabels = Object.keys(dayReasonStats);
  const dailyReasonCounts = dailyReasonLabels.map(r => dayReasonStats[r].count);

  createRadar(
      "reasonRadardaily",
      dailyReasonLabels,
      dailyReasonCounts,
      "Daily Volume"
  );
    
  // NEW: Daily Radar: Billing Sub-Reason Volume
  const dailyBillingReasonLabels = Object.keys(dayBillingSubReasonStats);
  const dailyBillingReasonCounts = dailyBillingReasonLabels.map(r => dayBillingSubReasonStats[r].count);

  createRadar(
      "billingReasonRadardaily",
      dailyBillingReasonLabels,
      dailyBillingReasonCounts,
      "Daily Billing Sub-Reason Volume"
  );
}

// ---------------------------
// NEW CHART 1: Month-over-Month Volume + Avg AHT
// ---------------------------
function createMonthOverMonthChart() {
    destroyIfExists("monthOverMonthChart");

    // Group by YYYY-MM
    const monthlyStats = {};

    for (const dateKey in groupedData) {
        const [y, m] = dateKey.split('-');
        const monthKey = `${y}-${m}`;
        if (!monthlyStats[monthKey]) {
            monthlyStats[monthKey] = {
                calls: 0,
                achtSum: 0,
                fcr: 0,
                totalResolved: 0,
                days: 0
            };
        }
        const day = groupedData[dateKey];
        const dayCalls = Object.keys(day).length;
        let dayAchtSum = 0;
        let dayFcr = 0;

        for (const id in day) {
            const c = day[id];
            const duration = Number(c.acht) || 0;
            dayAchtSum += duration;
            if ((c.status || "").toUpperCase() === "FCR") dayFcr++;
        }

        monthlyStats[monthKey].calls += dayCalls;
        monthlyStats[monthKey].achtSum += dayAchtSum;
        monthlyStats[monthKey].fcr += dayFcr;
        monthlyStats[monthKey].totalResolved += dayCalls;
        monthlyStats[monthKey].days += 1;
    }

    // Sort months chronologically
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
                    backgroundColor: 'rgba(74, 144, 226, 0.7)',
                    borderRadius: 6,
                    yAxisID: 'y'
                },
                {
                    type: 'line',
                    label: 'Avg AHT (seconds)',
                    data: ahtData,
                    borderColor: '#ff6b6b',
                    backgroundColor: '#ff6b6b',
                    borderWidth: 4,
                    pointBackgroundColor: 'rgba(255,107,107,0.1)',
                    tension: 0.4,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                title: { display: true, text: 'Month-over-Month: Volume vs Average Handle Time', font: { size: 16 } },
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        afterLabel: ctx => {
                            if (ctx.dataset.label.includes('AHT')) {
                                const secs = ctx.parsed.y;
                                return `     ${Math.floor(secs/60)}m ${secs%60}s`;
                            }
                            return '';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Avg Daily Calls' },
                    grid: { drawOnChartArea: false }
                },
                y1: {
                    position: 'right',
                    beginAtZero: true,
                    title: { display: true, text: 'Avg AHT (seconds)', color: '#ff6b6b' },
                    ticks: { color: '#ff6b6b' },
                    grid: { drawOnChartArea: false }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
    renderSpikingReasons();
  renderWorstHourBadge();
}

// ---------------------------
// NEW CHART 2: Month-over-Month FCR% Trend
// ---------------------------
function createFCRTrendChart() {
    destroyIfExists("fcrTrendChart");

    // Reuse the same monthlyStats from above (or recalculate – we do it again safely)
    const monthlyFCR = {};

    for (const dateKey in groupedData) {
        const [y, m] = dateKey.split('-');
        const monthKey = `${y}-${m}`;
        if (!monthlyFCR[monthKey]) monthlyFCR[monthKey] = { fcr: 0, total: 0 };

        const day = groupedData[dateKey];
        for (const id in day) {
            const c = day[id];
            if ((c.status || "").toUpperCase() === "FCR") monthlyFCR[monthKey].fcr++;
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
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                borderWidth: 5,
                pointBackgroundColor: '#10b981',
                pointRadius: 7,
                pointHoverRadius: 10,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'First Call Resolution (FCR%) Trend', font: { size: 16 } },
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => `FCR: ${ctx.parsed.y}%` } }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { callback: v => v + '%' }
                },
                x: { grid: { display: false } }
            }
        }
    });
}
// ---------------------------
// Fetch JSON, flatten, normalize & process
// ---------------------------
async function fetchAndRefresh(){
  try {
    const res = await fetch(MASTER_DATA_URL);
    if(!res.ok) throw new Error("HTTP " + res.status);
    const wrapper = await res.json();

    // wrapper.calls is expected to be an object keyed by date
    const callsByDate = wrapper.calls;
    if(!callsByDate || typeof callsByDate !== 'object') throw new Error("'calls' object missing or invalid in JSON");

    // flatten to rows array
    let rows = [];
    for(const dayKey in callsByDate){
      const dayObj = callsByDate[dayKey];
      if(!dayObj || typeof dayObj !== 'object') continue;
      const values = Object.values(dayObj);
      rows = rows.concat(values);
    }

    // normalize and group by real YYYY-MM-DD dates
    const grouped = normalizeFromRows(rows);
    processData(grouped);

  } catch(err){
    console.error("Failed to fetch/process MASTER_DATA_URL:", err);
    document.getElementById('selectedDate').textContent = "ERROR loading data";
  }
}

// alias for UI button
function fetchDataAndProcess(){ return fetchAndRefresh(); }

// ──────────────────────────────────────────────────
// 2. Top 5 Spiking Reasons Today vs 7-day average
// ──────────────────────────────────────────────────
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
    const pct = avg7 > 0 ? (today / avg7 - 1) * 100 : (today > 0 ? 1000 : 0);

    // Only show meaningful changes
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

  container.innerHTML = spikes.slice(0, 8).map(s => {
    const isUp = s.diff > 0;
    const color = isUp ? '#dc2626' : '#16a34a';
    const arrow = isUp ? '↑' : '↓';
    const pctText = s.pct > 999 ? 'new' : (s.pct >= 0 ? '+' + s.pct : s.pct) + '%';

    return `
      <div style="background:${isUp ? '#fee2e2' : '#dcfce7'}; color:${color}; 
                  padding:10px 16px; border-radius:12px; font-weight:600; 
                  font-size:14px; min-width:180px; text-align:center;
                  border: 1px solid ${isUp ? '#fecaca' : '#bbf7d0'}; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        <div style="font-size:13px; opacity:0.9; margin-bottom:4px;">${s.reason}</div>
        <div style="font-size:18px;">${s.today.toLocaleString()} <span style="font-size:14px;">(${pctText}) ${arrow}</span></div>
      </div>
    `;
  }).join('');
}

// ──────────────────────────────────────────────────
// 3. Worst Hour of the Day Badge (by call volume)
// ──────────────────────────────────────────────────
function renderWorstHourBadge() {
  if (!selectedDate || !groupedData[selectedDate]) return;

  const hourly = Array(24).fill(0);
  Object.values(groupedData[selectedDate]).forEach(c => {
    const h = parseInt(getHourFromDate(c.call_date));
    hourly[h]++;
  });

  let max = 0, worst = 0;
  for (let h = 0; h < 24; h++) {
    if (hourly[h] > max) {
      max = hourly[h];
      worst = h;
    }
  }

  const start = String(worst).padStart(2, '0');
  const end = String(worst + 1).padStart(2, '0');
  const badge = document.getElementById('worstHourBadge');

  badge.textContent = `Worst hour: ${start}:00 – ${end}:00 (${max.toLocaleString()} calls)`;
  badge.style.background = max > 800 ? '#fecaca' : max > 500 ? '#fed7aa' : '#d4d4d8';
  badge.style.color = max > 800 ? '#7f1d1d' : '#451a03';
  
}

// initial load
fetchAndRefresh();

// At the very end of fetchAndRefresh()
window.hideDashboardLoader();

// debugging helpers
window.__dashboard = { fetchDataAndProcess, groupedData, charts, normalizeRegion };