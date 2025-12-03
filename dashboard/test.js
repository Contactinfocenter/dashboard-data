// app-git-firebase-converted.js → ULTIMATE FINAL VERSION (Dec 2025)

const MASTER_DATA_URL = "https://raw.githubusercontent.com/Contactinfocenter/dashboard-data/main/data/calls/all_calls.json";
const CLIENT_BASE_CSV_URL = "https://raw.githubusercontent.com/Contactinfocenter/dashboard-data/main/data/client_count.csv";

let dateFilters = { main: {}, zone: {}, rural: {} };
let rawData = {};
let filters = { regions: new Set(), reasons: new Set() };
let zoneFilters = new Set(), zoneReasonFilters = new Set();
let ruralZoneFilters = new Set(), ruralReasonFilters = new Set();

const zonesOfInterest = ['Dhaka', 'Comilla', 'Chittagong'];
let allAvailableRegions = [], allAvailableReasons = [], allRuralZones = [], ruralReasons = [];
let clientBaseMapNormalized = {};

let chart = null, zoneChart = null, ruralZoneChart = null;

/* ---------------- DOM ---------------- */
const mainBarChartCanvas = document.getElementById('barChart');
const zoneBarChartCanvas = document.getElementById('zoneBarChart');
const ruralZoneCanvas = document.getElementById('ruralZoneBarChart');

/* ---------------- VALUE LABEL PLUGIN ---------------- */
const valueLabelPlugin = {
    id: 'valueLabels',
    afterDatasetsDraw(chart) {
        const { ctx, data } = chart;
        ctx.save();
        ctx.font = '700 12px "Segoe UI", Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 4;

        data.datasets.forEach(dataset => {
            chart.getDatasetMeta(chart.data.datasets.indexOf(dataset)).data.forEach((bar, i) => {
                const value = dataset.data[i];
                if (value > 0) ctx.fillText(value, bar.x, bar.y - 8);
            });
        });
        ctx.restore();
    }
};
Chart.register(valueLabelPlugin);

/* ---------------- CHART (GROUPED BARS) ---------------- */
function createOrUpdateChart(labels, totalData, uniqueData, canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const data = {
        labels,
        datasets: [
            { label: 'Total Calls',   data: totalData,  backgroundColor: '#004c99' },
            { label: 'Unique Calls',  data: uniqueData, backgroundColor: '#f39c12' }
        ]
    };

    const suggestedMax = Math.max(...totalData, ...uniqueData) * 1.15;

    let instance;
    if (canvas.id === 'barChart') instance = chart;
    else if (canvas.id === 'zoneBarChart') instance = zoneChart;
    else if (canvas.id === 'ruralZoneBarChart') instance = ruralZoneChart;

    if (instance) {
        instance.data = data;
        instance.options.scales.y.suggestedMax = suggestedMax;
        instance.update();
        return;
    }

    const newChart = new Chart(ctx, {
        type: 'bar',
        data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' }, tooltip: { mode: 'index', intersect: false } },
            scales: {
                x: { stacked: false, grid: { display: false } },
                y: { stacked: false, beginAtZero: true, suggestedMax, grid: { color: 'rgba(0,0,0,0.05)' } }
            }
        },
        plugins: [valueLabelPlugin]
    });

    if (canvas.id === 'barChart') chart = newChart;
    else if (canvas.id === 'zoneBarChart') zoneChart = newChart;
    else if (canvas.id === 'ruralZoneBarChart') ruralZoneChart = newChart;
}

/* ---------------- FILTER & AGGREGATE HELPERS ---------------- */
function buildFilterLists(recordsByDate) {
    const regions = new Set();
    const reasons = new Set();
    const zoneReasons = new Set();
    const ruralZonesTemp = new Set();
    const ruralReasonsTemp = new Set();

    for (const d in recordsByDate) {
        const group = recordsByDate[d] || {};
        for (const k in group) {
            const r = group[k];
            if (!r) continue;
            // Uses normalized 'Region' key
            regions.add(String(r.Region || 'N/A')); 
            // Uses normalized 'Call Reason' key
            reasons.add(String(r["Call Reason"] || 'N/A'));
            
            const zoneVal = String(r.Zone || 'N/A');
            if (zonesOfInterest.includes(zoneVal)) {
                zoneReasons.add(String(r["Call Reason"] || 'N/A'));
            }
            if (String(r.Region).trim() === "Rural") {
                ruralZonesTemp.add(zoneVal);
                ruralReasonsTemp.add(String(r["Call Reason"] || 'N/A'));
            }
        }
    }
    allAvailableRegions = Array.from(regions).sort();
    allAvailableReasons = Array.from(reasons).sort();
    allAvailableZoneReasons = Array.from(zoneReasons).sort();
    allRuralZones = Array.from(ruralZonesTemp).sort(); 
    ruralReasons = Array.from(ruralReasonsTemp).sort(); 
}

