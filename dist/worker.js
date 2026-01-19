// worker.js

// Utility to handle numbers safely
const safeNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

self.onmessage = function(e) {
    const { action, rawData, selectedDate, mode, startDate, endDate } = e.data;

    if (action === 'PROCESS_DATA') {
        const agentStats = {};
        let totalCallsAll = 0;
        let repeatCallsTotal = 0;

        // Process Global Stats and Agent Stats
        for (const dateKey in rawData) {
            const calls = rawData[dateKey] || {};
            const dailyCallerTracker = {};

            for (const callId in calls) {
                const call = calls[callId];
                totalCallsAll++;
                
                const agent = (call.full_name || "Unknown").trim();
                const phone = call.phone_number || null;
                const acht = safeNum(call.acht);

                // Global Repeat Logic
                if (phone) {
                    dailyCallerTracker[phone] = (dailyCallerTracker[phone] || 0) + 1;
                }

                // Agent Logic
                if (!agentStats[agent]) {
                    agentStats[agent] = { total: 0, ahtSum: 0 };
                }
                agentStats[agent].total++;
                agentStats[agent].ahtSum += acht;
            }

            // Calculate repeats for this specific day
            for (const count of Object.values(dailyCallerTracker)) {
                if (count > 1) repeatCallsTotal += (count - 1);
            }
        }

        const globalMetrics = {
            totalCalls: totalCallsAll,
            avgAht: totalCallsAll ? Math.round(Object.values(agentStats).reduce((a, s) => a + s.ahtSum, 0) / totalCallsAll) : 0,
            repeatPct: totalCallsAll ? Math.round((repeatCallsTotal / totalCallsAll) * 100) : 0,
            agentCount: Object.keys(agentStats).length
        };

        self.postMessage({ 
            status: 'success', 
            data: { agentStats, globalMetrics } 
        });
    }
};