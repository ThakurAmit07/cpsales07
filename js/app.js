// Encoded Supabase Production Configuration
const _ENV_CONFIG = {
  u: "aHR0cHM6Ly9oeHRvd2F0ZmJ4Y2tjYXN3Znd6ay5zdXBhYmFzZS5jby9yZXN0L3Yx",
  k: "ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnBjM01pT2lKemRYQmhZbUZ6WlNJc0luSmxaaUk2SW1oNGRHOTNZWFJtWW5oamEyTmhjM2RtZDNwcklpd2ljbTlzWlNJNkltRnViMjRpTENKcFlYUWlPakUzT0RNNE1qWTJPVEVzSW1WNGNDSTZNakE1T1RRd01qWTVNWDAuNEk1LVRiT0VQTWN0QWlNTEFLUnJ3ZlZyM1h2aFJ0TVRCblotVEF0NnpKaw=="
};

const SUPABASE_REST_URL = (window.__ENV__ && window.__ENV__.SUPABASE_URL) || localStorage.getItem("SUPABASE_URL") || atob(_ENV_CONFIG.u);
const SUPABASE_ANON_KEY = (window.__ENV__ && window.__ENV__.SUPABASE_ANON_KEY) || localStorage.getItem("SUPABASE_ANON_KEY") || atob(_ENV_CONFIG.k);

let allOrders = [];
let allUsers = [];
let allProducts = [];
let allDestinations = [];

let userMap = new Map();
let prodMap = new Map();
let destMap = new Map();

