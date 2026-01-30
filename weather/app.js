
// 状态管理
const state = {
    lat: null,
    lon: null,
    city: "正在定位...",
    weatherData: null,
    airQuality: null,
    wakeLock: null
};

// WMO 天气代码映射
const weatherCodes = {
    0: { desc: "晴", icon: "sun", bg: "sunny" },
    1: { desc: "主要晴", icon: "sun", bg: "sunny" },
    2: { desc: "多云", icon: "cloud", bg: "cloudy" },
    3: { desc: "阴", icon: "cloud", bg: "cloudy" },
    45: { desc: "雾", icon: "fog", bg: "cloudy" },
    48: { desc: "沉积雾", icon: "fog", bg: "cloudy" },
    51: { desc: "毛毛雨", icon: "drizzle", bg: "rainy" },
    53: { desc: "中毛毛雨", icon: "drizzle", bg: "rainy" },
    55: { desc: "密毛毛雨", icon: "drizzle", bg: "rainy" },
    56: { desc: "冻毛毛雨", icon: "drizzle", bg: "rainy" },
    57: { desc: "密冻毛毛雨", icon: "drizzle", bg: "rainy" },
    61: { desc: "小雨", icon: "rain", bg: "rainy" },
    63: { desc: "中雨", icon: "rain", bg: "rainy" },
    65: { desc: "大雨", icon: "rain", bg: "rainy" },
    66: { desc: "冻雨", icon: "rain", bg: "rainy" },
    67: { desc: "大冻雨", icon: "rain", bg: "rainy" },
    71: { desc: "小雪", icon: "snow", bg: "snowy" },
    73: { desc: "中雪", icon: "snow", bg: "snowy" },
    75: { desc: "大雪", icon: "snow", bg: "snowy" },
    77: { desc: "雪粒", icon: "snow", bg: "snowy" },
    80: { desc: "阵雨", icon: "rain", bg: "rainy" },
    81: { desc: "中阵雨", icon: "rain", bg: "rainy" },
    82: { desc: "大阵雨", icon: "rain", bg: "rainy" },
    85: { desc: "小雪阵", icon: "snow", bg: "snowy" },
    86: { desc: "大雪阵", icon: "snow", bg: "snowy" },
    95: { desc: "雷雨", icon: "storm", bg: "storm" },
    96: { desc: "雷雨伴冰雹", icon: "storm", bg: "storm" },
    99: { desc: "大雷雨伴冰雹", icon: "storm", bg: "storm" },
};

// 图标 SVG 路径 (简化版)
const icons = {
    sun: '<circle cx="12" cy="12" r="5"/><path d="M12 1v2"/><path d="M12 21v2"/><path d="M4.22 4.22l1.42 1.42"/><path d="M18.36 18.36l1.42 1.42"/><path d="M1 12h2"/><path d="M21 12h2"/><path d="M4.22 19.78l1.42-1.42"/><path d="M18.36 5.64l1.42-1.42"/>',
    cloud: '<path d="M17.5 19c0-1.7-1.3-3-3-3h-11a4 4 0 0 1-0-8h1a5 5 0 0 1 9.9-1 3 3 0 0 1 3 4"/>',
    fog: '<path d="M4 14h16"/><path d="M4 10h16"/><path d="M6 18h12"/>',
    drizzle: '<path d="M8 19v2"/><path d="M8 13v2"/><path d="M16 19v2"/><path d="M16 13v2"/><path d="M12 21v2"/><path d="M12 15v2"/><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/>',
    rain: '<path d="M16 13v8"/><path d="M8 13v8"/><path d="M12 15v8"/><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/>',
    snow: '<path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><line x1="8" x2="8" y1="16" y2="22"/><line x1="8" x2="8" y1="16" y2="22" transform="rotate(45 8 19)"/><line x1="8" x2="8" y1="16" y2="22" transform="rotate(-45 8 19)"/><line x1="16" x2="16" y1="16" y2="22"/><line x1="16" x2="16" y1="16" y2="22" transform="rotate(45 16 19)"/><line x1="16" x2="16" y1="16" y2="22" transform="rotate(-45 16 19)"/>',
    storm: '<path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/><polyline points="13 11 9 17 15 17 11 23"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
    requestWakeLock();
});

