// === Laptopkarren Dashboard ===

const DAYS_NL = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const DAYS_SHORT = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const MONTHS_NL = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

const COLORS = {
    athena: 'rgba(41, 128, 185, 0.8)',
    athenaBg: 'rgba(41, 128, 185, 0.15)',
    socrates: 'rgba(230, 126, 34, 0.8)',
    socratesBg: 'rgba(230, 126, 34, 0.15)',
    alle: 'rgba(26, 82, 118, 0.8)',
    alleBg: 'rgba(26, 82, 118, 0.15)',
};

let allRecords = [];
let activeFilter = 'alle';
let activeTab = 'overzicht';
let charts = {};

// ===================== FILE UPLOAD =====================

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const clearBtn = document.getElementById('clear-btn');

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', e => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });

    clearBtn.addEventListener('click', () => {
        allRecords = [];
        document.getElementById('dashboard').classList.add('hidden');
        document.getElementById('drop-zone').classList.remove('hidden');
        document.getElementById('file-info').classList.add('hidden');
        destroyCharts();
    });

    // Location filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.dataset.filter;
            renderDashboard();
        });
    });

    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeTab = btn.dataset.tab;
            // Destroy charts BEFORE hiding tabs (prevents ResizeObserver errors)
            destroyCharts();
            document.getElementById('tab-overzicht').classList.toggle('hidden', activeTab !== 'overzicht');
            document.getElementById('tab-toekomst').classList.toggle('hidden', activeTab !== 'toekomst');
            if (allRecords.length) renderDashboard();
        });
    });
});

function handleFile(file) {
    if (!file.name.match(/\.xlsx?$/i)) {
        alert('Selecteer een Excel-bestand (.xlsx)');
        return;
    }

    document.getElementById('file-name').textContent = file.name;
    document.getElementById('file-date').textContent = `Geladen: ${new Date().toLocaleString('nl-NL')}`;
    document.getElementById('drop-zone').classList.add('hidden');
    document.getElementById('file-info').classList.remove('hidden');

    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = new Uint8Array(e.target.result);
            const wb = XLSX.read(data, { type: 'array', cellDates: true });
            allRecords = parseWorkbook(wb);
            document.getElementById('dashboard').classList.remove('hidden');
            renderDashboard();
        } catch (err) {
            alert('Fout bij het lezen van het bestand: ' + err.message);
            console.error(err);
        }
    };
    reader.readAsArrayBuffer(file);
}

// ===================== PARSING =====================

function parseWorkbook(wb) {
    const records = [];

    for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        // Determine location from sheet name
        const location = sheetName.toLowerCase().includes('athena') ? 'Athena' : 'Socrates';

        for (const row of rows) {
            const subject = String(row['Onderwerp'] || '');
            if (!subject) continue;

            const canceled = /^(canceled|geannuleerd|afgebroken)/i.test(subject);
            const teacher = extractTeacher(subject);
            const cart = extractCart(String(row['Verplichte deelnemers'] || ''));
            const start = parseDate(row['Begin']);
            const end = parseDate(row['Einde']);

            if (!start || !end) continue;

            records.push({ location, subject, teacher, cart, start, end, canceled });
        }
    }

    return records;
}

function extractTeacher(subject) {
    let name = subject
        // Strip cancel/annulering prefixes
        .replace(/^(Canceled:\s*|Geannuleerd:\s*|Afgebroken:\s*)/i, '')
        // Strip reservation type prefixes
        .replace(/^Computer faciliteiten\s*-\s*/i, '')
        .replace(/^Laptopkar\s*-\s*/i, '')
        .replace(/^PWS\s*-\s*/i, '')
        .replace(/^Kerstactie\s*-\s*/i, '')
        .trim();

    // Normalize "Lastname , Firstname [extra]" to "Firstname [extra] Lastname"
    if (name.includes(' , ')) {
        const parts = name.split(' , ');
        name = parts[1].trim() + ' ' + parts[0].trim();
    }
    // Also handle "Lastname, Firstname"
    if (/^[A-Za-z][a-z]+,\s/.test(name)) {
        const parts = name.split(/,\s*/);
        name = parts[1].trim() + ' ' + parts[0].trim();
    }

    // Aggressively clean cart/room/location info from names
    name = name
        .replace(/\blaptopkar\b.*/i, '')               // "laptopkar ..." and everything after
        .replace(/\bkar\s+\d+\s+voor\b.*/i, '')        // "kar 6 voor klas 4 ..." descriptive text
        .replace(/\bvoor\s+\d.*$/i, '')                 // "voor 2a 6e uur ..."
        .replace(/\bvoor\s+\w.*$/i, '')                 // "voor klas ..."
        .replace(/\bin\s+lokaal\s+\w+/gi, '')           // "in lokaal a11"
        .replace(/\bin\s+[a-z]\d+/gi, '')               // "in a12"
        .replace(/\bkar\s*\d+[\s\w]*/gi, '')            // "kar 5 107", "kar 6"
        .replace(/\bnr\s*\d+[\s\w]*/gi, '')             // "nr 5 in a12"
        .replace(/\b\d{2}[a-z]\d+\w*/gi, '')            // "03b0k1", "05b1kar1"
        .replace(/\b[a-z]\d{2,}\b/gi, '')               // "c23", "a12", "b0kar1"
        .replace(/\b[b-c]\d+\s*kar\s*\w*/gi, '')        // "b0kar1", "b1 kar1"
        .replace(/\(\s*kar\s*\d*\s*\d*\s*\)/gi, '')     // "(kar 203)"
        .replace(/\(\s*\d+\s*\)/g, '')                  // "(4)", "(5)"
        .replace(/\b\d{3}\b/g, '')                      // standalone room numbers "107", "203", "303"
        .replace(/\b3c\b/gi, '')                        // "3c" location code
        .replace(/\s*-\s*$/g, '')                       // trailing dashes
        .replace(/\s+/g, ' ')                           // collapse whitespace
        .trim();

    return name || 'Onbekend';
}

function extractCart(participants) {
    // Match "LAPTOPKAR ATHENA 03 B0 KAR1" or "LAPTOPKAR SOCRATES 04 104"
    const match = participants.match(/LAPTOPKAR\s+(ATHENA|SOCRATES)\s+(\d+)\s+([A-Z0-9]+)/i);
    if (match) {
        const loc = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
        const num = match[2];
        const room = match[3].toUpperCase();
        // Normalize to "Athena 03 B0" or "Socrates 04 104"
        return `${loc} ${num} ${room}`;
    }
    // Try to match headphone sets
    const hpMatch = participants.match(/KOPTELEFOON[^;]*/i);
    if (hpMatch) return hpMatch[0].trim();

    return 'Onbekend';
}

