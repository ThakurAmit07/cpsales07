let revenueChart = null;
let monthlyRevenueChart = null;
let productChart = null;
let analyticsRevenueChart = null;
let customerChart = null;
let simModeChart = null;
let analyticsDestChart = null;

const countryMap = {
  TH: "🇹🇭 TH",
  THA: "🇹🇭 Thailand",
  US: "🇺🇸 US",
  USA: "🇺🇸 USA",
  JP: "🇯🇵 Japan",
  JPN: "🇯🇵 Japan",
  GB: "🇬🇧 UK",
  GBR: "🇬🇧 UK",
  IN: "🇮🇳 India",
  IND: "🇮🇳 India",
  SG: "🇸🇬 Singapore",
  SGP: "🇸🇬 Singapore",
  AE: "🇦🇪 UAE",
  ARE: "🇦🇪 UAE",
  AU: "🇦🇺 Australia",
  AUS: "🇦🇺 Australia",
  MY: "🇲🇾 Malaysia",
  MYS: "🇲🇾 Malaysia",
  KR: "🇰🇷 Korea",
  KOR: "🇰🇷 Korea",
  HK: "🇭🇰 Hong Kong",
  HKG: "🇭🇰 Hong Kong",
  VN: "🇻🇳 Vietnam",
  VNM: "🇻🇳 Vietnam",
  TR: "🇹🇷 Turkey",
  TUR: "🇹🇷 Turkey",
  CN: "🇨🇳 China",
  CHN: "🇨🇳 China",
  LK: "🇱🇰 Sri Lanka",
  LKA: "🇱🇰 Sri Lanka",
  ID: "🇮🇩 Indonesia",
  IDN: "🇮🇩 Indonesia",
  AT: "🇦🇹 Austria",
  AUT: "🇦🇹 Austria",
  AD: "🇦🇩 Andorra",
  AND: "🇦🇩 Andorra",
  ES: "🇪🇸 Spain",
  ESP: "🇪🇸 Spain",
  FR: "🇫🇷 France",
  FRA: "🇫🇷 France",
  DE: "🇩🇪 Germany",
  DEU: "🇩🇪 Germany",
  IT: "🇮🇹 Italy",
  ITA: "🇮🇹 Italy",
};

function getProductFlag(code) {
  code = String(code || "").toUpperCase();

  if (code.includes("TH")) return "🇹🇭";
  if (code.includes("US")) return "🇺🇸";
  if (code.includes("GB") || code.includes("UK")) return "🇬🇧";
  if (code.includes("JP")) return "🇯🇵";
  if (code.includes("IN")) return "🇮🇳";
  if (code.includes("SG")) return "🇸🇬";
  if (code.includes("AE")) return "🇦🇪";
  if (code.includes("VN")) return "🇻🇳";
  if (code.includes("LK")) return "🇱🇰";
  if (code.includes("AT")) return "🇦🇹";

  return "🌐";
}

function getChartThemeColors() {
  const isLight = document.body.classList.contains("light");
  return {
    text: isLight ? "#0f172a" : "#ffffff",
    grid: isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.06)",
  };
}

function refreshChartTheme() {
  const { text, grid } = getChartThemeColors();

  [revenueChart, monthlyRevenueChart, productChart, analyticsRevenueChart, customerChart, simModeChart, analyticsDestChart]
    .filter(Boolean)
    .forEach((chart) => {
      if (chart.options.scales) {
        Object.entries(chart.options.scales).forEach(([axis, scale]) => {
          if (scale.ticks) scale.ticks.color = text;
          if (scale.grid && scale.grid.display !== false) scale.grid.color = grid;
        });
      }

      if (chart.options.plugins?.legend?.labels) {
        chart.options.plugins.legend.labels.color = text;
      }

      chart.update();
    });
}

