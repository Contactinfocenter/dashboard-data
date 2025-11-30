// app-a.js (SAFE VERSION)

// Chart.js Plugins
Chart.register(ChartDataLabels);

// CONFIG
const BASE_GITHUB =
  "https://raw.githubusercontent.com/Contactinfocenter/dashboard-data/main/data/calls";

// "Safe" status update
function showStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.innerText = msg;
  console.log(msg); // fallback if element missing
}

// Load the latest available CSV file from the last 10 days
async function loadLatestCSV() {
  const today = new Date();

  for (let i = 0; i < 10; i++) {
    const d = new Date();
    d.setDate(today.getDate() - i);

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");

    const filename = `${y}-${m}-${dd}.csv`;
    const url = `${BASE_GITHUB}/${filename}`;

    console.log("Trying:", url);

    try {
      const response = await fetch(url);

      if (response.ok) {
        showStatus(`CSV Loaded: ${filename}`);

        const csvText = await response.text();
        processCSV(csvText);
        return;
      }
    } catch (e) {
      console.log("Fetch error:", e);
    }
  }

  showStatus("❌ No CSV found in last 10 days!");
}

// Parse CSV using PapaParse
function processCSV(csvText) {
  Papa.parse(csvText, {
    header: true,
    dynamicTyping: true,
    complete: function (result) {
      console.log("Parsed rows:", result.data.length);
      renderCharts(result.data);
    },
  });
}

// --------------------
// CHART RENDER SECTION
// --------------------

let barChartRef = null;

function renderCharts(rows) {
  showStatus(`✅ CSV Loaded (${rows.length} rows)`);

  const ahtList = rows.map((r) => r.AHT);

  if (barChartRef) barChartRef.destroy();

  const ctx = document.getElementById("barChart").getContext("2d");

  barChartRef = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ahtList.map((v, i) => "Row " + (i + 1)),
      datasets: [
        {
          label: "AHT",
          data: ahtList,
          datalabels: {
            anchor: "end",
            align: "top",
            formatter: (v) => v,
          },
        },
      ],
    },
    options: {
      plugins: {
        datalabels: {
          color: "#000",
          font: {
            weight: "bold",
          },
        },
      },
      responsive: true,
    },
  });
}

loadLatestCSV();