function parseDate(val) {
    if (!val) return null;

    // Already a Date object (from cellDates: true)
    if (val instanceof Date && !isNaN(val)) return val;

    // Number (Excel serial date)
    if (typeof val === 'number') {
        const epoch = new Date(1899, 11, 30);
        return new Date(epoch.getTime() + val * 86400000);
    }

    // String: "di 16-9-2025 14:35"
    if (typeof val === 'string') {
        const str = val.trim();

        // Dutch format first: "di 16-9-2025 14:35" (day-month-year)
        // Must try this BEFORE new Date() which uses US month-day-year
        const m = str.match(/[a-zA-Z]+\s+(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})/);
        if (m) {
            return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]), parseInt(m[4]), parseInt(m[5]));
        }

        // Try "d-m-yyyy H:mm" without day name
        const m2 = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})/);
        if (m2) {
            return new Date(parseInt(m2[3]), parseInt(m2[2]) - 1, parseInt(m2[1]), parseInt(m2[4]), parseInt(m2[5]));
        }

        // Fallback: ISO format (only if no Dutch format matched)
        const iso = new Date(str);
        if (!isNaN(iso)) return iso;
    }

    return null;
}

// ===================== DATA ANALYSIS =====================

function getFilteredRecords() {
    if (activeFilter === 'alle') return allRecords;
    return allRecords.filter(r => r.location === activeFilter);
}

function getActiveRecords(records) {
    return records.filter(r => !r.canceled);
}

function analyzeData(records) {
    const active = getActiveRecords(records);
    const stats = {};

    // Basic counts
    stats.total = records.length;
    stats.active = active.length;
    stats.canceled = records.length - active.length;
    stats.cancelRate = records.length ? ((stats.canceled / records.length) * 100).toFixed(1) : 0;

    // Unique teachers and carts
    stats.teachers = new Set(active.map(r => r.teacher.toLowerCase())).size;
    stats.carts = new Set(active.filter(r => !r.cart.includes('Onbekend')).map(r => r.cart)).size;

    // Per weekday
    stats.weekday = [0, 0, 0, 0, 0, 0, 0];
    active.forEach(r => { stats.weekday[r.start.getDay()]++; });

    // Peak day
    let maxDay = 0;
    stats.weekday.forEach((count, i) => { if (count > stats.weekday[maxDay]) maxDay = i; });
    stats.peakDay = DAYS_NL[maxDay];

    // Per hour
    stats.hourly = {};
    for (let h = 7; h <= 17; h++) stats.hourly[h] = 0;
    active.forEach(r => {
        const h = r.start.getHours();
        stats.hourly[h] = (stats.hourly[h] || 0) + 1;
    });

    // Peak hour
    let maxHour = 8;
    Object.entries(stats.hourly).forEach(([h, c]) => {
        if (c > (stats.hourly[maxHour] || 0)) maxHour = parseInt(h);
    });
    stats.peakHour = `${maxHour}:00`;

    // Per month
    stats.monthly = {};
    active.forEach(r => {
        const key = `${r.start.getFullYear()}-${String(r.start.getMonth() + 1).padStart(2, '0')}`;
        stats.monthly[key] = (stats.monthly[key] || 0) + 1;
    });

    // Per week
    stats.weekly = { Athena: {}, Socrates: {} };
    active.forEach(r => {
        const d = new Date(r.start);
        d.setDate(d.getDate() - d.getDay() + 1); // Monday of that week
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!stats.weekly[r.location]) stats.weekly[r.location] = {};
        stats.weekly[r.location][key] = (stats.weekly[r.location][key] || 0) + 1;
    });

    // Heatmap: weekday x hour
    stats.heatmap = {};
    for (let d = 1; d <= 5; d++) {
        stats.heatmap[d] = {};
        for (let h = 8; h <= 16; h++) stats.heatmap[d][h] = 0;
    }
    active.forEach(r => {
        const day = r.start.getDay();
        const hour = r.start.getHours();
        if (day >= 1 && day <= 5 && stats.heatmap[day]) {
            stats.heatmap[day][hour] = (stats.heatmap[day][hour] || 0) + 1;
        }
    });

    // Top 10 per location
    stats.top10 = { Athena: {}, Socrates: {} };
    active.forEach(r => {
        if (!stats.top10[r.location]) stats.top10[r.location] = {};
        const key = r.teacher.toLowerCase();
        stats.top10[r.location][key] = (stats.top10[r.location][key] || 0) + 1;
    });

    for (const loc of ['Athena', 'Socrates']) {
        stats.top10[loc] = Object.entries(stats.top10[loc])
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({
                name: name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                count
            }));
    }

    // Capacity analysis
    stats.capacity = analyzeCapacity(active);

    // Per cart stats
    stats.cartUsage = {};
    active.forEach(r => {
        if (r.cart === 'Onbekend') return;
        if (!stats.cartUsage[r.cart]) stats.cartUsage[r.cart] = { total: 0, monthly: {} };
        stats.cartUsage[r.cart].total++;
        const mKey = `${r.start.getFullYear()}-${String(r.start.getMonth() + 1).padStart(2, '0')}`;
        stats.cartUsage[r.cart].monthly[mKey] = (stats.cartUsage[r.cart].monthly[mKey] || 0) + 1;
    });

    return stats;
}

function analyzeCapacity(active) {
    // Group by location, then by date+hour slot, count unique carts in use
    const result = { Athena: {}, Socrates: {} };
    const totalCarts = { Athena: new Set(), Socrates: new Set() };

    active.forEach(r => {
        if (r.cart === 'Onbekend') return;
        const loc = r.location;
        totalCarts[loc]?.add(r.cart);

        // For each hour the reservation spans
        const startHour = r.start.getHours();
        const endHour = r.end.getHours() + (r.end.getMinutes() > 0 ? 1 : 0);
        const dateStr = r.start.toISOString().slice(0, 10);

        for (let h = startHour; h < endHour; h++) {
            const key = `${dateStr}_${h}`;
            if (!result[loc]) result[loc] = {};
            if (!result[loc][key]) result[loc][key] = { date: dateStr, hour: h, carts: new Set() };
            result[loc][key].carts.add(r.cart);
        }
    });

    // Find peak slots and calculate occupancy per location
    const peaksPerLoc = { Athena: [], Socrates: [] };
    const maxOccPerLoc = { Athena: 0, Socrates: 0 };

    for (const loc of ['Athena', 'Socrates']) {
        const maxCarts = totalCarts[loc]?.size || 1;
        for (const [, slot] of Object.entries(result[loc] || {})) {
            const occupancy = slot.carts.size / maxCarts;
            if (occupancy > maxOccPerLoc[loc]) maxOccPerLoc[loc] = occupancy;
            if (occupancy >= 0.5) {
                peaksPerLoc[loc].push({
                    location: loc,
                    date: slot.date,
                    hour: slot.hour,
                    inUse: slot.carts.size,
                    available: maxCarts,
                    occupancy
                });
            }
        }
        peaksPerLoc[loc].sort((a, b) => b.occupancy - a.occupancy);
    }

    // Combine peaks: top 25 per location
    const peaks = [
        ...peaksPerLoc.Athena.slice(0, 25),
        ...peaksPerLoc.Socrates.slice(0, 25)
    ].sort((a, b) => b.occupancy - a.occupancy);

    // Weekly average occupancy for trend
    const weeklyOccupancy = { Athena: {}, Socrates: {} };
    for (const loc of ['Athena', 'Socrates']) {
        const maxCarts = totalCarts[loc]?.size || 1;
        const weekSlots = {};

        for (const [, slot] of Object.entries(result[loc] || {})) {
            const d = new Date(slot.date);
            d.setDate(d.getDate() - d.getDay() + 1);
            const wk = d.toISOString().slice(0, 10);
            if (!weekSlots[wk]) weekSlots[wk] = [];
            weekSlots[wk].push(slot.carts.size / maxCarts);
        }

        for (const [wk, vals] of Object.entries(weekSlots)) {
            weeklyOccupancy[loc][wk] = vals.reduce((a, b) => a + b, 0) / vals.length;
        }
    }

    return {
        totalCarts: { Athena: totalCarts.Athena?.size || 0, Socrates: totalCarts.Socrates?.size || 0 },
        maxOccPerLoc,
        highPeaksPerLoc: {
            Athena: peaksPerLoc.Athena.filter(p => p.occupancy >= 0.8).length,
            Socrates: peaksPerLoc.Socrates.filter(p => p.occupancy >= 0.8).length
        },
        peaks,
        weeklyOccupancy
    };
}