async function fetchFromSupabase(table) {
  const response = await fetch(`${SUPABASE_REST_URL}/${table}?select=*`, {
    method: "GET",
    mode: "cors",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${table}: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

async function fetchSupabaseData() {
  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "flex";

  try {
    const [ordersData, usersData, productsData, destsData] = await Promise.all([
      fetchFromSupabase("orders"),
      fetchFromSupabase("users"),
      fetchFromSupabase("products"),
      fetchFromSupabase("destinations")
    ]);

    allOrders = ordersData || [];
    allUsers = usersData || [];
    allProducts = productsData || [];
    allDestinations = destsData || [];

    // Build fast lookup maps
    userMap.clear();
    allUsers.forEach((u) => userMap.set(String(u.user_id), u));

    prodMap.clear();
    allProducts.forEach((p) => prodMap.set(String(p.prod_id), p));

    destMap.clear();
    allDestinations.forEach((d) => destMap.set(String(d.destination_id), d));

    updateDashboard(allOrders);
    initDefaultDateInput();
    updateLastUpdated();
  } catch (error) {
    console.error("Supabase Sync Error:", error);
    toast("⚠️ Supabase Sync Error: " + error.message);
  } finally {
    if (loader) {
      loader.style.opacity = "0";
      setTimeout(() => {
        loader.style.display = "none";
      }, 200);
    }
  }
}

function updateDashboard(orders, targetDate = null) {
  orders = orders || [];

  const reportDateInput = document.getElementById("reportDate");
  const activeDate = targetDate || (reportDateInput ? reportDateInput.value : "");

  // 1. Total Revenue (Final revenue accumulated up to date / in filter)
  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const revenueElem = document.getElementById("revenue");
  if (revenueElem) revenueElem.innerText = "₹ " + Math.round(totalRevenue).toLocaleString();

  const chartRevenueElem = document.getElementById("chartRevenue");
  if (chartRevenueElem) chartRevenueElem.innerText = "₹ " + Math.round(totalRevenue).toLocaleString();

  // Growth & count badge
  const growthElem = document.getElementById("revenueGrowth");
  const growthBadge = document.getElementById("revenueGrowthBadge");
  if (growthElem) {
    if (orders.length === 0) {
      growthElem.innerText = "0 Orders";
      if (growthBadge) growthBadge.className = "negative";
    } else if (activeDate && activeDate.length === 10 && orders.length < allOrders.length) {
      growthElem.innerText = `Till ${activeDate}`;
      if (growthBadge) growthBadge.className = "positive";
    } else if (orders.length === allOrders.length) {
      growthElem.innerText = "+18.4%";
      if (growthBadge) growthBadge.className = "positive";
    } else {
      growthElem.innerText = `${orders.length} Order${orders.length === 1 ? "" : "s"}`;
      if (growthBadge) growthBadge.className = "positive";
    }
  }

  // 2. Monthly Sales & Prev Month Gap
  let targetMonth = "";
  if (activeDate) {
    targetMonth = activeDate.substring(0, 7);
  } else if (orders.length > 0) {
    const dates = orders.map((o) => o.order_date_time).filter(Boolean).sort();
    targetMonth = dates[dates.length - 1].substring(0, 7);
  }

  let thisMonthRev = 0;
  let prevMonthRev = 0;
  let gapPct = 0;

  if (targetMonth) {
    const monthOrders = allOrders.filter((o) => (o.order_date_time || "").startsWith(targetMonth) && (!activeDate || o.order_date_time <= activeDate));
    thisMonthRev = monthOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);

    const [yearStr, monthStr] = targetMonth.split("-");
    const y = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);
    const prevDate = new Date(y, m - 2, 1);
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

    const prevMonthOrders = allOrders.filter((o) => (o.order_date_time || "").startsWith(prevMonthStr));
    prevMonthRev = prevMonthOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);

    if (prevMonthRev > 0) {
      gapPct = Math.round(((thisMonthRev - prevMonthRev) / prevMonthRev) * 100);
    } else if (thisMonthRev > 0) {
      gapPct = 100;
    } else {
      gapPct = 0;
    }
  }

  const thisMonthElem = document.getElementById("thisMonthRevenue");
  if (thisMonthElem) thisMonthElem.innerText = "₹ " + Math.round(thisMonthRev).toLocaleString();

  const monthGapTitle = document.getElementById("monthGapTitle");
  if (monthGapTitle && targetMonth) {
    const [y, m] = targetMonth.split("-");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthName = monthNames[parseInt(m, 10) - 1] || "";
    monthGapTitle.innerText = `${monthName} ${y} Sales`;
  }

  const monthGapPctElem = document.getElementById("monthGapPct");
  if (monthGapPctElem) monthGapPctElem.innerText = (gapPct >= 0 ? "+" : "") + gapPct + "%";

  const monthGapBadge = document.getElementById("monthGapBadge");
  if (monthGapBadge) {
    monthGapBadge.className = gapPct >= 0 ? "positive" : "negative";
    monthGapBadge.innerHTML = gapPct >= 0
      ? `<i class="fa-solid fa-arrow-trend-up"></i> <span id="monthGapPct">+${gapPct}%</span>`
      : `<i class="fa-solid fa-arrow-trend-down"></i> <span id="monthGapPct">${gapPct}%</span>`;
  }

  const prevMonthRevLabel = document.getElementById("prevMonthRevLabel");
  if (prevMonthRevLabel) {
    prevMonthRevLabel.innerText = `vs Prev Month (₹ ${(prevMonthRev / 1000).toFixed(0)}K)`;
  }

  // 3. Today's / Selected Date Performance
  let performanceDate = "";
  if (activeDate) {
    performanceDate = activeDate;
  } else if (orders.length > 0) {
    const dates = orders.map((o) => o.order_date_time).filter(Boolean).sort();
    performanceDate = dates[dates.length - 1];
  }

  const dateOrdersList = allOrders.filter((o) => o.order_date_time === performanceDate);
  const todayOrdersCount = dateOrdersList.length;
  const todayRevenueSum = dateOrdersList.reduce((sum, o) => sum + Number(o.amount || 0), 0);

  const todayOrdersElem = document.getElementById("todayOrders");
  if (todayOrdersElem) todayOrdersElem.innerText = todayOrdersCount.toLocaleString();

  const todayRevenueElem = document.getElementById("todayRevenue");
  if (todayRevenueElem) todayRevenueElem.innerText = "₹ " + Math.round(todayRevenueSum).toLocaleString();

  // 4. Average Daily Revenue = Total Revenue ÷ Active Selling Days
  const activeSellingDays = new Set(orders.map((o) => o.order_date_time).filter(Boolean)).size;
  const avgDailyRevenue = activeSellingDays > 0 ? Math.round(totalRevenue / activeSellingDays) : (orders.length === 0 ? 0 : Math.round(totalRevenue));
  const avgDailyElem = document.getElementById("avgDailyRevenue");
  if (avgDailyElem) avgDailyElem.innerText = "₹ " + avgDailyRevenue.toLocaleString();

  // Sidebar Stats
  const totalOrdersCount = orders.length;
  const avgOrderValue = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;

  const sidebarAvg = document.getElementById("sidebarAvg");
  if (sidebarAvg) sidebarAvg.innerText = "₹ " + avgOrderValue.toLocaleString();

  const sidebarOrders = document.getElementById("sidebarOrders");
  if (sidebarOrders) sidebarOrders.innerText = totalOrdersCount.toLocaleString();

  // 5. Active Customers = COUNT(DISTINCT user_id)
  const activeCustomersCount = new Set(orders.map((o) => o.user_id)).size;
  const customersElem = document.getElementById("customers");
  if (customersElem) customersElem.innerText = activeCustomersCount.toLocaleString();

  const sidebarCustomers = document.getElementById("sidebarCustomers");
  if (sidebarCustomers) sidebarCustomers.innerText = activeCustomersCount.toLocaleString();

  // Render Visualizations safely
  try { drawRevenueChart(orders); } catch (e) { console.error("Revenue chart error:", e); }
  try { renderDailyLeaderboard(orders, allUsers); } catch (e) { console.error("Leaderboard error:", e); }
  try { renderTopDestinations(orders, allProducts, allDestinations); } catch (e) { console.error("Top dest error:", e); }
  try { updateRecentOrders(orders); } catch (e) { console.error("Recent orders error:", e); }
  try { updateAIInsights(orders); } catch (e) { console.error("AI Insights error:", e); }
}

