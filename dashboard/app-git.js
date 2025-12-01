// app-git.js — ES Module (CSV/Git version)
// Replaces Firebase with PapaParse + GitHub RAW CSV while keeping ALL charts & functions intact.

// --- External libraries expected in the page ---
// 1) Chart.js + ChartDataLabels loaded already
// 2) flatpickr loaded already

// Import PapaParse directly as an ES module (requires <script type="module"> in HTML)


const MASTER_CSV_URL = "https://raw.githubusercontent.com/Contactinfocenter/dashboard-data/main/data/calls/calls-master.csv";

// --- REMOVED: ensurePapa() function and PAPAPARSE_CDN as they are replaced by the ES import ---
// --- Note: The HTML must load this file using <script type="module" src="app-git.js"></script> ---
// ------------------------------------------------------------------

Chart.register(ChartDataLabels);

const charts = {};
let selectedDate = null;
let groupedData = {};
let availableDates = [];

// --- CONFIGURATION ---
const BILLING_ISSUE_REASON = "Billing Issue";

// --- COLOR DEFINITIONS ---
const GENERAL_ACHT_COLOR = '#FF8A42'; // Orange
const GENERAL_VOLUME_COLOR = '#124E8C'; // Dark Blue
const BILLING_ACHT_COLOR = '#D0006E'; // Vibrant Magenta
const BILLING_VOLUME_COLOR = '#00C9A7'; // Bright Teal

const REGION_COLORS = {
  'Rural': '#4A90E2', 
  'Urban': '#7ED321', 
  'N/A': '#D0021B',   
  'Unknown': '#555555' 
};
const FCR_COLORS=['#4A90E2','#fb923c'];

// --- CHART HELPERS (Kept verbatim) ---
function destroyIfExists(id){
  if(charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function createMixed(id, labels=[], datasets=[]){
  destroyIfExists(id);
  const ctx = document.getElementById(id);
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive:true,
      maintainAspectRatio:false,
      interaction:{ mode:'index', intersect:false },
      plugins:{ legend:{ position:'top' }, datalabels: { display: false } },
      scales: { 
        x:{ grid: { display: false } }, 
        y:{ beginAtZero:true, grid: { borderDash: [2, 4] } } 
      }
    }
  });
}

function createPie(id, labels=[], dataArr=[], colors=[], isFCR=false, isRegion=false){
  destroyIfExists(id);
  const ctx = document.getElementById(id);

  let backgroundColors;
  if(isFCR){
    backgroundColors = FCR_COLORS;
  } else if(isRegion){
    backgroundColors = labels.map(label => REGION_COLORS[label] || REGION_COLORS['Unknown']);
  } else {
    backgroundColors = colors;
  }

  charts[id] = new Chart(ctx, {
    type:'doughnut',
    data:{ labels, datasets:[{ data: dataArr, backgroundColor: backgroundColors, borderWidth:5, borderColor:'#fff', cutout:'70%', hoverOffset:10 }] },
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
          offset: 12,
          
          formatter: (value, context)=>{
            if(value===0) return '';
            const label = context.chart.data.labels[context.dataIndex];
            const total = context.chart.data.datasets[0].data.reduce((a,b)=>a+b,0);
            const valueStr = value.toLocaleString();
            
            let perc = total>0 ? Math.round((value/total)*100) : 0;
            
            if(isFCR){
              return `${perc}%\n${label}`;
            } else if (isRegion){
              return `${valueStr}\n${label}`;
            } else {
              if(perc > 1){
                return `${valueStr}\n${label}`;
              } else {
                return '';
              }
            }
          }
        }
      }
    }
  });
}

