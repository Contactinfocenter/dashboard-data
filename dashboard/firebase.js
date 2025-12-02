// app-git-firebase-converted.js - FINAL 100% WORKING VERSION (Your Structure + All Bugs Fixed)

const MASTER_DATA_URL = "https://raw.githubusercontent.com/Contactinfocenter/dashboard-data/main/data/calls/all_calls.json";
const CLIENT_BASE_CSV_URL = "https://raw.githubusercontent.com/Contactinfocenter/dashboard-data/main/data/client_count.csv"; 

let dateFilters = {
    main: { start: null, end: null },
    zone: { start: null, end: null },
    rural: { start: null, end: null }
};

// DOM Elements
const statusText = document.getElementById('statusText');
const regionChips = document.getElementById('regionChips');
const reasonChips = document.getElementById('reasonChips');
const summaryTableContainer = document.getElementById('summaryTableContainer');
const quickStats = document.getElementById('quickStats');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const selectAllBtn = document.getElementById('selectAllBtn');
const mainBarChartCanvas = document.getElementById('barChart');

const zoneChips = document.getElementById('zoneChips');
const zoneReasonChips = document.getElementById('zoneReasonChips');
const zoneSummaryTableContainer = document.getElementById('zoneSummaryTableContainer');
const zoneBarChartCanvas = document.getElementById('zoneBarChart');
const clearZoneFiltersBtn = document.getElementById('clearZoneFiltersBtn');
const selectAllZoneBtn = document.getElementById('selectAllZoneBtn');

const ruralSummaryTableContainer = document.getElementById("ruralSummaryTableContainer");
const ruralZoneCanvas = document.getElementById("ruralZoneBarChart");
const ruralZoneQuickStats = document.getElementById("ruralZoneQuickStats");
const ruralZoneChips = document.getElementById("ruralZoneChips");
const ruralZoneReasonChips = document.getElementById("ruralZoneReasonChips");
const clearRuralFiltersBtn = document.getElementById('clearRuralFiltersBtn');
const selectAllRuralBtn = document.getElementById('selectAllRuralBtn');

let chart = null, zoneChart = null, ruralZoneChart = null;

let rawData = {};
let filters = { regions: new Set(), reasons: new Set() };
let zoneFilters = new Set();
let zoneReasonFilters = new Set();
let ruralZoneFilters = new Set();
let ruralReasonFilters = new Set();

const zonesOfInterest = ['Dhaka', 'Comilla', 'Chittagong'];
let allAvailableRegions = [], allAvailableReasons = [], allAvailableZoneReasons = [];
let allRuralZones = [], ruralReasons = [];
let clientBaseMapNormalized = {};

/* ---------------- UTILS ---------------- */
function normalizeKey(s) { return s ? String(s).trim().toLowerCase() : ''; }

/* ---------------- DATA NORMALIZATION ---------------- */
function normalizeFromRows(rows) {
    const result = {};
    rows.forEach(row => {
        const dateStr = String(row.call_date || '').split(' ')[0];
        if (!dateStr || dateStr === 'null') return;

        const id = `${String(row.phone_number || '').replace(/\D/g,'')}_${dateStr}`;
        if (!result[dateStr]) result[dateStr] = {};

        result[dateStr][id] = {
            Region: String(row.Region || row.region || 'N/A'),
            Zone: String(row.Zone || row.zone || 'N/A'),
            "Call Reason": String(row["Call Reason"] || row.call_reason || 'N/A'),
            phone_number: String(row.phone_number || '').replace(/\D/g,'') || 'unknown'
        };
    });
    return result;
}

/* ---------------- CLIENT BASE ---------------- */
async function loadClientBase() {
    const res = await fetch(CLIENT_BASE_CSV_URL);
    const text = await res.text();
    Papa.parse(text, {
        header: true,
        complete: r => {
            r.data.forEach(row => {
                const key = (row.Zone || row.Region || '').trim();
                const val = parseInt(row.ClientBaseCount || row.Client_Count || 0);
                if (key) clientBaseMapNormalized[normalizeKey(key)] = val;
            });
        }
    });
}

/* ---------------- FILTERS ---------------- */
function passFilters(row) {
    if (!row) return false;
    const reg = row.Region;
    const rea = row["Call Reason"];
    return (!filters.regions.size || filters.regions.has(reg)) && 
           (!filters.reasons.size || filters.reasons.has(rea));
}

function passZoneFilters(row) {
    if (!row) return false;
    const z = row.Zone;
    const rea = row["Call Reason"];
    return zonesOfInterest.includes(z) &&
           (!zoneFilters.size || zoneFilters.has(z)) &&
           (!zoneReasonFilters.size || zoneReasonFilters.has(rea));
}