function updateChipVisuals() {
    if (regionChips && reasonChips) {
        [...regionChips.children, ...reasonChips.children].forEach(chip => {
            const type = chip.dataset.type;
            const value = chip.dataset.value;
            const s = type === 'region' ? filters.regions : filters.reasons;
            if (s.has(value)) { chip.classList.remove('off'); chip.classList.add('selected'); }
            else { chip.classList.add('off'); chip.classList.remove('selected'); }
        });
    }
    if (clearFiltersBtn) clearFiltersBtn.classList.toggle('off', filters.regions.size === 0 && filters.reasons.size === 0);
    if (selectAllBtn) selectAllBtn.classList.toggle('off', filters.regions.size === allAvailableRegions.length && filters.reasons.size === allAvailableReasons.length);

    if (zoneChips) {
        [...zoneChips.children].forEach(chip => {
            const value = chip.dataset.value;
            if (zoneFilters.has(value)) { chip.classList.remove('off'); chip.classList.add('selected'); }
            else { chip.classList.add('off'); chip.classList.remove('selected'); }
        });
    }
    if (zoneReasonChips) {
        [...zoneReasonChips.children].forEach(chip => {
            const value = chip.dataset.value;
            if (zoneReasonFilters.has(value)) { chip.classList.remove('off'); chip.classList.add('selected'); }
            else { chip.classList.add('off'); chip.classList.remove('selected'); }
        });
    }
    if (clearZoneFiltersBtn) clearZoneFiltersBtn.classList.toggle('off', zoneFilters.size === 0 && zoneReasonFilters.size === 0);
    if (selectAllZoneBtn) selectAllZoneBtn.classList.toggle('off', zoneFilters.size === zonesOfInterest.length && zoneReasonFilters.size === allAvailableZoneReasons.length);

    updateRuralChipVisuals();
}

function updateRuralChipVisuals() {
    if (ruralZoneChips) {
        [...ruralZoneChips.children].forEach(chip => {
            const value = chip.dataset.value;
            if (ruralZoneFilters.has(value)) { chip.classList.remove('off'); chip.classList.add('selected'); }
            else { chip.classList.add('off'); chip.classList.remove('selected'); }
        });
    }
    if (ruralZoneReasonChips) {
        [...ruralZoneReasonChips.children].forEach(chip => {
            const value = chip.dataset.value;
            if (ruralReasonFilters.has(value)) { chip.classList.remove('off'); chip.classList.add('selected'); }
            else { chip.classList.add('off'); chip.classList.remove('selected'); }
        });
    }
    
    if (clearRuralFiltersBtn) clearRuralFiltersBtn.classList.toggle('off', ruralZoneFilters.size === 0 && ruralReasonFilters.size === 0);
    if (selectAllRuralBtn) selectAllRuralBtn.classList.toggle('off', ruralZoneFilters.size === allRuralZones.length && ruralReasonFilters.size === ruralReasons.length);
}

function passFilters(row) {
    if (!row) return false;
    // normalized 'Region' key
    const region = String(row.Region || 'N/A'); 
    const reason = String(row["Call Reason"] || 'N/A');
    if (filters.regions.size > 0 && !filters.regions.has(region)) return false;
    if (filters.reasons.size > 0 && !filters.reasons.has(reason)) return false;
    return true;
}

function passZoneFilters(row) {
    if (!row) return false;
    // normalized 'Zone' key
    const zone = String(row.Zone || 'N/A'); 
    const reason = String(row["Call Reason"] || 'N/A');
    if (zoneFilters.size > 0 && !zoneFilters.has(zone)) return false;
    if (zoneReasonFilters.size > 0 && !zoneReasonFilters.has(reason)) return false;
    return true;
}

function passRuralFilters(row) {
    if (!row) return false;
    // normalized 'Region' key
    if (String(row.Region).trim() !== "Rural") return false; 
    const zone = String(row.Zone || "N/A");
    const reason = String(row["Call Reason"] || "N/A");
    if (ruralZoneFilters.size > 0 && !ruralZoneFilters.has(zone)) return false;
    if (ruralReasonFilters.size > 0 && !ruralReasonFilters.has(reason)) return false;
    return true;
}

function computeTotalsForDateArray(dateArray, filterFunc = passFilters) {
    let totals = 0;
    let uniquesSet = new Set();
    for (const d of dateArray) {
        const group = rawData[d] || {};
        for (const docKey in group) {
            const row = group[docKey];
            if (!filterFunc(row)) continue;
            totals++;
            uniquesSet.add(getCallerId(row, docKey));
        }
    }
    return { tot: totals, uniqueCount: uniquesSet.size, days: dateArray.length };
}