function createButterflyChart(id, labels, leftData, rightData, leftLabel='Avg ACHT', rightLabel='Volume', title='Top 10 Reasons', achtColor=GENERAL_ACHT_COLOR, volumeColor=GENERAL_VOLUME_COLOR){
  destroyIfExists(id);
  const ctx = document.getElementById(id);
  charts[id] = new Chart(ctx, {
    type:'bar',
    data:{
      labels,
      datasets:[
        {
          label:leftLabel,
          data:leftData,
          backgroundColor:achtColor, 
          barPercentage:0.8,
          categoryPercentage:0.8,
          stack:'stack0',
          datalabels:{
            color:'#000',
            anchor:'middle',
            align:'left',
            formatter:v => Math.abs(v)
          }
        },
        {
          label:rightLabel,
          data:rightData,
          backgroundColor:volumeColor, 
          barPercentage:0.8,
          categoryPercentage:0.8,
          stack:'stack0',
          datalabels:{
            color:'#000',
            anchor:'end',
            align:'right'
          }
        }
      ]
    },
    options:{
      indexAxis:'y',
      responsive:true,
      maintainAspectRatio:false,
      scales:{
        x:{
          position:'top',
          ticks:{ callback:v=>Math.abs(v), font:{ size:13 } },
          grid:{ drawOnChartArea:true, color:'rgba(0,0,0,0.05)' },
          border:{ display:false }
        },
        y:{ ticks:{ font:{ size:14, weight:'bold' } }, grid:{ drawOnChartArea:false } }
      },
      plugins:{
        legend:{ display:true },
        tooltip:{ callbacks:{ label: ctx => ctx.dataset.label+": "+Math.abs(ctx.raw) } },
        title:{ display:true, text:title, font:{ size:16 } }
      }
    }
  });
}

function initEmptyCharts(){
  createMixed("avgHourlyChart", [], []);
  createMixed("lastDayHourlyChart", [], []);
  createPie("monthRegionPie", [], [], [], false, true); 
  createPie("lastDayRegionPie", [], [], [], false, true); 
  createPie("monthFCRPie", [], [], [], true);
  createPie("lastDayFCRPie", [], [], [], true);
  createButterflyChart("monthButterflyChart1", [], [], [], "Avg ACHT", "Avg Daily Volume", "Top 10 Reasons: Avg Volume vs ACHT");
  createButterflyChart("dayButterflyChart", [], [], [], "Avg ACHT", "Daily Volume", "Top 10 Reasons: Volume vs ACHT");
  createButterflyChart("monthBillingButterfly", [], [], [], "Avg ACHT", "Avg Daily Volume", "Monthly Billing Sub-Reasons: Avg Volume vs ACHT", BILLING_ACHT_COLOR, BILLING_VOLUME_COLOR);
  createButterflyChart("dayBillingButterfly", [], [], [], "Avg ACHT", "Daily Volume", "Daily Billing Sub-Reasons: Volume vs ACHT", BILLING_ACHT_COLOR, BILLING_VOLUME_COLOR);
}
initEmptyCharts();

// --- DATE PICKER & HELPERS (Kept verbatim) ---
const fp = flatpickr("#datePicker", {
  dateFormat:"Y-m-d",
  allowInput:true,
  disableMobile:"true",
  onChange:(selectedDates,dateStr)=>{
    if(!dateStr) return;
    selectedDate = dateStr;
    document.getElementById('selectedDate').textContent = selectedDate;
    renderForSelectedDate();
  }
});

document.getElementById('btnReload').addEventListener('click', ()=>{
  if(availableDates.length) selectLatestDate();
  // re-fetch CSV
  fetchCsvAndProcess();
});

function formatTime(seconds){
  if(!seconds) return "0s";
  const m = Math.floor(seconds/60);
  const s = seconds%60;
  return m>0?`${m}m ${s}s`:`${s}s`;
}

function getHourFromDate(dateStr){
  try{ return String(new Date(dateStr).getHours()).padStart(2,'0'); }catch(e){ return "00"; }
}

// Simplified normalizer: The original normalizeData is kept for legacy support if needed, 
// but it's not strictly necessary if we rely on normalizeFromRows, which is now simplified/integrated.
// Keeping processSnapshot to call normalizeFromRows, which is the preferred CSV processing path.

function normalizeFromRows(rows){
  // This function is now the primary data cleaning/structuring step
  const normalized = {};
  rows.forEach((row, idx) => {
    // Map and clean data points
    const dateStr = row.call_date ? String(row.call_date).split('T')[0] : 'Unknown';
    const id = row.id || `${dateStr}_${idx}`;
    
    normalized[dateStr] = normalized[dateStr] || {};
    normalized[dateStr][id] = {
        // Mandatory fields
        call_date: row.call_date,
        phone_number: row.phone_number,
        status: (row.status||'').toUpperCase(),
        full_name: row.full_name || row.email || 'Unknown',
        // Normalization for different column names
        Region: row.Region || row.Zone || 'Unknown', 
        "Call Reason": row["Call Reason"] || row.call_reason || 'Unknown',
        // ACHT normalization
        acht: Number(row.length_in_sec || row.ACR || row.acht || 0),
        comments: row.comments || 'Comment Not Provided'
    };
  });
  return normalized;
}