// ===================== RENDERING =====================

function destroyCharts() {
    Object.values(charts).forEach(c => c.destroy?.());
    charts = {};
}

function renderDashboard() {
    destroyCharts();

    const filtered = getFilteredRecords();
    const stats = analyzeData(filtered);

    // Always render non-chart elements (KPIs, heatmap HTML, selectors, summaries)
    renderKPIs(stats);
    renderOverzichtSummary(stats);
    renderHeatmap(stats);
    renderCartSelector(stats);

    // Only create Chart.js charts for the visible tab
    if (activeTab === 'overzicht') {
        renderWeeklyChart(stats);
        renderMonthlyChart(stats);
        renderWeekdayChart(stats);
        renderTop10(stats);
        renderCapacity(stats);
    }

    // Forecast tab (always uses all records for complete picture)
    const forecast = analyzeForecast(allRecords);
    if (forecast) {
        renderForecastKPIs(forecast);
        renderToekomstSummary(forecast);
        renderForecastHeatmap(forecast);
        if (activeTab === 'toekomst') {
            renderForecastChart(forecast);
            renderScenarioAnalysis(forecast);
            renderLatentDemand(forecast);
        }
    }
}

function renderKPIs(stats) {
    document.getElementById('kpi-total').textContent = stats.active.toLocaleString('nl-NL');
    document.getElementById('kpi-teachers').textContent = stats.teachers;
    document.getElementById('kpi-carts').textContent = stats.carts;
    document.getElementById('kpi-canceled').textContent = stats.cancelRate + '%';
    document.getElementById('kpi-peak-day').textContent = stats.peakDay;
    document.getElementById('kpi-peak-hour').textContent = stats.peakHour;
}

function renderOverzichtSummary(stats) {
    const el = document.getElementById('summary-overzicht');
    const cap = stats.capacity;
    const maxOcc = Math.max(cap.maxOccPerLoc.Athena || 0, cap.maxOccPerLoc.Socrates || 0);
    const maxOccPct = Math.round(maxOcc * 100);
    const highPeaks = (cap.highPeaksPerLoc.Athena || 0) + (cap.highPeaksPerLoc.Socrates || 0);
    const worstLoc = (cap.maxOccPerLoc.Socrates || 0) > (cap.maxOccPerLoc.Athena || 0) ? 'Socrates' : 'Athena';

    // Date range
    const dates = allRecords.map(r => r.start).filter(d => d).sort((a, b) => a - b);
    const first = dates[0];
    const last = dates[dates.length - 1];
    const rangeStr = first && last
        ? `${first.getDate()} ${MONTHS_NL[first.getMonth()]} ${first.getFullYear()} t/m ${last.getDate()} ${MONTHS_NL[last.getMonth()]} ${last.getFullYear()}`
        : '';

    let lines = [`<div class="summary-title">Samenvatting</div>`];
    lines.push(`In de periode <strong>${rangeStr}</strong> zijn <strong>${stats.active.toLocaleString('nl-NL')} reserveringen</strong> geregistreerd door <strong>${stats.teachers} docenten</strong> op ${stats.carts} laptopkarren over twee locaties.`);
    lines.push(`De drukste dag is <strong>${stats.peakDay}</strong> en het drukste uur is <strong>${stats.peakHour}</strong>. Het annuleringspercentage is ${stats.cancelRate}%.`);

    if (maxOccPct >= 90) {
        lines.push(`De maximale bezettingsgraad is <strong>${maxOccPct}%</strong> (${worstLoc}), met <strong>${highPeaks} piektijden boven 80%</strong>. De capaciteit staat onder druk.`);
        lines.push(`<span class="cta danger">Capaciteit monitoren en uitbreiden overwegen</span>`);
    } else if (maxOccPct >= 70) {
        lines.push(`De maximale bezettingsgraad is <strong>${maxOccPct}%</strong> (${worstLoc}), met ${highPeaks} piektijden boven 80%. Er is nog ruimte maar piekuren vragen aandacht.`);
        lines.push(`<span class="cta warning">Piektijden in de gaten houden</span>`);
    } else {
        lines.push(`De maximale bezettingsgraad is <strong>${maxOccPct}%</strong> (${worstLoc}). Er is voldoende capaciteit op beide locaties.`);
    }

    el.innerHTML = lines.join('<br>');
}

function renderToekomstSummary(forecast) {
    const el = document.getElementById('summary-toekomst');
    const locs = activeFilter === 'alle' ? ['Athena', 'Socrates'] : [activeFilter];

    let peakPct = 0, peakLoc = '', weeksOver = 0, extraNeeded = 0;
    for (const loc of locs) {
        const s = forecast.summary[loc];
        if (!s) continue;
        if (s.peakProjected > peakPct) { peakPct = s.peakProjected; peakLoc = loc; }
        weeksOver = Math.max(weeksOver, s.weeksOver);
        extraNeeded = Math.max(extraNeeded, s.extraNeeded);
    }

    // Find busiest time window
    let busiestWindow = '', busiestOcc = 0;
    for (const loc of locs) {
        const proj = forecast.projection[loc];
        if (!proj || !proj.length) continue;
        const lastWeek = proj[proj.length - 1];
        for (let dow = 1; dow <= 5; dow++) {
            for (const [twIdx, data] of Object.entries(lastWeek.dayDetails[dow] || {})) {
                if (data.projected > busiestOcc) {
                    busiestOcc = data.projected;
                    busiestWindow = `${DAYS_NL[dow]} ${forecast.timeWindows[twIdx]?.label || ''}`;
                }
            }
        }
    }

    let lines = [`<div class="summary-title">Prognose module 3</div>`];
    lines.push(`Op basis van de afgelopen 6 weken en de groeitrend wordt de bezetting in module 3 (eind maart &ndash; eind juni) geprojecteerd.`);

    if (peakPct >= 100) {
        lines.push(`De verwachte piekbezetting is <strong>${peakPct}%</strong> op ${peakLoc}, wat betekent dat de vraag de beschikbare capaciteit overstijgt. Het drukste moment is <strong>${busiestWindow}</strong>.`);
        lines.push(`Er zijn naar schatting <strong>${extraNeeded} extra kar(ren)</strong> nodig om piektijden op te vangen. In ${weeksOver} van de ${forecast.summary[locs[0]]?.totalWeeks || '?'} weken wordt een tekort verwacht.`);
        lines.push(`<span class="cta danger">Capaciteit uitbreiden voor module 3</span>`);
    } else if (peakPct >= 80) {
        lines.push(`De verwachte piekbezetting is <strong>${peakPct}%</strong> op ${peakLoc}. Het drukste moment is <strong>${busiestWindow}</strong>. De capaciteit is krap maar toereikend.`);
        if (extraNeeded > 0) {
            lines.push(`Overweeg <strong>${extraNeeded} extra kar(ren)</strong> aan te schaffen als buffer voor onverwachte pieken.`);
        }
        lines.push(`<span class="cta warning">Capaciteit nauwlettend volgen</span>`);
    } else {
        lines.push(`De verwachte piekbezetting is <strong>${peakPct}%</strong> (${peakLoc}). Er is voldoende capaciteit voor module 3. Het drukste moment is <strong>${busiestWindow}</strong>.`);
    }

    el.innerHTML = lines.join('<br>');
}

