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

function createPie(id, labels=[], dataArr=[], colors=[], isFCR=false, isRegion=false){
  destroyIfExists(id);
  const ctx = document.getElementById(id);
  if(!ctx) return;
  let backgroundColors;
  if(isFCR) backgroundColors = FCR_COLORS;
  else if(isRegion) backgroundColors = labels.map(l => REGION_COLORS[l] || REGION_COLORS['N/A']);
  else backgroundColors = colors;

  charts[id] = new Chart(ctx, {
    type:'doughnut',
    data:{ labels, datasets:[{ data:dataArr, backgroundColor:backgroundColors, borderWidth:4, borderColor:'#fff', cutout:'70%' }] },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{ display:false },
        datalabels:{
          color:'#0f1724',
          font:{ weight:'bold', size:12 },
          align:'end',
          anchor:'end',
          offset:12,
          formatter:(value, ctx) => {
            if(!value || value === 0) return '';
            const total = ctx.chart.data.datasets[0].data.reduce((a,b)=>a+b,0);
            const perc = total>0?Math.round((value/total)*100):0;
            const label = ctx.chart.data.labels[ctx.dataIndex];
            if(isFCR) return `${perc}%\n${label}`;
            if(isRegion) return `${value.toLocaleString()}\n${label}`;
            return perc > 1 ? `${value.toLocaleString()}\n${label}` : '';
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

// initial load
fetchAndRefresh();

// debugging helpers
window.__dashboard = { fetchDataAndProcess, groupedData, charts, normalizeRegion };