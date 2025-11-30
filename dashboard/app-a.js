//-----------------------------------------
// GLOBAL INITIALIZATION
//-----------------------------------------
Chart.register(ChartDataLabels);

let groupedData = {};       // All calls by date
let selectedDate = null;
let availableDates = [];

// GitHub folder (ONLY CHANGE THIS PART)
const GITHUB_BASE =
  "https://raw.githubusercontent.com/Contactinfocenter/dashboard-data/main/data/calls/";


//------------------------------------------------------
// LOAD CSV FROM GITHUB (BY SELECTED DATE)
//------------------------------------------------------
async function loadCSV(dateString) {
  const url = `${GITHUB_BASE}${dateString}.csv`;

  try {
    const csvText = await fetch(url).then(r => r.text());

    return new Promise(resolve => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: results => {
          resolve(results.data);
        }
      });
    });

  } catch (err) {
    console.error("CSV load error:", err);
    return [];
  }
}


//------------------------------------------------------
// NORMALIZE CSV ROWS → JSON { date: {call_id: {...}} }
//------------------------------------------------------
function normalizeData(csvRows) {
  let map = {};

  for (let row of csvRows) {
    if (!row.call_date) continue;

    // Date only (YYYY-MM-DD)
    let date = row.call_date.split(" ")[0];

    if (!map[date]) map[date] = [];

    map[date].push(row);
  }
  return map;
}


//------------------------------------------------------
// LOAD LATEST DATE FROM GITHUB REPO BASED ON INDEX LIST
//------------------------------------------------------
async function initLoad() {
  const today = new Date();
  const tryDates = [];

  // Try last 10 days (you can increase)
  for (let i = 0; i < 10; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    tryDates.push(d.toISOString().slice(0, 10));
  }

  // Find the first CSV that exists
  for (let date of tryDates) {
    const url = `${GITHUB_BASE}${date}.csv`;
    const resp = await fetch(url);

    if (resp.ok) {
      console.log("Found CSV date:", date);
      selectedDate = date;
      document.getElementById("selectedDate").innerText = date;
      const raw = await loadCSV(date);
      groupedData = normalizeData(raw);
      availableDates = Object.keys(groupedData);
      renderForSelectedDate();
      return;
    }
  }

  alert("No CSV found in last 10 days!");
}


//------------------------------------------------------
// KPI + CHART RENDERING FOR SELECTED DATE
//------------------------------------------------------
function renderForSelectedDate() {
  let list = groupedData[selectedDate] || [];

  // KPIs
  document.getElementById("kpiTotalCalls").innerText = list.length;

  let unique = new Set(list.map(r => r.phone_number));
  document.getElementById("kpiUniqueCallers").innerText = unique.size;

  let fcrCount = list.filter(r => r.status === "FCR").length;
  document.getElementById("kpiFCRPercent").innerText =
    ((fcrCount / list.length) * 100).toFixed(1) + "%";

  let avgACHT =
    list.reduce((a, b) => a + Number(b.acht || 0), 0) / (list.length || 1);
  document.getElementById("kpiAvgHandleTime").innerText =
    Math.round(avgACHT) + "s";

  // Build charts
  renderHourlyChart(list);
  renderRegionPie(list);
  renderFcrPie(list);
  renderButterfly(list);
}


//------------------------------------------------------
// HOURLY BAR CHART
//------------------------------------------------------
function renderHourlyChart(list) {
  const ctx = document.getElementById("lastDayHourlyChart");

  // Count by hour
  const counts = Array(24).fill(0);

  for (let row of list) {
    const hour = Number(row.call_date.split(" ")[1].split(":")[0]);
    counts[hour]++;
  }

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: [...Array(24).keys()],
      datasets: [
        {
          label: "Calls",
          data: counts
        }
      ]
    }
  });
}


//------------------------------------------------------
// REGION PIE CHART
//------------------------------------------------------
function renderRegionPie(list) {
  const ctx = document.getElementById("lastDayRegionPie");

  const map = {};
  for (let row of list) {
    if (!map[row.Region]) map[row.Region] = 0;
    map[row.Region]++;
  }

  new Chart(ctx, {
    type: "pie",
    data: {
      labels: Object.keys(map),
      datasets: [
        { data: Object.values(map) }
      ]
    }
  });
}


//------------------------------------------------------
// FCR PIE CHART
//------------------------------------------------------
function renderFcrPie(list) {
  const ctx = document.getElementById("lastDayFCRPie");

  let fcr = list.filter(r => r.status === "FCR").length;
  let non = list.length - fcr;

  new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["FCR", "Non-FCR"],
      datasets: [
        { data: [fcr, non] }
      ]
    }
  });
}


//------------------------------------------------------
// BUTTERFLY CHART (Reason vs ACHT)
//------------------------------------------------------
function renderButterfly(list) {
  const ctx = document.getElementById("dayButterflyChart");

  // Count reason
  const countMap = {};
  const achtMap = {};

  for (let row of list) {
    const r = row["Call Reason"] || "Unknown";

    if (!countMap[r]) {
      countMap[r] = 0;
      achtMap[r] = [];
    }

    countMap[r]++;
    achtMap[r].push(Number(row.acht || 0));
  }

  // Prepare data
  const labels = Object.keys(countMap).slice(0, 10); // top 10
  const calls = labels.map(l => countMap[l]);
  const avgAcht = labels.map(l => {
    let total = achtMap[l].reduce((a, b) => a + b, 0);
    return Math.round(total / achtMap[l].length);
  });

  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Calls",
          data: calls,
          xAxisID: "left"
        },
        {
          label: "Avg ACHT",
          data: avgAcht,
          xAxisID: "right"
        }
      ]
    },
    options: {
      indexAxis: "y",
      scales: {
        left: { position: "left" },
        right: { position: "right" }
      }
    }
  });
}


//------------------------------------------------------
// DATE PICKER EVENT
//------------------------------------------------------
document.getElementById("datePicker").addEventListener("change", async e => {
  selectedDate = e.target.value;
  document.getElementById("selectedDate").innerText = selectedDate;

  const rows = await loadCSV(selectedDate);
  groupedData = normalizeData(rows);
  renderForSelectedDate();
});


// Reload latest
document.getElementById("btnReload").addEventListener("click", initLoad);


//------------------------------------------------------
// FIRST RUN
//------------------------------------------------------
initLoad();