function initApp() {
    // 尝试从本地存储获取位置
    const savedLat = localStorage.getItem('weather_lat');
    const savedLon = localStorage.getItem('weather_lon');
    const savedCity = localStorage.getItem('weather_city');

    if (savedLat && savedLon) {
        state.lat = parseFloat(savedLat);
        state.lon = parseFloat(savedLon);
        state.city = savedCity || "未知地点";
        updateUI();
        fetchWeatherData(state.lat, state.lon);
    } else {
        // 自动定位
        getLocation();
    }
}

function setupEventListeners() {
    document.getElementById('location-btn').addEventListener('click', () => {
        document.getElementById('search-modal').classList.remove('hidden');
    });

    document.getElementById('close-search').addEventListener('click', () => {
        document.getElementById('search-modal').classList.add('hidden');
    });

    document.getElementById('search-btn').addEventListener('click', () => {
        const query = document.getElementById('city-input').value;
        if (query) searchCity(query);
    });

    document.getElementById('city-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = document.getElementById('city-input').value;
            if (query) searchCity(query);
        }
    });

    // 自动检索（防抖）
    const debouncedSearch = debounce((query) => {
        if (query) searchCity(query);
    }, 800); // 增加防抖时间到 800ms，减少不必要的请求

    document.getElementById('city-input').addEventListener('input', (e) => {
        debouncedSearch(e.target.value);
    });

    document.getElementById('use-location-btn').addEventListener('click', () => {
        getLocation();
        document.getElementById('search-modal').classList.add('hidden');
    });
}

