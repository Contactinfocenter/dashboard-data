lucide.createIcons();

const MASTER_DATA_URL = "https://raw.githubusercontent.com/Contactinfocenter/dashboard-data/main/data/calls/all_calls.json";

let rawData = {};
let agentList = [];
let agentStats = {};
let selectedDate = null;
let currentSelectedAgent = null;
let avgHourlyChart = null;
let ahtHeatmapChart = null;
let agentVsSystemChart = null;
let talkTimeChart = null;
let repeatRateChart = null;
let currentEnabledDates = [];
let datePickerInstance = null;

const primaryColor = '#3874ff';
const avgColor = '#CBD5E1';
const hours = Array.from({length: 24}, (_, i) => `${i.toString().padStart(2, '0')}:00`);

function safeNum(v) { return Number.isFinite(Number(v)) ? Number(v) : 0; }

function formatSecondsToMinutes(totalSeconds) {
  if (!totalSeconds || totalSeconds < 0) return "0:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function updateSelectedDateDisplay(dateStr) {
  const display = formatDateDisplay(dateStr);
  document.getElementById('selectedDate').textContent = display;
  document.getElementById('selectedDateDisplay').textContent = display;
  document.getElementById('volumeChartDate').textContent = display;
  document.getElementById('talkTimeChartDate').textContent = display;

  if (datePickerInstance) {
    datePickerInstance.setDate(dateStr, false);
  }
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

async function loadDataFromGitHub() {
  const reloadIcon = document.getElementById('reloadIcon');
  const loadingIcon = document.getElementById('loadingIcon');
  reloadIcon.classList.add('hidden');
  loadingIcon.classList.remove('hidden');

  try {
    const res = await fetch(MASTER_DATA_URL + '?t=' + Date.now());
    const json = await res.json();
    const newRawData = json.calls || {};
    const availableDates = Object.keys(newRawData)
      .filter(key => /^\d{4}-\d{1,2}-\d{1,2}$/.test(key))
      .sort((a, b) => new Date(b) - new Date(a));

    const newLatestDate = availableDates.length > 0 ? availableDates[0] : selectedDate;

    if (JSON.stringify(newRawData) !== JSON.stringify(rawData) || selectedDate !== newLatestDate) {
      rawData = newRawData;
      selectedDate = newLatestDate;
      processRawData(rawData);
      updateSelectedDateDisplay(selectedDate);
      renderAllContent();
      initDatePicker();
    }
  } catch (err) {
    console.error("Failed to load data", err);
    alert("Failed to reload data. Please try again.");
  } finally {
    loadingIcon.classList.add('hidden');
    reloadIcon.classList.remove('hidden');
    reloadIcon.style.transform = 'rotate(360deg)';
    setTimeout(() => { reloadIcon.style.transform = ''; }, 600);
  }
}

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
  if (agentList.length && !currentSelectedAgent) currentSelectedAgent = agentList[0];
}

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
      if (phone) callerCount[phone] = (callerCount[phone] || 0) + 1;
    }
    for (const count of Object.values(callerCount)) {
      if (count > 1) repeatCalls += (count - 1);
    }
  }
  const repeatPct = totalCallsAll ? Math.round((repeatCalls / totalCallsAll) * 100) : 0;

  document.getElementById('kpiTotalCalls').textContent = totalCalls.toLocaleString();
  document.getElementById('kpiActiveAgents').textContent = activeAgents;
  document.getElementById('kpiTopAgent').textContent = topAgent;
  document.getElementById('kpiAvgAHT').textContent = formatSecondsToMinutes(avgAht);
  document.getElementById('kpiRepeatPct').textContent = repeatPct + '%';
}

