const API_KEY = 'd7doe4pr01qggoep2vngd7doe4pr01qggoep2vo0'; 
const BASE_URL = 'https://finnhub.io/api/v1';
 
// ================== STATE ==================
let trackedStocks = JSON.parse(localStorage.getItem('trackedStocks')) || [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'TSLA', name: 'Tesla, Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corp.' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.' }
];
 
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let currentChart = null;
let activeSort = null;
let sortAsc = false;
let debounceTimer = null;
 
// ================== AUTH ==================
function checkAuth() {
  const user = localStorage.getItem('currentUser');
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  const { name, email } = JSON.parse(user);
 
  const nameEl = document.getElementById('user-name');
  const emailEl = document.getElementById('user-email');
  const avatarEl = document.getElementById('user-avatar');
 
  if (nameEl) nameEl.textContent = name;
  if (emailEl) emailEl.textContent = email;
  if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
 
  return { name, email };
}
 
function logout() {
  localStorage.removeItem('currentUser');
  window.location.href = 'login.html';
}
 
// ================== CLOCK ==================
function updateClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
 
// ================== THEME ==================
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);
 
  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.textContent = saved === 'dark' ? '🌙' : '☀️';
    toggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  }
 
  // Sync settings toggle
  const settingsToggle = document.getElementById('dark-mode-toggle');
  if (settingsToggle) settingsToggle.checked = saved === 'dark';
}
 
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
 
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
 
  const settingsToggle = document.getElementById('dark-mode-toggle');
  if (settingsToggle) settingsToggle.checked = theme === 'dark';
 
  // Update Chart.js colors if chart exists
  if (currentChart) {
    const isDark = theme === 'dark';
    currentChart.options.scales.y.grid.color = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    currentChart.options.scales.x.grid.color = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    currentChart.options.scales.y.ticks.color = isDark ? '#5a6a7e' : '#94a3b8';
    currentChart.options.scales.x.ticks.color = isDark ? '#5a6a7e' : '#94a3b8';
    currentChart.update();
  }
}
 
function toggleThemeFromSettings(checkbox) {
  applyTheme(checkbox.checked ? 'dark' : 'light');
}
 
// ================== TOAST ==================
function showToast(msg, duration = 2800) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}
 
// ================== LOADING ==================
function setLoading(active) {
  const bar = document.getElementById('loading-bar');
  if (bar) bar.classList.toggle('active', active);
 
  const btn = document.getElementById('search-btn');
  if (btn) {
    btn.disabled = active;
    btn.textContent = active ? 'LOADING...' : 'ADD STOCK';
  }
}
 
// ================== API ==================
async function fetchQuote(symbol) {
  try {
    const res = await fetch(`${BASE_URL}/quote?symbol=${symbol.toUpperCase()}&token=${API_KEY}`);
    if (!res.ok) throw new Error('Network error');
    const data = await res.json();
    if (!data || data.c === 0) throw new Error('Invalid symbol');
 
    const changePercent = parseFloat(data.dp.toFixed(2));
 
    return {
      symbol: symbol.toUpperCase(),
      price: data.c.toFixed(2),
      change: data.d ? data.d.toFixed(2) : '0.00',
      changePercent,
      trend: changePercent > 1.5 ? '🟢 Strong Bullish'
           : changePercent > 0.3 ? '🟢 Bullish'
           : changePercent < -1.5 ? '🔴 Strong Bearish'
           : changePercent < -0.3 ? '🔴 Bearish'
           : '🟡 Stable',
      high: data.h ? data.h.toFixed(2) : null,
      low: data.l ? data.l.toFixed(2) : null,
      open: data.o ? data.o.toFixed(2) : null,
      prevClose: data.pc ? data.pc.toFixed(2) : null,
    };
  } catch (err) {
    console.error(`fetchQuote(${symbol}):`, err.message);
    return null;
  }
}
 
// ================== SEARCH (Debounced) ==================
// Debounce: limits how fast searchStock fires on repeated key presses
function debounce(fn, delay) {
  return function(...args) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fn.apply(this, args), delay);
  };
}
 
async function searchStock() {
  const input = document.getElementById('search-input');
  const raw = input.value.trim().toUpperCase();
  if (!raw) { showToast('⚠️ Enter a stock symbol first'); return; }
 
  setLoading(true);
 
  const data = await fetchQuote(raw);
 
  if (!data) {
    showToast('❌ Stock not found or API error');
    setLoading(false);
    return;
  }
 
  // HOF: find — check duplicate
  const exists = trackedStocks.find(s => s.symbol === data.symbol);
  if (!exists) {
    trackedStocks.unshift({ symbol: data.symbol, name: data.symbol, ...data });
    persistStocks();
    showToast(`✅ ${data.symbol} added to dashboard`);
  } else {
    // Update existing entry
    trackedStocks = trackedStocks.map(s => s.symbol === data.symbol ? { ...s, ...data } : s);
    persistStocks();
    showToast(`🔄 ${data.symbol} data refreshed`);
  }
 
  input.value = '';
  setLoading(false);
  renderStocks(trackedStocks);
  updateStats(trackedStocks);
  updateSidebarWatchlist();
}
 