function getLocation() {
    document.getElementById('location-name').textContent = "定位中...";
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                state.lat = position.coords.latitude;
                state.lon = position.coords.longitude;
                // 反向地理编码获取城市名 (这里简化，直接使用 Geocoding API 或显示坐标)
                // 我们可以调用一个简单的 API 来获取城市名，或者 Open-Meteo 并没有直接的反向编码功能
                // 这里暂时用 OpenStreetMap Nominatim
                fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${state.lat}&lon=${state.lon}`)
                    .then(res => res.json())
                    .then(data => {
                        state.city = data.address.city || data.address.town || data.address.village || "当前位置";
                        saveLocation();
                        updateUI();
                        fetchWeatherData(state.lat, state.lon);
                    })
                    .catch(() => {
                        state.city = "当前位置";
                        saveLocation();
                        updateUI();
                        fetchWeatherData(state.lat, state.lon);
                    });
            },
            (error) => {
                alert("无法获取定位，请手动搜索城市");
                document.getElementById('location-name').textContent = "选择城市";
                document.getElementById('search-modal').classList.remove('hidden');
            }
        );
    } else {
        alert("浏览器不支持定位");
    }
}

function saveLocation() {
    localStorage.setItem('weather_lat', state.lat);
    localStorage.setItem('weather_lon', state.lon);
    localStorage.setItem('weather_city', state.city);
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function searchCity(query) {
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '<div class="text-center text-gray-400 py-4">搜索中...</div>';

    // 构建搜索队列
    let queries = [query];
    // 如果是中文且不包含行政区划后缀，尝试添加后缀搜索
    if (/[\u4e00-\u9fa5]/.test(query) && query.length >= 2) {
        if (!query.endsWith('市')) queries.push(query + '市');
        // 可以根据需要添加 '县', '区' 等，但 '市' 最常用且能解决大城市搜不到的问题
    }

    // 所有的 fetch Promise
    const promises = queries.map(q => 
        fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&language=zh&format=json`)
            .then(res => res.json())
            .then(data => data.results || [])
            .catch(e => [])
    );

    try {
        const resultsArray = await Promise.all(promises);
        // 合并结果
        let allResults = resultsArray.flat();

        // 去重 (根据 ID)
        const uniqueResults = [];
        const seenIds = new Set();
        
        allResults.forEach(city => {
            if (!seenIds.has(city.id)) {
                seenIds.add(city.id);
                uniqueResults.push(city);
            }
        });

        if (uniqueResults.length === 0) {
            resultsContainer.innerHTML = '<div class="text-center text-gray-400 py-4">未找到城市</div>';
            return;
        }

        // 1. 过滤：只保留中国 (CN), 香港 (HK), 澳门 (MO), 台湾 (TW)
        let filteredResults = uniqueResults.filter(city => 
            ['CN', 'HK', 'MO', 'TW'].includes(city.country_code)
        );

        if (filteredResults.length === 0) {
            resultsContainer.innerHTML = '<div class="text-center text-gray-400 py-4">未找到中国境内的城市</div>';
            return;
        }

        // 2. 排序优化
        // 优先级：
        // 1. 名称完全匹配 (exact match) - 注意：这里我们要匹配的是原始 query 或 query+"市"
        // 2. 人口数量 (population)
        filteredResults.sort((a, b) => {
            // 检查是否匹配原始查询或带“市”的查询
            const isExactA = queries.includes(a.name);
            const isExactB = queries.includes(b.name);
            
            if (isExactA && !isExactB) return -1;
            if (!isExactA && isExactB) return 1;
            
            return (b.population || 0) - (a.population || 0);
        });

        // 3. 限制显示数量
        filteredResults = filteredResults.slice(0, 10);

        resultsContainer.innerHTML = ''; // 清空 loading
        filteredResults.forEach(city => {
            const div = document.createElement('div');
            div.className = "p-3 bg-gray-700/50 hover:bg-gray-600 rounded-lg cursor-pointer flex justify-between items-center";
            
            // 构建行政区划显示字符串
            let adminInfoParts = [];
            if (city.admin1) adminInfoParts.push(city.admin1);
            if (city.admin2 && city.admin2 !== city.admin1) adminInfoParts.push(city.admin2); // 避免重复显示 北京, 北京市
            if (city.country) adminInfoParts.push(city.country);
            
            const adminInfo = adminInfoParts.join(', ');
            
            div.innerHTML = `
                <div>
                    <div class="font-medium">${city.name}</div>
                    <div class="text-xs text-gray-400">${adminInfo}</div>
                </div>
                <div class="text-xs text-gray-500">
                    ${city.latitude.toFixed(2)}, ${city.longitude.toFixed(2)}
                </div>
            `;
            div.onclick = () => {
                state.lat = city.latitude;
                state.lon = city.longitude;
                state.city = city.name;
                saveLocation();
                updateUI();
                fetchWeatherData(state.lat, state.lon);
                document.getElementById('search-modal').classList.add('hidden');
            };
            resultsContainer.appendChild(div);
        });
    } catch (e) {
        console.error(e);
        resultsContainer.innerHTML = '<div class="text-center text-gray-400 py-4">搜索出错</div>';
    }
}

async function fetchWeatherData(lat, lon) {
    // 1. 获取天气数据
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,weather_code,is_day,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,precipitation_probability_max&timezone=auto`;
    
    // 2. 获取空气质量数据
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`;

    try {
        const [weatherRes, aqiRes] = await Promise.all([
            fetch(weatherUrl),
            fetch(aqiUrl)
        ]);
        
        const weatherData = await weatherRes.json();
        const aqiData = await aqiRes.json();

        state.weatherData = weatherData;
        state.airQuality = aqiData;
        
        renderWeather();
    } catch (e) {
        console.error("Failed to fetch weather data", e);
        alert("获取天气数据失败");
    }
}

function updateUI() {
    if (state.city) {
        document.getElementById('location-name').textContent = state.city;
    }
}