// Original processSnapshot function, renamed to processData to reflect source change
function processData(data){
  groupedData = data;
  availableDates = Object.keys(groupedData).sort();
  if(!selectedDate || !groupedData[selectedDate]) selectLatestDate();
  renderAveragesAndMonthPies();
  renderForSelectedDate();
}

function selectLatestDate(){
  if(!availableDates.length) return;
  selectedDate = availableDates[availableDates.length-1];
  document.getElementById('selectedDate').textContent = selectedDate;
  fp.setDate(selectedDate,true,"Y-m-d");
}

function categorizeBillingCall(call){
  return (call.comments || "Comment Not Provided").trim();
}

// --- Averages & Monthly Charts (Kept verbatim) ---
function renderAveragesAndMonthPies(){
  const sumTotal={}, sumUnique={}, sumAgents={};
  for(let i=0;i<24;i++){ const h=String(i).padStart(2,'0'); sumTotal[h]=0; sumUnique[h]=0; sumAgents[h]=0; }

  const regionMonth={}, reasonStats={}, billingSubReasonStats={};
  let monthFCR=0, monthNonFCR=0;

  for(const dateKey of availableDates){
    const callsForDate=groupedData[dateKey];
    const dayTotals={}, dayUnique={}, dayAgents={};
    for(const id in callsForDate){
      const call=callsForDate[id];
      const hour=getHourFromDate(call.call_date);
      const phone=call.phone_number;
      const agent=call.full_name||call.email||"Unknown";
      const region=call.Region||"Unknown";
      const reason=call["Call Reason"]||call.call_reason||"Unknown";
      const status=(call.status||"").toUpperCase();
      const duration=Number(call.acht)||0;

      regionMonth[region]=(regionMonth[region]||0)+1;

      if(!reasonStats[reason]) reasonStats[reason]={ count:0, sumAcht:0 };
      reasonStats[reason].count+=1;
      reasonStats[reason].sumAcht+=duration;
      
      // Filter and categorize for billing
      if(reason === BILLING_ISSUE_REASON){
          const subReason = categorizeBillingCall(call);
          if(!billingSubReasonStats[subReason]) billingSubReasonStats[subReason]={ count:0, sumAcht:0 };
          billingSubReasonStats[subReason].count+=1;
          billingSubReasonStats[subReason].sumAcht+=duration;
      }

      if(status==="FCR") monthFCR++; else monthNonFCR++;

      dayTotals[hour]=(dayTotals[hour]||0)+1;
      if(!dayUnique[hour]) dayUnique[hour]=new Set();
      if(phone) dayUnique[hour].add(phone);
      if(!dayAgents[hour]) dayAgents[hour]=new Set();
      dayAgents[hour].add(agent);
    }
    for(let i=0;i<24;i++){
      const h=String(i).padStart(2,'0');
      sumTotal[h]+=(dayTotals[h]||0);
      sumUnique[h]+=(dayUnique[h]?dayUnique[h].size:0);
      sumAgents[h]+=(dayAgents[h]?dayAgents[h].size:0);
    }
  }

  const hours=Array.from({length:24},(_,i)=>String(i).padStart(2,'0'));
  const daysCount = availableDates.length||1;
  const avgTotalArr = hours.map(h=>Math.round(sumTotal[h]/daysCount));
  const avgUniqueArr = hours.map(h=>Math.round(sumUnique[h]/daysCount));
  const avgAgentsArr = hours.map(h=>Math.round(sumAgents[h]/daysCount));

  createMixed("avgHourlyChart", hours, [
    { type:'bar', label:'Avg Calls', data:avgTotalArr, backgroundColor:'rgba(74,144,226,0.6)', borderRadius:4, barPercentage:0.6, categoryPercentage:0.8, order:2 },
    { type:'line', label:'Avg Unique', data:avgUniqueArr, borderColor:'rgba(255,99,132,1.0)', borderWidth:2, tension:0.4, pointRadius:3, pointBackgroundColor:'rgba(255,99,132,1.0)', fill:false, order:1 },
    { type:'line', label:'Avg Agents', data:avgAgentsArr, borderColor:'rgba(86,201,138,1.0)', borderWidth:2, tension:0.4, pointRadius:3, pointBackgroundColor:'rgba(86,201,138,1.0)', fill:false, order:0 }
  ]);

  const monthRegionLabels = Object.keys(regionMonth);
  const monthRegionVals = monthRegionLabels.map(k=>regionMonth[k]);
  createPie("monthRegionPie", monthRegionLabels, monthRegionVals, [], false, true); 
  createPie("monthFCRPie", ['FCR','Non-FCR'], [monthFCR, monthNonFCR], FCR_COLORS, true);

  // --- Month Butterfly (General Reasons) ---
  let reasonDataArr = [];
  for(const r in reasonStats){
    const stat = reasonStats[r];
    const avgVol = Math.ceil(stat.count/daysCount);
    const avgAcht = stat.count>0?Math.ceil(stat.sumAcht/stat.count):0;
    reasonDataArr.push({ reason:r, leftMetric:avgAcht, rightMetric:avgVol });
  }
  reasonDataArr.sort((a,b)=>b.rightMetric-a.rightMetric);
  const top10 = reasonDataArr.slice(0,10);
  createButterflyChart(
    "monthButterflyChart1",
    top10.map(i=>i.reason),
    top10.map(i=>-i.leftMetric),
    top10.map(i=>i.rightMetric)
  );

  // --- Month Billing Issue Butterfly (Passes NEW COLORS) ---
  renderBillingMonthButterfly(billingSubReasonStats, daysCount);
}

