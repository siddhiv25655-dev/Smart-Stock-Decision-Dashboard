// ================== CONFIG ==================
const API_KEY = "KTH0WVVAGU10V49P";   // ←←← GET FREE KEY: https://finnhub.io/register
const BASE_URL = 'https://finnhub.io/api/v1';

// Global variables
let trackedStocks = JSON.parse(localStorage.getItem('trackedStocks')) || [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'TSLA', name: 'Tesla, Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' }
];
let currentChart = null;

// Check if logged in
function checkAuth() {
  const user = localStorage.getItem('currentUser');
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  const { name } = JSON.parse(user);
  document.getElementById('user-info').innerHTML = `
    <span class="text-lg font-medium">👋 ${name}</span>
  `;
  return true;
}

// Fetch stock quote
async function fetchQuote(symbol) {
  const loading = document.getElementById('stocks-grid');
  if (loading) loading.classList.add('loading');

  try {
    const res = await fetch(`${BASE_URL}/quote?symbol=${symbol}&token=${API_KEY}`);
    if (!res.ok) throw new Error('Invalid symbol or API limit');
    const data = await res.json();

    if (data.c === 0) throw new Error('Invalid symbol');

    return {
      symbol: symbol.toUpperCase(),
      price: data.c.toFixed(2),
      change: data.d.toFixed(2),
      changePercent: data.dp.toFixed(2),
      trend: data.dp > 0.5 ? '🟢 Bullish' : data.dp < -0.5 ? '🔴 Bearish' : '🟡 Stable'
    };
  } catch (err) {
    console.error(err);
    return null;
  } finally {
    if (loading) loading.classList.remove('loading');
  }
}

// Render stock cards using map + filter
// Render stock cards using map + filter (PURE CSS - No Tailwind)
function renderStocks(stocks) {
  const container = document.getElementById('stocks-grid');
  
  container.innerHTML = stocks.map(stock => `
    <div onclick="showChart('${stock.symbol}')" class="stock-card">
      <div class="stock-card-content">
        <div class="stock-left">
          <h3>${stock.symbol}</h3>
          <p class="stock-name">${stock.name || stock.symbol}</p>
        </div>
        <div class="stock-right">
          <p class="stock-price">$${stock.price}</p>
          <p class="stock-change ${parseFloat(stock.changePercent) >= 0 ? 'change-positive' : 'change-negative'}">
            ${parseFloat(stock.changePercent) >= 0 ? '+' : ''}${stock.changePercent}%
          </p>
          <p class="stock-trend">${stock.trend}</p>
        </div>
      </div>
    </div>
  `).join('');

  if (stocks.length === 0) {
    container.innerHTML = `<p class="no-results">No stocks match your filters</p>`;
  }
}

// Search new stock
async function searchStock() {
  const input = document.getElementById('search-input').value.trim().toUpperCase();
  if (!input) return;

  const data = await fetchQuote(input);
  if (!data) {
    alert('❌ Stock not found or API error');
    return;
  }

  // Add to tracked if not already present
  if (!trackedStocks.find(s => s.symbol === data.symbol)) {
    trackedStocks.unshift({ symbol: data.symbol, name: data.symbol, ...data });
    localStorage.setItem('trackedStocks', JSON.stringify(trackedStocks));
  }

  renderStocks(trackedStocks);
  document.getElementById('search-input').value = '';
}

// Apply filters using HOFs
function applyFilters() {
  let filtered = [...trackedStocks];

  const minPrice = parseFloat(document.getElementById('min-price').value) || 0;
  const maxPrice = parseFloat(document.getElementById('max-price').value) || Infinity;
  const performance = document.getElementById('performance-filter').value;

  filtered = filtered.filter(stock => {
    const price = parseFloat(stock.price);
    const gain = parseFloat(stock.changePercent) > 0;

    if (price < minPrice || price > maxPrice) return false;
    if (performance === 'gain' && !gain) return false;
    if (performance === 'loss' && gain) return false;
    return true;
  });

  renderStocks(filtered);
}

// Sort using HOF
function sortStocks(type) {
  let sorted = [...trackedStocks];
  if (type === 'price') {
    sorted.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
  } else if (type === 'change') {
    sorted.sort((a, b) => parseFloat(b.changePercent) - parseFloat(a.changePercent));
  }
  renderStocks(sorted);
}

// Show chart (30-day daily candles)
async function showChart(symbol) {
  const section = document.getElementById('chart-section');
  document.getElementById('chart-symbol').textContent = `${symbol} - 30 Day Trend`;

  section.classList.remove('hidden');
  section.scrollIntoView({ behavior: 'smooth' });

  // Clear old chart
  if (currentChart) currentChart.destroy();

  const ctx = document.getElementById('price-chart');

  // Get last 30 days
  const to = Math.floor(Date.now() / 1000);
  const from = to - (30 * 24 * 60 * 60);

  try {
    const res = await fetch(`${BASE_URL}/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${API_KEY}`);
    const data = await res.json();

    if (data.s === 'no_data') throw new Error();

    currentChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.t.map(ts => new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        datasets: [{
          label: 'Closing Price',
          data: data.c,
          borderColor: '#3b82f6',
          tension: 0.3,
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { grid: { color: '#e5e7eb' } } }
      }
    });
  } catch (e) {
    ctx.innerHTML = `<p class="text-red-500 text-center py-12">Chart data not available right now</p>`;
  }
}

// Logout
function logout() {
  localStorage.removeItem('currentUser');
  window.location.href = 'login.html';
}

// Theme toggle
// Theme Toggle - FIXED
function initTheme() {
  const toggleBtn = document.getElementById('theme-toggle');
  let isDark = localStorage.getItem('theme') === 'dark';

  // Apply saved theme on load
  if (isDark) {
    document.documentElement.classList.add('dark');
  }

  // Set initial icon
  toggleBtn.textContent = isDark ? '☀️' : '🌙';

  // Click handler
  toggleBtn.addEventListener('click', () => {
    isDark = !isDark;
    
    if (isDark) {
      document.documentElement.classList.add('dark');
      toggleBtn.textContent = '☀️';
    } else {
      document.documentElement.classList.remove('dark');
      toggleBtn.textContent = '🌙';
    }

    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });
}

// Initialize Dashboard
async function initDashboard() {
  if (!checkAuth()) return;

  initTheme();

  // Fetch latest data for all tracked stocks
  const updatedStocks = [];
  for (const stock of trackedStocks) {
    const fresh = await fetchQuote(stock.symbol);
    if (fresh) updatedStocks.push({ ...stock, ...fresh });
    else updatedStocks.push(stock); // keep old data if API fails
  }

  trackedStocks = updatedStocks;
  localStorage.setItem('trackedStocks', JSON.stringify(trackedStocks));

  renderStocks(trackedStocks);
}

// Run on load
window.onload = initDashboard;