function renderWeather() {
    if (!state.weatherData) return;

    const current = state.weatherData.current;
    const daily = state.weatherData.daily;
    const hourly = state.weatherData.hourly;
    
    // 更新头部
    document.getElementById('location-name').textContent = state.city;
    document.getElementById('current-temp').textContent = Math.round(current.temperature_2m);
    
    const wCode = current.weather_code;
    const wInfo = weatherCodes[wCode] || { desc: "未知", icon: "sun", bg: "sunny" };
    document.getElementById('weather-desc').textContent = wInfo.desc;
    
    document.getElementById('max-temp').textContent = Math.round(daily.temperature_2m_max[0]);
    document.getElementById('min-temp').textContent = Math.round(daily.temperature_2m_min[0]);

    // 更新背景
    updateBackground(wInfo.bg, current.is_day);

    // 更新详情
    document.getElementById('humidity').textContent = current.relative_humidity_2m;
    document.getElementById('humidity-desc').textContent = `露点 ${Math.round(current.temperature_2m - ((100 - current.relative_humidity_2m)/5))}°`;
    
    document.getElementById('wind-speed').textContent = current.wind_speed_10m;
    document.getElementById('wind-dir').textContent = getWindDirection(current.wind_direction_10m);
    
    document.getElementById('apparent-temp').textContent = Math.round(current.apparent_temperature);
    document.getElementById('pressure').textContent = Math.round(current.pressure_msl);

    // 降雨概率 (取今天的最大概率)
    document.getElementById('precip-prob').textContent = daily.precipitation_probability_max[0];
    document.getElementById('precip-amount').textContent = daily.precipitation_sum[0] + " mm";

    // 日出日落
    const sunrise = new Date(daily.sunrise[0]);
    const sunset = new Date(daily.sunset[0]);
    document.getElementById('sunrise-time').textContent = formatTime(sunrise);
    document.getElementById('sunset-time').textContent = formatTime(sunset);

    // 空气质量
    if (state.airQuality && state.airQuality.current) {
        const aqi = state.airQuality.current.us_aqi;
        document.getElementById('aqi-val').textContent = aqi;
        document.getElementById('aqi-desc').textContent = getAQIDesc(aqi);
        const aqiPercent = Math.min((aqi / 300) * 100, 100);
        document.getElementById('aqi-bar').style.width = `${aqiPercent}%`;
    }

    // 渲染小时预报
    const hourlyContainer = document.getElementById('hourly-forecast');
    hourlyContainer.innerHTML = '';
    
    // 获取当前时间索引
    const now = new Date();
    let startIndex = 0;
    // 简单的找到最近的小时
    for(let i=0; i<hourly.time.length; i++) {
        if (new Date(hourly.time[i]) > now) {
            startIndex = Math.max(0, i-1);
            break;
        }
    }

    // 收集未来48小时内的日出日落事件
    const sunEvents = [];
    for(let i=0; i<daily.time.length; i++) {
        if (daily.sunrise[i]) sunEvents.push({ time: new Date(daily.sunrise[i]), type: 'sunrise', label: '日出' });
        if (daily.sunset[i]) sunEvents.push({ time: new Date(daily.sunset[i]), type: 'sunset', label: '日落' });
    }
    // 按时间排序
    sunEvents.sort((a, b) => a.time - b.time);

    // 显示未来 24 小时
    for(let i=startIndex; i<startIndex+24 && i<hourly.time.length; i++) {
        const time = new Date(hourly.time[i]);
        const nextTime = new Date(time.getTime() + 3600000); // 下一小时
        const isNow = i === startIndex;
        const hCode = hourly.weather_code[i];
        const hInfo = weatherCodes[hCode] || weatherCodes[0];
        
        // 渲染当前小时
        const div = document.createElement('div');
        div.className = "flex-shrink-0 text-center w-14 flex flex-col items-center gap-2";
        div.innerHTML = `
            <div class="text-sm opacity-80">${isNow ? '现在' : formatTime(time)}</div>
            <div class="w-6 h-6">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    ${hourly.is_day[i] ? icons[hInfo.icon] : (hInfo.icon === 'sun' ? icons['moon'] : icons[hInfo.icon])}
                </svg>
            </div>
            <div class="text-lg font-medium">${Math.round(hourly.temperature_2m[i])}°</div>
        `;
        hourlyContainer.appendChild(div);

        // 检查这一小时内是否有日出日落
        const eventsInThisHour = sunEvents.filter(e => e.time >= time && e.time < nextTime);
        eventsInThisHour.forEach(e => {
            const eventDiv = document.createElement('div');
            eventDiv.className = "flex-shrink-0 text-center w-14 flex flex-col items-center gap-2";
            eventDiv.innerHTML = `
                <div class="text-sm opacity-80">${formatTime(e.time)}</div>
                <div class="w-6 h-6">
                     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        ${e.type === 'sunrise' ? 
                          '<path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.91 11.64 12 12l-.01.03"/><path d="M8 12H2"/><path d="M12 8v4"/><path d="M12 22v-6"/><path d="m19.07 19.07-1.41-1.41"/><path d="m4.93 19.07 1.41-1.41"/>' : 
                          '<path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.91 11.64 12 12l-.01.03"/><path d="M8 12H2"/><path d="M12 8v4"/><path d="M12 22v-6"/><path d="m19.07 19.07-1.41-1.41"/><path d="m4.93 19.07 1.41-1.41"/>'
                        }
                    </svg>
                </div>
                <div class="text-sm font-medium pt-1">${e.label}</div>
            `;
            // 简单的 SVG 图标重用 (sunrise icon)
             if (e.type === 'sunset') {
                 // Sunset icon
                 eventDiv.querySelector('svg').innerHTML = '<path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M8 12H2"/><path d="M12 8v4"/><path d="M12 22v-6"/><path d="m19.07 19.07-1.41-1.41"/><path d="m4.93 19.07 1.41-1.41"/><path d="M12 12v.01"/><path d="M16 12h1"/>'; // Simplified or just reuse text
                 // Let's use text primarily or the sunrise icon is fine for both with label
             }
            hourlyContainer.appendChild(eventDiv);
        });
    }

    // 渲染每日预报
    const dailyContainer = document.getElementById('daily-forecast');
    dailyContainer.innerHTML = '';
    
    for(let i=0; i<daily.time.length; i++) {
        const date = new Date(daily.time[i]);
        const dayName = i === 0 ? '今天' : getDayName(date);
        const dCode = daily.weather_code[i];
        const dInfo = weatherCodes[dCode] || weatherCodes[0];
        const min = Math.round(daily.temperature_2m_min[i]);
        const max = Math.round(daily.temperature_2m_max[i]);
        
        // 计算温度条位置
        // 假设本周最低-10，最高40，以此为基准计算百分比（简化逻辑）
        // 实际Apple设计是基于当天的min-max在总min-max中的位置。
        // 这里简化：取这7天的全局min和max
        const weekMin = Math.min(...daily.temperature_2m_min);
        const weekMax = Math.max(...daily.temperature_2m_max);
        const range = weekMax - weekMin;
        
        const leftPct = ((min - weekMin) / range) * 100;
        const widthPct = ((max - min) / range) * 100;

        const div = document.createElement('div');
        div.className = "flex items-center justify-between py-2 border-b border-white/10 last:border-none";
        div.innerHTML = `
            <div class="w-12 font-medium">${dayName}</div>
            <div class="flex-1 flex justify-center">
                 <div class="w-6 h-6">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        ${icons[dInfo.icon]}
                    </svg>
                </div>
            </div>
            <div class="flex items-center gap-2 w-40">
                <span class="w-8 text-right opacity-60">${min}°</span>
                <div class="flex-1 h-1 bg-white/20 rounded-full relative overflow-hidden">
                    <div class="absolute h-full bg-gradient-to-r from-blue-300 to-yellow-300 rounded-full" 
                         style="left: ${leftPct}%; width: ${widthPct}%"></div>
                </div>
                <span class="w-8 text-right font-medium">${max}°</span>
            </div>
        `;
        dailyContainer.appendChild(div);
    }

    // 更新时间
    document.getElementById('last-updated').textContent = "更新于: " + formatTime(new Date());
}

