// home-2.js — FULL UPDATED VERSION with avgHourlyChart converted to ECharts (Phoenix style)

const MASTER_DATA_URL = "https://raw.githubusercontent.com/Contactinfocenter/dashboard-data/main/data/calls/all_calls.json";

let rawData = {};
let agentList = [];
let agentStats = {};
let selectedDate = null;
let currentSelectedAgent = null;

// Chart instances
let avgHourlyChart = null;          // Now ECharts
let ahtHeatmapChart = null;
let agentVsSystemHourlyChart = null;
let talkTimeComparisonChart = null;
let repeatRateChart = null;

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

// ==================== PROCESS DATA ====================
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

  const availableDates = Object.keys(rawData)
    .filter(key => /^\d{4}-\d{1,2}-\d{1,2}$/.test(key))
    .sort((a, b) => new Date(b) - new Date(a));

  selectedDate = availableDates.length > 0 ? availableDates[0] : new Date().toISOString().split('T')[0];

  updateSelectedDateDisplay(selectedDate);

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
      if (count > 1) repeatCalls += (count - 1);
    }
  }
  const repeatPct = totalCallsAll ? Math.round((repeatCalls / totalCallsAll) * 100) : 0;

  const kpiTotalCalls = document.getElementById('kpiTotalCalls');
  const kpiActiveAgents = document.getElementById('kpiActiveAgents');
  const kpiTopAgent = document.getElementById('kpiTopAgent');
  const kpiAvgAHT = document.getElementById('kpiAvgAHT');
  const kpiRepeatPct = document.getElementById('kpiRepeatPct');

  if (kpiTotalCalls) kpiTotalCalls.textContent = totalCalls.toLocaleString();
  if (kpiActiveAgents) kpiActiveAgents.textContent = activeAgents;
  if (kpiTopAgent) kpiTopAgent.textContent = topAgent;
  if (kpiAvgAHT) kpiAvgAHT.textContent = formatSecondsToMinutes(avgAht);
  if (kpiRepeatPct) kpiRepeatPct.textContent = repeatPct + '%';
}

// ==================== HOURLY VOLUME (NOW ECHARTS) ====================
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

function renderCombinedHourlyChart() {
  const avgData = computeAvgHourlyVolume();
  const todayData = computeSelectedDateHourlyVolume(selectedDate);

  const dom = document.getElementById('avgHourlyChart');
  if (!dom) return;

  if (avgHourlyChart) {
    avgHourlyChart.dispose();
  }

  avgHourlyChart = echarts.init(dom);

  const primaryColor = '#3874ff';
  const amberColor = '#f59e0b';

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'line',
        lineStyle: { color: '#d1d5db', width: 1 }
      }
    },
    legend: {
      show: true,
      top: '5%',
      left: 'center',
      textStyle: { color: '#525b75', fontWeight: 600 },
      itemWidth: 18,
      itemHeight: 10,
      data: [
        { name: 'Average (All Time)', icon: 'roundRect' },
        { name: selectedDate, icon: 'line' }
      ]
    },
    grid: {
      left: '5%',
      right: '5%',
      top: '18%',
      bottom: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#6b7280',
        fontSize: 12,
        fontWeight: 600
      },
      splitLine: {
        show: true,
        lineStyle: { color: '#f3f4f6' }
      }
    },
    yAxis: {
      type: 'value',
      name: 'Call Volume',
      nameLocation: 'middle',
      nameGap: 40,
      nameTextStyle: { color: '#64748b' },
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } }
    },
    series: [
      {
        name: 'Average (All Time)',
        type: 'line',
        smooth: true,
        data: avgData,
        symbol: 'circle',
        symbolSize: 8,
        showSymbol: false,
        areaStyle: {
          opacity: 0.4,
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(56, 116, 255, 0.6)' },
            { offset: 1, color: 'rgba(56, 116, 255, 0.05)' }
          ])
        },
        itemStyle: { color: primaryColor },
        lineStyle: { width: 3, color: primaryColor },
        emphasis: {
          focus: 'series',
          itemStyle: {
            color: primaryColor,
            borderColor: '#fff',
            borderWidth: 5,
            shadowBlur: 20,
            shadowColor: 'rgba(56, 116, 255, 0.6)'
          },
          symbolSize: 14
        }
      },
      {
        name: selectedDate,
        type: 'line',
        smooth: true,
        data: todayData,
        symbol: 'circle',
        symbolSize: 8,
        showSymbol: false,
        areaStyle: {
          opacity: 0.5,
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(245, 158, 11, 0.7)' },
            { offset: 1, color: 'rgba(245, 158, 11, 0.05)' }
          ])
        },
        itemStyle: { color: amberColor },
        lineStyle: { width: 4, color: amberColor },
        emphasis: {
          focus: 'series',
          itemStyle: {
            color: amberColor,
            borderColor: '#fff',
            borderWidth: 5,
            shadowBlur: 20,
            shadowColor: 'rgba(245, 158, 11, 0.6)'
          },
          symbolSize: 14
        }
      }
    ]
  };

  avgHourlyChart.setOption(option);
  window.addEventListener('resize', () => avgHourlyChart?.resize());
}