function updateRecentOrders(orders) {
  const tbody = document.getElementById("tableData");
  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-secondary); padding:28px;"><i class="fa-solid fa-inbox" style="font-size:1.5rem; margin-bottom:8px; display:block;"></i>No orders found for this selected date or filter.</td></tr>`;
    return;
  }

  const recent = orders.slice(-10).reverse();

  tbody.innerHTML = recent
    .map((o) => {
      const u = userMap.get(String(o.user_id));
      const p = prodMap.get(String(o.product_id));
      const customerName = u ? u.name : `Customer #${o.user_id}`;
      const prodName = p ? p.productName || p.addOnId : `Product #${o.product_id}`;

      let destName = "";
      if (p && p.coverageDestinations) {
        const destCode = p.coverageDestinations.split(",")[0].trim();
        const d = destMap.get(destCode);
        destName = d ? d.destination_name : destCode;
      }

      return `
        <tr>
          <td><strong>#${o.order_no}</strong></td>
          <td>${customerName}</td>
          <td><span style="font-size:0.82rem; color: var(--text-secondary);">${prodName} ${destName ? '• ' + destName : ''}</span></td>
          <td><strong style="color: var(--accent);">₹ ${Number(o.amount || 0).toLocaleString()}</strong></td>
          <td>${o.order_date_time || 'N/A'}</td>
        </tr>
      `;
    })
    .join("");
}