function renderDailyLeaderboard(orders, users) {
  const tbody = document.getElementById("leaderboardData");
  if (!tbody) return;

  if (!orders || orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-secondary); padding:24px;">No leaderboard records for this selection.</td></tr>`;
    return;
  }

  let userMap = new Map();
  (users || []).forEach((u) => userMap.set(String(u.user_id), u));

  let salesByUser = {};
  orders.forEach((o) => {
    let uid = String(o.created_by || o.user_id);
    if (!salesByUser[uid]) {
      salesByUser[uid] = { orders: 0, revenue: 0 };
    }
    salesByUser[uid].orders++;
    salesByUser[uid].revenue += Number(o.amount || 0);
  });

  let leaderboard = Object.keys(salesByUser)
    .map((uid) => {
      let u = userMap.get(uid);
      let rev = salesByUser[uid].revenue;
      let count = salesByUser[uid].orders;
      let arpu = Math.round(rev / (count || 1));
      let target = 250;
      let progress = Math.min(Math.round((count / target) * 100), 100);
      return {
        name: u ? u.name.trim() : `User #${uid}`,
        orders: count,
        revenue: Math.round(rev),
        arpu: arpu,
        progress: progress,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  tbody.innerHTML = leaderboard
    .map((item, idx) => {
      let rankClass = idx === 0 ? "top-1" : idx === 1 ? "top-2" : idx === 2 ? "top-3" : "top-normal";
      return `
        <tr>
          <td><span class="rank-badge ${rankClass}">${idx + 1}</span></td>
          <td class="leader-name">${item.name}</td>
          <td><strong>${item.orders}</strong></td>
          <td><strong style="color: var(--accent);">₹ ${(item.revenue / 1000).toFixed(1)}K</strong></td>
          <td>₹ ${item.arpu}</td>
          <td>
            <div class="table-progress-container">
              <div class="table-progress-bar">
                <div class="table-progress-fill" style="width: ${item.progress}%"></div>
              </div>
              <span class="progress-label">${item.progress}%</span>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function drawRevenueChart(orders) {
  let revenueByDate = {};

  orders.forEach((o) => {
    let date = o.order_date_time;
    let amount = Number(o.amount || 0);
    revenueByDate[date] = (revenueByDate[date] || 0) + amount;
  });

  let labels = Object.keys(revenueByDate).sort();
  let dataPoints = labels.map((d) => Math.round(revenueByDate[d]));

  const ctx = document.getElementById("revenueChart").getContext("2d");

  if (revenueChart) {
    revenueChart.destroy();
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, 330);
  gradient.addColorStop(0, "rgba(79, 140, 255, 0.45)");
  gradient.addColorStop(0.5, "rgba(79, 140, 255, 0.12)");
  gradient.addColorStop(1, "rgba(79, 140, 255, 0)");

  const theme = getChartThemeColors();

  revenueChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Daily Revenue (₹)",
          data: dataPoints,
          borderColor: "#4F8CFF",
          backgroundColor: gradient,
          pointRadius: 4,
          pointHoverRadius: 8,
          pointBackgroundColor: "#4F8CFF",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
          fill: true,
          tension: 0.4,
          borderWidth: 3.5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: "index",
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#181a26",
          titleColor: "#ffffff",
          bodyColor: "#ffffff",
          borderColor: "#4F8CFF",
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: function (context) {
              return ` Revenue: ₹ ${context.parsed.y.toLocaleString()}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: theme.text, maxTicksLimit: 12, font: { size: 12 } },
          grid: { display: false },
        },
        y: {
          ticks: {
            color: theme.text,
            font: { size: 12 },
            callback: (val) => "₹" + val.toLocaleString(),
          },
          grid: { color: theme.grid },
        },
      },
    },
  });
}