function renderLineChart(containerId, series) {
  const chartDom = document.getElementById(containerId);
  if (!chartDom) return;
  let chart = echarts.getInstanceByDom(chartDom);
  if (chart) chart.dispose();
  chart = echarts.init(chartDom);

  const option = {
    tooltip: { trigger: 'axis', padding: [12, 16], backgroundColor: 'rgba(255, 255, 255, 0.95)', borderColor: '#e2e8f0', textStyle: { color: '#1e293b', fontWeight: 600 }, extraCssText: 'box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border-radius: 8px;' },
    legend: { show: true, top: '0%', right: '0%', icon: 'circle', itemGap: 20, textStyle: { color: '#64748b', fontWeight: 700, fontSize: 11 } },
    grid: { left: '1%', right: '1%', top: '15%', bottom: '5%', containLabel: true },
    xAxis: { type: 'category', data: hours, boundaryGap: false, axisLine: { show: true, lineStyle: { color: '#f1f5f9' } }, axisTick: { show: false }, axisLabel: { color: '#94a3b8', fontWeight: 700, margin: 20, fontSize: 11, interval: 2 }, splitLine: { show: true, lineStyle: { color: '#f1f5f9', width: 1 } } },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8', fontWeight: 700, fontSize: 11 }, splitLine: { show: false } },
    series: series.map((s, i) => ({
      name: s.name,
      type: 'line',
      data: s.data,
      smooth: true,
      showSymbol: false,
      itemStyle: { color: i === 0 ? avgColor : primaryColor },
      lineStyle: { width: 2, color: i === 0 ? avgColor : primaryColor, shadowBlur: i === 1 ? 10 : 0, shadowColor: i === 1 ? 'rgba(56, 116, 255, 0.3)' : '' },
      areaStyle: i === 0 ? { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(203, 213, 225, 0.2)' }, { offset: 1, color: 'rgba(203, 213, 225, 0)' }]) } : undefined
    }))
  };

  chart.setOption(option);
  window.addEventListener('resize', () => chart.resize());
}

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

function renderHourlyChart() {
  const avgData = computeAvgHourlyVolume();
  const todayData = computeSelectedDateHourlyVolume(selectedDate);
  renderLineChart('avgHourlyChart', [
    { name: 'Average (All Days)', data: avgData },
    { name: formatDateDisplay(selectedDate), data: todayData }
  ]);
}

function getAgentHourlyVolumeOnSelectedDate(agent, dateStr) {
  const calls = getCallsForDate(dateStr);
  const h = Array(24).fill(0);
  for (const id in calls) {
    if ((calls[id].full_name || "Unknown").trim() === agent) {
      const d = new Date(calls[id].call_date);
      if (!isNaN(d)) h[d.getHours()]++;
    }
  }
  return h.map(v => v > 0 ? v : null);
}

function renderAgentVsSystemChart(agent) {
  const agentData = getAgentHourlyVolumeOnSelectedDate(agent, selectedDate);
  const systemData = computeSelectedDateHourlyVolume(selectedDate);
  renderLineChart('agentVsSystemHourlyCanvas', [
    { name: 'Team Average', data: systemData },
    { name: agent, data: agentData }
  ]);
}

function getHourlyTalkTime(agent, dateStr) {
  const calls = getCallsForDate(dateStr);
  const sys = Array(24).fill(0), ag = Array(24).fill(0);
  for (const id in calls) {
    const c = calls[id];
    const d = new Date(c.call_date);
    const aht = safeNum(c.acht);
    const name = (c.full_name || "Unknown").trim();
    if (!isNaN(d)) {
      const h = d.getHours();
      sys[h] += aht;
      if (name === agent) ag[h] += aht;
    }
  }
  return { systemData: sys, agentData: ag };
}

function renderTalkTimeChart(agent) {
  const { systemData, agentData } = getHourlyTalkTime(agent, selectedDate);
  renderLineChart('talkTimeComparisonChart', [
    { name: 'Team Average', data: systemData },
    { name: agent, data: agentData.map(v => v > 0 ? v : null) }
  ]);
}

function renderAgentChips(containerId) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = '';
  agentList.forEach(a => {
    const b = document.createElement('button');
    b.textContent = a;
    b.className = a === currentSelectedAgent ? 'agent-chip active' : 'agent-chip';
    b.onclick = () => {
      currentSelectedAgent = a;
      ['agentChipContainer', 'agentChipContainerVolume', 'agentChipContainerTalkTime'].forEach(id => {
        const container = document.getElementById(id);
        if (container) {
          [...container.children].forEach(btn => {
            btn.className = btn.textContent === a ? 'agent-chip active' : 'agent-chip';
          });
        }
      });
      renderAHTHeatmap(a);
      renderAgentVsSystemChart(a);
      renderTalkTimeChart(a);
    };
    c.appendChild(b);
  });
}

