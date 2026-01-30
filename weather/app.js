
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
    0: { desc: "晴", icon: "sun", bg: "sunny", intensity: 0 },
    1: { desc: "主要晴", icon: "sun", bg: "sunny", intensity: 0 },
    2: { desc: "多云", icon: "cloud", bg: "cloudy", intensity: 0 },
    3: { desc: "阴", icon: "cloud", bg: "cloudy", intensity: 0 },
    45: { desc: "雾", icon: "fog", bg: "cloudy", intensity: 0 },
    48: { desc: "沉积雾", icon: "fog", bg: "cloudy", intensity: 0 },
    51: { desc: "毛毛雨", icon: "drizzle", bg: "rainy", intensity: 1 },
    53: { desc: "中毛毛雨", icon: "drizzle", bg: "rainy", intensity: 1 },
    55: { desc: "密毛毛雨", icon: "drizzle", bg: "rainy", intensity: 1 },
    56: { desc: "冻毛毛雨", icon: "drizzle", bg: "rainy", intensity: 1 },
    57: { desc: "密冻毛毛雨", icon: "drizzle", bg: "rainy", intensity: 1 },
    61: { desc: "小雨", icon: "rain", bg: "rainy", intensity: 1 },
    63: { desc: "中雨", icon: "rain", bg: "rainy", intensity: 2 },
    65: { desc: "大雨", icon: "rain", bg: "rainy", intensity: 3 },
    66: { desc: "冻雨", icon: "rain", bg: "rainy", intensity: 2 },
    67: { desc: "大冻雨", icon: "rain", bg: "rainy", intensity: 3 },
    71: { desc: "小雪", icon: "snow", bg: "snowy", intensity: 1 },
    73: { desc: "中雪", icon: "snow", bg: "snowy", intensity: 2 },
    75: { desc: "大雪", icon: "snow", bg: "snowy", intensity: 3 },
    77: { desc: "雪粒", icon: "snow", bg: "snowy", intensity: 1 },
    80: { desc: "阵雨", icon: "rain", bg: "rainy", intensity: 1 },
    81: { desc: "中阵雨", icon: "rain", bg: "rainy", intensity: 2 },
    82: { desc: "大阵雨", icon: "rain", bg: "rainy", intensity: 3 },
    85: { desc: "小雪阵", icon: "snow", bg: "snowy", intensity: 1 },
    86: { desc: "大雪阵", icon: "snow", bg: "snowy", intensity: 3 },
    95: { desc: "雷雨", icon: "storm", bg: "storm", intensity: 3 },
    96: { desc: "雷雨伴冰雹", icon: "storm", bg: "storm", intensity: 3 },
    99: { desc: "大雷雨伴冰雹", icon: "storm", bg: "storm", intensity: 3 },
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
    
    // 启动自动刷新 (每分钟)
    startAutoRefresh();
}

let refreshInterval = null;
function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
        if (state.lat && state.lon) {
            console.log("Auto-refreshing weather data...");
            fetchWeatherData(state.lat, state.lon, true);
        }
    }, 60000);
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