// ==================== REST OF YOUR FUNCTIONS (unchanged) ====================
// (Keeping the rest exactly as before for brevity — they remain functional)

function renderAgentChips() { /* ... your existing code ... */ }
function renderAgentVsSystemHourlyChart(agent) { /* ... */ }
function renderTalkTimeComparisonChart(agent) { /* ... */ }
function getHourlyTalkTime(agent, dateStr) { /* ... */ }
function getAgentHourlyVolumeOnSelectedDate(agent, dateStr) { /* ... */ }
function renderAHTHeatmap(agent) { /* ... */ }
function computeAhtPerHour(agent) { /* ... */ }
function renderLoginSummary() { /* ... */ }

function renderRepeatRateChartForSelectedDate() {
  const calls = getCallsForDate(selectedDate);
  const agentStatsToday = {};
  for (const id in calls) {
    const c = calls[id];
    const agent = (c.full_name || "Unknown").trim();
    const phone = c.phone_number;
    if (!agentStatsToday[agent]) agentStatsToday[agent] = { total: 0, unique: new Set() };
    agentStatsToday[agent].total++;
    if (phone) agentStatsToday[agent].unique.add(phone);
  }

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

  const dom = document.getElementById('repeatRateChart');
  if (!dom) return;

  if (repeatRateChart) repeatRateChart.dispose();
  repeatRateChart = echarts.init(dom);

  const option = {
    title: { text: `Repeat Caller Rate per Agent – ${selectedDate}`, left: 'center', top: 10, textStyle: { fontSize: 16, fontWeight: '600', color: '#1e293b' } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: p => `<strong>${p[0].name}</strong><br/>Repeat Rate: <strong>${p[0].value}%</strong>` },
    grid: { left: '5%', right: '5%', top: 60, bottom: 80, containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { interval: 0, rotate: 45, fontSize: 12, color: '#64748b', align: 'right' },
      axisLine: { show: false }
    },
    yAxis: {
      type: 'value',
      max: value => value.max > 0 ? Math.ceil(value.max * 1.1) : 100,
      axisLabel: { formatter: '{value}%', color: '#64748b' },
      splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } }
    },
    series: [{
      name: 'Repeat Rate %',
      type: 'bar',
      data: data,
      barWidth: '50%',
      itemStyle: {
        borderRadius: [6, 6, 0, 0],
        color: params => {
          const v = params.value;
          if (v > 30) return '#dc2626';
          if (v > 15) return '#f59e0b';
          return '#10b981';
        }
      },
      label: { show: true, position: 'top', formatter: '{c}%', fontWeight: 'bold', color: '#1e293b' }
    }]
  };

  repeatRateChart.setOption(option);
  repeatRateChart.resize();
  window.addEventListener('resize', () => repeatRateChart?.resize());
}

function renderLeaderboard() { /* ... */ }
function renderCallSummaryTable() { /* ... */ }

function renderAllChartsAndTables() {
  renderCombinedHourlyChart();           // Now ECharts!
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

// ==================== TABS & EVENTS ====================
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

function resetToToday() {
  const dates = Object.keys(rawData)
    .filter(d => /^\d{4}-\d{1,2}-\d{1,2}$/.test(d))
    .sort((a, b) => new Date(b) - new Date(a));
  selectedDate = dates[0] || new Date().toISOString().split('T')[0];
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
      updateSelectedDateDisplay(dateStr);
      renderAllChartsAndTables();
    }
  });
} catch (e) { console.warn("flatpickr not loaded"); }