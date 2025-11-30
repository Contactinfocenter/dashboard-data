async function loadData() {
  const url = "https://raw.githubusercontent.com/Contactinfocenter/dashboard-data/main/data/calls/2025-11-01.csv";

  const response = await fetch(url);
  const csvText = await response.text();

  const parsed = Papa.parse(csvText, { header: true });
  const rows = parsed.data;

  document.getElementById("output").textContent =
    JSON.stringify(rows.slice(0, 5), null, 2);
}
