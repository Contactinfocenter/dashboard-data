import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

/* FIREBASE CONFIG */
const firebaseConfig = {
    apiKey: "AIzaSyAb1x31pma-pubWkJHHFjeGA_t2w4cLKY8",
    authDomain: "dashboard-24856.firebaseapp.com",
    databaseURL: "https://dashboard-24856-default-rtdb.firebaseio.com",
    projectId: "dashboard-24856",
    storageBucket: "dashboard-24856.appspot.com",
    messagingSenderId: "484671281554",
    appId: "1:484671281554:web:218b6fa714f61aa158894b"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const callsRef = ref(db, "calls");

/* -------------- MAIN DATA STRUCTURES -------------- */
let agentStats = {};  
// Structure:
// agentStats[agentName] = {
//    total: 0,
//    fcr: 0,
//    nonFcr: 0,
//    ahtSum: 0,
//    uniqueCallers: Set(),
// }

/* ----------------- LOAD DATA ----------------- */
onValue(callsRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    agentStats = {};

    // Loop through: date → callID → callData
    for (const dateKey in data) {
        const calls = data[dateKey];

        for (const callId in calls) {
            const call = calls[callId];
            if (!call.full_name) continue;

            const agent = call.full_name.trim();
            if (!agentStats[agent]) {
                agentStats[agent] = {
                    total: 0,
                    fcr: 0,
                    nonFcr: 0,
                    ahtSum: 0,
                    uniqueCallers: new Set()
                };
            }

            agentStats[agent].total++;
            agentStats[agent].ahtSum += Number(call.acht || 0);

            if (call.status === "FCR") agentStats[agent].fcr++;
            else agentStats[agent].nonFcr++;

            agentStats[agent].uniqueCallers.add(call.phone_number);
        }
    }

    renderKPIs();
    renderCharts();
    renderAgentTable();
});
