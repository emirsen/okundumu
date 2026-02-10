// App State
const state = {
    currentTheme: localStorage.getItem('theme') || 'dark',
    trackedCities: [], // Array of { city, country, data, nextPrayer }
    timerInterval: null
};

// Ramadan 2026 Settings
const RAMADAN_2026 = {
    start: '2026-02-18', // Ramadan 1
    end: '2026-03-19',   // Ramadan 30
    year: 2026
};

// DOM Elements
const themeToggle = document.getElementById('theme-toggle');

const geoBtn = document.getElementById('geo-btn');
const shareBtn = document.getElementById('share-btn');
const dashboard = document.getElementById('dashboard');

// Prayer Name Translations
const prayerTranslations = {
    'Fajr': 'İmsak',
    'Sunrise': 'Güneş',
    'Dhuhr': 'Öğle',
    'Asr': 'İkindi',
    'Maghrib': 'Akşam',
    'Isha': 'Yatsı'
};

const prayerOrder = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    applyTheme(state.currentTheme);
    // populateProvinceDropdown(); // Removed

    updateDashboardUI(); // Ensure UI runs once to show empty state if needed


    // Auto-detect location if no cities tracked, otherwise load default
    getUserLocation();

    startTimer();

    // Setup Print Button
    const printBtn = document.getElementById('print-btn');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }
});

// Theme Logic
themeToggle.addEventListener('click', () => {
    state.currentTheme = state.currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', state.currentTheme);
    applyTheme(state.currentTheme);
});

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = themeToggle.querySelector('.icon');
    icon.textContent = theme === 'dark' ? '🌙' : '☀️';
}

// Data Management
// Data Management
// function populateProvinceDropdown() { ... } // Removed


// Geolocation Logic
geoBtn.addEventListener('click', getUserLocation);

// Share Logic
shareBtn.addEventListener('click', () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
        const icon = shareBtn.querySelector('.icon');
        const originalIcon = icon.textContent;
        icon.textContent = '✅';
        setTimeout(() => {
            icon.textContent = originalIcon;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy link: ', err);
    });
});


function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                findNearestProvince(latitude, longitude);
            },
            (error) => {
                console.error("Location access denied or failed", error);
                // Default to Istanbul if failed and list is empty
                if (state.trackedCities.length === 0) {
                    addCityToDashboard("İstanbul");
                }
            }
        );
    } else {
        alert("Tarayıcınız konum servisini desteklemiyor.");
    }
}

function findNearestProvince(lat, lng) {
    let nearest = null;
    let minDistance = Infinity;

    provinces.forEach(p => {
        const distance = getDistanceFromLatLonInKm(lat, lng, p.lat, p.lng);
        if (distance < minDistance) {
            minDistance = distance;
            nearest = p;
        }
    });

    if (nearest) {
        // Only add if not empty or replace? 
        // User might want to track multiple. Use "Add" logic.
        // But if it's the first load, maybe clear others?
        // Let's just add it.
        addCityToDashboard(nearest.name);
    }
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);  // deg2rad below
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180)
}

async function addCityToDashboard(cityName) {
    if (state.trackedCities.find(c => c.city === cityName)) {
        alert(`${cityName} zaten listenizde.`);
        return;
    }

    try {
        const data = await fetchPrayerTimes(cityName);
        if (data) {
            const cityObj = {
                city: cityName,
                country: "Turkey",
                timings: data.timings,
                date: data.date,
                nextPrayer: null
            };
            updateCityPrayerStatus(cityObj);
            state.trackedCities.push(cityObj);
            sortAndRenderCities();

            // Also load Ramadan Calendar for this city
            loadRamadanCalendar(cityName);
        }
    } catch (error) {
        console.error(`Failed to load ${cityName}:`, error);
    }
}

async function loadRamadanCalendar(cityName) {
    const grid = document.getElementById('ramadan-grid');
    const cityTitle = document.getElementById('imsakiye-city');

    if (cityTitle) cityTitle.textContent = `(${cityName})`;

    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">Ramazan verileri yükleniyor...</div>';

    try {
        // Fetch Feb and March 2026
        const [febData, marchData] = await Promise.all([
            fetchMonthlyPrayerTimes(cityName, 2, 2026),
            fetchMonthlyPrayerTimes(cityName, 3, 2026)
        ]);

        if (febData && marchData) {
            const allDays = [...febData, ...marchData];
            const ramadanDays = filterRamadanDays(allDays);
            renderRamadanGrid(ramadanDays);
        }
    } catch (error) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #e74c3c;">Ramazan takvimi yüklenemedi.</div>';
    }
}

function filterRamadanDays(allDays) {
    const start = new Date(RAMADAN_2026.start);
    const end = new Date(RAMADAN_2026.end);

    return allDays.filter(day => {
        const [d, m, y] = day.date.gregorian.date.split('-').map(Number);
        const dayDate = new Date(y, m - 1, d);
        return dayDate >= start && dayDate <= end;
    }).slice(0, 30); // Ensure exactly 30 days
}