function computeAhtPerHour(agent) {
  const s = agentStats[agent];
  if (!s) return Array(24).fill(0);
  return s.hourly.map(arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
}

function renderAHTHeatmap(agent) {
  const data = computeAhtPerHour(agent);
  const chartDom = document.getElementById('ahtHeatmapCanvas');
  if (!chartDom) return;
  if (ahtHeatmapChart) ahtHeatmapChart.dispose();
  ahtHeatmapChart = echarts.init(chartDom);
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#f8fafc',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      padding: [10, 14],
      textStyle: { color: '#475569', fontSize: 13 },
      extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 8px;',
      formatter: params => {
        const p = params[0];
        if (!p || p.value === 0) return '<div style="color:#94a3b8; font-size:12px; padding-left:18px;">No calls</div>';
        const hour = p.name;
        const timeValue = formatSecondsToMinutes(p.value);
        return `<div style="display: flex; align-items: flex-start; gap: 10px; line-height: 1.4;">
          <div style="width: 8px; height: 8px; background: #3b82f6; border-radius: 50%; margin-top: 4px; flex-shrink: 0;"></div>
          <div>
            <div style="font-size: 12px; color: #64748b; font-weight: 600; margin-bottom: 1px;">${hour}</div>
            <div style="font-size: 12.5px; color: #64748b;">
              Avg AHT — ${agent}: <strong style="color: #3b82f6; font-weight: 700; margin-left: 5px; font-size: 13.5px;">${timeValue}</strong>
            </div>
          </div>
        </div>`;
      }
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: hours, axisTick: { alignWithLabel: true }, axisLine: { show: true, lineStyle: { color: '#e2e8f0' } }, axisLabel: { color: '#64748b', fontWeight: 600, fontSize: 11, interval: 1 } },
    yAxis: { type: 'value', axisLabel: { formatter: val => formatSecondsToMinutes(val), color: '#64748b', fontWeight: 600 }, splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } } },
    series: [{
      name: 'Avg AHT',
      type: 'bar',
      barWidth: '60%',
      data: data,
      itemStyle: {
        color: params => {
          const v = params.value;
          if (v === 0) return '#e2e8f0';
          if (v > 400) return '#f59e0b';
          if (v > 300) return '#fbbf24';
          return '#60a5fa';
        },
        borderRadius: [6, 6, 0, 0]
      },
      label: {
        show: true,
        position: 'top',
        formatter: p => p.value === 0 ? '' : formatSecondsToMinutes(p.value),
        color: '#1e293b',
        fontWeight: 'bold',
        fontSize: 11
      }
    }]
  };
  ahtHeatmapChart.setOption(option);
}

function renderLoginSummary() {
  const c = document.getElementById('loginSummaryContainer');
  if (!c) return;
  let html = '<table class="w-full text-sm"><thead class="bg-slate-100 sticky top-0"><tr><th class="px-4 py-3 text-left font-bold">Agent</th><th class="px-4 py-3 text-center font-bold">Active Days</th><th class="px-4 py-3 text-center font-bold">Total Hours</th><th class="px-4 py-3 text-center font-bold">Avg Hours/Day</th></tr></thead><tbody>';
  agentList.forEach(agent => {
    const s = agentStats[agent];
    const days = Object.keys(s.firstPerDay).map(d => {
      const f = s.firstPerDay[d], l = s.lastPerDay[d] || f;
      return { hours: Math.max(0, (l - f) / 3600000) };
    });
    const totalDays = days.length;
    const totalH = days.reduce((a, b) => a + b.hours, 0).toFixed(2);
    const avgH = totalDays ? (totalH / totalDays).toFixed(2) : '0.00';
    html += `<tr class="hover:bg-slate-50"><td class="px-4 py-3 font-medium">${agent}</td><td class="px-4 py-3 text-center">${totalDays}</td><td class="px-4 py-3 text-center">${totalH}</td><td class="px-4 py-3 text-center">${avgH}</td></tr>`;
  });
  html += '</tbody></table>';
  c.innerHTML = html;
}

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
  const chartDom = document.getElementById('repeatRateChart');
  if (!chartDom) return;
  if (repeatRateChart) repeatRateChart.dispose();
  repeatRateChart = echarts.init(chartDom);
  const option = {
    title: { text: 'Repeat Caller Rate per Agent', left: 'center', top: 10, textStyle: { fontSize: 16, fontWeight: 600 } },
    tooltip: { trigger: 'axis', formatter: p => `<strong>${p[0].name}</strong><br/>Repeat Rate: <strong>${p[0].value}%</strong>` },
    grid: { left: '5%', right: '5%', top: 60, bottom: 80, containLabel: true },
    xAxis: { type: 'category', data: labels, axisLabel: { interval: 0, rotate: 45, fontSize: 12 } },
    yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
    series: [{
      type: 'bar',
      data: data,
      itemStyle: {
        color: params => {
          const v = params.value;
          if (v > 30) return '#dc2626';
          if (v > 15) return '#f59e0b';
          return '#10b981';
        },
        borderRadius: [6, 6, 0, 0]
      },
      label: { show: true, position: 'top', formatter: '{c}%', fontWeight: 'bold' }
    }]
  };
  repeatRateChart.setOption(option);
}