function renderTopDestinations(orders, products, destinations) {
  const container = document.getElementById("topDestinationsList");
  if (!container) return;

  if (!orders || orders.length === 0) {
    container.innerHTML = `<p style="color:var(--text-secondary); padding:20px; text-align:center;">No destination data for this selection.</p>`;
    const badge = document.getElementById("destCountBadge");
    if (badge) badge.innerHTML = `<i class="fa-solid fa-earth-americas"></i> 0 Countries`;
    const subhead = document.getElementById("destinationsSubhead");
    if (subhead) subhead.innerText = `0 countries in selected period`;
    return;
  }

  let prodMap = new Map();
  (products || []).forEach((p) => prodMap.set(String(p.prod_id), p));

  let destMap = new Map();
  (destinations || []).forEach((d) => destMap.set(String(d.destination_id), d));

  let destRevenue = {};
  orders.forEach((o) => {
    let p = prodMap.get(String(o.product_id));
    if (p && p.coverageDestinations) {
      let codes = p.coverageDestinations.split(",");
      codes.forEach((c) => {
        let code = c.trim();
        destRevenue[code] = (destRevenue[code] || 0) + Number(o.amount || 0);
      });
    }
  });

  let sorted = Object.entries(destRevenue)
    .map(([code, rev]) => {
      let d = destMap.get(code) || {};
      let name = d.destination_name || countryMap[code] || code;
      let flag = d.flag_path || "https://flagcdn.com/w320/un.png";
      return { code, name, flag, revenue: rev };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const badge = document.getElementById("destCountBadge");
  if (badge) badge.innerHTML = `<i class="fa-solid fa-earth-americas"></i> ${sorted.length} Countries`;

  const subhead = document.getElementById("destinationsSubhead");
  if (subhead) subhead.innerText = `All ${sorted.length} countries ranked by revenue sales`;

  let maxRevenue = sorted.length ? sorted[0].revenue : 1;

  container.innerHTML = sorted
    .map((item) => {
      let pct = Math.max(Math.round((item.revenue / maxRevenue) * 100), 2);
      return `
        <div class="dest-row">
          <img src="${item.flag}" class="dest-flag" alt="${item.name}" onerror="this.src='https://flagcdn.com/w320/un.png'" />
          <div class="dest-info">
            <div class="dest-header">
              <span class="dest-name">${item.name}</span>
              <span class="dest-amount">₹ ${Math.round(item.revenue).toLocaleString()}</span>
            </div>
            <div class="dest-progress-bar">
              <div class="dest-progress-fill" style="width: ${pct}%"></div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function drawAnalyticsRevenueChart(orders) {
  let monthly = {};
  orders.forEach((o) => {
    let m = (o.order_date_time || "").substring(0, 7);
    if (m) monthly[m] = (monthly[m] || 0) + Number(o.amount || 0);
  });

  const ctx = document.getElementById("analyticsRevenueChart").getContext("2d");
  if (analyticsRevenueChart) analyticsRevenueChart.destroy();

  const theme = getChartThemeColors();

  analyticsRevenueChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: Object.keys(monthly).sort(),
      datasets: [
        {
          label: "Monthly Revenue",
          data: Object.keys(monthly).sort().map((m) => Math.round(monthly[m])),
          borderColor: "#4F8CFF",
          backgroundColor: "rgba(79, 140, 255, 0.2)",
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: theme.text }, grid: { display: false } },
        y: { ticks: { color: theme.text, callback: (v) => "₹" + v.toLocaleString() }, grid: { color: theme.grid } },
      },
    },
  });
}

function drawCustomerChart(orders, users) {
  let spend = {};
  orders.forEach((o) => {
    spend[o.user_id] = (spend[o.user_id] || 0) + Number(o.amount || 0);
  });

  let userMap = new Map();
  (users || []).forEach((u) => userMap.set(String(u.user_id), u));

  let data = Object.keys(spend).map((uid) => {
    let u = userMap.get(uid);
    return {
      name: u ? u.name.trim() : `User #${uid}`,
      amount: spend[uid],
    };
  });

  data.sort((a, b) => b.amount - a.amount);
  data = data.slice(0, 6);

  const ctx = document.getElementById("customerChart").getContext("2d");
  if (customerChart) customerChart.destroy();

  const theme = getChartThemeColors();

  customerChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.map((x) => x.name),
      datasets: [
        {
          label: "Total Spend (₹)",
          data: data.map((x) => Math.round(x.amount)),
          backgroundColor: "#8B5CF6",
          borderRadius: 8,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: theme.text }, grid: { color: theme.grid } },
        y: { ticks: { color: theme.text, font: { weight: "500" } }, grid: { display: false } },
      },
    },
  });
}

function drawSIMModeChart(orders, products) {
  const ctx = document.getElementById("simModeChart");
  if (!ctx) return;

  let prodMap = new Map();
  (products || []).forEach((p) => prodMap.set(String(p.prod_id), p));

  let esim = 0, plastic = 0;
  orders.forEach((o) => {
    let p = prodMap.get(String(o.product_id));
    if (p && (p.simMode === 2 || (p.productName || "").toLowerCase().includes("esim"))) {
      esim++;
    } else {
      plastic++;
    }
  });

  if (simModeChart) simModeChart.destroy();

  const theme = getChartThemeColors();

  simModeChart = new Chart(ctx.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: [`eSIM Digital (${esim} Orders)`, `Plastic SIM (${plastic} Orders)`],
      datasets: [
        {
          data: [esim, plastic],
          backgroundColor: ["#4F8CFF", "#10B981"],
          borderWidth: 2,
          borderColor: "#181a26",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: theme.text, font: { size: 12 } },
        },
      },
    },
  });
}

function drawAnalyticsDestChart(orders, products, destinations) {
  const ctx = document.getElementById("analyticsDestChart");
  if (!ctx) return;

  let prodMap = new Map();
  (products || []).forEach((p) => prodMap.set(String(p.prod_id), p));

  let destMap = new Map();
  (destinations || []).forEach((d) => destMap.set(String(d.destination_id), d));

  let destRev = {};
  orders.forEach((o) => {
    let p = prodMap.get(String(o.product_id));
    if (p && p.coverageDestinations) {
      let code = p.coverageDestinations.split(",")[0].trim();
      destRev[code] = (destRev[code] || 0) + Number(o.amount || 0);
    }
  });

  let top7 = Object.entries(destRev)
    .map(([code, rev]) => {
      let d = destMap.get(code) || {};
      return {
        name: d.destination_name || code,
        revenue: Math.round(rev),
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 7);

  if (analyticsDestChart) analyticsDestChart.destroy();

  const theme = getChartThemeColors();

  analyticsDestChart = new Chart(ctx.getContext("2d"), {
    type: "bar",
    data: {
      labels: top7.map((x) => x.name),
      datasets: [
        {
          label: "Revenue (₹)",
          data: top7.map((x) => x.revenue),
          backgroundColor: "#F59E0B",
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: theme.text }, grid: { display: false } },
        y: { ticks: { color: theme.text, callback: (v) => "₹" + v.toLocaleString() }, grid: { color: theme.grid } },
      },
    },
  });
}