function computeRegionAggregatesForDates(region, dateArray) {
    let tot = 0, uniqSet = new Set();
    for (const d of dateArray) {
        const group = rawData[d] || {};
        for (const docKey in group) {
            const row = group[docKey];
            // Uses normalized 'Region' key
            if (!row || String(row.Region || 'N/A') !== region) continue; 
            if (!passFilters(row)) continue;
            tot++; uniqSet.add(getCallerId(row, docKey));
        }
    }
    return { tot, uniq: uniqSet.size };
}

function computeZoneAggregates(keyValue, dateArray, filterFunc = passZoneFilters) {
    let tot = 0, uniqSet = new Set();
    for (const dStr of dateArray) {
        const group = rawData[dStr] || {};
        for (const docKey in group) {
            const row = group[docKey];
            // normalized 'Zone' key
            if (!row || String(row.Zone || 'N/A') !== keyValue) continue; 
            if (!filterFunc(row)) continue;
            tot++; uniqSet.add(getCallerId(row, docKey));
        }
    }
    return { tot, uniq: uniqSet.size };
}

function computeDailyUniqueCount(dateStr, filterFunc) {
    const dailyUniqueSet = new Set();
    const group = rawData[dateStr] || {};
    for (const docKey in group) {
        const row = group[docKey];
        if (!row || !filterFunc(row)) continue;
        dailyUniqueSet.add(getCallerId(row, docKey));
    }
    return dailyUniqueSet.size;
}

/* ---------------- Load client base CSV ---------------- */
function loadClientBase() {
    return new Promise((resolve, reject) => {
        Papa.parse(CLIENT_BASE_CSV_URL, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete(results) {
                if (results.data && Array.isArray(results.data)) {
                    clientBaseMap = {};
                    clientBaseMapNormalized = {};
                    results.data.forEach(row => {
                        const zoneKey = row.Zone !== undefined ? String(row.Zone).trim() : (row.Region !== undefined ? String(row.Region).trim() : 'N/A');
                        const count = Number(row.ClientBaseCount) || Number(row.Client_Count) || 0;
                        const safeCount = Number.isFinite(count) ? Math.round(count) : 0;
                        clientBaseMap[zoneKey] = safeCount;
                        clientBaseMapNormalized[normalizeKey(zoneKey)] = safeCount;
                    });
                    resolve();
                } else {
                    reject(new Error("Failed to parse client_count.csv or it's empty."));
                }
            },
            error(err) { reject(err); }
        });
    });
}