function renderWeeklyChart(stats) {
    const allWeeks = new Set();
    for (const loc of ['Athena', 'Socrates']) {
        Object.keys(stats.weekly[loc] || {}).forEach(w => allWeeks.add(w));
    }
    const weeks = [...allWeeks].sort();

    const formatWeek = w => {
        const d = new Date(w);
        return `${d.getDate()} ${MONTHS_NL[d.getMonth()]}`;
    };

    const datasets = [];
    if (activeFilter === 'alle' || activeFilter === 'Athena') {
        datasets.push({
            label: 'Athena',
            data: weeks.map(w => stats.weekly.Athena?.[w] || 0),
            borderColor: COLORS.athena,
            backgroundColor: COLORS.athenaBg,
            fill: true,
            tension: 0.3
        });
    }
    if (activeFilter === 'alle' || activeFilter === 'Socrates') {
        datasets.push({
            label: 'Socrates',
            data: weeks.map(w => stats.weekly.Socrates?.[w] || 0),
            borderColor: COLORS.socrates,
            backgroundColor: COLORS.socratesBg,
            fill: true,
            tension: 0.3
        });
    }

    charts.weekly = new Chart(document.getElementById('chart-weekly'), {
        type: 'line',
        data: { labels: weeks.map(formatWeek), datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Reserveringen' } }
            }
        }
    });
}