// Attach debounced search on Enter key
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('search-input');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(searchStock, 300);
      }
    });
  }
});
 
// ================== RENDER STOCKS (map HOF) ==================
function renderStocks(stocks, containerId = 'stocks-grid') {
  const container = document.getElementById(containerId);
  if (!container) return;
 
  if (stocks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">◈</div>
        <p>No stocks match your filters.</p>
      </div>`;
    return;
  }
 
  // HOF: map — build card HTML for each stock
  container.innerHTML = stocks.map((stock, i) => {
    const isFav = favorites.includes(stock.symbol);
    const isPos = parseFloat(stock.changePercent) >= 0;
    const changeClass = isPos ? 'change-pos' : 'change-neg';
    const sign = isPos ? '+' : '';
    const delay = i * 60;
 
    return `
      <div class="stock-card"
           onclick="showChart('${stock.symbol}')"
           style="animation-delay: ${delay}ms">
 
        <button class="stock-remove"
                onclick="event.stopPropagation(); removeStock('${stock.symbol}')"
                title="Remove">✕</button>
 
        <div class="stock-card-top">
          <div class="stock-sym-wrap">
            <div class="stock-sym">${stock.symbol}</div>
            <div class="stock-name">${stock.name || stock.symbol}</div>
          </div>
          <button class="stock-fav ${isFav ? 'active' : ''}"
                  onclick="event.stopPropagation(); toggleFavorite('${stock.symbol}')"
                  title="Favorite">★</button>
        </div>
 
        <div class="stock-card-bottom">
          <div class="stock-price">$${stock.price || '—'}</div>
          <div class="stock-meta">
            <div class="stock-change ${changeClass}">
              ${sign}${stock.changePercent || 0}%
              <span style="font-size:0.8rem;font-weight:400"> (${sign}$${stock.change || 0})</span>
            </div>
            <div class="stock-trend">${stock.trend || '—'}</div>
          </div>
        </div>
      </div>`;
  }).join('');
}
 
// ================== STATS (reduce HOF) ==================
function updateStats(stocks) {
  const total = stocks.length;
  // HOF: filter
  const gainers = stocks.filter(s => parseFloat(s.changePercent) > 0).length;
  const losers = stocks.filter(s => parseFloat(s.changePercent) < 0).length;
  // HOF: reduce — sum all changePercent values, then divide
  const avg = total > 0
    ? (stocks.reduce((sum, s) => sum + parseFloat(s.changePercent || 0), 0) / total).toFixed(2)
    : 0;
 
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
 
  setEl('stat-total', total);
  setEl('stat-gainers', gainers);
  setEl('stat-losers', losers);
 
  const avgEl = document.getElementById('stat-avg');
  if (avgEl) {
    avgEl.textContent = `${avg > 0 ? '+' : ''}${avg}%`;
    avgEl.className = 'stat-value ' + (avg >= 0 ? 'green' : 'red');
  }
}
 
// ================== SIDEBAR MINI LIST ==================
function updateSidebarWatchlist() {
  const container = document.getElementById('wl-items');
  if (!container) return;
 
  // HOF: slice + map — show top 5 stocks in sidebar
  const top5 = trackedStocks.slice(0, 5);
 
  container.innerHTML = top5.map(s => {
    const isPos = parseFloat(s.changePercent) >= 0;
    return `
      <div class="wl-mini-item" onclick="showChart('${s.symbol}')">
        <span class="wl-mini-sym">${s.symbol}</span>
        <div>
          <div class="wl-mini-price">$${s.price || '—'}</div>
          <div class="wl-mini-chg ${isPos ? 'change-pos' : 'change-neg'}">
            ${isPos ? '+' : ''}${s.changePercent || 0}%
          </div>
        </div>
      </div>`;
  }).join('');
}
 
// ================== FILTERS (filter HOF) ==================
function applyFilters() {
  // HOF: filter — apply price range and performance filter
  let filtered = trackedStocks.filter(stock => {
    const price = parseFloat(stock.price || 0);
    const minPrice = parseFloat(document.getElementById('min-price').value) || 0;
    const maxPrice = parseFloat(document.getElementById('max-price').value) || Infinity;
    const performance = document.getElementById('performance-filter').value;
    const isGain = parseFloat(stock.changePercent) > 0;
 
    if (price < minPrice || price > maxPrice) return false;
    if (performance === 'gain' && !isGain) return false;
    if (performance === 'loss' && isGain) return false;
    return true;
  });
 
  renderStocks(filtered);
  updateStats(filtered);
}
 
function resetFilters() {
  document.getElementById('min-price').value = '';
  document.getElementById('max-price').value = '';
  document.getElementById('performance-filter').value = 'all';
 
  // Remove active sort class
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  activeSort = null;
 
  renderStocks(trackedStocks);
  updateStats(trackedStocks);
}
 
// ================== SORT (sort HOF) ==================
function sortStocks(type) {
  // Toggle direction if same sort
  if (activeSort === type) { sortAsc = !sortAsc; }
  else { activeSort = type; sortAsc = false; }
 
  // Highlight active sort btn
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.getElementById(`sort-${type === 'alpha' ? 'alpha' : type}`);
  if (activeBtn) activeBtn.classList.add('active');
 
  // HOF: sort — sort the copy, never mutate original
  const sorted = [...trackedStocks].sort((a, b) => {
    let valA, valB;
    if (type === 'price') {
      valA = parseFloat(a.price || 0);
      valB = parseFloat(b.price || 0);
    } else if (type === 'change') {
      valA = parseFloat(a.changePercent || 0);
      valB = parseFloat(b.changePercent || 0);
    } else if (type === 'alpha') {
      return sortAsc
        ? b.symbol.localeCompare(a.symbol)
        : a.symbol.localeCompare(b.symbol);
    }
    return sortAsc ? valA - valB : valB - valA;
  });
 
  renderStocks(sorted);
}
 
// ================== FAVORITES ==================
function toggleFavorite(symbol) {
  const isFav = favorites.includes(symbol);
 
  if (isFav) {
    // HOF: filter — remove from favorites
    favorites = favorites.filter(s => s !== symbol);
    showToast(`☆ ${symbol} removed from watchlist`);
  } else {
    favorites.push(symbol);
    showToast(`★ ${symbol} added to watchlist`);
  }
 
  localStorage.setItem('favorites', JSON.stringify(favorites));
  renderStocks(trackedStocks);
  renderWatchlist();
}
 
function renderWatchlist() {
  // HOF: filter — show only favorited stocks
  const favStocks = trackedStocks.filter(s => favorites.includes(s.symbol));
  renderStocks(favStocks, 'watchlist-grid');
}
 
// ================== REMOVE STOCK ==================
function removeStock(symbol) {
  // HOF: filter — remove stock from tracked list
  trackedStocks = trackedStocks.filter(s => s.symbol !== symbol);
  favorites = favorites.filter(s => s !== symbol);
 
  persistStocks();
  localStorage.setItem('favorites', JSON.stringify(favorites));
 
  renderStocks(trackedStocks);
  updateStats(trackedStocks);
  updateSidebarWatchlist();
  showToast(`🗑 ${symbol} removed`);
}
 
// ================== CHART ==================
async function showChart(symbol) {
  const section = document.getElementById('chart-section');
  const symbolEl = document.getElementById('chart-symbol');
  const infoEl = document.getElementById('chart-info');
 
  symbolEl.textContent = `${symbol} — 30 Day Trend`;
  section.classList.remove('hidden');
 
  setTimeout(() => {
    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 100);
 
  if (currentChart) { currentChart.destroy(); currentChart = null; }
 
  const to = Math.floor(Date.now() / 1000);
  const from = to - (30 * 24 * 60 * 60);
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
 
  const ctx = document.getElementById('price-chart').getContext('2d');
 
  try {
    const res = await fetch(`${BASE_URL}/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${API_KEY}`);
    const data = await res.json();
 
    if (!data || data.s === 'no_data' || !data.c) throw new Error('No chart data');
 
    // Chart stats
    const prices = data.c;
    const high = Math.max(...prices).toFixed(2);
    const low = Math.min(...prices).toFixed(2);
    const start = prices[0].toFixed(2);
    const end = prices[prices.length - 1].toFixed(2);
    const pct = (((prices[prices.length - 1] - prices[0]) / prices[0]) * 100).toFixed(2);
 
    infoEl.innerHTML = `
      <div class="chart-stat"><div class="chart-stat-label">30D HIGH</div><div class="chart-stat-val" style="color:var(--green)">$${high}</div></div>
      <div class="chart-stat"><div class="chart-stat-label">30D LOW</div><div class="chart-stat-val" style="color:var(--red)">$${low}</div></div>
      <div class="chart-stat"><div class="chart-stat-label">START PRICE</div><div class="chart-stat-val">$${start}</div></div>
      <div class="chart-stat"><div class="chart-stat-label">END PRICE</div><div class="chart-stat-val">$${end}</div></div>
      <div class="chart-stat"><div class="chart-stat-label">30D CHANGE</div><div class="chart-stat-val ${parseFloat(pct) >= 0 ? 'change-pos' : 'change-neg'}">${parseFloat(pct) >= 0 ? '+' : ''}${pct}%</div></div>
    `;
 
    const labels = data.t.map(ts =>
      new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );
 
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const tickColor = isDark ? '#5a6a7e' : '#94a3b8';
    const lineColor = parseFloat(pct) >= 0 ? '#00e5a0' : '#ff4d6a';
 
    currentChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: `${symbol} Price`,
          data: prices,
          borderColor: lineColor,
          backgroundColor: `${lineColor}18`,
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: lineColor,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isDark ? '#0d1825' : '#ffffff',
            borderColor: gridColor,
            borderWidth: 1,
            titleColor: isDark ? '#a0aec0' : '#475569',
            bodyColor: isDark ? '#e8edf5' : '#0f172a',
            callbacks: {
              label: ctx => ` $${ctx.raw.toFixed(2)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: tickColor, maxTicksLimit: 8, font: { family: 'DM Sans', size: 11 } },
            border: { color: 'transparent' }
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: tickColor,
              font: { family: 'DM Sans', size: 11 },
              callback: val => `$${val.toFixed(0)}`
            },
            border: { color: 'transparent' }
          }
        }
      }
    });
 
  } catch (e) {
    document.getElementById('price-chart').style.display = 'none';
    infoEl.innerHTML = `<p style="color:var(--muted);font-size:0.9rem">⚠️ Chart data not available. This may be due to API plan limitations.</p>`;
  }
}
 