function renderBillingMonthButterfly(billingStats, daysCount){
    let billingDataArr = [];
    for(const subReason in billingStats){
        const stat = billingStats[subReason];
        if (stat.count === 0) continue; 
        const avgVol = Math.ceil(stat.count / daysCount);
        const avgAcht = stat.count > 0 ? Math.ceil(stat.sumAcht / stat.count) : 0;
        billingDataArr.push({ subReason, leftMetric: avgAcht, rightMetric: avgVol });
    }
    billingDataArr.sort((a, b) => b.rightMetric - a.rightMetric);
    const top10 = billingDataArr.slice(0, 10);

    createButterflyChart(
        "monthBillingButterfly",
        top10.map(i => i.subReason),
        top10.map(i => -i.leftMetric),
        top10.map(i => i.rightMetric),
        "Avg ACHT",
        "Avg Daily Volume",
        "",
        BILLING_ACHT_COLOR, // <--- HIGH-CONTRAST MAGENTA
        BILLING_VOLUME_COLOR // <--- HIGH-CONTRAST TEAL
    );
}

// --- Render Selected Date Charts (Kept verbatim) ---
function renderForSelectedDate(){
  if(!selectedDate || !groupedData[selectedDate]) return;
  const callsForDate = groupedData[selectedDate];

  const totals={}, unique={}, agents={}, region={};
  let fcr=0, nonFcr=0, totalAcht=0;
  const dayReasonStats={}, dayBillingSubReasonStats={};

  for(const id in callsForDate){
    const call=callsForDate[id];
    const hour=getHourFromDate(call.call_date);
    const ph=call.phone_number;
    const ag=call.full_name||call.email||"Unknown";
    const reg=call.Region||"Unknown";
    const reason=call["Call Reason"]||call.call_reason||"Unknown";
    const st=(call.status||"").toUpperCase();
    const duration=Number(call.acht)||0;

    totals[hour]=(totals[hour]||0)+1;
    if(!unique[hour]) unique[hour]=new Set(); if(ph) unique[hour].add(ph);
    if(!agents[hour]) agents[hour]=new Set(); agents[hour].add(ag);

    region[reg]=(region[reg]||0)+1;
    if(st==="FCR") fcr++; else nonFcr++;

    totalAcht+=duration;

    // --- For general day butterfly ---
    if(!dayReasonStats[reason]) dayReasonStats[reason]={ count:0, sumAcht:0 };
    dayReasonStats[reason].count+=1;
    dayReasonStats[reason].sumAcht+=duration;

      // Filter and categorize for billing
      if(reason === BILLING_ISSUE_REASON){
          const subReason = categorizeBillingCall(call);
          if(!dayBillingSubReasonStats[subReason]) dayBillingSubReasonStats[subReason]={ count:0, sumAcht:0 };
          dayBillingSubReasonStats[subReason].count+=1;
          dayBillingSubReasonStats[subReason].sumAcht+=duration;
      }
  }

  // --- KPIs (No Change) ---
  const totalCalls = Object.values(totals).reduce((a,b)=>a+b,0);
  document.getElementById('kpiTotalCalls').textContent=totalCalls.toLocaleString();

  const allUnique = new Set(); Object.values(callsForDate).forEach(c=>{ if(c.phone_number) allUnique.add(c.phone_number) });
  document.getElementById('kpiUniqueCallers').textContent = allUnique.size.toLocaleString();

  const allAgents = new Set(); Object.values(callsForDate).forEach(c=>{ const a=c.full_name||c.email; if(a) allAgents.add(a); });
  document.getElementById('kpiActiveAgents').textContent = allAgents.size.toLocaleString();

  const fcrPercent = fcr+nonFcr>0?Math.round((fcr/(fcr+nonFcr))*100):0;
  document.getElementById('kpiFCRPercent').textContent = fcrPercent+"%";

  const avgHandle = totalCalls>0?Math.round(totalAcht/totalCalls):0;
  document.getElementById('kpiAvgHandleTime').textContent = formatTime(avgHandle);

  // --- Hourly Charts (No Change) ---
  const hours = Array.from({length:24},(_,i)=>String(i).padStart(2,'0'));
  const dataTotal = hours.map(h=>totals[h]||0);
  const dataUnique = hours.map(h=>unique[h]?.size||0);
  const dataAgents = hours.map(h=>agents[h]?.size||0);
  createMixed("lastDayHourlyChart", hours, [
    { type:'bar', label:'Total', data:dataTotal, backgroundColor:'rgba(255,179,64,0.7)', borderRadius:4, barPercentage:0.6 },
    { type:'line', label:'Unique', data:dataUnique, borderColor:'rgba(255,99,132,1.0)', borderWidth:2, tension:0.4, pointRadius:3 },
    { type:'line', label:'Agents', data:dataAgents, borderColor:'rgba(86,201,138,1.0)', borderWidth:2, tension:0.4, pointRadius:3 }
  ]);

  const regLabels = Object.keys(region);
  const regVals = regLabels.map(k=>region[k]);
  createPie("lastDayRegionPie", regLabels, regVals, [], false, true); 
  createPie("lastDayFCRPie", ['FCR','Non-FCR'], [fcr, nonFcr], FCR_COLORS, true);

  // --- Day Butterfly Chart (General Reasons) ---
  const dayTop = Object.keys(dayReasonStats).map(r=>{
    const s = dayReasonStats[r];
    return { 
          reason:r, 
          volume:s.count, 
          acht: s.count > 0 ? Math.ceil(s.sumAcht / s.count) : 0 
      };
  });
  dayTop.sort((a,b)=>b.volume-a.volume);
  const topDay10 = dayTop.slice(0,10);
  createButterflyChart(
    "dayButterflyChart",
    topDay10.map(i=>i.reason),
    topDay10.map(i=>-i.acht),   
    topDay10.map(i=>i.volume)
  );

    // --- Day Billing Issue Butterfly (Passes NEW COLORS) ---
    renderBillingDayButterfly(dayBillingSubReasonStats);
}