function renderMonthlyChart(stats) {
    const months = Object.keys(stats.monthly).sort();
    const formatMonth = m => {
        const [y, mo] = m.split('-');
        return `${MONTHS_NL[parseInt(mo) - 1]} ${y}`;
    };

    charts.monthly = new Chart(document.getElementById('chart-monthly'), {
        type: 'bar',
        data: {
            labels: months.map(formatMonth),
            datasets: [{
                label: 'Reserveringen',
                data: months.map(m => stats.monthly[m]),
                backgroundColor: COLORS.athena,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Aantal' } }
            }
        }
    });
}

function renderWeekdayChart(stats) {
    const labels = ['Ma', 'Di', 'Wo', 'Do', 'Vr'];
    const data = [stats.weekday[1], stats.weekday[2], stats.weekday[3], stats.weekday[4], stats.weekday[5]];
    const max = Math.max(...data);

    charts.weekday = new Chart(document.getElementById('chart-weekday'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Reserveringen',
                data,
                backgroundColor: data.map(d => d === max ? COLORS.accent || '#e67e22' : COLORS.athena),
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function renderHeatmap(stats) {
    const container = document.getElementById('heatmap');
    const hours = [];
    for (let h = 8; h <= 16; h++) hours.push(h);
    const days = [1, 2, 3, 4, 5];
    const dayLabels = ['Ma', 'Di', 'Wo', 'Do', 'Vr'];

    // Find max for color scaling
    let maxVal = 0;
    days.forEach(d => hours.forEach(h => {
        const v = stats.heatmap[d]?.[h] || 0;
        if (v > maxVal) maxVal = v;
    }));

    let html = '<table><thead><tr><th></th>';
    hours.forEach(h => { html += `<th>${h}:00</th>`; });
    html += '</tr></thead><tbody>';

    days.forEach((d, i) => {
        html += `<tr><th>${dayLabels[i]}</th>`;
        hours.forEach(h => {
            const val = stats.heatmap[d]?.[h] || 0;
            const intensity = maxVal ? val / maxVal : 0;
            const bg = heatColor(intensity);
            const textColor = intensity > 0.5 ? 'white' : '#333';
            html += `<td style="background:${bg};color:${textColor}" title="${dayLabels[i]} ${h}:00 - ${val} reserveringen">${val}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function heatColor(intensity) {
    if (intensity === 0) return '#f0f3f5';
    // Gradient: light blue -> blue -> dark blue
    const r = Math.round(234 - intensity * 193);
    const g = Math.round(242 - intensity * 162);
    const b = Math.round(248 - intensity * 63);
    return `rgb(${r}, ${g}, ${b})`;
}

function renderTop10(stats) {
    renderTop10Chart('chart-top10-athena', stats.top10.Athena || [], COLORS.athena);
    renderTop10Chart('chart-top10-socrates', stats.top10.Socrates || [], COLORS.socrates);
}

function renderTop10Chart(canvasId, data, color) {
    let canvas = document.getElementById(canvasId);
    if (!canvas) {
        // Canvas was replaced by "no data" message; restore it
        const container = document.querySelector(`#${canvasId}`)?.parentElement
            || document.querySelector(`[data-chart="${canvasId}"]`);
        if (container) {
            container.innerHTML = `<canvas id="${canvasId}"></canvas>`;
            canvas = document.getElementById(canvasId);
        }
        if (!canvas) return;
    }
    if (!data.length) {
        canvas.style.display = 'none';
        const existing = canvas.parentElement.querySelector('.no-data-msg');
        if (!existing) {
            canvas.parentElement.insertAdjacentHTML('beforeend', '<p class="no-data-msg" style="color:#7f8c8d;text-align:center;padding:2rem">Geen data voor deze locatie</p>');
        }
        return;
    }
    canvas.style.display = '';
    const existing = canvas.parentElement.querySelector('.no-data-msg');
    if (existing) existing.remove();

    charts[canvasId] = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: data.map(d => d.name),
            datasets: [{
                label: 'Reserveringen',
                data: data.map(d => d.count),
                backgroundColor: color,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { beginAtZero: true, title: { display: true, text: 'Aantal' } }
            }
        }
    });
}

function renderCapacity(stats) {
    const cap = stats.capacity;
    const summaryEl = document.getElementById('capacity-summary');

    let summaryHtml = '';
    for (const loc of ['Athena', 'Socrates']) {
        const total = cap.totalCarts[loc];
        const maxOccupancy = cap.maxOccPerLoc[loc] || 0;
        const highPeaks = cap.highPeaksPerLoc[loc] || 0;

        let statusClass = 'ok';
        let statusText = 'Voldoende capaciteit';
        if (maxOccupancy >= 0.9) {
            statusClass = 'danger';
            statusText = 'Capaciteitsprobleem!';
        } else if (maxOccupancy >= 0.7) {
            statusClass = 'warning';
            statusText = 'Aandacht nodig';
        }

        summaryHtml += `
            <div class="capacity-card ${statusClass}">
                <h3>${loc}</h3>
                <div class="stat">${total} karren</div>
                <p>Max bezetting: ${Math.round(maxOccupancy * 100)}%</p>
                <p>${highPeaks} momenten met >80% bezetting</p>
                <p><strong>${statusText}</strong></p>
            </div>
        `;
    }

    // Trend assessment
    const weeklyAll = {};
    for (const loc of ['Athena', 'Socrates']) {
        for (const [wk, occ] of Object.entries(cap.weeklyOccupancy[loc] || {})) {
            weeklyAll[wk] = (weeklyAll[wk] || 0) + occ;
        }
    }
    const sortedWeeks = Object.keys(weeklyAll).sort();
    if (sortedWeeks.length >= 4) {
        const firstHalf = sortedWeeks.slice(0, Math.floor(sortedWeeks.length / 2));
        const secondHalf = sortedWeeks.slice(Math.floor(sortedWeeks.length / 2));
        const avgFirst = firstHalf.reduce((s, w) => s + weeklyAll[w], 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((s, w) => s + weeklyAll[w], 0) / secondHalf.length;
        const trend = ((avgSecond - avgFirst) / avgFirst * 100).toFixed(0);

        let trendClass = 'ok';
        let trendText = `Het gebruik is ${trend > 0 ? 'gestegen' : 'gedaald'} met ${Math.abs(trend)}% in de tweede helft van de periode.`;
        if (trend > 20) {
            trendClass = 'warning';
            trendText += ' Bij deze trend is mogelijk extra capaciteit nodig.';
        }

        summaryHtml += `
            <div class="capacity-card ${trendClass}">
                <h3>Trend</h3>
                <div class="stat">${trend > 0 ? '+' : ''}${trend}%</div>
                <p>${trendText}</p>
            </div>
        `;
    }

    summaryEl.innerHTML = summaryHtml;

    // Capacity chart: weekly occupancy over time
    const allWeeks = new Set();
    for (const loc of ['Athena', 'Socrates']) {
        Object.keys(cap.weeklyOccupancy[loc] || {}).forEach(w => allWeeks.add(w));
    }
    const weeks = [...allWeeks].sort();

    const datasets = [];
    for (const loc of ['Athena', 'Socrates']) {
        datasets.push({
            label: `${loc} gem. bezetting`,
            data: weeks.map(w => Math.round((cap.weeklyOccupancy[loc]?.[w] || 0) * 100)),
            borderColor: loc === 'Athena' ? COLORS.athena : COLORS.socrates,
            backgroundColor: loc === 'Athena' ? COLORS.athenaBg : COLORS.socratesBg,
            fill: false,
            tension: 0.3
        });
    }

    charts.capacity = new Chart(document.getElementById('chart-capacity'), {
        type: 'line',
        data: {
            labels: weeks.map(w => {
                const d = new Date(w);
                return `${d.getDate()} ${MONTHS_NL[d.getMonth()]}`;
            }),
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: 'Bezettingsgraad (%)' },
                    ticks: { callback: v => v + '%' }
                }
            }
        }
    });

    // Peak table
    renderPeakTable(cap.peaks);
}

function renderPeakTable(peaks) {
    const tbody = document.getElementById('peak-table-body');

    if (!peaks.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#7f8c8d">Geen piektijden gevonden</td></tr>';
        return;
    }

    tbody.innerHTML = peaks.map(p => {
        const d = new Date(p.date);
        const dayName = DAYS_NL[d.getDay()];
        const dateStr = `${dayName} ${d.getDate()} ${MONTHS_NL[d.getMonth()]} ${d.getFullYear()}`;
        const occ = Math.round(p.occupancy * 100);
        let badgeClass = 'low';
        if (occ >= 90) badgeClass = 'high';
        else if (occ >= 70) badgeClass = 'medium';

        return `<tr>
            <td>${dateStr}</td>
            <td>${p.hour}:00 - ${p.hour + 1}:00</td>
            <td>${p.location}</td>
            <td>${p.inUse}</td>
            <td>${p.available}</td>
            <td><span class="badge ${badgeClass}">${occ}%</span></td>
        </tr>`;
    }).join('');
}

function renderCartSelector(stats) {
    const select = document.getElementById('cart-select');
    const carts = Object.keys(stats.cartUsage).sort();

    select.innerHTML = '<option value="">-- Selecteer een kar --</option>' +
        carts.map(c => `<option value="${c}">${c} (${stats.cartUsage[c].total}x)</option>`).join('');

    // Remove old listener by cloning
    const newSelect = select.cloneNode(true);
    select.parentNode.replaceChild(newSelect, select);

    newSelect.addEventListener('change', () => {
        const cart = newSelect.value;
        if (cart && stats.cartUsage[cart]) {
            renderCartDetails(cart, stats.cartUsage[cart], stats.monthly);
        }
    });
}

// ===================== FORECAST ANALYSIS =====================

const TIME_WINDOWS = [
    { name: 'Ochtend vroeg', label: '08\u201310', start: 8, end: 10 },
    { name: 'Ochtend laat', label: '10\u201312', start: 10, end: 12 },
    { name: 'Middag', label: '12\u201314', start: 12, end: 14 },
    { name: 'Middag laat', label: '14\u201316', start: 14, end: 16 }
];

function analyzeForecast(records) {
    const active = records.filter(r => !r.canceled);
    if (!active.length) return null;

    // Step 1: Build hourly slot data per location
    const slotData = { Athena: {}, Socrates: {} };
    const totalCarts = { Athena: new Set(), Socrates: new Set() };

    active.forEach(r => {
        if (r.cart === 'Onbekend') return;
        const loc = r.location;
        if (!totalCarts[loc]) return;
        totalCarts[loc].add(r.cart);

        const startHour = r.start.getHours();
        const endHour = r.end.getHours() + (r.end.getMinutes() > 0 ? 1 : 0);
        const dateStr = r.start.toISOString().slice(0, 10);

        for (let h = startHour; h < endHour; h++) {
            const key = `${dateStr}_${h}`;
            if (!slotData[loc][key]) {
                slotData[loc][key] = { date: dateStr, dayOfWeek: r.start.getDay(), hour: h, carts: new Set() };
            }
            slotData[loc][key].carts.add(r.cart);
        }
    });

    const cartCounts = {
        Athena: totalCarts.Athena.size || 1,
        Socrates: totalCarts.Socrates.size || 1
    };

    // Step 2: Determine reference period (last 6 weeks with substantial activity)
    // The data may have sparse future bookings; find the last "full" week
    const weekResCounts = {};
    active.forEach(r => {
        const d = new Date(r.start);
        d.setDate(d.getDate() - d.getDay() + 1); // Monday
        const wk = d.toISOString().slice(0, 10);
        weekResCounts[wk] = (weekResCounts[wk] || 0) + 1;
    });
    const sortedWeekEntries = Object.entries(weekResCounts).sort((a, b) => a[0].localeCompare(b[0]));
    // Median week activity (excluding very low weeks)
    const weeklyCounts = sortedWeekEntries.map(e => e[1]).sort((a, b) => a - b);
    const medianActivity = weeklyCounts[Math.floor(weeklyCounts.length / 2)] || 1;
    const activityThreshold = medianActivity * 0.25; // 25% of median = "real" week
    // Find the last week with substantial activity
    let lastFullWeekIdx = sortedWeekEntries.length - 1;
    while (lastFullWeekIdx >= 0 && sortedWeekEntries[lastFullWeekIdx][1] < activityThreshold) {
        lastFullWeekIdx--;
    }
    if (lastFullWeekIdx < 0) lastFullWeekIdx = sortedWeekEntries.length - 1;
    const lastFullWeek = sortedWeekEntries[lastFullWeekIdx][0];
    const refEnd = new Date(lastFullWeek);
    refEnd.setDate(refEnd.getDate() + 6); // End of that week (Sunday)
    const refStart = new Date(lastFullWeek);
    refStart.setDate(refStart.getDate() - 35); // 5 more weeks back (6 total)

    // Step 3: Build weekly pattern from reference period
    const weekPattern = {};

    for (const loc of ['Athena', 'Socrates']) {
        weekPattern[loc] = {};
        const maxC = cartCounts[loc];

        // Organize reference slots by week
        const weekBuckets = {};
        for (const [, slot] of Object.entries(slotData[loc])) {
            const slotDate = new Date(slot.date);
            if (slotDate < refStart || slotDate > refEnd) continue;

            const d = new Date(slotDate);
            d.setDate(d.getDate() - d.getDay() + 1); // Monday
            const weekKey = d.toISOString().slice(0, 10);
            const dow = slot.dayOfWeek;
            const h = slot.hour;

            if (!weekBuckets[weekKey]) weekBuckets[weekKey] = {};
            if (!weekBuckets[weekKey][dow]) weekBuckets[weekKey][dow] = {};
            weekBuckets[weekKey][dow][h] = slot.carts.size;
        }

        const refWeekKeys = Object.keys(weekBuckets).sort();

        // For each dow x timeWindow: compute stats across reference weeks
        for (let dow = 1; dow <= 5; dow++) {
            weekPattern[loc][dow] = {};

            TIME_WINDOWS.forEach((tw, twIdx) => {
                const weeklyMaxOcc = [];

                for (const wk of refWeekKeys) {
                    let maxInWindow = 0;
                    for (let h = tw.start; h < tw.end; h++) {
                        const used = weekBuckets[wk]?.[dow]?.[h] || 0;
                        if (used > maxInWindow) maxInWindow = used;
                    }
                    weeklyMaxOcc.push(maxInWindow / maxC);
                }

                const avg = weeklyMaxOcc.length ? weeklyMaxOcc.reduce((a, b) => a + b) / weeklyMaxOcc.length : 0;
                const max = weeklyMaxOcc.length ? Math.max(...weeklyMaxOcc) : 0;
                const at100 = weeklyMaxOcc.filter(o => o >= 1.0).length;

                weekPattern[loc][dow][twIdx] = {
                    avgOcc: avg,
                    maxOcc: max,
                    at100Count: at100,
                    at100Pct: weeklyMaxOcc.length ? at100 / weeklyMaxOcc.length : 0,
                    weekCount: weeklyMaxOcc.length
                };
            });
        }

        weekPattern[loc].refWeeks = refWeekKeys;
    }

    // Step 4: Growth trend - monthly average occupancy
    const trend = {};
    for (const loc of ['Athena', 'Socrates']) {
        const maxC = cartCounts[loc];
        const monthlySlots = {};

        for (const [, slot] of Object.entries(slotData[loc])) {
            const monthKey = slot.date.slice(0, 7);
            if (!monthlySlots[monthKey]) monthlySlots[monthKey] = [];
            monthlySlots[monthKey].push(slot.carts.size / maxC);
        }

        const monthKeys = Object.keys(monthlySlots).sort();
        const monthlyAvg = monthKeys.map(m => ({
            month: m,
            avg: monthlySlots[m].reduce((a, b) => a + b) / monthlySlots[m].length
        }));

        // Linear regression on monthly averages
        let growthPerMonth = 0;
        if (monthlyAvg.length >= 2) {
            const n = monthlyAvg.length;
            const xMean = (n - 1) / 2;
            const yMean = monthlyAvg.reduce((s, m) => s + m.avg, 0) / n;
            let num = 0, den = 0;
            monthlyAvg.forEach((m, i) => {
                num += (i - xMean) * (m.avg - yMean);
                den += (i - xMean) ** 2;
            });
            growthPerMonth = den ? num / den : 0;
        }

        trend[loc] = { growthPerMonth, monthlyAvg };
    }

    // Step 5: Module 3 projection (late March to end June 2026)
    const mod3Start = new Date(2026, 2, 23); // March 23
    const mod3End = new Date(2026, 5, 26);   // June 26

    const projection = {};
    for (const loc of ['Athena', 'Socrates']) {
        projection[loc] = [];
        const maxC = cartCounts[loc];
        const growth = trend[loc].growthPerMonth;

        // Reference midpoint for growth extrapolation
        const refWeeks = weekPattern[loc].refWeeks || [];
        const refMidStr = refWeeks[Math.floor(refWeeks.length / 2)];
        const refMid = refMidStr ? new Date(refMidStr) : refStart;

        let weekStart = new Date(mod3Start);
        while (weekStart <= mod3End) {
            const monthsFromRef = (weekStart.getTime() - refMid.getTime()) / (30.44 * 24 * 3600 * 1000);
            const growthMultiplier = Math.max(0, 1 + growth * monthsFromRef);

            let weekMaxOcc = 0;
            let weekTotalOcc = 0;
            let windowCount = 0;
            const dayDetails = {};

            for (let dow = 1; dow <= 5; dow++) {
                dayDetails[dow] = {};
                TIME_WINDOWS.forEach((tw, twIdx) => {
                    const base = weekPattern[loc][dow]?.[twIdx];
                    if (!base || base.weekCount === 0) return;

                    const projectedOcc = base.avgOcc * growthMultiplier;
                    const projectedMax = base.maxOcc * growthMultiplier;

                    dayDetails[dow][twIdx] = {
                        projected: projectedOcc,
                        projectedMax: projectedMax,
                        demandCarts: projectedOcc * maxC,
                        maxDemandCarts: projectedMax * maxC,
                        available: maxC,
                        overCapacity: projectedMax > 1.0
                    };

                    weekMaxOcc = Math.max(weekMaxOcc, projectedMax);
                    weekTotalOcc += projectedOcc;
                    windowCount++;
                });
            }

            projection[loc].push({
                weekStart: new Date(weekStart),
                weekLabel: `${weekStart.getDate()} ${MONTHS_NL[weekStart.getMonth()]}`,
                avgOcc: windowCount ? weekTotalOcc / windowCount : 0,
                maxOcc: weekMaxOcc,
                dayDetails
            });

            weekStart.setDate(weekStart.getDate() + 7);
        }
    }

    // Step 6: Latent demand per time window
    const latentDemand = {};
    for (const loc of ['Athena', 'Socrates']) {
        latentDemand[loc] = TIME_WINDOWS.map((tw, twIdx) => {
            let totalAt100 = 0;
            let totalWeeks = 0;

            for (let dow = 1; dow <= 5; dow++) {
                const p = weekPattern[loc][dow]?.[twIdx];
                if (p && p.weekCount > 0) {
                    totalAt100 += p.at100Count;
                    totalWeeks += p.weekCount;
                }
            }

            return {
                window: tw.name,
                label: tw.label,
                pctAt100: totalWeeks ? totalAt100 / totalWeeks : 0,
                isStructural: totalWeeks ? (totalAt100 / totalWeeks) > 0.3 : false
            };
        });
    }

    // Step 7: Scenario analysis (+0, +1, +2, +3 carts)
    const scenarios = {};
    for (const loc of ['Athena', 'Socrates']) {
        scenarios[loc] = [];
        const maxC = cartCounts[loc];

        for (let extra = 0; extra <= 3; extra++) {
            const newTotal = maxC + extra;
            let peakOcc = 0;
            let overCapacitySlots = 0;
            let totalSlots = 0;

            for (const week of projection[loc]) {
                for (let dow = 1; dow <= 5; dow++) {
                    for (const [, data] of Object.entries(week.dayDetails[dow] || {})) {
                        totalSlots++;
                        const occ = data.maxDemandCarts / newTotal;
                        if (occ > peakOcc) peakOcc = occ;
                        if (occ > 1.0) overCapacitySlots++;
                    }
                }
            }

            scenarios[loc].push({
                extra,
                total: newTotal,
                peakOcc,
                overCapacityPct: totalSlots ? overCapacitySlots / totalSlots * 100 : 0
            });
        }
    }

    // Step 8: Summary per location
    const summary = {};
    for (const loc of ['Athena', 'Socrates']) {
        const peakProjected = projection[loc].reduce((max, w) => Math.max(max, w.maxOcc), 0);
        const weeksOver = projection[loc].filter(w => w.maxOcc > 1.0).length;
        const maxC = cartCounts[loc];
        const peakDemandCarts = peakProjected * maxC;

        let extraNeeded = 0;
        while (peakDemandCarts / (maxC + extraNeeded) > 0.95 && extraNeeded < 10) {
            extraNeeded++;
        }

        summary[loc] = {
            peakProjected: Math.round(peakProjected * 100),
            weeksOver,
            extraNeeded,
            totalWeeks: projection[loc].length
        };
    }

    return {
        weekPattern, trend, projection, latentDemand, scenarios, summary,
        totalCarts: cartCounts,
        timeWindows: TIME_WINDOWS,
        refPeriod: { start: refStart, end: refEnd }
    };
}

// ===================== FORECAST RENDERING =====================

function renderForecastKPIs(forecast) {
    const locations = activeFilter === 'alle' ? ['Athena', 'Socrates'] : [activeFilter];
    let maxPeak = 0, maxWeeksOver = 0, maxLatent = 0, maxExtra = 0;

    for (const loc of locations) {
        const s = forecast.summary[loc];
        if (!s) continue;
        if (s.peakProjected > maxPeak) maxPeak = s.peakProjected;
        if (s.weeksOver > maxWeeksOver) maxWeeksOver = s.weeksOver;
        if (s.extraNeeded > maxExtra) maxExtra = s.extraNeeded;

        (forecast.latentDemand[loc] || []).forEach(d => {
            if (d.pctAt100 > maxLatent) maxLatent = d.pctAt100;
        });
    }

    const peakEl = document.getElementById('fkpi-peak');
    peakEl.textContent = maxPeak + '%';
    peakEl.style.color = maxPeak >= 100 ? 'var(--accent-red)' : maxPeak >= 80 ? 'var(--accent)' : 'var(--success)';

    const weeksEl = document.getElementById('fkpi-weeks-over');
    weeksEl.textContent = maxWeeksOver > 0 ? maxWeeksOver + ' van ' + (forecast.summary[locations[0]]?.totalWeeks || '?') : 'geen';
    weeksEl.style.color = maxWeeksOver > 0 ? 'var(--accent-red)' : 'var(--success)';

    const latentEl = document.getElementById('fkpi-latent');
    latentEl.textContent = Math.round(maxLatent * 100) + '% van pieken';
    latentEl.style.color = maxLatent > 0.3 ? 'var(--accent-red)' : maxLatent > 0.1 ? 'var(--accent)' : 'var(--success)';

    const adviceEl = document.getElementById('fkpi-advice');
    adviceEl.textContent = maxExtra > 0 ? '+' + maxExtra : 'geen';
    adviceEl.style.color = maxExtra > 0 ? 'var(--accent-red)' : 'var(--success)';
}

function forecastHeatColor(occ) {
    if (occ <= 0.05) return '#f0f3f5';
    if (occ < 0.3) return 'rgba(39, 174, 96, 0.35)';
    if (occ < 0.5) return 'rgba(39, 174, 96, 0.6)';
    if (occ < 0.7) return 'rgba(241, 196, 15, 0.65)';
    if (occ < 0.85) return 'rgba(230, 126, 34, 0.75)';
    if (occ <= 1.0) return 'rgba(231, 76, 60, 0.8)';
    return 'rgba(146, 43, 33, 0.9)';
}

function renderForecastHeatmap(forecast) {
    const container = document.getElementById('forecast-heatmap');
    const dayLabels = ['Ma', 'Di', 'Wo', 'Do', 'Vr'];
    const locations = activeFilter === 'alle' ? ['Athena', 'Socrates'] : [activeFilter];

    let html = '<div class="forecast-heatmap-grid">';

    for (const loc of locations) {
        const proj = forecast.projection[loc];
        if (!proj || !proj.length) continue;
        const lastWeek = proj[proj.length - 1];

        html += `<div><h3>${loc} (${forecast.totalCarts[loc]} karren)</h3>`;
        html += '<table><thead><tr><th></th>';
        forecast.timeWindows.forEach(tw => { html += `<th>${tw.label}</th>`; });
        html += '</tr></thead><tbody>';

        for (let dow = 1; dow <= 5; dow++) {
            html += `<tr><th>${dayLabels[dow - 1]}</th>`;
            forecast.timeWindows.forEach((tw, twIdx) => {
                const data = lastWeek.dayDetails[dow]?.[twIdx];
                const occ = data ? data.projected : 0;
                const pct = Math.round(occ * 100);
                const bg = forecastHeatColor(occ);
                const textColor = occ > 0.55 ? 'white' : '#333';
                html += `<td style="background:${bg};color:${textColor}" title="${dayLabels[dow-1]} ${tw.name}: ${pct}%">${pct}%</td>`;
            });
            html += '</tr>';
        }

        html += '</tbody></table></div>';
    }

    html += '</div>';
    container.innerHTML = html;
}

function renderForecastChart(forecast) {
    const locations = activeFilter === 'alle' ? ['Athena', 'Socrates'] : [activeFilter];
    const datasets = [];
    let labels = [];

    for (const loc of locations) {
        const proj = forecast.projection[loc] || [];
        if (proj.length > labels.length) {
            labels = proj.map(w => w.weekLabel);
        }

        datasets.push({
            label: `${loc} gem. bezetting`,
            data: proj.map(w => Math.round(w.avgOcc * 100)),
            borderColor: loc === 'Athena' ? COLORS.athena : COLORS.socrates,
            backgroundColor: loc === 'Athena' ? COLORS.athenaBg : COLORS.socratesBg,
            fill: true,
            tension: 0.3
        });

        datasets.push({
            label: `${loc} piekbezetting`,
            data: proj.map(w => Math.round(w.maxOcc * 100)),
            borderColor: loc === 'Athena' ? COLORS.athena : COLORS.socrates,
            borderDash: [5, 5],
            fill: false,
            tension: 0.3,
            pointRadius: 2
        });
    }

    // Reference lines
    datasets.push({
        label: 'Capaciteitsgrens (100%)',
        data: labels.map(() => 100),
        borderColor: 'rgba(231, 76, 60, 0.5)',
        borderDash: [8, 4],
        pointRadius: 0,
        fill: false
    });

    datasets.push({
        label: 'Waarschuwing (80%)',
        data: labels.map(() => 80),
        borderColor: 'rgba(230, 126, 34, 0.35)',
        borderDash: [4, 4],
        pointRadius: 0,
        fill: false
    });

    const maxY = Math.max(120, ...datasets.flatMap(d => (d.data || []).filter(v => typeof v === 'number'))) + 10;

    charts.forecast = new Chart(document.getElementById('chart-forecast'), {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: {
                y: {
                    beginAtZero: true,
                    max: maxY,
                    title: { display: true, text: 'Bezettingsgraad (%)' },
                    ticks: { callback: v => v + '%' }
                }
            }
        }
    });
}

function renderScenarioAnalysis(forecast) {
    const container = document.getElementById('scenario-table-container');
    const locations = activeFilter === 'alle' ? ['Athena', 'Socrates'] : [activeFilter];

    let html = '<table class="scenario-table"><thead><tr>';
    html += '<th></th><th>Huidig</th><th>+1 kar</th><th>+2 karren</th><th>+3 karren</th>';
    html += '</tr></thead><tbody>';

    for (const loc of locations) {
        const scen = forecast.scenarios[loc] || [];
        if (!scen.length) continue;

        html += `<tr class="loc-header"><td colspan="5">${loc}</td></tr>`;

        html += '<tr><td>Totaal karren</td>';
        scen.forEach(s => { html += `<td>${s.total}</td>`; });
        html += '</tr>';

        html += '<tr><td>Verwachte piekbezetting</td>';
        scen.forEach(s => {
            const pct = Math.round(s.peakOcc * 100);
            let cls = 'low';
            if (pct >= 100) cls = 'high';
            else if (pct >= 80) cls = 'medium';
            html += `<td><span class="badge ${cls}">${pct}%</span></td>`;
        });
        html += '</tr>';

        html += '<tr><td>Momenten boven 100%</td>';
        scen.forEach(s => {
            html += `<td>${Math.round(s.overCapacityPct)}%</td>`;
        });
        html += '</tr>';
    }

    html += '</tbody></table>';
    container.innerHTML = html;

    // Scenario bar chart
    const scenLabels = ['Huidig', '+1 kar', '+2 karren', '+3 karren'];
    const chartDatasets = [];

    for (const loc of locations) {
        const scen = forecast.scenarios[loc] || [];
        chartDatasets.push({
            label: loc,
            data: scen.map(s => Math.round(s.peakOcc * 100)),
            backgroundColor: loc === 'Athena' ? COLORS.athena : COLORS.socrates,
            borderRadius: 4
        });
    }

    charts.scenario = new Chart(document.getElementById('chart-scenario'), {
        type: 'bar',
        data: { labels: scenLabels, datasets: chartDatasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Piekbezetting (%)' },
                    ticks: { callback: v => v + '%' }
                }
            }
        }
    });
}