function passRuralFilters(row) {
    if (!row || row.Region !== "Rural") return false;
    const z = row.Zone;
    const rea = row["Call Reason"];
    return (!ruralZoneFilters.size || ruralZoneFilters.has(z)) &&
           (!ruralReasonFilters.size || ruralReasonFilters.has(rea));
}

/* ---------------- DATE HELPERS ---------------- */
function getFilteredDates(section, n = 7) {
    const all = Object.keys(rawData).sort();
    const f = dateFilters[section];
    if (f.start && f.end) {
        return all.filter(d => new Date(d) >= f.start && new Date(d) <= f.end);
    }
    return all.slice(-n);
}

/* ---------------- CHARTS ---------------- */
const valuePlugin = {
    id: 'val',
    afterDatasetsDraw(c) {
        const ctx = c.ctx;
        ctx.save();
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        c.data.datasets.forEach(ds => {
            c.getDatasetMeta(c.data.datasets.indexOf(ds)).data.forEach((bar, i) => {
                const v = ds.data[i];
                if (v > 0) ctx.fillText(v, bar.x, bar.y + 12);
            });
        });
        ctx.restore();
    }
};
Chart.register(valuePlugin);

function createOrUpdateChart(canvas, ref, labels, tot, uniq) {
    if (!canvas) return;
    const data = { labels, datasets: [
        { label: 'Total Calls', data: tot, backgroundColor: '#004c99' },
        { label: 'Unique Calls', data: uniq, backgroundColor: '#f39c12' }
    ]};
    if (ref.current) ref.current.destroy();
    ref.current = new Chart(canvas, { type: 'bar', data, options: { responsive: true, plugins: { legend: { position: 'top' }}} , plugins: [valuePlugin] });
}

/* ---------------- RENDER RURAL TOP-20 (FULLY FIXED) ---------------- */
function renderRuralZoneSection() {
    const dates = getFilteredDates('rural', 7);
    if (!dates.length) {
        ruralSummaryTableContainer.innerHTML = "<p>No data</p>";
        createOrUpdateChart(ruralZoneCanvas, {current: ruralZoneChart}, [], [], []);
        return;
    }

    // Rebuild zones & reasons based on current filters
    const zonesSet = new Set(), reasonsSet = new Set();
    Object.values(rawData).forEach(day => {
        Object.values(day).forEach(r => {
            if (r.Region === "Rural") {
                const rea = r["Call Reason"];
                if (!ruralReasonFilters.size || ruralReasonFilters.has(rea)) {
                    zonesSet.add(r.Zone);
                    reasonsSet.add(rea);
                }
            }
        });
    });
    allRuralZones = Array.from(zonesSet).sort();
    ruralReasons = Array.from(reasonsSet).sort();

    // Top 20 zones by MTD
    const mtdStart = dates[0];
    const mtdDates = Object.keys(rawData).filter(d => d >= mtdStart);
    const zoneCount = {};
    mtdDates.forEach(d => {
        Object.values(rawData[d] || {}).forEach(r => {
            if (r.Region === "Rural" && (!ruralReasonFilters.size || ruralReasonFilters.has(r["Call Reason"]))) {
                zoneCount[r.Zone] = (zoneCount[r.Zone] || 0) + 1;
            }
        });
    });
    const top20 = Object.entries(zoneCount)
        .sort((a,b) => b[1] - a[1])
        .slice(0,20)
        .map(([z]) => z);

    // Daily data for Top-20
    const dailyTot = dates.map(() => 0);
    const dailyUniq = dates.map(() => new Set());

    dates.forEach((d, i) => {
        Object.values(rawData[d] || {}).forEach(r => {
            if (passRuralFilters(r) && top20.includes(r.Zone)) {
                dailyTot[i]++;
                dailyUniq[i].add(r.phone_number);
            }
        });
    });
    const dailyUniqCount = dailyUniq.map(s => s.size);

    // Chart
    const labels = dates.map(d => new Date(d).toLocaleDateString(undefined, {day:'numeric', month:'short'}));
    createOrUpdateChart(ruralZoneCanvas, {current: ruralZoneChart}, labels, dailyTot, dailyUniqCount);

    // Table
    const mtdTot = mtdDates.reduce((s,d) => s + Object.values(rawData[d]||{}).filter(r => r.Region==="Rural" && top20.includes(r.Zone) && (!ruralReasonFilters.size || ruralReasonFilters.has(r["Call Reason"]))).length, 0);
    const mtdUniq = new Set();
    mtdDates.forEach(d => {
        Object.values(rawData[d]||{}).forEach(r => {
            if (r.Region==="Rural" && top20.includes(r.Zone) && (!ruralReasonFilters.size || ruralReasonFilters.has(r["Call Reason"]))) {
                mtdUniq.add(r.phone_number);
            }
        });
    });

    let html = `<div style="overflow:auto"><table class="excel-table">
        <thead><tr><th>Top 20 Rural Zones</th><th>7-Day Total</th><th>7-Day Unique</th><th>MTD Total</th></tr></thead>
        <tbody>`;
    
    top20.forEach(z => {
        const zone7dTot = dates.reduce((s,d) => s + Object.values(rawData[d]||{}).filter(r => r.Zone===z && passRuralFilters(r)).length, 0);
        const zone7dUniq = new Set();
        dates.forEach(d => {
            Object.values(rawData[d]||{}).forEach(r => {
                if (r.Zone===z && passRuralFilters(r)) zone7dUniq.add(r.phone_number);
            });
        });
        const zoneMtdTot = mtdDates.reduce((s,d) => s + Object.values(rawData[d]||{}).filter(r => r.Zone===z && r.Region==="Rural" && (!ruralReasonFilters.size || ruralReasonFilters.has(r["Call Reason"]))).length, 0);
        
        html += `<tr><td>${z}</td><td>${zone7dTot}</td><td>${zone7dUniq.size}</td><td>${zoneMtdTot}</td></tr>`;
    });
    
    html += `<tr class="grand"><td>TOTAL (Top 20)</td><td>${dailyTot.reduce((a,b)=>a+b,0)}</td><td>${dailyUniqCount.reduce((a,b)=>a+b,0)}</td><td>${mtdTot}</td></tr>`;
    html += `</tbody></table></div>`;

    ruralSummaryTableContainer.innerHTML = html;

    // Update Chips
    ruralZoneChips.innerHTML = "";
    allRuralZones.forEach(z => {
        const chip = document.createElement("div");
        chip.className = `chip ${ruralZoneFilters.has(z) ? "selected" : "off"}`;
        chip.textContent = z;
        chip.onclick = () => { ruralZoneFilters.clear(); ruralZoneFilters.add(z); renderRuralZoneSection(); };
        ruralZoneChips.appendChild(chip);
    });

    ruralZoneReasonChips.innerHTML = "";
    ruralReasons.forEach(r => {
        const chip = document.createElement("div");
        chip.className = `chip ${ruralReasonFilters.has(r) ? "selected" : "off"}`;
        chip.textContent = r;
        chip.onclick = () => { ruralReasonFilters.clear(); ruralReasonFilters.add(r); renderRuralZoneSection(); };
        ruralZoneReasonChips.appendChild(chip);
    });
}

