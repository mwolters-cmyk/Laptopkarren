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

    renderKPIs(stats);
    renderWeeklyChart(stats);
    renderMonthlyChart(stats);
    renderWeekdayChart(stats);
    renderHeatmap(stats);
    renderTop10(stats);
    renderCapacity(stats);
    renderCartSelector(stats);
}

function renderKPIs(stats) {
    document.getElementById('kpi-total').textContent = stats.active.toLocaleString('nl-NL');
    document.getElementById('kpi-teachers').textContent = stats.teachers;
    document.getElementById('kpi-carts').textContent = stats.carts;
    document.getElementById('kpi-canceled').textContent = stats.cancelRate + '%';
    document.getElementById('kpi-peak-day').textContent = stats.peakDay;
    document.getElementById('kpi-peak-hour').textContent = stats.peakHour;
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