function closeChart() {
  const section = document.getElementById('chart-section');
  section.classList.add('hidden');
  if (currentChart) { currentChart.destroy(); currentChart = null; }
  document.getElementById('price-chart').style.display = '';
  document.getElementById('chart-info').innerHTML = '';
}
 
// ================== SECTION NAV ==================
function showSection(name) {
  const sections = ['dashboard', 'watchlist', 'settings'];
  sections.forEach(s => {
    const el = document.getElementById(`section-${s}`);
    if (el) el.classList.toggle('hidden', s !== name);
  });
 
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const target = document.querySelector(`.nav-item[onclick*="${name}"]`);
  if (target) target.classList.add('active');
 
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = name.charAt(0).toUpperCase() + name.slice(1);
 
  if (name === 'watchlist') renderWatchlist();
 
  // Close sidebar on mobile after click
  if (window.innerWidth < 900) {
    document.getElementById('sidebar').classList.remove('open');
  }
}
 
// ================== SIDEBAR TOGGLE (mobile) ==================
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}
 
// ================== SETTINGS ACTIONS ==================
function clearWatchlist() {
  if (!confirm('Remove all tracked stocks?')) return;
  trackedStocks = [];
  persistStocks();
  renderStocks([]);
  updateStats([]);
  updateSidebarWatchlist();
  showToast('🗑 Watchlist cleared');
}
 
function resetDefaults() {
  trackedStocks = [
    { symbol: 'AAPL', name: 'Apple Inc.' },
    { symbol: 'TSLA', name: 'Tesla, Inc.' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.' }
  ];
  persistStocks();
  showToast('🔄 Restored defaults — reloading...');
  setTimeout(() => location.reload(), 1000);
}
 
// ================== PERSIST ==================
function persistStocks() {
  localStorage.setItem('trackedStocks', JSON.stringify(trackedStocks));
}
 
// ================== INIT ==================
async function initDashboard() {
  if (!checkAuth()) return;
 
  initTheme();
  setLoading(true);
 
  setInterval(updateClock, 1000);
  updateClock();
 
  // Fetch fresh data for all tracked stocks
  const updated = [];
  for (const stock of trackedStocks) {
    const fresh = await fetchQuote(stock.symbol);
    if (fresh) {
      updated.push({ ...stock, ...fresh });
    } else {
      // Keep stale data with a marker
      updated.push({ ...stock, stale: true });
    }
  }
 
  trackedStocks = updated;
  persistStocks();
  setLoading(false);
 
  renderStocks(trackedStocks);
  updateStats(trackedStocks);
  updateSidebarWatchlist();
}
 
window.onload = initDashboard;