async function fetchMonthlyPrayerTimes(city, month, year) {
    try {
        const response = await fetch(`https://api.aladhan.com/v1/calendarByCity?city=${city}&country=Turkey&method=13&month=${month}&year=${year}`);
        const json = await response.json();
        if (json.code === 200) {
            return json.data;
        }
        return null;
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

function renderRamadanGrid(ramadanDays) {
    const grid = document.getElementById('ramadan-grid');
    grid.innerHTML = '';

    const today = new Date().toLocaleDateString('tr-TR');

    ramadanDays.forEach((day, index) => {
        const ramadanDay = index + 1;
        const dateStr = day.date.gregorian.date; // DD-MM-YYYY
        const [d, m, y] = dateStr.split('-');
        const formattedDate = `${d}/${m}/${y}`;

        const isToday = formattedDate === today;

        const card = document.createElement('div');
        card.className = `ramadan-day-card ${isToday ? 'today' : ''}`;

        card.innerHTML = `
            <div class="day-header">
                <span class="ramadan-day-num">${ramadanDay}. Gün</span>
                <span class="ramadan-date">${formattedDate}</span>
            </div>
            <div class="ramadan-times">
                <div class="ramadan-time-row imsak">
                    <span class="time-label">İmsak</span>
                    <span class="time-value">${day.timings.Fajr.split(' ')[0]}</span>
                </div>
                <div class="ramadan-time-row">
                    <span class="time-label">Öğle</span>
                    <span class="time-value">${day.timings.Dhuhr.split(' ')[0]}</span>
                </div>
                <div class="ramadan-time-row">
                    <span class="time-label">İkindi</span>
                    <span class="time-value">${day.timings.Asr.split(' ')[0]}</span>
                </div>
                <div class="ramadan-time-row aksam">
                    <span class="time-label">Akşam</span>
                    <span class="time-value">${day.timings.Maghrib.split(' ')[0]}</span>
                </div>
                <div class="ramadan-time-row">
                    <span class="time-label">Yatsı</span>
                    <span class="time-value">${day.timings.Isha.split(' ')[0]}</span>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

async function fetchPrayerTimes(city) {
    try {
        const response = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=${city}&country=Turkey&method=13`);
        // Method 13 is Diyanet İşleri Başkanlığı (Turkey)
        const json = await response.json();
        if (json.code === 200) {
            return json.data;
        }
        return null;
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

// Logic: Prayer Times & Sorting
function startTimer() {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
        state.trackedCities.forEach(cityObj => {
            updateCityPrayerStatus(cityObj);
        });
        updateDashboardUI();
    }, 1000);
}

function updateCityPrayerStatus(cityObj) {
    const now = new Date();

    let upcomingPrayers = [];

    // Check for today's prayers
    for (let prayerKey of prayerOrder) {
        const timeStr = cityObj.timings[prayerKey];
        if (!timeStr) continue;

        const [hours, minutes] = timeStr.split(':').map(Number);

        let prayerDate = new Date();
        prayerDate.setHours(hours, minutes, 0, 0);

        if (prayerDate > now) {
            upcomingPrayers.push({ name: prayerKey, time: prayerDate, trName: prayerTranslations[prayerKey] });
        }
    }

    // If no prayers left today, next is Fajr tomorrow
    if (upcomingPrayers.length === 0) {
        const fajrTimeStr = cityObj.timings['Fajr'];
        const [hours, minutes] = fajrTimeStr.split(':').map(Number);
        let tomorrowFajr = new Date();
        tomorrowFajr.setDate(tomorrowFajr.getDate() + 1);
        tomorrowFajr.setHours(hours, minutes, 0, 0);

        upcomingPrayers.push({
            name: 'Fajr',
            time: tomorrowFajr,
            trName: prayerTranslations['Fajr'],
            isTomorrow: true
        });
    }

    // Sort upcoming
    upcomingPrayers.sort((a, b) => a.time - b.time);

    const next = upcomingPrayers[0];

    // Calculate time diff
    const diffMs = next.time - now;
    const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);

    cityObj.nextPrayer = {
        name: next.name,
        trName: next.trName,
        time: next.time,
        timeRemainingStr: `${diffHrs}s ${diffMins}dk ${diffSecs}sn`,
        msRemaining: diffMs
    };
}

function sortAndRenderCities() {
    state.trackedCities.sort((a, b) => a.nextPrayer.msRemaining - b.nextPrayer.msRemaining);
    dashboard.innerHTML = '';
    state.trackedCities.forEach(city => {
        const card = createCityCard(city);
        dashboard.appendChild(card);
    });
}

function updateDashboardUI() {
    const container = document.getElementById('dashboard');

    if (state.trackedCities.length === 0) {
        // Render Empty State (Selector only) if it doesn't exist
        if (!document.getElementById('empty-state-card')) {
            container.innerHTML = '';
            container.appendChild(createEmptyStateCard());
        }
        return;
    }

    // Remove empty state if present
    const emptyCard = document.getElementById('empty-state-card');
    if (emptyCard) emptyCard.remove();

    state.trackedCities.forEach(city => {
        let card = document.getElementById(`city-card-${city.city}`);
        if (!card) {
            card = createCityCard(city);
            container.appendChild(card);
        } else {
            updateCityCardContent(card, city);
        }
    });

    // Remove cities that are no longer tracked
    const trackedNames = state.trackedCities.map(c => c.city);
    Array.from(container.children).forEach(child => {
        if (child.id === 'empty-state-card') return; // Don't remove if we just added it (though logic above handles this)
        const cityName = child.id.replace('city-card-', '');
        if (!trackedNames.includes(cityName)) {
            child.remove();
        }
    });
}

function createEmptyStateCard() {
    const card = document.createElement('div');
    card.className = 'city-card';
    card.id = 'empty-state-card';

    // Generate full options list
    const sortedProvinces = [...provinces].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    let optionsHtml = sortedProvinces.map(p =>
        `<option value="${p.name}">${p.name}</option>`
    ).join('');

    card.innerHTML = `
        <div class="city-header">
            <select class="city-name-select" onchange="handleCityChange(this.value)">
                <option value="" disabled selected>İl Seçiniz</option>
                ${optionsHtml}
            </select>
        </div>
        <div style="text-align: center; color: var(--text-secondary); padding: 2rem;">
            Lütfen bir il seçin veya konumunuzu kullanın.
        </div>
    `;
    return card;
}

function createCityCard(city) {
    const card = document.createElement('div');
    card.className = 'city-card';
    card.id = `city-card-${city.city}`;

    const np = city.nextPrayer; // Reference for initial build

    // Generate options
    const sortedProvinces = [...provinces].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    let optionsHtml = sortedProvinces.map(p =>
        `<option value="${p.name}" ${p.name === city.city ? 'selected' : ''}>${p.name}</option>`
    ).join('');

    // Static portions (Header with Select) + Containers for dynamic content
    card.innerHTML = `
        <div class="city-header">
             <select class="city-name-select" onchange="handleCityChange(this.value)">
                ${optionsHtml}
            </select>
        </div>
        
        <div class="next-prayer-highlight" id="next-prayer-container-${city.city}">
            <!-- Content injected by update -->
        </div>
        
        <div class="timings-list" id="timings-list-${city.city}">
             <!-- Content injected by update -->
        </div>
    `;

    // Populate dynamic portions
    updateCityCardContent(card, city);

    return card;
}

function updateCityCardContent(card, city) {
    const np = city.nextPrayer;

    let timingsHtml = prayerOrder.map(key => {
        const time = city.timings[key];
        const trName = prayerTranslations[key];

        const [h, m] = time.split(':').map(Number);
        const now = new Date();
        const pDate = new Date();
        pDate.setHours(h, m, 0, 0);

        let statusClass = '';
        let statusText = ''; // Vakit Geçti / Yaklaşıyor

        if (key === np.name) {
            statusClass = 'active';
            statusText = 'Sıradaki';
        } else if (pDate < now) {
            statusClass = 'passed';
            statusText = 'Geçti';
        } else {
            statusText = 'Yaklaşıyor';
        }

        // Custom Styles
        // "imsak" (Fajr) -> Yellow, Bold
        // "akşam" (Maghrib) -> Green, Bold
        let rowStyle = '';
        if (key === 'Fajr') {
            rowStyle = 'color: var(--color-yellow); font-weight: bold;';
        } else if (key === 'Maghrib') {
            rowStyle = 'color: var(--accent); font-weight: bold;';
        }

        return `<li class="${statusClass}" style="${rowStyle}">
            <span class="prayer-name">${trName}</span> 
            <span class="prayer-time" style="font-weight: inherit;">${time}</span>
        </li>`;
    }).join('');

    // Partial Update: Next Prayer Section
    const nextContainer = card.querySelector(`#next-prayer-container-${city.city}`);
    if (nextContainer) {
        nextContainer.innerHTML = `
            <div class="next-label">Sıradaki Vakit: ${np.trName}</div>
            <div class="next-time">${np.timeRemainingStr}</div>
        `;
    }

    // Partial Update: Timings List
    const listContainer = card.querySelector(`#timings-list-${city.city}`);
    if (listContainer) {
        listContainer.innerHTML = timingsHtml;
    }
}

// Global handler for inline select
window.handleCityChange = function (newCity) {
    if (newCity) {
        state.trackedCities = [];
        addCityToDashboard(newCity);
    }
};