/* ---------------- RENDER (Main, Zone, Rural)---------------- */
// --- Main Render ---
function render() {
    const datesAvailable = Object.keys(rawData).sort();
    if (datesAvailable.length === 0) {
        if (summaryTableContainer) summaryTableContainer.innerHTML = "<p style='padding:12px'>No call data available.</p>";
        createOrUpdateMainChart([], [], []);
        updateChipVisuals();
        renderZoneSection(); 
        renderRuralZoneSection(); 
        return;
    }

    const allDates = datesAvailable;
    const N = 7; 
    const currentFilteredDates = getFilteredDates(dateFilters.main, N); 
    const lastDates = currentFilteredDates;

    const prevDates = getPreviousPeriodDates(lastDates, allDates);

    const latestDateStr = lastDates[lastDates.length - 1];
    if (!latestDateStr) { }
    const [latestYear, latestMonth] = latestDateStr ? latestDateStr.split('-').map(Number) : [0, 0];
    const mtdDates = allDates.filter(d => { const [y, m] = d.split('-').map(Number); return y === latestYear && m === latestMonth; });
    
    const cwaText = (dateFilters.main.start && dateFilters.main.end) ? 'CFA' : 'CWA';
    const pwaText = (dateFilters.main.start && dateFilters.main.end) ? 'PBA' : 'PWA';

    const regionsSet = new Set(allAvailableRegions);
    const perRegion = {};
    for (const r of Array.from(regionsSet)) {
        const normalized = normalizeKey(r);
        const cb = clientBaseMapNormalized[normalized];
        perRegion[r] = { 
            clientBase: Number.isFinite(cb) ? cb : 0, 
            dailyTotals: lastDates.map(() => 0), 
            dailyUniques: lastDates.map(() => 0) 
        };
    }

    for (let i = 0; i < lastDates.length; i++) {
        const d = lastDates[i];
        const group = rawData[d] || {};
        const perRegionUniqueSets = {};
        for (const rKey in perRegion) perRegionUniqueSets[rKey] = new Set();
        for (const docKey in group) {
            const row = group[docKey];
            if (!row || !passFilters(row)) continue;
            const reg = String(row.Region || 'N/A');
            const caller = getCallerId(row, docKey);
            if (perRegion[reg]) {
                perRegion[reg].dailyTotals[i] += 1;
                perRegionUniqueSets[reg].add(caller);
            }
        }
        for (const rKey in perRegion) perRegion[rKey].dailyUniques[i] = perRegionUniqueSets[rKey].size;
    }

    const grandTotals = lastDates.map((_, i) => Object.values(perRegion).reduce((sum, r) => sum + r.dailyTotals[i], 0));
    const grandUniqueTotals = lastDates.map((_, i) => {
        // Correctly calculate grand unique totals across all regions for the day
        const dailyUniqueSet = new Set();
        const d = lastDates[i];
        const group = rawData[d] || {};
        for(const docKey in group){
            const row = group[docKey];
            if(!row || !passFilters(row)) continue;
            dailyUniqueSet.add(getCallerId(row, docKey));
        }
        return dailyUniqueSet.size;
    });

    const currentWeekAgg = computeTotalsForDateArray(lastDates);
    const prevWeekAgg = computeTotalsForDateArray(prevDates);
    const mtdAgg = computeTotalsForDateArray(mtdDates);

    const repeatRatios = grandTotals.map((t, i) => { const u = grandUniqueTotals[i] || 0; return u > 0 ? (t / u).toFixed(2) : '-'; });
    const repeatPct = grandTotals.map((t, i) => { const u = grandUniqueTotals[i] || 0; return t > 0 ? Math.round((1 - (u / t)) * 100) + '%' : '-'; });

    function buildTableHtml() {
        const thDates = lastDates.map(d => {
            const [y, m, day] = d.split('-');
            return new Date(y, parseInt(m) - 1, day).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
        });

        let html = `<div style="overflow:auto"><table class="excel-table"><thead><tr>
            <th>Total Call</th>
            <th>Type</th>
            <th>Client Base</th>
            <th class="col-base-pct">% age of Base (MTD)</th>
            <th>MTD Avg</th>
            <th>${pwaText}</th>
            <th>${cwaText}</th>`;

        for (const hd of thDates) html += `<th>${hd}</th>`;
        html += `</tr></thead><tbody>`;

        const defaultOrder = ['Urban', 'Rural', 'N/A'];
        const regionOrder = [...defaultOrder, ...Array.from(regionsSet).filter(r => !defaultOrder.includes(r))];
        const today = new Date();

        for (const r of regionOrder) {
            if (!perRegion[r]) continue;
            const clientBase = perRegion[r].clientBase;
            
            const regionMtd = computeRegionAggregatesForDates(r, mtdDates);
            const prevWeekUniqueAgg = computeRegionAggregatesForDates(r, prevDates);
            const currentWeekUniqueAgg = computeRegionAggregatesForDates(r, lastDates);

            let mtdSumUniq = 0, mtdDays = 0;
            for (const dStr of mtdDates) {
                const [yy, mm, dd] = dStr.split('-');
                const dObj = new Date(yy, parseInt(mm) - 1, dd);
                if (dObj >= today) continue;
                const group = rawData[dStr] || {};
                const uniqSet = new Set();
                for (const docKey in group) {
                    const row = group[docKey];
                    if (!row || !passFilters(row) || String(row.Region || 'N/A') !== r) continue;
                    uniqSet.add(getCallerId(row, docKey));
                }
                mtdSumUniq += uniqSet.size;
                mtdDays++;
            }
            const mtdAvgUniq = mtdDays > 0 ? (mtdSumUniq / mtdDays) : 0;

            let percentOfBase = '-';
            if (clientBase > 0) {
                const pct = (mtdAvgUniq / clientBase) * 100;
                percentOfBase = Number.isFinite(pct) ? (pct.toFixed(1) + '%') : '-';
            }

            const mtdAvg = Math.round(regionMtd.tot / Math.max(1, mtdDates.length));
            const prevAvg = prevDates.length > 0 ? Math.round(prevWeekUniqueAgg.tot / prevDates.length) : 0;
            const curAvg = lastDates.length > 0 ? Math.round(currentWeekUniqueAgg.tot / lastDates.length) : 0;

            const mtdUniqAvg = Math.round(regionMtd.uniq / Math.max(1, mtdDates.length));
            const prevUniqAvg = prevDates.length > 0 ? Math.round(prevWeekUniqueAgg.uniq / prevDates.length) : 0;
            const curUniqAvg = lastDates.length > 0 ? Math.round(currentWeekUniqueAgg.uniq / lastDates.length) : 0;

            html += `<tr><td class="zone">${formatRegionName(r)}</td><td>Total</td><td>${clientBase}</td><td class="muted col-base-pct">${percentOfBase}</td><td>${mtdAvg}</td><td>${prevAvg}</td><td>${curAvg}</td>`;
            for (let i = 0; i < lastDates.length; i++) html += `<td>${perRegion[r].dailyTotals[i]}</td>`;
            html += `</tr>`;

            html += `<tr class="row-unique"><td class="zone"></td><td>Unique</td><td></td><td class="col-base-pct"></td><td>${mtdUniqAvg}</td><td>${prevUniqAvg}</td><td>${curUniqAvg}</td>`;
            for (let i = 0; i < lastDates.length; i++) html += `<td>${perRegion[r].dailyUniques[i]}</td>`;
            html += `</tr>`;
        }

        const grandBase = Object.values(perRegion).reduce((s, r) => s + r.clientBase, 0);
        const grandMtdAvg = mtdAgg.days > 0 ? Math.round(mtdAgg.tot / mtdAgg.days) : 0;
        const grandPrevAvg = prevWeekAgg.days > 0 ? Math.round(prevWeekAgg.tot / prevWeekAgg.days) : 0;
        const grandCurAvg = currentWeekAgg.days > 0 ? Math.round(currentWeekAgg.tot / currentWeekAgg.days) : 0;

        const grandMtdUniqAvg = mtdAgg.days > 0 ? Math.round(mtdAgg.uniqueCount / mtdAgg.days) : 0;
        const grandPrevUniqAvg = prevWeekAgg.days > 0 ? Math.round(prevWeekAgg.uniqueCount / prevWeekAgg.days) : 0;
        const grandCurUniqAvg = currentWeekAgg.days > 0 ? Math.round(currentWeekAgg.uniqueCount / currentWeekAgg.days) : 0;

        html += `<tr class="grand"><td>Grand Total</td><td>Total</td><td>${grandBase}</td><td class="col-base-pct">-</td><td>${grandMtdAvg}</td><td>${grandPrevAvg}</td><td>${grandCurAvg}</td>`;
        for (let i = 0; i < lastDates.length; i++) html += `<td>${grandTotals[i]}</td>`;
        html += `</tr>`;

        html += `<tr class="grand"><td>Grand Total</td><td>Unique</td><td>${grandBase}</td><td class="col-base-pct">-</td><td>${grandMtdUniqAvg}</td><td>${grandPrevUniqAvg}</td><td>${grandCurUniqAvg}</td>`;
        for (let i = 0; i < lastDates.length; i++) html += `<td>${grandUniqueTotals[i]}</td>`;
        html += `</tr>`;

        html += `<tr class="repeat"><td colspan="7" class="zone">Repeat Call Ratio</td>`;
        for (let i = 0; i < repeatRatios.length; i++) html += `<td>${repeatRatios[i]}</td>`;
        html += `</tr>`;

        html += `<tr class="repeat"><td colspan="7" class="zone">Repeat Call %</td>`;
        for (let i = 0; i < repeatPct.length; i++) html += `<td>${repeatPct[i]}</td>`;
        html += `</tr>`;

        html += `</tbody></table></div>`;
        return html;
    }

    if (summaryTableContainer) summaryTableContainer.innerHTML = buildTableHtml();

    const chartLabels = lastDates.map(d => {
        const [y, m, day] = d.split('-');
        return new Date(y, parseInt(m) - 1, day).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    });
    createOrUpdateMainChart(chartLabels, grandTotals, grandUniqueTotals);

    if (regionChips && regionChips.children.length !== allAvailableRegions.length) {
        regionChips.innerHTML = "";
        for (const r of allAvailableRegions) {
            const chip = document.createElement("div");
            chip.className = "chip off";
            chip.dataset.type = "region";
            chip.dataset.value = r;
            chip.textContent = r;
            chip.onclick = () => { filters.regions.clear(); filters.regions.add(r); render(); };
            regionChips.appendChild(chip);
        }
    }

    if (reasonChips && reasonChips.children.length !== allAvailableReasons.length) {
        reasonChips.innerHTML = "";
        for (const reason of allAvailableReasons) {
            const chip = document.createElement("div");
            chip.className = "chip off";
            chip.dataset.type = "reason";
            chip.dataset.value = reason;
            chip.textContent = reason;
            chip.onclick = () => { filters.reasons.clear(); filters.reasons.add(reason); render(); };
            reasonChips.appendChild(chip);
        }
    }

    renderZoneSection();
    renderRuralZoneSection();

    updateChipVisuals();
}