function renderLeaderboard() {
  const c = document.getElementById('leaderboardContainer');
  if (!c) return;
  const ranked = Object.entries(agentStats)
    .map(([a, s]) => ({ agent: a, total: s.total, fcr: s.fcr, aht: s.total ? Math.round(s.ahtSum / s.total) : 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 50);
  c.innerHTML = ranked.map((r, i) => `
    <div class="flex items-center justify-between p-4 rounded-xl ${i < 3 ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-full bg-blue-900 text-white flex items-center justify-center font-bold text-lg">${i + 1}</div>
        <div>
          <div class="font-bold text-lg">${r.agent}</div>
          <div class="text-sm text-slate-600">Calls: ${r.total} • FCR: ${r.fcr} • AHT: ${formatSecondsToMinutes(r.aht)}</div>
        </div>
      </div>
      <div class="text-right">
        <div class="text-2xl font-black">${r.total}</div>
        <div class="text-sm text-slate-500">calls</div>
      </div>
    </div>`).join('');
}

function renderCallSummaryTable() {
  const c = document.getElementById('callSummaryTable');
  if (!c) return;
  let html = '<table class="w-full text-sm"><thead class="bg-slate-100 sticky top-0"><tr><th class="px-4 py-3 text-left font-bold">Agent</th><th class="px-4 py-3 text-center font-bold">Total Calls</th><th class="px-4 py-3 text-center font-bold">Unique Callers</th><th class="px-4 py-3 text-center font-bold">FCR</th><th class="px-4 py-3 text-center font-bold">Avg AHT</th></tr></thead><tbody>';
  agentList.forEach(a => {
    const s = agentStats[a];
    const avg = s.total ? Math.round(s.ahtSum / s.total) : 0;
    html += `<tr class="hover:bg-slate-50"><td class="px-4 py-3 font-medium">${a}</td><td class="px-4 py-3 text-center">${s.total}</td><td class="px-4 py-3 text-center">${s.uniqueCallers.size}</td><td class="px-4 py-3 text-center">${s.fcr}</td><td class="px-4 py-3 text-center">${formatSecondsToMinutes(avg)}</td></tr>`;
  });
  html += '</tbody></table>';
  c.innerHTML = html;
}

function renderAllContent() {
  renderKPIs();
  renderHourlyChart();
  renderAgentChips('agentChipContainer');
  renderAgentChips('agentChipContainerVolume');
  renderAgentChips('agentChipContainerTalkTime');
  const agent = currentSelectedAgent || (agentList.length ? agentList[0] : null);
  if (agent) {
    renderAHTHeatmap(agent);
    renderAgentVsSystemChart(agent);
    renderTalkTimeChart(agent);
  }
  renderLoginSummary();
  renderRepeatRateChartForSelectedDate();
  renderLeaderboard();
  renderCallSummaryTable();
}

function initDatePicker() {
  const dates = Object.keys(rawData)
    .filter(d => /^\d{4}-\d{1,2}-\d{1,2}$/.test(d))
    .sort((a, b) => new Date(b) - new Date(a));

  if (JSON.stringify(dates) === JSON.stringify(currentEnabledDates)) return;

  if (datePickerInstance) datePickerInstance.destroy();

  datePickerInstance = flatpickr('#datePicker', {
    altInput: true,
    altFormat: "M j, Y",
    dateFormat: "Y-m-d",
    defaultDate: selectedDate,
    enable: dates,
    // Restored the nice pill/button style
    altInputClass: "uppercase tracking-wider bg-slate-100 border-none rounded-full pl-10 pr-4 py-2 text-xs font-extrabold text-slate-700 h-10 flex items-center leading-10 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-600",
    onChange: (selectedDates, dateStr) => {
      selectedDate = dateStr;
      updateSelectedDateDisplay(dateStr);
      renderAllContent();
    }
  });
  currentEnabledDates = dates;
}

document.getElementById('mobileDateTrigger')?.addEventListener('click', () => {
  document.getElementById('datePicker')._flatpickr.open();
});

const tabButtons = document.querySelectorAll('.tab-button');
const tabIndicator = document.getElementById('tabIndicator');

function updateIndicator(activeButton) {
  const container = activeButton.parentElement;
  const buttonRect = activeButton.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  tabIndicator.style.left = `${buttonRect.left - containerRect.left}px`;
  tabIndicator.style.width = `${buttonRect.width}px`;
}

tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    tabButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    updateIndicator(button);
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.add('hidden'));
    document.querySelector(`.tab-panel[data-panel="${button.dataset.tab}"]`).classList.remove('hidden');
  });
});

const activeTab = document.querySelector('.tab-button.active');
if (activeTab) updateIndicator(activeTab);

window.addEventListener('resize', () => {
  const active = document.querySelector('.tab-button.active');
  if (active) updateIndicator(active);
});

document.getElementById('btnReload').addEventListener('click', loadDataFromGitHub);

loadDataFromGitHub();