function renderBillingDayButterfly(billingStats){
    const dayTop = Object.keys(billingStats).map(subReason => {
        const s = billingStats[subReason];
        return { 
            subReason, 
            volume: s.count, 
            acht: s.count > 0 ? Math.ceil(s.sumAcht / s.count) : 0 
        };
    });
    dayTop.sort((a, b) => b.volume - a.volume);
    const topDay10 = dayTop.slice(0, 10);

    createButterflyChart(
        "dayBillingButterfly",
        topDay10.map(i => i.subReason),
        topDay10.map(i => -i.acht),
        topDay10.map(i => i.volume),
        "Avg ACHT",
        "Daily Volume",
        "",
        BILLING_ACHT_COLOR, // <--- HIGH-CONTRAST MAGENTA
        BILLING_VOLUME_COLOR // <--- HIGH-CONTRAST TEAL
    );
}


// --- CSV fetching + processing ---
async function fetchCsvAndProcess(){
    try {
        const res = await fetch(MASTER_CSV_URL);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const text = await res.text();
        
        Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: function(results){
                const grouped = normalizeFromRows(results.data);
                processData(grouped);
            },
            error: function(err){ 
                console.error('PapaParse error', err); 
                // Optionally display an error message to the user
            }
        });

    } catch (error) {
        console.error('Error fetching CSV:', error);
        // Handle fetch error
    }
}


// Initial load
fetchCsvAndProcess();

// export for debugging (optional)
window.__dashboard = {
  fetchCsvAndProcess,
  groupedData,
  charts
};