function updateAIInsights(orders) {
  const container = document.getElementById("aiInsights");
  if (!container) return;

  if (orders.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 28px; text-align: center; color: var(--text-secondary); background: var(--card-bg); border-radius: 12px; border: 1px dashed var(--border-color);">
        <i class="fa-solid fa-circle-info" style="font-size:1.6rem; margin-bottom:10px; display:block; color: var(--accent);"></i>
        <strong>No Transactions for Selected Date</strong>
        <p style="margin-top:6px; font-size:0.85rem;">Try choosing another date from the date selector or click "All Time" to view full insights.</p>
      </div>
    `;
    return;
  }

  // 1. Top Customer
  let userSpend = {};
  orders.forEach((o) => {
    userSpend[o.user_id] = (userSpend[o.user_id] || 0) + Number(o.amount || 0);
  });
  let topUserId = Object.keys(userSpend).sort((a, b) => userSpend[b] - userSpend[a])[0];
  let topUserObj = userMap.get(String(topUserId));
  let topCustomerName = topUserObj ? topUserObj.name.trim() : `User #${topUserId}`;
  let topCustomerSpend = userSpend[topUserId] || 0;

  // 2. Best Selling Product
  let prodCounts = {};
  orders.forEach((o) => {
    prodCounts[o.product_id] = (prodCounts[o.product_id] || 0) + 1;
  });
  let topProdId = Object.keys(prodCounts).sort((a, b) => prodCounts[b] - prodCounts[a])[0];
  let topProdObj = prodMap.get(String(topProdId));
  let topProdName = topProdObj ? topProdObj.productName || topProdObj.addOnId : `Product #${topProdId}`;
  let topProdOrders = prodCounts[topProdId] || 0;

  // 3. Top Destination
  let destRev = {};
  orders.forEach((o) => {
    let p = prodMap.get(String(o.product_id));
    if (p && p.coverageDestinations) {
      let code = p.coverageDestinations.split(",")[0].trim();
      destRev[code] = (destRev[code] || 0) + Number(o.amount || 0);
    }
  });
  let topDestCode = Object.keys(destRev).sort((a, b) => destRev[b] - destRev[a])[0];
  let topDestObj = destMap.get(topDestCode);
  let topDestName = topDestObj ? topDestObj.destination_name : (topDestCode || "Global");
  let topDestRevenue = destRev[topDestCode] || 0;

  // 4. Highest Revenue Day
  let dateRev = {};
  orders.forEach((o) => {
    if (o.order_date_time) {
      dateRev[o.order_date_time] = (dateRev[o.order_date_time] || 0) + Number(o.amount || 0);
    }
  });
  let peakDate = Object.keys(dateRev).sort((a, b) => dateRev[b] - dateRev[a])[0];
  let peakRevenue = dateRev[peakDate] || 0;

  // 5. Total & Avg Order Value
  const totalRev = orders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const avgOrderVal = Math.round(totalRev / orders.length);

  // 6. Peak Month
  let monthly = {};
  orders.forEach((o) => {
    let m = (o.order_date_time || "").substring(0, 7);
    if (m) monthly[m] = (monthly[m] || 0) + Number(o.amount || 0);
  });
  let peakMonth = Object.keys(monthly).sort((a, b) => monthly[b] - monthly[a])[0] || "N/A";
  let peakMonthRevenue = monthly[peakMonth] || 0;

  container.innerHTML = `
    <div class="insight customer">
      <small>👤 Top Customer</small>
      <h3>${topCustomerName}</h3>
      <p>Purchases: ₹ ${Math.round(topCustomerSpend).toLocaleString()}</p>
      <span class="mini-tag">VIP Spender</span>
    </div>

    <div class="insight product">
      <small>📦 Best Selling Product</small>
      <h3>${topProdName.length > 25 ? topProdName.substring(0,22) + "..." : topProdName}</h3>
      <p>${topProdOrders} total orders</p>
      <span class="mini-tag success">Top Seller</span>
    </div>

    <div class="insight destination">
      <small>🌍 Top Destination</small>
      <h3>${topDestName}</h3>
      <p>Revenue: ₹ ${Math.round(topDestRevenue).toLocaleString()}</p>
      <span class="mini-tag">Peak Market</span>
    </div>

    <div class="insight revenue">
      <small>💰 Record Sales Day</small>
      <h3>${peakDate}</h3>
      <p>Peak Sales: ₹ ${Math.round(peakRevenue).toLocaleString()}</p>
      <span class="mini-tag success">Record Day</span>
    </div>

    <div class="insight average">
      <small>⚡ Avg Order Value</small>
      <h3>₹ ${avgOrderVal.toLocaleString()}</h3>
      <p>Per transaction average</p>
      <span class="mini-tag">AOV Metric</span>
    </div>

    <div class="insight month">
      <small>📈 Peak Sales Month</small>
      <h3>${peakMonth}</h3>
      <p>Gross: ₹ ${Math.round(peakMonthRevenue).toLocaleString()}</p>
      <span class="mini-tag success">Best Month</span>
    </div>
  `;
}

// Live Search logic
const searchInput = document.getElementById("searchInput");
if (searchInput) {
  searchInput.addEventListener("input", function () {
    const query = this.value.trim().toLowerCase();

    const filtered = allOrders.filter((order) => {
      const user = userMap.get(String(order.user_id));
      const prod = prodMap.get(String(order.product_id));
      const customerName = user ? user.name.toLowerCase() : "";
      const productName = prod ? (prod.productName || prod.addOnId || "").toLowerCase() : "";
      const orderNo = String(order.order_no).toLowerCase();
      const date = String(order.order_date_time || "").toLowerCase();

      let destName = "";
      if (prod && prod.coverageDestinations) {
        const code = prod.coverageDestinations.split(",")[0].trim().toLowerCase();
        const d = destMap.get(code.toUpperCase());
        destName = (d ? d.destination_name : code).toLowerCase();
      }

      return (
        orderNo.includes(query) ||
        customerName.includes(query) ||
        productName.includes(query) ||
        destName.includes(query) ||
        date.includes(query)
      );
    });

    updateDashboard(filtered);
  });
}

// Time Filters logic
function applyTimeFilter(filterType) {
  if (filterType === "all") {
    updateDashboard(allOrders);
    return;
  }

  if (allOrders.length === 0) return;

  const dates = allOrders.map((o) => o.order_date_time).filter(Boolean).sort();
  const maxDateStr = dates[dates.length - 1]; // Latest date in DB
  const refDate = new Date(maxDateStr);

  let startDate = new Date(refDate);

  if (filterType === "7days") {
    startDate.setDate(startDate.getDate() - 6);
  } else if (filterType === "1month") {
    startDate.setMonth(startDate.getMonth() - 1);
  } else if (filterType === "1year") {
    startDate.setFullYear(startDate.getFullYear() - 1);
  }

  const startStr = startDate.toISOString().split("T")[0];
  const filtered = allOrders.filter((o) => o.order_date_time >= startStr && o.order_date_time <= maxDateStr);
  updateDashboard(filtered);
}

document.querySelectorAll(".filter-btn").forEach((button) => {
  button.addEventListener("click", function () {
    document.querySelectorAll(".filter-btn").forEach((btn) => btn.classList.remove("active"));
    this.classList.add("active");
    applyTimeFilter(this.dataset.filter);
  });
});

function applyDateFilter() {
  const reportDateInput = document.getElementById("reportDate");
  let selectedDate = reportDateInput ? reportDateInput.value : "";

  // If input is empty, fallback to actual current local date
  if (!selectedDate) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthNum = String(now.getMonth() + 1).padStart(2, "0");
    const currentDayNum = String(now.getDate()).padStart(2, "0");
    selectedDate = `${currentYear}-${currentMonthNum}-${currentDayNum}`;
    if (reportDateInput) reportDateInput.value = selectedDate;
  }

  // Cumulative orders up to selected date ("tab tak kitna final revenue hai")
  const filtered = allOrders.filter((o) => o.order_date_time <= selectedDate);
  const dayOrders = allOrders.filter((o) => o.order_date_time === selectedDate);

  document.querySelectorAll(".filter-btn").forEach((btn) => btn.classList.remove("active"));
  updateDashboard(filtered, selectedDate);
  toast(`📅 Filter applied till ${selectedDate} (${filtered.length} total orders, ${dayOrders.length} on date)`);
}