// --- Zone Render (Urban) ---
function renderZoneSection() {
    const datesAvailable = Object.keys(rawData).sort();
    if (datesAvailable.length === 0) {
        if (zoneSummaryTableContainer) zoneSummaryTableContainer.innerHTML = "<p style='padding:12px'>No zone data available.</p>";
        createOrUpdateZoneChart([], [], []);
        return;
    }

    const allDates = datesAvailable;
    const N = 7;
    const currentFilteredDates = getFilteredDates(dateFilters.zone, N);
    const lastDates = currentFilteredDates;
    const prevDates = getPreviousPeriodDates(lastDates, allDates);

    const latestDateStr = lastDates[lastDates.length - 1];
    const [latestYear, latestMonth] = latestDateStr ? latestDateStr.split('-').map(Number) : [0, 0];
    const mtdDates = allDates.filter(d => {
        const [y, m] = d.split('-').map(Number);
        return y === latestYear && m === latestMonth;
    });

    const cwaText = (dateFilters.zone.start && dateFilters.zone.end) ? 'CFA' : 'CWA';
    const pwaText = (dateFilters.zone.start && dateFilters.zone.end) ? 'PBA' : 'PWA';

    const today = new Date();
    const perZone = {};

    // Initialize per-zone structure
    for (const z of zonesOfInterest) {
        const normalized = normalizeKey(z);
        const cb = clientBaseMapNormalized[normalized];
        perZone[z] = {
            clientBase: Number.isFinite(cb) ? cb : 0,
            dailyTotals: lastDates.map(() => 0),
            dailyUniques: lastDates.map(() => 0)
        };
    }

    // Fill daily totals and uniques per zone
    for (let i = 0; i < lastDates.length; i++) {
        const d = lastDates[i];
        const group = rawData[d] || {};
        const uniqueSets = {};
        for (const z of zonesOfInterest) uniqueSets[z] = new Set();

        for (const docKey in group) {
            const row = group[docKey];
            if (!row || !passZoneFilters(row)) continue;
            const zoneVal = String(row.Zone || 'N/A');
            if (!zonesOfInterest.includes(zoneVal)) continue;

            perZone[zoneVal].dailyTotals[i]++;
            uniqueSets[zoneVal].add(getCallerId(row, docKey));
        }
        for (const z of zonesOfInterest) {
            perZone[z].dailyUniques[i] = uniqueSets[z].size;
        }
    }

    // Grand Totals (sum of totals across all urban zones)
    const grandTotals = lastDates.map((_, i) =>
        zonesOfInterest.reduce((sum, z) => sum + (perZone[z]?.dailyTotals[i] || 0), 0)
    );

    // Grand Uniques (real unique across all urban zones - no summing!)
    const grandUniques = lastDates.map((_, i) => {
        const dailySet = new Set();
        const d = lastDates[i];
        const group = rawData[d] || {};
        for (const docKey in group) {
            const row = group[docKey];
            if (!row || !passZoneFilters(row)) continue;
            if (!zonesOfInterest.includes(String(row.Zone || 'N/A'))) continue;
            dailySet.add(getCallerId(row, docKey));
        }
        return dailySet.size;
    });

    // MTD / PWA / CWA aggregates only for urban zones
    const urbanOnlyFilter = (row) => {
        if (!row) return false;
        const zone = String(row.Zone || 'N/A');
        return zonesOfInterest.includes(zone) && passZoneFilters(row);
    };

    const mtdAgg = computeTotalsForDateArray(mtdDates, urbanOnlyFilter);
    const prevAgg = computeTotalsForDateArray(prevDates, urbanOnlyFilter);
    const curAgg = computeTotalsForDateArray(lastDates, urbanOnlyFilter);

    const grandMtdAvg = mtdAgg.days > 0 ? Math.round(mtdAgg.tot / mtdAgg.days) : 0;
    const grandPrevAvg = prevAgg.days > 0 ? Math.round(prevAgg.tot / prevAgg.days) : 0;
    const grandCurAvg = curAgg.days > 0 ? Math.round(curAgg.tot / curAgg.days) : 0;

    const grandMtdUniqAvg = mtdAgg.days > 0 ? Math.round(mtdAgg.uniqueCount / mtdAgg.days) : 0;
    const grandPrevUniqAvg = prevAgg.days > 0 ? Math.round(prevAgg.uniqueCount / prevAgg.days) : 0;
    const grandCurUniqAvg = curAgg.days > 0 ? Math.round(curAgg.uniqueCount / curAgg.days) : 0;

    const grandBase = zonesOfInterest.reduce((s, z) => s + (perZone[z]?.clientBase || 0), 0);

    // Rebuild available reasons based on current zone filter
    const currentReasons = new Set();
    for (const date in rawData) {
        const day = rawData[date];
        for (const id in day) {
            const row = day[id];
            if (!row) continue;
            const zone = String(row.Zone || 'N/A');
            if (zoneFilters.size > 0 && !zoneFilters.has(zone)) continue;
            if (zonesOfInterest.includes(zone)) {
                currentReasons.add(String(row["Call Reason"] || 'N/A'));
            }
        }
    }
    allAvailableZoneReasons = Array.from(currentReasons).sort();

    function buildZoneTableHtml() {
        const thDates = lastDates.map(d => {
            const [y, m, day] = d.split('-');
            return new Date(y, parseInt(m) - 1, day).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
        });

        let html = `<div style="overflow:auto"><table class="excel-table"><thead><tr>
            <th>Zone</th><th>Type</th><th>Client Base</th><th class="col-base-pct">% age of Base (MTD)</th>
            <th>MTD Avg</th><th>${pwaText}</th><th>${cwaText}</th>`;
        for (const hd of thDates) html += `<th>${hd}</th>`;
        html += `</tr></thead><tbody>`;

        for (const z of zonesOfInterest) {
            if (!perZone[z]) continue;
            const clientBase = perZone[z].clientBase;

            // MTD Unique Avg per zone (for % of base)
            let mtdSumUniq = 0, mtdDays = 0;
            for (const dStr of mtdDates) {
                const [yy, mm, dd] = dStr.split('-');
                const dObj = new Date(yy, parseInt(mm) - 1, dd);
                if (dObj >= today) continue;
                const count = computeDailyUniqueCount(dStr, row => {
                    return String(row.Zone || 'N/A') === z && passZoneFilters(row);
                });
                mtdSumUniq += count;
                mtdDays++;
            }
            const mtdAvgUniq = mtdDays > 0 ? (mtdSumUniq / mtdDays) : 0;
            const percentOfBase = clientBase > 0 ? (mtdAvgUniq / clientBase * 100).toFixed(1) + '%' : '-';

            const zoneMtd = computeZoneAggregates(z, mtdDates, passZoneFilters);
            const zonePrev = computeZoneAggregates(z, prevDates, passZoneFilters);
            const zoneCur = computeZoneAggregates(z, lastDates, passZoneFilters);

            const mtdAvg = Math.round(zoneMtd.tot / Math.max(1, mtdDates.length));
            const prevAvg = prevDates.length > 0 ? Math.round(zonePrev.tot / prevDates.length) : 0;
            const curAvg = lastDates.length > 0 ? Math.round(zoneCur.tot / lastDates.length) : 0;

            const mtdUniqAvg = Math.round(zoneMtd.uniq / Math.max(1, mtdDates.length));
            const prevUniqAvg = prevDates.length > 0 ? Math.round(zonePrev.uniq / prevDates.length) : 0;
            const curUniqAvg = lastDates.length > 0 ? Math.round(zoneCur.uniq / lastDates.length) : 0;

            html += `<tr><td class="zone">${z}</td><td>Total</td><td>${clientBase}</td><td class="muted col-base-pct">${percentOfBase}</td><td>${mtdAvg}</td><td>${prevAvg}</td><td>${curAvg}</td>`;
            for (let i = 0; i < lastDates.length; i++) html += `<td>${perZone[z].dailyTotals[i]}</td>`;
            html += `</tr>`;

            html += `<tr class="row-unique"><td class="zone"></td><td>Unique</td><td></td><td class="col-base-pct"></td><td>${mtdUniqAvg}</td><td>${prevUniqAvg}</td><td>${curUniqAvg}</td>`;
            for (let i = 0; i < lastDates.length; i++) html += `<td>${perZone[z].dailyUniques[i]}</td>`;
            html += `</tr>`;
        }

        // GRAND TOTALS 
        html += `<tr class="grand"><td>Grand Total</td><td>Total</td><td>${grandBase}</td><td class="col-base-pct">-</td><td>${grandMtdAvg}</td><td>${grandPrevAvg}</td><td>${grandCurAvg}</td>`;
        for (let i = 0; i < lastDates.length; i++) html += `<td>${grandTotals[i]}</td>`;
        html += `</tr>`;

        html += `<tr class="grand"><td>Grand Total</td><td>Unique</td><td>${grandBase}</td><td class="col-base-pct">-</td><td>${grandMtdUniqAvg}</td><td>${grandPrevUniqAvg}</td><td>${grandCurUniqAvg}</td>`;
        for (let i = 0; i < lastDates.length; i++) html += `<td>${grandUniques[i]}</td>`;
        html += `</tr>`;

        // Repeat ratios
        const ratios = grandTotals.map((t, i) => {
            const u = grandUniques[i] || 0;
            return u > 0 ? (t / u).toFixed(2) : '-';
        });
        const pct = grandTotals.map((t, i) => {
            const u = grandUniques[i] || 0;
            return t > 0 ? Math.round((1 - u / t) * 100) + '%' : '-';
        });

        html += `<tr class="repeat"><td colspan="7" class="zone">Repeat Call Ratio</td>`;
        for (const r of ratios) html += `<td>${r}</td>`;
        html += `</tr>`;

        html += `<tr class="repeat"><td colspan="7" class="zone">Repeat Call %</td>`;
        for (const p of pct) html += `<td>${p}</td>`;
        html += `</tr></tbody></table></div>`;

        return html;
    }

    if (zoneSummaryTableContainer) zoneSummaryTableContainer.innerHTML = buildZoneTableHtml();

    // Chart - now shows correct urban-only data
    const chartLabels = lastDates.map(d => {
        const [y, m, day] = d.split('-');
        return new Date(y, parseInt(m) - 1, day).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    });

    createOrUpdateZoneChart(chartLabels, grandTotals, grandUniques);

    // Rebuild zone & reason chips
    if (zoneChips && zoneChips.children.length !== zonesOfInterest.length) {
        zoneChips.innerHTML = "";
        for (const z of zonesOfInterest) {
            const chip = document.createElement("div");
            chip.className = zoneFilters.has(z) ? "chip selected" : "chip off";
            chip.dataset.value = z;
            chip.textContent = z;
            chip.onclick = () => { zoneFilters.clear(); zoneFilters.add(z); renderZoneSection(); };
            zoneChips.appendChild(chip);
        }
    }

    if (zoneReasonChips) {
        zoneReasonChips.innerHTML = '';
        for (const reason of allAvailableZoneReasons) {
            const chip = document.createElement('div');
            chip.className = zoneReasonFilters.has(reason) ? 'chip selected' : 'chip off';
            chip.dataset.value = reason;
            chip.textContent = reason;
            chip.onclick = () => {
                zoneReasonFilters.clear();
                zoneReasonFilters.add(reason);
                renderZoneSection();
            };
            zoneReasonChips.appendChild(chip);
        }
    }

    updateChipVisuals();
}