function renderLatentDemand(forecast) {
    const locations = activeFilter === 'alle' ? ['Athena', 'Socrates'] : [activeFilter];
    const labels = forecast.timeWindows.map(tw => tw.name);
    const datasets = [];

    for (const loc of locations) {
        const data = (forecast.latentDemand[loc] || []).map(d => Math.round(d.pctAt100 * 100));
        datasets.push({
            label: loc,
            data,
            backgroundColor: loc === 'Athena' ? COLORS.athena : COLORS.socrates,
            borderRadius: 4
        });
    }

    charts.latent = new Chart(document.getElementById('chart-latent'), {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: 'Weken op 100% capaciteit (%)' },
                    ticks: { callback: v => v + '%' }
                }
            }
        }
    });
}

// ===================== CART DETAILS =====================

function renderCartDetails(cartName, cartData, allMonthly) {
    // Chart
    const months = Object.keys(allMonthly).sort();
    const formatMonth = m => {
        const [y, mo] = m.split('-');
        return `${MONTHS_NL[parseInt(mo) - 1]} ${y}`;
    };

    if (charts.cartUsage) charts.cartUsage.destroy();

    charts.cartUsage = new Chart(document.getElementById('chart-cart-usage'), {
        type: 'bar',
        data: {
            labels: months.map(formatMonth),
            datasets: [{
                label: cartName,
                data: months.map(m => cartData.monthly[m] || 0),
                backgroundColor: COLORS.athena,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });

    // Stats
    const avgPerMonth = cartData.total / Math.max(Object.keys(cartData.monthly).length, 1);
    const peakMonth = Object.entries(cartData.monthly).sort((a, b) => b[1] - a[1])[0];

    document.getElementById('cart-stats').innerHTML = `
        <div class="cart-stat">
            <div class="value">${cartData.total}</div>
            <div class="label">Totaal reserveringen</div>
        </div>
        <div class="cart-stat">
            <div class="value">${avgPerMonth.toFixed(1)}</div>
            <div class="label">Gem. per maand</div>
        </div>
        <div class="cart-stat">
            <div class="value">${peakMonth ? peakMonth[1] : '-'}</div>
            <div class="label">Drukste maand</div>
        </div>
        <div class="cart-stat">
            <div class="value">${peakMonth ? (() => { const [y, m] = peakMonth[0].split('-'); return MONTHS_NL[parseInt(m)-1] + ' ' + y; })() : '-'}</div>
            <div class="label">Piekperiode</div>
        </div>
    `;
}
