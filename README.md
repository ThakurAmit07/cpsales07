# Amit Sales & Executive BI Dashboard

A high-performance, real-time Business Intelligence and Sales Performance Executive Dashboard integrated directly with Supabase Live API backend.

## 🚀 Features

- **Live Supabase Integration**: Real-time synchronization of Orders, Users, Products, and Destinations.
- **Dynamic Date & Time Filtering**:
  - Filter by date range (7 Days, 1 Month, 1 Year, All Time) or pick any specific target date.
  - Cumulative As-of-Date Revenue tracking ("final revenue till selected date").
  - Isolated single-day performance and month-to-date analysis.
- **Interactive Visualizations**:
  - Revenue trends & Daily/Monthly charts with Chart.js.
  - Top Destinations & Country ranking breakdown with live flags.
  - Daily Leaderboard with ARPU and target progress bars.
- **Export & Tools**:
  - Instant CSV Live Report Export.
  - Quick Search across Orders, Customers, Products, and Countries.
  - Dark / Light Theme switching.
- **Responsive & Modern UI**: Built with modern CSS custom properties, glassmorphism, and FontAwesome icons.

## 🛠️ Tech Stack

- **Frontend**: HTML5, Vanilla JavaScript (ES6+), Modern CSS3
- **Data & Backend**: Supabase REST API
- **Charts**: Chart.js

## 💻 Getting Started

To run the dashboard locally:

```bash
# Using Python
python3 -m http.server 8080

# Or open index.html directly in any modern browser
```
Then visit `http://localhost:8080` in your web browser.
