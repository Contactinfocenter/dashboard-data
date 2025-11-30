// app.js — GitHub CSV version
// Make sure PapaParse is included in index.html
// <script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js"></script>

Chart.register(ChartDataLabels);

const charts = {};
let selectedDate = null;
let groupedData = {};
let availableDates = [];

// --- CONFIGURATION ---
const BILLING_ISSUE_REASON = "Billing Issue";

// --- NEW COLOR DEFINITIONS ---
const GENERAL_ACHT_COLOR = '#FF8A42';
const GENERAL_VOLUME_COLOR = '#124E8C';

// *** HIGH-CONTRAST COLORS FOR BILLING CHARTS ***
const BILLING_ACHT_COLOR = '#D0006E';
const BILLING_VOLUME_COLOR = '#00C9A7';

const REGION_COLORS = {
    'Rural': '#4A90E2', 
    'Urban': '#7ED321', 
    'N/A': '#D0021B',  
    'Unknown': '#555555' 
};
const FCR_COLORS=['#4A90E2','#fb923c'];

// --- CHART HELPERS ---
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
    if(isFCR) backgroundColors = FCR_COLORS;
    else if(isRegion) backgroundColors = labels.map(label => REGION_COLORS[label] || REGION_COLORS['Unknown']);
    else backgroundColors = colors;

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
                        if(isFCR) return `${perc}%\n${label}`;
                        else if (isRegion) return `${valueStr}\n${label}`;
                        else return perc > 1 ? `${valueStr}\n${label}` : '';
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
                    datalabels:{ color:'#000', anchor:'middle', align:'left', formatter:v => Math.abs(v) }
                },
                {
                    label:rightLabel,
                    data:rightData,
                    backgroundColor:volumeColor, 
                    barPercentage:0.8,
                    categoryPercentage:0.8,
                    stack:'stack0',
                    datalabels:{ color:'#000', anchor:'end', align:'right' }
                }
            ]
        },
        options:{
            indexAxis:'y',
            responsive:true,
            maintainAspectRatio:false,
            scales:{
                x:{ position:'top', ticks:{ callback:v=>Math.abs(v), font:{ size:13 } }, grid:{ drawOnChartArea:true, color:'rgba(0,0,0,0.05)' }, border:{ display:false } },
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

// --- INIT EMPTY CHARTS ---
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

// --- HELPER FUNCTIONS ---
function formatTime(seconds){
    if(!seconds) return "0s";
    const m = Math.floor(seconds/60);
    const s = seconds%60;
    return m>0?`${m}m ${s}s`:`${s}s`;
}

function getHourFromDate(dateStr){
    try{ return String(new Date(dateStr).getHours()).padStart(2,'0'); }catch(e){ return "00"; }
}

function categorizeBillingCall(call){
    return (call.comments || "Comment Not Provided").trim();
}

// --- CSV FETCH FUNCTION ---
async function loadCSVFromGitHub(dateStr){
    const url = `https://raw.githubusercontent.com/Contactinfocenter/dashboard-data/main/data/calls/${dateStr}.csv`;

    try {
        const response = await fetch(url);
        if(!response.ok) throw new Error("CSV file not found");
        const csvText = await response.text();

        const parsed = Papa.parse(csvText, { header: true });
        const callsObj = {};

        parsed.data.forEach(call => {
            const id = call.phone_number + "_" + new Date(call.call_date).getTime();
            callsObj[id] = call;
        });

        const grouped = {};
        grouped[dateStr] = callsObj;

        processSnapshot(grouped);

    } catch(err) {
        console.error("Error loading CSV:", err);
    }
}

// --- PROCESS DATA ---
function normalizeData(snapshotVal){
    if(!snapshotVal) return {};
    const normalized={};
    const keys=Object.keys(snapshotVal);
    const isDateGrouped = keys.every(k=>k.match(/^\d{4}-\d{2}-\d{2}$/));
    if(isDateGrouped) return snapshotVal;
    for(const id in snapshotVal){
        const call=snapshotVal[id];
        const dateStr=call.call_date ? call.call_date.split('T')[0]:"Unknown";
        if(!normalized[dateStr]) normalized[dateStr]={};
        normalized[dateStr][id]=call;
    }
    return normalized;
}

function processSnapshot(snapshotVal){
    groupedData = normalizeData(snapshotVal);
    availableDates = Object.keys(groupedData).sort();
    if(!selectedDate || !groupedData[selectedDate]) selectLatestDate();
    renderAveragesAndMonthPies();
    renderForSelectedDate();
}

function selectLatestDate(){
    if(!availableDates.length) return;
    selectedDate = availableDates[availableDates.length-1];
    document.getElementById('selectedDate').textContent = selectedDate;
}

// --- DATE PICKER ---
const fp = flatpickr("#datePicker", {
    dateFormat:"Y-m-d",
    allowInput:true,
    disableMobile:"true",
    onChange:(selectedDates,dateStr)=>{
        if(!dateStr) return;
        selectedDate = dateStr;
        document.getElementById('selectedDate').textContent = selectedDate;
        loadCSVFromGitHub(selectedDate);
    }
});

// --- INITIAL LOAD ---
const today = "2025-11-01"; // default
loadCSVFromGitHub(today);