async function fetchWeatherData(lat, lon, silent = false) {
    if (!lat || !lon) {
        console.error("Invalid coordinates for fetchWeatherData");
        return;
    }

    // 1. 获取天气数据
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,weather_code,is_day,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,precipitation_probability_max&timezone=auto`;
    
    // 2. 获取空气质量数据
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`;

    try {
        // 使用 allSettled 防止 AQI 失败导致整个请求失败
        const results = await Promise.allSettled([
            fetch(weatherUrl),
            fetch(aqiUrl)
        ]);

        // 处理天气数据
        if (results[0].status === 'fulfilled' && results[0].value.ok) {
            const weatherData = await results[0].value.json();
            state.weatherData = weatherData;
        } else {
            throw new Error("Weather API failed");
        }

        // 处理空气质量数据 (可选)
        if (results[1].status === 'fulfilled' && results[1].value.ok) {
            const aqiData = await results[1].value.json();
            state.airQuality = aqiData;
        } else {
            console.warn("AQI API failed, skipping AQI update");
            // 不抛出错误，继续渲染天气
        }
        
        renderWeather();
    } catch (e) {
        console.error("Failed to fetch weather data", e);
        if (!silent) alert("获取天气数据失败: " + e.message);
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
let splashParticles = [];
let clouds = [];
let lightningTimer = 0;
let isThundering = false;
let currentIntensity = 1;
let wind = { x: 0, y: 0 };

// 碰撞区域缓存
let collisionZones = [];

function updateCollisionZones() {
    // 获取所有需要交互的 UI 元素 (glass-panel 和 #search-modal > div) - 移除 header 以避免溅射
    const elements = document.querySelectorAll('.glass-panel, #search-modal > div');
    collisionZones = Array.from(elements).map(el => {
        const rect = el.getBoundingClientRect();
        // 稍微扩大一点判定范围，或者只判定顶部
        return {
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width
        };
    });
}

// 监听滚动和窗口变化更新碰撞区域
window.addEventListener('scroll', updateCollisionZones);
window.addEventListener('resize', () => {
    resizeCanvas();
    updateCollisionZones();
});

function updateBackground(bgType, isDay, intensity = 1) {
    const bg = document.getElementById('bg-gradient');
    const current = state.weatherData?.current;
    const daily = state.weatherData?.daily;
    
    let period = 'day';
    if (daily && daily.sunrise && daily.sunset) {
        period = getTimePeriod(daily.sunrise[0], daily.sunset[0]);
    }

    let gradientClass = "";
    
    // Base gradients by period
    const periodGradients = {
        dawn: "bg-gradient-to-b from-indigo-400 to-orange-200",
        morning: "bg-gradient-to-b from-blue-400 to-blue-200",
        noon: "bg-gradient-to-b from-blue-500 to-blue-300",
        afternoon: "bg-gradient-to-b from-blue-600 to-blue-400",
        dusk: "bg-gradient-to-b from-indigo-800 to-orange-400",
        night: "bg-gradient-to-b from-gray-900 to-black"
    };

    if (isDay === 0 || period === 'night') {
        gradientClass = periodGradients.night;
    } else {
        gradientClass = periodGradients[period] || periodGradients.morning;
    }
    
    // Override/Overlay based on weather
    switch(bgType) {
        case 'cloudy':
        case 'fog':
            if (period === 'night') gradientClass = "bg-gradient-to-b from-gray-800 to-gray-900";
            else if (period === 'dusk' || period === 'dawn') gradientClass = "bg-gradient-to-b from-slate-500 to-orange-200";
            else gradientClass = "bg-gradient-to-b from-slate-400 to-slate-200";
            break;
        case 'rainy':
            if (period === 'night') gradientClass = "bg-gradient-to-b from-slate-900 to-black";
            else gradientClass = "bg-gradient-to-b from-slate-700 to-slate-500";
            break;
        case 'snowy':
             if (period === 'night') gradientClass = "bg-gradient-to-b from-slate-800 to-slate-900";
             else gradientClass = "bg-gradient-to-b from-slate-300 to-slate-100";
            break;
        case 'storm':
            gradientClass = "bg-gradient-to-b from-indigo-950 to-slate-900";
            break;
    }
    
    bg.className = `weather-bg-gradient ${gradientClass}`;

    startAnimation(bgType, isDay, intensity);
}

function getTimePeriod(sunriseIso, sunsetIso) {
    const now = new Date();
    const sunrise = new Date(sunriseIso);
    const sunset = new Date(sunsetIso);
    
    // Adjust to today
    sunrise.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
    sunset.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());

    const oneHour = 3600000;
    
    if (now.getTime() < sunrise.getTime() - oneHour) return 'night';
    if (now.getTime() < sunrise.getTime() + oneHour) return 'dawn';
    
    const noon = new Date(now); noon.setHours(11, 0, 0, 0);
    if (now.getTime() < noon.getTime()) return 'morning';
    
    const afternoonStart = new Date(now); afternoonStart.setHours(14, 0, 0, 0);
    if (now.getTime() < afternoonStart.getTime()) return 'noon';
    
    if (now.getTime() < sunset.getTime() - oneHour) return 'afternoon';
    if (now.getTime() < sunset.getTime() + oneHour) return 'dusk';
    
    return 'night';
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();

function startAnimation(type, isDay, intensity = 1) {
    if (animationId) cancelAnimationFrame(animationId);
    particles = [];
    splashParticles = [];
    clouds = [];
    isThundering = false;
    lightningTimer = 0;
    currentIntensity = intensity;
    
    // 计算风力
    const current = state.weatherData?.current;
    if (current) {
        const speed = current.wind_speed_10m || 0;
        const dir = current.wind_direction_10m || 0;
        // 风向是来源方向，所以粒子移动方向是反的? 
        // 通常 wind_direction 是风吹来的方向 (0=北, 90=东)
        // 粒子应该向风吹去的方向移动
        // x 分量: sin(dir) * speed (如果 0度是从北吹来，往南吹，x=0, y>0)
        // 让我们简化：直接用角度计算偏移
        const rad = (dir - 180) * Math.PI / 180; // 反向，因为是要吹去的方向
        // 调整系数
        const factor = 0.05; 
        wind.x = Math.sin(rad) * speed * factor;
        // y 轴一般雨雪自然下落，风主要影响 x 轴，但也可以微调 y
        // 这里只影响 x 轴简单点，或者稍微影响 y
    } else {
        wind = { x: 0, y: 0 };
    }
    
    // 每次动画开始前更新碰撞区域
    updateCollisionZones();

    if (type === 'rainy' || type === 'storm') {
        const isStorm = type === 'storm';
        if (isStorm) currentIntensity = 3; // 暴雨强制最高强度
        createRain(isStorm); 
        createClouds(isStorm); 
        animateRain(isStorm);
    } else if (type === 'snowy') {
        createSnow();
        animateSnow();
    } else if (type === 'cloudy' || type === 'fog') {
        createClouds(false);
        animateClouds();
    } else if (type === 'sunny' && isDay) {
        // 晴天也可以有一些淡淡的光晕效果
        createSunBeams();
        animateSunBeams();
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// --- 雨 & 溅射系统 ---

function createRain(isStorm) {
    let count;
    if (isStorm) {
        count = 1200;
    } else {
        switch(currentIntensity) {
            case 1: count = 150; break; // 小雨
            case 2: count = 500; break; // 中雨
            case 3: count = 900; break; // 大雨
            default: count = 400;
        }
    }
    
    for(let i=0; i<count; i++) {
        resetRainDrop({}, true);
    }
}

function resetRainDrop(p, initial = false) {
    p.x = Math.random() * canvas.width;
    p.y = initial ? Math.random() * canvas.height : -50;
    
    const lenMult = currentIntensity === 3 ? 1.5 : (currentIntensity === 1 ? 0.6 : 1);
    const speedMult = currentIntensity === 3 ? 1.4 : (currentIntensity === 1 ? 0.7 : 1);

    p.l = (Math.random() * 20 + 10) * lenMult; // 长度
    p.v = (Math.random() * 10 + 15) * speedMult; // 速度
    p.a = Math.random() * 0.5 + 0.3; // 透明度
    if (particles.indexOf(p) === -1) particles.push(p);
}

function createSplash(x, y) {
    const count = Math.random() * 3 + 2;
    for (let i = 0; i < count; i++) {
        splashParticles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 4,
            vy: -(Math.random() * 3 + 1),
            life: 1.0,
            gravity: 0.2
        });
    }
}

function animateRain(isStorm) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 闪电效果
    if (isStorm) {
        if (lightningTimer > 0) {
            lightningTimer--;
            ctx.fillStyle = `rgba(255, 255, 255, ${lightningTimer / 10})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (Math.random() < 0.005) { // 0.5% 概率触发闪电
            lightningTimer = 10;
        }
    }

    // 绘制云层 (背景层)
    drawClouds();

    // 绘制雨滴
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    
    for(let p of particles) {
        // 应用风力
        p.x += wind.x;
        // 暴雨额外增加一点混乱的风
        if (isStorm) p.x += (Math.random() - 0.5) * 2;
        
        p.y += p.v;

        // 碰撞检测
        let hit = false;
        if (p.y > 0 && p.y < canvas.height) {
            for (let zone of collisionZones) {
                // 检查是否击中 UI 顶部边界
                if (p.x >= zone.left && p.x <= zone.right && 
                    p.y >= zone.top && p.y <= zone.top + 15) { // 稍微宽松的判定
                    
                    hit = true;
                    createSplash(p.x, zone.top);
                    resetRainDrop(p);
                    break;
                }
            }
        }

        if (!hit) {
            if (p.y > canvas.height) {
                resetRainDrop(p);
            } else {
                // 根据风向绘制雨滴轨迹
                ctx.moveTo(p.x, p.y);
                // 雨滴尾巴向风的反方向延伸，或者简单的垂直延伸+倾斜
                // 这里简单处理：尾巴在 (p.x - wind.x * 2, p.y - p.l)
                ctx.lineTo(p.x - wind.x * 2, p.y - p.l);
            }
        }
    }
    ctx.stroke();

    // 绘制溅射效果
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let i = splashParticles.length - 1; i >= 0; i--) {
        let sp = splashParticles[i];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.vy += sp.gravity;
        sp.life -= 0.05;

        if (sp.life <= 0) {
            splashParticles.splice(i, 1);
        } else {
            ctx.globalAlpha = sp.life;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, 1, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1.0;

    animationId = requestAnimationFrame(() => animateRain(isStorm));
}

// --- 雪系统 ---

function createSnow() {
    let count;
    switch(currentIntensity) {
        case 1: count = 100; break; // 小雪
        case 2: count = 300; break; // 中雪
        case 3: count = 800; break; // 大雪
        default: count = 300;
    }
    
    for(let i=0; i<count; i++) {
        resetSnowFlake({}, true);
    }
}

function resetSnowFlake(p, initial = false) {
    p.x = Math.random() * canvas.width;
    p.y = initial ? Math.random() * canvas.height : -10;
    
    const sizeMult = currentIntensity === 3 ? 1.2 : (currentIntensity === 1 ? 0.8 : 1);
    const speedMult = currentIntensity === 3 ? 1.5 : (currentIntensity === 1 ? 0.8 : 1);

    p.r = (Math.random() * 3 + 1) * sizeMult; // 半径
    p.v = (Math.random() * 1.5 + 0.5) * speedMult; // 下落速度
    p.swing = Math.random() * 0.02; // 摆动幅度
    p.swingOffset = Math.random() * Math.PI * 2;
    if (particles.indexOf(p) === -1) particles.push(p);
}

function animateSnow() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    
    for(let p of particles) {
        const oldY = p.y;
        
        p.swingOffset += p.swing;
        p.x += Math.sin(p.swingOffset) * 0.5;
        p.y += p.v;

        // 碰撞检测 (雪花碰到 UI 顶部可能会消失)
        let hit = false;
        if (p.y > 0 && p.y < canvas.height) {
            for (let zone of collisionZones) {
                 if (p.x >= zone.left && p.x <= zone.right && 
                    oldY <= zone.top && p.y >= zone.top) {
                    hit = true;
                    // 雪花碰到 UI 融化/消失
                    resetSnowFlake(p);
                    break;
                }
            }
        }

        if (!hit) {
            if (p.y > canvas.height) {
                resetSnowFlake(p);
            } else {
                ctx.moveTo(p.x, p.y);
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            }
        }
    }
    ctx.fill();
    animationId = requestAnimationFrame(animateSnow);
}

// --- 云系统 ---

function createClouds(isDark) {
    const count = 10;
    clouds = [];
    for(let i=0; i<count; i++) {
        clouds.push({
            x: Math.random() * canvas.width,
            y: Math.random() * (canvas.height / 3), // 只在上半部分
            r: Math.random() * 100 + 50,
            v: Math.random() * 0.2 + 0.1,
            alpha: Math.random() * 0.3 + 0.1,
            isDark: isDark
        });
    }
}

function drawClouds() {
    for(let c of clouds) {
        c.x += c.v + wind.x * 0.2; // Clouds move slower
        
        // Wrap around
        if (c.x - c.r > canvas.width) {
            c.x = -c.r;
        } else if (c.x + c.r < 0) {
            c.x = canvas.width + c.r;
        }
        
        const gradient = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
        if (c.isDark) {
            gradient.addColorStop(0, `rgba(50, 50, 60, ${c.alpha})`);
            gradient.addColorStop(1, 'rgba(50, 50, 60, 0)');
        } else {
            gradient.addColorStop(0, `rgba(255, 255, 255, ${c.alpha})`);
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        }
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fill();
    }
}

function animateClouds() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawClouds();
    animationId = requestAnimationFrame(animateClouds);
}

// --- 光晕系统 (晴天) ---

function createSunBeams() {
    // 简单的光晕粒子
    const count = 5;
    particles = [];
    for(let i=0; i<count; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 200 + 100,
            alpha: 0,
            targetAlpha: Math.random() * 0.2 + 0.1,
            delta: 0.002
        });
    }
}

function animateSunBeams() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for(let p of particles) {
        p.alpha += p.delta;
        if (p.alpha > p.targetAlpha || p.alpha < 0) {
            p.delta = -p.delta;
        }
        
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        gradient.addColorStop(0, `rgba(255, 255, 200, ${Math.max(0, p.alpha)})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        
        // 缓慢移动
        p.x += Math.sin(Date.now() / 2000) * 0.2;
    }
    
    animationId = requestAnimationFrame(animateSunBeams);
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