const applyDateBtn = document.getElementById("applyDate");
if (applyDateBtn) {
  applyDateBtn.addEventListener("click", applyDateFilter);
}

const reportDateInput = document.getElementById("reportDate");
if (reportDateInput) {
  reportDateInput.addEventListener("change", applyDateFilter);
  reportDateInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      applyDateFilter();
    }
  });
}

// Refresh button handler
const refreshBtn = document.getElementById("refreshBtn");
if (refreshBtn) {
  refreshBtn.addEventListener("click", async function () {
    this.disabled = true;
    this.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Refreshing...';

    try {
      await fetchSupabaseData();
      toast("⚡ Dashboard synchronized with Live Supabase!");
    } finally {
      this.disabled = false;
      this.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Refresh';
    }
  });
}

// View All Button
const viewAllBtn = document.getElementById("viewAllBtn");
if (viewAllBtn) {
  viewAllBtn.addEventListener("click", function () {
    document.getElementById("searchInput").value = "";
    document.getElementById("reportDate").value = "";
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.filter === "all");
    });
    updateDashboard(allOrders);
  });
}

// Navigation logic
const dashboardBtn = document.getElementById("dashboardBtn");
const analyticsBtn = document.getElementById("analyticsBtn");

function setActivePage(page) {
  const isAnalytics = page === "analytics";
  if (dashboardBtn) dashboardBtn.classList.toggle("active", !isAnalytics);
  if (analyticsBtn) analyticsBtn.classList.toggle("active", isAnalytics);
  
  const dPage = document.getElementById("dashboardPage");
  const aPage = document.getElementById("analyticsPage");
  if (dPage) dPage.style.display = isAnalytics ? "none" : "block";
  if (aPage) aPage.style.display = isAnalytics ? "block" : "none";

  if (isAnalytics) {
    const totalRev = allOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
    const totalOrdersCount = allOrders.length;
    const totalUsersCount = allUsers.length;

    const distinctActive = new Set(allOrders.map((o) => o.user_id)).size;
    const ratioPct = totalUsersCount > 0 ? ((distinctActive / totalUsersCount) * 100).toFixed(1) : "0";

    const aRev = document.getElementById("analyticsRevenue");
    if (aRev) aRev.innerText = "₹ " + Math.round(totalRev).toLocaleString();

    const aOrders = document.getElementById("analyticsOrders");
    if (aOrders) aOrders.innerText = totalOrdersCount.toLocaleString();

    const aCust = document.getElementById("analyticsCustomers");
    if (aCust) aCust.innerText = totalUsersCount.toLocaleString();

    const aRatio = document.getElementById("analyticsRatio");
    if (aRatio) aRatio.innerText = ratioPct + "%";

    try { drawAnalyticsRevenueChart(allOrders); } catch(e) {}
    try { drawCustomerChart(allOrders, allUsers); } catch(e) {}
    try { drawSIMModeChart(allOrders, allProducts); } catch(e) {}
    try { drawAnalyticsDestChart(allOrders, allProducts, allDestinations); } catch(e) {}
  }
}