function renderRuralZoneSection() {
    const dates = getFilteredDates('rural', 7);
    if (!dates.length) { ruralSummaryTableContainer.innerHTML = "<p>No data</p>"; return; }

    // Rebuild zones & reasons
    const zonesSet = new Set(), reasonsSet = new Set();
    Object.values(rawData).forEach(day => Object.values(day).forEach(r => {
        if (r.Region === "Rural" && (!ruralReasonFilters.size || ruralReasonFilters.has(r["Call Reason"]))) {
            zonesSet.add(r.Zone); reasonsSet.add(r["Call Reason"]);
        }
    }));
    allRuralZones = Array.from(zonesSet).sort();
    ruralReasons = Array.from(reasonsSet).sort();

    // Top-20 logic (unchanged – already perfect)
    const mtdStart = dates[0];
    const mtdDates = Object.keys(rawData).filter(d => d >= mtdStart);
    const zoneCount = {};
    mtdDates.forEach(d => Object.values(rawData[d]||{}).forEach(r => {
        if (r.Region==="Rural" && (!ruralReasonFilters.size || ruralReasonFilters.has(r["Call Reason"]))) {
            zoneCount[r.Zone] = (zoneCount[r.Zone] || 0) + 1;
        }
    }));
    const top20 = Object.entries(zoneCount).sort((a,b)=>b[1]-a[1]).slice(0,20).map(e=>e[0]);

    // Daily data for chart
    const dailyTot = dates.map(()=>0);
    const dailyUniq = dates.map(()=>new Set());
    dates.forEach((d,i) => Object.values(rawData[d]||{}).forEach(r => {
        if (passRuralFilters(r) && top20.includes(r.Zone)) {
            dailyTot[i]++;
            dailyUniq[i].add(r.phone_number);
        }
    }));
    const dailyUniqCount = dailyUniq.map(s=>s.size);

    createOrUpdateChart(dates.map(d=>new Date(d).toLocaleDateString(undefined,{day:'numeric',month:'short'})), dailyTot, dailyUniqCount, ruralZoneCanvas);

    // Table & chips rendering (your perfect code continues here…)
    // → just keep your existing renderRuralZoneSection table/chips code
}

/* ---------------- INIT ---------------- */
async function init() {
    // ... your existing init code ...

    // At the very end, after all renders:
    document.getElementById('lastUpdated').textContent = 
        "Last updated: " + new Date().toLocaleString('en-GB', {day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'});
    
    updateTitle(); // call your title function
}

init();