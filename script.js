// Protect dashboard
if (localStorage.getItem("loggedIn") !== "true") {
  window.location.href = "index.html";
}

const API_KEY = "QXTHLO2TLM7VTCXV";

// Search
function searchStock() {
  const symbol = document.getElementById("symbol").value.toUpperCase();
  getStock(symbol);
}

// Fetch stock
function getStock(symbol) {
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      const stock = data["Global Quote"];

      if (!stock || Object.keys(stock).length === 0) {
        alert("No data found ❌");
        return;
      }

      const price = stock["05. price"];
      const changeStr = stock["10. change percent"];
      const change = parseFloat(changeStr);

      let trend = "";
      let color = "";

      if (change > 0) {
        trend = "🟢 Bullish";
        color = "green";
      } else if (change < 0) {
        trend = "🔴 Bearish";
        color = "red";
      } else {
        trend = "🟡 Stable";
        color = "orange";
      }

      document.getElementById("price").innerText = price;
      document.getElementById("change").innerText = changeStr;

      const trendEl = document.getElementById("trend");
      trendEl.innerText = trend;
      trendEl.style.color = color;

      drawChart(parseFloat(price));
    })
    .catch(err => {
      console.error(err);
      alert("Error fetching data ⚠️");
    });
}

// Chart
let chart;

function drawChart(price) {
  const ctx = document.getElementById("stockChart");

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: ["1", "2", "3", "4", "5"],
      datasets: [{
        label: "Stock Price",
        data: [
          price - 5,
          price - 2,
          price,
          price + 2,
          price + 5
        ]
      }]
    }
  });
}

// Theme toggle
function toggleTheme() {
  const body = document.body;

  if (body.classList.contains("light")) {
    body.classList.replace("light", "dark");
    localStorage.setItem("theme", "dark");
  } else {
    body.classList.replace("dark", "light");
    localStorage.setItem("theme", "light");
  }
}

// Logout
function logout() {
  localStorage.removeItem("loggedIn");
  window.location.href = "index.html";
}

// Apply saved theme
window.onload = function () {
  const theme = localStorage.getItem("theme") || "light";
  document.body.className = theme;
};