// 辅助函数
function formatTime(date) {
    return date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0');
}

function getDayName(date) {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days[date.getDay()];
}

function getWindDirection(degrees) {
    const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    return directions[Math.round(degrees / 45) % 8];
}

function getAQIDesc(aqi) {
    if (aqi <= 50) return "优";
    if (aqi <= 100) return "良";
    if (aqi <= 150) return "轻度污染";
    if (aqi <= 200) return "中度污染";
    if (aqi <= 300) return "重度污染";
    return "严重污染";
}

// 动态背景与动画
let animationId = null;
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');
let particles = [];

function updateBackground(bgType, isDay) {
    const bg = document.getElementById('bg-gradient');
    
    // 设置渐变色
    if (isDay === 0) { // 夜晚
        bg.className = "weather-bg-gradient bg-gradient-to-b from-gray-900 to-black";
    } else {
        switch(bgType) {
            case 'sunny':
                bg.className = "weather-bg-gradient bg-gradient-to-b from-blue-400 to-blue-300";
                break;
            case 'cloudy':
                bg.className = "weather-bg-gradient bg-gradient-to-b from-gray-400 to-gray-300";
                break;
            case 'rainy':
                bg.className = "weather-bg-gradient bg-gradient-to-b from-slate-700 to-slate-600";
                break;
            case 'snowy':
                bg.className = "weather-bg-gradient bg-gradient-to-b from-slate-300 to-slate-200";
                break;
            case 'storm':
                bg.className = "weather-bg-gradient bg-gradient-to-b from-indigo-900 to-slate-800";
                break;
            default:
                bg.className = "weather-bg-gradient bg-gradient-to-b from-blue-500 to-blue-400";
        }
    }

    // 启动对应的 Canvas 动画
    startAnimation(bgType);
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function startAnimation(type) {
    if (animationId) cancelAnimationFrame(animationId);
    particles = [];
    
    if (type === 'rainy' || type === 'storm') {
        createRain();
        animateRain();
    } else if (type === 'snowy') {
        createSnow();
        animateSnow();
    } else if (type === 'cloudy') {
        // 云可以用 CSS 做，或者简单的 Canvas 圆圈
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function createRain() {
    const count = 100;
    for(let i=0; i<count; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            l: Math.random() * 20 + 10,
            v: Math.random() * 5 + 10
        });
    }
}

function animateRain() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let p of particles) {
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, p.y + p.l);
        p.y += p.v;
        if (p.y > canvas.height) {
            p.y = -p.l;
            p.x = Math.random() * canvas.width;
        }
    }
    ctx.stroke();
    animationId = requestAnimationFrame(animateRain);
}

function createSnow() {
    const count = 50;
    for(let i=0; i<count; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 3 + 1,
            v: Math.random() * 1 + 0.5
        });
    }
}

function animateSnow() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    for(let p of particles) {
        ctx.moveTo(p.x, p.y);
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        p.y += p.v;
        if (p.y > canvas.height) {
            p.y = -5;
            p.x = Math.random() * canvas.width;
        }
    }
    ctx.fill();
    animationId = requestAnimationFrame(animateSnow);
}

// 屏幕常亮
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            state.wakeLock = await navigator.wakeLock.request('screen');
            console.log('Screen Wake Lock active');
            
            // 重新请求如果可见性改变
            document.addEventListener('visibilitychange', async () => {
                if (state.wakeLock !== null && document.visibilityState === 'visible') {
                    state.wakeLock = await navigator.wakeLock.request('screen');
                }
            });
        }
    } catch (err) {
        console.error(`${err.name}, ${err.message}`);
    }
}