if (analyticsBtn) {
  analyticsBtn.addEventListener("click", function () {
    setActivePage("analytics");
  });
}

if (dashboardBtn) {
  dashboardBtn.addEventListener("click", function () {
    setActivePage("dashboard");
  });
}

// Theme Toggle
const themeBtn = document.getElementById("themeToggle");
function setTheme(theme) {
  const isLight = theme === "light";
  document.body.classList.toggle("light", isLight);
  document.body.classList.toggle("dark", !isLight);
  localStorage.setItem("theme", theme);
  refreshChartTheme();

  if (themeBtn) {
    themeBtn.innerHTML = isLight ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
  }
}

if (themeBtn) {
  themeBtn.addEventListener("click", function () {
    const currentTheme = document.body.classList.contains("light") ? "dark" : "light";
    setTheme(currentTheme);
  });
}

if (localStorage.getItem("theme") === "light") {
  setTheme("light");
}

// Notification Dropdown
const bell = document.getElementById("notificationBtn");
const dropdown = document.getElementById("notificationDropdown");
if (bell && dropdown) {
  bell.onclick = function (e) {
    e.stopPropagation();
    const isOpen = dropdown.style.display === "block";
    dropdown.style.display = isOpen ? "none" : "block";
    bell.setAttribute("aria-expanded", String(!isOpen));
  };
  document.addEventListener("click", function () {
    dropdown.style.display = "none";
  });
}

// Single Main Export CSV Function
function handleExportCSV() {
  let csv = "Order No,Customer,Product,Amount,Date\n";
  allOrders.forEach((o) => {
    const u = userMap.get(String(o.user_id));
    const p = prodMap.get(String(o.product_id));
    const custName = u ? u.name.replace(/,/g, "") : "";
    const prodName = p ? (p.productName || p.addOnId).replace(/,/g, "") : "";
    csv += `${o.order_no},${custName},${prodName},${o.amount},${o.order_date_time}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Amit_Live_Report.csv";
  a.click();
  toast("CSV Exported Successfully ✅");
}

const topExportCSVBtn = document.getElementById("topExportCSV");
if (topExportCSVBtn) {
  topExportCSVBtn.addEventListener("click", handleExportCSV);
}

// Live Digital Watch ticking every second
function updateDigitalWatch() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const liveWatch = document.getElementById("liveDigitalWatch");
  if (liveWatch) liveWatch.innerText = timeStr;

  const todayDate = document.getElementById("todayDate");
  if (todayDate) todayDate.innerText = dateStr;
}

function initDefaultDateInput() {
  const reportDateInput = document.getElementById("reportDate");
  if (reportDateInput && !reportDateInput.value) {
    const now = new Date();
    const realTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    reportDateInput.value = realTodayStr;
  }
}

function updateLastUpdated() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString();
  const lastUpdated = document.getElementById("lastUpdated");
  if (lastUpdated) lastUpdated.innerText = `Updated: ${timeStr} (Live Sync)`;
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// Ticking clock interval
setInterval(updateDigitalWatch, 1000);
updateDigitalWatch();
initDefaultDateInput();

// Run immediately
fetchSupabaseData();