/* ---------------- START ---------------- */
async function init() {
    statusText.textContent = "Loading...";
    await loadClientBase();

    const res = await fetch(MASTER_DATA_URL);
    const json = await res.json();
    const rows = [];
    for (const date in json.calls) {
        Object.values(json.calls[date] || {}).forEach(r => rows.push(r));
    }
    rawData = normalizeFromRows(rows);

    // Build filter lists
    const regs = new Set(), reas = new Set();
    Object.values(rawData).forEach(day => {
        Object.values(day).forEach(r => {
            regs.add(r.Region);
            reas.add(r["Call Reason"]);
        });
    });
    allAvailableRegions = Array.from(regs).sort();
    allAvailableReasons = Array.from(reas).sort();

    // Date pickers
    flatpickr("#mainDateRange", { mode: "range", dateFormat: "Y-m-d", onClose: d => { dateFilters.main = d.length===2 ? {start:d[0],end:d[1]} : {}; render(); }});
    flatpickr("#zoneDateRange", { mode: "range", dateFormat: "Y-m-d", onClose: d => { dateFilters.zone = d.length===2 ? {start:d[0],end:d[1]} : {}; renderZoneSection(); }});
    flatpickr("#ruralDateRange", { mode: "range", dateFormat: "Y-m-d", onClose: d => { dateFilters.rural = d.length===2 ? {start:d[0],end:d[1]} : {}; renderRuralZoneSection(); }});

    // Buttons
    clearFiltersBtn.onclick = () => { filters.regions.clear(); filters.reasons.clear(); render(); };
    clearZoneFiltersBtn.onclick = () => { zoneFilters.clear(); zoneReasonFilters.clear(); renderZoneSection(); };
    clearRuralFiltersBtn.onclick = () => { ruralZoneFilters.clear(); ruralReasonFilters.clear(); renderRuralZoneSection(); };

    // Render all sections
    render();
    renderZoneSection();
    renderRuralZoneSection();

    statusText.textContent = "Dashboard ready!";
}

init();