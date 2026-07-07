/* ========================================
   🟣 TÍM GO v2.0 — Professional Edition
   Hệ thống quản lý tài xế chuyên nghiệp
   ======================================== */

import './style.css';
import {
  initSupabase, isSupabaseOnline, loadAllData, hashPassword, verifyPassword,
  dbSaveUser, dbUpdateUserField, dbSaveTrip, dbSaveInvoice, dbSaveDebt,
  dbUpdateDebt, dbSaveWalletEntry, dbSavePricing, dbSaveSettings, dbAddLog,
  seedDatabase, dbLogin, dbResolveViolation, dbBackfillViolationDriver,
} from './supabase.js';
import './seed-data.js';

// ============================================================
// DATA STORE
// ============================================================
const STORAGE_KEY = 'timgo_v5_data';
const DB_ONLINE = initSupabase();

function getDefaultData() {
  const today = new Date().toISOString().split('T')[0];
  return {
    users: [
      { id: 'admin1', name: 'Tâm Thịnh', phone: '0948505077', password: 'Tamthinh123', role: 'admin', status: 'active', created_at: today },
    ],
    trips: [],
    pricing: {
      service_types: [
        { id: 'xe_om', name: '🏍️ Xe ôm', base_fee: 12000, per_km_first2: 5000, per_km_after: 4000, min_fee: 15000, surge_percent: 30, night_fee: 10000, multiplier: 1 },
        { id: 'xe_om_co_xe', name: '🏍️ Xe ôm có xe', base_fee: 24000, per_km_first2: 10000, per_km_after: 8000, min_fee: 30000, surge_percent: 30, night_fee: 20000, multiplier: 2, base_service: 'xe_om' },
        { id: 'giao_hang_nho', name: '📦 Giao hàng nhỏ', base_fee: 15000, per_km_first2: 5500, per_km_after: 4500, min_fee: 18000, surge_percent: 20, night_fee: 8000, multiplier: 1 },
        { id: 'giao_hang_lon', name: '📦 Giao hàng lớn', base_fee: 25000, per_km_first2: 7000, per_km_after: 5500, min_fee: 30000, surge_percent: 25, night_fee: 15000, multiplier: 1 },
      ],
      zone_prices: [
        { from: 'Quận 1', to: 'Quận 3', price: 25000 },
        { from: 'Quận 1', to: 'Quận 7', price: 45000 },
        { from: 'Quận 1', to: 'Tân Bình', price: 40000 },
        { from: 'Quận 1', to: 'Bình Thạnh', price: 35000 },
        { from: 'Quận 1', to: 'Gò Vấp', price: 50000 },
        { from: 'Quận 3', to: 'Phú Nhuận', price: 20000 },
        { from: 'Quận 7', to: 'Quận 2', price: 30000 },
        { from: 'Tân Bình', to: 'Quận 12', price: 55000 },
      ],
      wait_fee_per_min: 2000,
      surge_hours: { start: 7, end: 9, start2: 17, end2: 19 },
      night_hours: { start: 22, end: 5 },
    },
    settings: {
      default_commission_type: 'percent', default_commission_value: 20, calc_method: 'km',
      fund: {
        purpose: 'Bảo trì xe + hỗ trợ tài xế',
        per_trip: { enabled: true, amount: 2000 },
        per_day: { enabled: false, amount: 10000, absent_policy: 'skip' },
        percent: { enabled: true, value: 5 },
      },
    },
    walletHistory: [],
    fundTransactions: [],
    zaloViolations: [],
    fundExpenses: [],
    debts: [],
    invoices: [],
    activityLog: [],
    shifts: [],
  };
}

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const d = JSON.parse(stored);
      // Ensure all required arrays exist
      if (!d.walletHistory) d.walletHistory = [];
      if (!d.debts) d.debts = [];
      if (!d.invoices) d.invoices = [];
      if (!d.activityLog) d.activityLog = [];
      if (!d.shifts) d.shifts = [];
      if (!d.fundTransactions) d.fundTransactions = [];
      if (!d.fundExpenses) d.fundExpenses = [];
      if (!d.pricing) d.pricing = getDefaultData().pricing;
      if (!d.settings) d.settings = getDefaultData().settings;
      if (!d.settings.fund) d.settings.fund = getDefaultData().settings.fund;
      return d;
    }
  } catch (e) {}
  
  // Try loading from Excel seed data
  if (window.EXCEL_SEED_DATA) {
    const sd = window.EXCEL_SEED_DATA;
    console.log('📊 Loading Excel data: ' + sd.users.length + ' users, ' + sd.trips.length + ' trips');
    const data = {
      ...getDefaultData(),
      users: sd.users,
      trips: sd.trips,
      invoices: sd.invoices || [],
      debts: sd.debts || [],
      fundInfo: sd.fundInfo || { fund_start: 0, fund_current: 0, commission_total: 0, fee_total: 0 },
      fundExpenses: sd.fundExpenses || [],
      fundPenalties: sd.fundPenalties || [],
      revenueSummary: sd.revenueSummary || [],
      driverMonthly: sd.driverMonthly || {},
      dutySchedule: sd.dutySchedule || { shifts: [], rules: [] },
      marketingFund: sd.marketingFund || { current: 0, expenses: [] },
      driverStatus: {},
      leaveRequests: [],
    };
    // Initialize driver statuses
    data.users.filter(u => u.role === 'driver' && u.status === 'active').forEach((d, i) => {
      const statuses = ['available', 'on_trip', 'available', 'available', 'offline', 'available', 'on_trip', 'available', 'available', 'available', 'on_leave', 'available', 'available', 'available'];
      const st = statuses[i % statuses.length];
      data.driverStatus[d.id] = {
        status: st,
        service_type: st === 'on_trip' ? 'xe_om' : null,
        since: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        trip_count_today: Math.floor(Math.random() * 8) + 1
      };
    });
    saveDataLocal(data);
    return data;
  }
  
  const data = getDefaultData();
  generateSampleTrips(data);
  saveDataLocal(data);
  return data;
}

async function loadDataFromCloud() {
  if (!DB_ONLINE) return null;
  try {
    const cloud = await loadAllData();
    if (cloud && cloud.users && cloud.users.length > 0) {
      // Merge pricing/settings from cloud
      const data = {
        users: cloud.users,
        trips: cloud.trips || [],
        invoices: cloud.invoices || [],
        debts: cloud.debts || [],
        walletHistory: cloud.walletHistory || [],
        activityLog: cloud.activityLog || [],
        pricing: cloud.pricing || getDefaultData().pricing,
        settings: cloud.settings || getDefaultData().settings,
        shifts: [],
        zaloViolations: cloud.zaloViolations || [],
      };
      saveDataLocal(data); // Cache locally
      return data;
    }
    return null;
  } catch (e) {
    console.error('Cloud load failed:', e);
    return null;
  }
}

function generateSampleTrips(data) {
  const today = new Date().toISOString().split('T')[0];
  const drivers = data.users.filter(u => u.role === 'driver');
  const notes = [
    'Giao hàng Q.Bình Thạnh', 'Chở khách Q.1 → Q.7', 'Giao đồ ăn Q.3',
    'Chở khách sân bay', 'Giao hàng Tân Bình', 'Chở khách Q.Phú Nhuận',
    'Giao hàng Q.Gò Vấp', 'Ship đồ Q.Tân Phú'
  ];
  const serviceTypes = ['xe_om', 'giao_hang_nho', 'giao_hang_lon'];
  let id = 1;
  for (const d of drivers) {
    const numTrips = Math.floor(Math.random() * 5) + 3;
    let runTotal = 0;
    for (let i = 0; i < numTrips; i++) {
      const amount = (Math.floor(Math.random() * 14) + 2) * 10000;
      runTotal += amount;
      const km = (Math.random() * 12 + 1).toFixed(1);
      const isPaid = Math.random() > 0.15;
      const h = 7 + Math.floor(i * 1.4);
      const m = Math.floor(Math.random() * 60);
      const sType = serviceTypes[Math.floor(Math.random() * serviceTypes.length)];
      const commRate = d.commission_value || 20;
      const commission = Math.round(amount * commRate / 100);
      const trip = {
        id: `t${id++}`, driver_id: d.id, trip_number: i + 1,
        amount, note: notes[Math.floor(Math.random() * notes.length)],
        payment_status: isPaid ? 'paid' : 'debt',
        payment_method: isPaid ? (Math.random() > 0.3 ? 'cash' : 'transfer') : 'pending',
        service_type: sType, distance_km: parseFloat(km),
        customer_name: '', customer_phone: '',
        running_total: runTotal, commission_amount: commission,
        created_at: `${today}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`,
        date: today, is_locked: h < new Date().getHours() - 1,
      };
      data.trips.push(trip);
      // Generate invoice
      data.invoices.push({
        id: `inv${id}`, trip_id: trip.id, driver_id: d.id,
        amount: trip.amount, service_type: sType,
        distance_km: parseFloat(km), commission: commission,
        payment_status: trip.payment_status, payment_method: trip.payment_method,
        created_at: trip.created_at, date: today,
      });
      // If debt, create debt record
      if (!isPaid) {
        data.debts.push({
          id: `debt${id}`, trip_id: trip.id, driver_id: d.id,
          amount: trip.amount, customer_name: `Khách ${Math.floor(Math.random()*900)+100}`,
          customer_phone: `09${Math.floor(Math.random()*90000000)+10000000}`,
          status: 'pending', created_at: trip.created_at, date: today, note: trip.note,
        });
      }
    }
  }
}

function saveDataLocal(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function saveData(data) { saveDataLocal(data); }

// ============================================================
// APP STATE
// ============================================================
let D = loadData(); // D = global data
let U = null; // U = current user
let activeModal = null;
let adminMap = null; // Leaflet map instance
let driverMarkers = {}; // Map markers per driver
let gpsWatchId = null; // Geolocation watch ID
let activeTrip = null; // Current 1-Tap trip in progress
let tripTrackPoints = []; // GPS points during active trip
let adminActiveTab = 'dispatch'; // Current admin tab
let adminOrderFilter = { service: 'all', driver: 'all' };
let adminDebtTab = 'pending'; // pending | collected | stats

// ============================================================
// UTILITIES
// ============================================================
const fmt = (n) => n >= 1e6 ? (n/1e6).toFixed(1).replace('.0','')+'tr' : n >= 1000 ? Math.round(n/1000)+'k' : n+'đ';
const fmtFull = (n) => n.toLocaleString('vi-VN') + 'đ';
const today = () => new Date().toISOString().split('T')[0];
const timeOf = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
const vnDate = () => {
  const ds = ['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
  const d = new Date();
  return `${ds[d.getDay()]}, ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
};
const todayTrips = (did) => D.trips.filter(t => t.driver_id === did && t.date === today()).sort((a,b) => b.trip_number - a.trip_number);
const allTodayTrips = () => D.trips.filter(t => t.date === today()).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
const driver = (id) => D.users.find(u => u.id === id);
const driverName = (id) => { const d = driver(id); return d ? d.name.split(' ').pop() : 'N/A'; };
const svcName = (id) => { const s = D.pricing.service_types.find(x => x.id === id); return s ? s.name : id; };
const payMethodLabel = (m) => ({cash:'💵 Tiền mặt', transfer:'🏦 Chuyển khoản', momo:'📱 Momo', zalopay:'📱 ZaloPay', pending:'⏳ Chưa TT'}[m] || m);
const isSurge = () => { const h = new Date().getHours(); const s = D.pricing.surge_hours; return (h >= s.start && h < s.end) || (h >= s.start2 && h < s.end2); };
const isNight = () => { const h = new Date().getHours(); return h >= D.pricing.night_hours.start || h < D.pricing.night_hours.end; };

function calcFare(serviceId, km) {
  const svc = D.pricing.service_types.find(s => s.id === serviceId);
  if (!svc) return 0;
  let fare = svc.base_fee;
  if (km <= 2) fare += km * svc.per_km_first2;
  else fare += 2 * svc.per_km_first2 + (km - 2) * svc.per_km_after;
  if (isSurge()) fare += fare * svc.surge_percent / 100;
  if (isNight()) fare += svc.night_fee;
  return Math.max(Math.round(fare / 1000) * 1000, svc.min_fee);
}

// Tính giá chi tiết (dùng cho bảng preview)
function calcFareDetail(svc, km) {
  let base = svc.base_fee;
  let kmFee1 = Math.min(km, 2) * svc.per_km_first2;
  let kmFee2 = km > 2 ? (km - 2) * svc.per_km_after : 0;
  let subtotal = base + kmFee1 + kmFee2;
  let surgeFee = isSurge() ? Math.round(subtotal * svc.surge_percent / 100) : 0;
  let nightFee = isNight() ? svc.night_fee : 0;
  let total = subtotal + surgeFee + nightFee;
  total = Math.max(Math.round(total / 1000) * 1000, svc.min_fee);
  return { base, kmFee1, kmFee2, subtotal, surgeFee, nightFee, total, km };
}

function addLog(action, detail) {
  const entry = { id: 'log'+Date.now(), user_id: U?.id, user_name: U?.name, action, detail, created_at: new Date().toISOString() };
  D.activityLog.push(entry);
  if (DB_ONLINE) dbAddLog(entry).catch(e => console.error('Log sync error:', e));
}

// ============================================================
// GPS MODULE — $0 MÃI MÃI (OpenStreetMap + Leaflet + Geolocation)
// ============================================================

// Haversine: tính khoảng cách 2 điểm GPS (km) — chính xác ±0.5%
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Bán kính Trái Đất (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Simulated GPS positions for demo (TP.HCM area)
const DEMO_POSITIONS = {
  'd1': { lat: 10.7769, lng: 106.7009, area: 'Q.1' },
  'd2': { lat: 10.7851, lng: 106.6862, area: 'Q.3' },
  'd3': { lat: 10.7340, lng: 106.7218, area: 'Q.7' },
  'd4': { lat: 10.8010, lng: 106.6527, area: 'Tân Bình' },
  'd5': { lat: 10.8384, lng: 106.6651, area: 'Gò Vấp' },
};

// Trạng thái giả lập: TX đang bận (demo)
const DEMO_BUSY = {
  'd1': { busy: true, destination: 'Nguyễn Huệ, Q.1', km: 3.2, startTime: Date.now() - 600000 },
  'd4': { busy: true, destination: 'Sân bay Tân Sơn Nhất', km: 8.5, startTime: Date.now() - 300000 },
};

// Xác định trạng thái TX: 'busy' | 'free' | 'offline'
function getDriverStatus(d) {
  if (!d || d.status === 'blocked') return 'blocked';
  if (!d.online) return 'offline';
  // Check 1-Tap active trip
  if (DEMO_BUSY[d.id]?.busy) return 'busy';
  return 'free';
}

function getStatusLabel(status) {
  return { busy: '🔵 Đang chạy', free: '🟢 Rảnh', offline: '⚪ Offline', blocked: '🔴 Khóa' }[status] || status;
}
function getStatusColor(status) {
  return { busy: '#3B82F6', free: '#10B981', offline: '#9CA3AF', blocked: '#EF4444' }[status] || '#9CA3AF';
}

// Simulate driver movement (random drift) — TX bận di chuyển nhiều hơn
function simulateMovement() {
  for (const [id, pos] of Object.entries(DEMO_POSITIONS)) {
    const d = driver(id);
    if (d && d.online && d.status === 'active') {
      const isBusy = DEMO_BUSY[id]?.busy;
      const drift = isBusy ? 0.004 : 0.001; // TX bận chạy nhanh hơn
      pos.lat += (Math.random() - 0.5) * drift;
      pos.lng += (Math.random() - 0.5) * drift;
      pos.updated = new Date().toISOString();
      pos.speed = isBusy ? Math.round(Math.random() * 30 + 20) : 0; // km/h
    }
  }
}

// Start GPS tracking for driver (Geolocation API — FREE)
function startDriverGPS() {
  if (!navigator.geolocation) return;
  if (gpsWatchId) navigator.geolocation.clearWatch(gpsWatchId);
  gpsWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (U && U.role === 'driver') {
        const gpsData = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, updated: new Date().toISOString() };
        DEMO_POSITIONS[U.id] = { ...gpsData, area: 'GPS Live' };
        updateGPSStatus(true, gpsData);
      }
    },
    (err) => { updateGPSStatus(false, null); },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
  );
}

function stopDriverGPS() {
  if (gpsWatchId) { navigator.geolocation.clearWatch(gpsWatchId); gpsWatchId = null; }
}

function updateGPSStatus(active, data) {
  const el = document.getElementById('gps-indicator');
  if (!el) return;
  if (active && data) {
    el.className = 'gps-status';
    el.innerHTML = `<div class="gps-pulse"></div> 📍 GPS đang hoạt động — Độ chính xác: ${Math.round(data.accuracy||10)}m`;
  } else {
    el.className = 'gps-status off';
    el.innerHTML = `<div class="gps-pulse off"></div> ⚠️ GPS đang tắt — Bấm để bật`;
  }
}

// Initialize Leaflet map for Admin
function initAdminMap() {
  const mapEl = document.getElementById('admin-map');
  if (!mapEl || !window.L) return;
  if (adminMap) { adminMap.remove(); adminMap = null; }
  
  adminMap = L.map('admin-map', { zoomControl: false, attributionControl: false }).setView([10.7769, 106.7009], 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap'
  }).addTo(adminMap);
  L.control.zoom({ position: 'topright' }).addTo(adminMap);
  
  updateAdminMapMarkers();
  updateDriverStatusList();
  // Refresh every 5s
  setInterval(() => { simulateMovement(); updateAdminMapMarkers(); updateDriverStatusList(); }, 5000);
}

function updateAdminMapMarkers() {
  if (!adminMap) return;
  const drivers = D.users.filter(u => u.role === 'driver' && u.status === 'active');
  
  drivers.forEach(d => {
    const pos = DEMO_POSITIONS[d.id];
    if (!pos) return;
    const tr = todayTrips(d.id);
    const status = getDriverStatus(d);
    const color = getStatusColor(status);
    const shortName = d.name.split(' ').pop();
    const busyInfo = DEMO_BUSY[d.id];
    const speed = pos.speed || 0;
    
    // Enhanced marker with status ring
    const icon = L.divIcon({
      className: 'driver-marker-wrapper',
      html: `<div class="driver-marker-pro" style="--marker-color:${color}">
        <div class="marker-dot ${status === 'busy' ? 'moving' : ''}"></div>
        <div class="marker-name">${shortName}</div>
        ${status === 'busy' ? '<div class="marker-speed">'+speed+'km/h</div>' : ''}
      </div>`,
      iconSize: [90, 50],
      iconAnchor: [45, 25]
    });
    
    // Rich popup
    const elapsed = busyInfo ? Math.round((Date.now() - busyInfo.startTime) / 60000) : 0;
    const popupHtml = `<div style="font-family:Inter,sans-serif;min-width:180px;">
      <div style="font-weight:700;font-size:14px;margin-bottom:6px;">${d.name}</div>
      <div style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;color:white;background:${color};margin-bottom:6px;">${getStatusLabel(status)}</div>
      <div style="font-size:12px;line-height:1.8;">
        🏍️ ${d.vehicle_plate}<br>
        📍 ${pos.area}<br>
        📞 ${d.phone}<br>
        💰 Hôm nay: <b>${fmt(tr.reduce((s,t)=>s+t.amount,0))}</b> (${tr.length} cuốc)<br>
        💵 Ví: <b>${fmt(d.wallet||0)}</b>
        ${busyInfo ? '<br>🚀 Đang đi: <b>'+busyInfo.destination+'</b><br>📏 '+busyInfo.km+'km · ⏱️ '+elapsed+' phút<br>🏎️ '+speed+' km/h' : ''}
      </div>
    </div>`;
    
    if (driverMarkers[d.id]) {
      driverMarkers[d.id].setLatLng([pos.lat, pos.lng]).setIcon(icon);
      driverMarkers[d.id].setPopupContent(popupHtml);
    } else {
      driverMarkers[d.id] = L.marker([pos.lat, pos.lng], { icon }).addTo(adminMap);
      driverMarkers[d.id].bindPopup(popupHtml);
    }
  });
}

// Update driver status list below map
function updateDriverStatusList() {
  const el = document.getElementById('driver-status-list');
  if (!el) return;
  const filter = window._mapFilter || 'all';
  const drivers = D.users.filter(u => u.role === 'driver' && u.status === 'active');
  const filtered = filter === 'all' ? drivers : drivers.filter(d => getDriverStatus(d) === filter);
  
  const counts = { free: 0, busy: 0, offline: 0 };
  drivers.forEach(d => { const s = getDriverStatus(d); if (counts[s] !== undefined) counts[s]++; });
  
  el.innerHTML = filtered.map(d => {
    const status = getDriverStatus(d);
    const color = getStatusColor(status);
    const pos = DEMO_POSITIONS[d.id];
    const tr = todayTrips(d.id);
    const busyInfo = DEMO_BUSY[d.id];
    const elapsed = busyInfo ? Math.round((Date.now() - busyInfo.startTime) / 60000) : 0;
    return `<div class="driver-status-item" onclick="G.focusDriver('${d.id}')" style="border-left:3px solid ${color};">
      <div class="dsi-top">
        <div class="dsi-avatar" style="background:${color}20;color:${color};">${d.name.charAt(0)}</div>
        <div class="dsi-info">
          <div class="dsi-name">${d.name.split(' ').pop()} <span style="font-size:11px;color:${color};">${getStatusLabel(status)}</span></div>
          <div class="dsi-detail">${d.vehicle_plate} · ${tr.length} cuốc · ${fmt(tr.reduce((s,t)=>s+t.amount,0))}</div>
          ${busyInfo ? `<div class="dsi-trip">🚀 → ${busyInfo.destination} (${busyInfo.km}km · ${elapsed}p)</div>` : ''}
        </div>
        <div class="dsi-area">${pos?.area || ''}</div>
      </div>
    </div>`;
  }).join('') || '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:13px;">Không có TX</div>';
  
  // Update filter counts
  const countEl = document.getElementById('map-filter-counts');
  if (countEl) countEl.innerHTML = `
    <button class="date-chip ${filter==='all'?'active':''}" onclick="G.filterMap('all')">Tất cả (${drivers.length})</button>
    <button class="date-chip ${filter==='free'?'active':''}" onclick="G.filterMap('free')" style="${filter==='free'?'':'border-color:var(--success);color:var(--success);'}">🟢 Rảnh (${counts.free})</button>
    <button class="date-chip ${filter==='busy'?'active':''}" onclick="G.filterMap('busy')" style="${filter==='busy'?'':'border-color:#3B82F6;color:#3B82F6;'}">🔵 Đang chạy (${counts.busy})</button>
    <button class="date-chip ${filter==='offline'?'active':''}" onclick="G.filterMap('offline')">⚪ Offline (${counts.offline})</button>
  `;
}

// ============================================================
// SMART FEATURES — OSRM + Nominatim + 1-Tap ($0 MÃI MÃI)
// ============================================================

// OSRM: Tính km theo đường đi THỰC TẾ (không phải chim bay)
async function osrmDistance(lat1, lng1, lat2, lng2) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.[0]) {
      return {
        km: Math.round(data.routes[0].distance / 100) / 10, // mét → km (1 chữ số)
        duration_min: Math.round(data.routes[0].duration / 60),
        raw_meters: data.routes[0].distance,
      };
    }
  } catch (e) { console.warn('OSRM error:', e); }
  // Fallback: dùng Haversine nếu OSRM lỗi
  return { km: Math.round(haversine(lat1, lng1, lat2, lng2) * 10) / 10, duration_min: 0, raw_meters: 0, fallback: true };
}

// Nominatim: GPS → Địa chỉ tự động (FREE)
async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'TimGo/2.0' } });
    const data = await res.json();
    if (data.display_name) {
      const a = data.address || {};
      // Trả về địa chỉ ngắn gọn kiểu VN
      const short = [a.road, a.suburb || a.quarter, a.city_district || a.county].filter(Boolean).join(', ');
      return short || data.display_name.split(',').slice(0, 3).join(',');
    }
  } catch (e) { console.warn('Nominatim error:', e); }
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

// Lấy vị trí hiện tại (Promise-based)
function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      // Demo fallback: random TP.HCM
      resolve({ lat: 10.7769 + (Math.random()-0.5)*0.02, lng: 106.7009 + (Math.random()-0.5)*0.02 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      err => {
        // Fallback for desktop/no GPS
        const demoPos = DEMO_POSITIONS[U?.id] || { lat: 10.7769, lng: 106.7009 };
        resolve({ lat: demoPos.lat + (Math.random()-0.5)*0.01, lng: demoPos.lng + (Math.random()-0.5)*0.01 });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

// So khớp km: chống gian lận
function verifyDistance(reportedKm, osrmKm) {
  if (osrmKm <= 0) return { ok: true, diff: 0 };
  const diff = Math.abs(reportedKm - osrmKm);
  const pct = (diff / osrmKm) * 100;
  return { ok: pct < 30, diff: Math.round(pct), reportedKm, osrmKm };
}

// Dự toán giá tất cả dịch vụ
function estimateAllFares(km) {
  return D.pricing.service_types.map(s => ({
    id: s.id, name: s.name,
    fare: calcFare(s.id, km),
    km,
  }));
}

// ============================================================
// RENDER ENGINE
// ============================================================
const $ = (id) => document.getElementById(id);
const app = () => $('app');
const show = (id, navId, items) => {
  document.querySelectorAll('#app > .screen').forEach(s => s.classList.remove('active'));
  $(id)?.classList.add('active');
  if (navId) {
    document.querySelectorAll(`#${navId} .nav-item`).forEach(n => n.classList.remove('active'));
    const idx = items.indexOf(id);
    if (idx >= 0) document.querySelectorAll(`#${navId} .nav-item`)[idx]?.classList.add('active');
  }
};

// ============================================================
// LOGIN
// ============================================================
function renderLogin() {
  app().innerHTML = `
    <div class="screen active login-screen" id="scr-login">
      <div class="login-logo">🟣</div>
      <div class="login-title">Tím Go</div>
      <div class="login-subtitle">Quản lý tài xế chuyên nghiệp</div>
      <div class="login-card">
        <div class="login-role-tabs">
          <button class="role-tab active" id="tab-login" onclick="G.switchAuthTab('login')">🔑 Đăng nhập</button>
          <button class="role-tab" id="tab-register" onclick="G.switchAuthTab('register')">📝 Đăng ký TX</button>
        </div>

        <div id="form-login">
          <div class="form-group">
            <label class="form-label">Số điện thoại</label>
            <input type="tel" class="form-input" id="inp-phone" placeholder="VD: 0948505077" />
          </div>
          <div class="form-group">
            <label class="form-label">Mật khẩu</label>
            <input type="password" class="form-input" id="inp-pass" placeholder="Nhập mật khẩu" />
          </div>
          <div id="login-err" class="alert alert-danger" style="display:none"></div>
          <button class="btn btn-primary" onclick="G.login()">Đăng nhập</button>
          <div class="text-center text-muted" style="margin-top:16px;font-size:11px;">
            Tài xế mới? Bấm tab <b>📝 Đăng ký TX</b> bên trên
          </div>
        </div>

        <div id="form-register" style="display:none;">
          <div class="form-group">
            <label class="form-label">Số điện thoại *</label>
            <input type="tel" class="form-input" id="reg-phone" placeholder="0xxx..." inputmode="numeric" />
          </div>
          <div class="form-group">
            <label class="form-label">Họ tên *</label>
            <input type="text" class="form-input" id="reg-name" placeholder="Nguyễn Văn..." />
          </div>
          <div class="form-group">
            <label class="form-label">Mật khẩu *</label>
            <input type="password" class="form-input" id="reg-pass" placeholder="Tối thiểu 6 ký tự" />
          </div>
          <div id="reg-err" class="alert alert-danger" style="display:none"></div>
          <div id="reg-ok" class="alert alert-success" style="display:none"></div>
          <button class="btn btn-primary" onclick="G.register()">📝 Gửi đăng ký</button>
          <div class="text-center text-muted" style="margin-top:12px;font-size:11px;">
            Sau khi đăng ký, admin sẽ duyệt tài khoản trước khi anh có thể chạy đơn.
          </div>
        </div>
      </div>
    </div>`;
}

// ============================================================
// ADMIN SCREENS — 6 MODULES + AI DISPATCH
// ============================================================
const adminScreens = ['scr-a-dispatch','scr-a-chietkhau','scr-a-donhang','scr-a-congno','scr-a-xinphep','scr-a-taichinh','scr-a-settings','scr-a-drivers','scr-a-trips','scr-a-finance','scr-a-pricing','scr-a-debts','scr-a-quy-config','scr-a-quy-report','scr-a-zalo-audit','scr-a-zalo-mapping','scr-a-duty'];

function renderAdmin() {
  stopDriverGPS();
  adminActiveTab = 'dispatch';
  if (!D.driverStatus) D.driverStatus = {};
  if (!D.leaveRequests) D.leaveRequests = [];
  // Ensure driver statuses exist
  D.users.filter(u => u.role === 'driver' && u.status === 'active').forEach((d, i) => {
    if (!D.driverStatus[d.id]) {
      D.driverStatus[d.id] = { status: 'available', service_type: null, since: new Date().toISOString(), trip_count_today: 0 };
    }
  });
  app().innerHTML = [
    adminDispatch(), adminChietKhau(), adminDonHang(), adminCongNo(), adminXinPhep(), adminTaiChinh(),
    adminDrivers(), adminTrips(), adminFinance(),
    adminPricing(), adminDebts(), adminQuyConfig(), adminQuyReport(), adminSettings(),
    adminZaloAudit(), adminZaloMapping(), adminDutyRoster(),
    `<div class="modal-overlay" id="modal-ov" onclick="G.closeModal()"><div class="modal-sheet" onclick="event.stopPropagation()" id="modal-c"></div></div>`,
    adminNav()
  ].join('');
  show('scr-a-dispatch', 'nav-a', adminScreens);
  setTimeout(() => initAdminMap(), 100);
}

// Helper: get driver status info
function getDrvStatus(drvId) {
  return D.driverStatus?.[drvId] || { status: 'offline', service_type: null, since: new Date().toISOString(), trip_count_today: 0 };
}
function statusEmoji(st) {
  return { available: '🟢', on_trip: '🔴', on_leave: '🟡', offline: '⚫' }[st] || '⚫';
}
function statusLabel(st) {
  return { available: 'Trống', on_trip: 'Đang chạy', on_leave: 'Nghỉ phép', offline: 'Offline' }[st] || 'N/A';
}
function timeSince(iso) {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'vừa xong';
  if (diff < 60) return diff + ' phút';
  return Math.floor(diff / 60) + 'h ' + (diff % 60) + 'p';
}
function svcIcon(type) {
  return { xe_om: '🏍️', giao_ho: '📦', mua_ho: '🛒', lay_ho: '🔄', giao_hang: '🚚', giao_hang_nho: '📦', giao_hang_lon: '🚚' }[type] || '🏍️';
}

// =================== MODULE 1: DISPATCH BOARD ===================
function adminDispatch() {
  const drivers = D.users.filter(u => u.role === 'driver' && u.status === 'active');
  const counts = { available: 0, on_trip: 0, on_leave: 0, offline: 0 };
  drivers.forEach(d => { const st = getDrvStatus(d.id).status; counts[st] = (counts[st] || 0) + 1; });
  const trips = allTodayTrips();
  const totAmt = trips.reduce((s,t) => s + t.amount, 0);

  return `<div class="screen" id="scr-a-dispatch">
    <div class="header">
      <div class="header-top">
        <div><div class="header-greeting">Xin chào, Admin 👋</div><div class="header-name">📡 Bảng Điều Phối</div><div class="header-date">📅 ${vnDate()}${isSurge() ? ' — 🔴 GIỜ CAO ĐIỂM' : ''}${isNight() ? ' — 🌙 Phí đêm' : ''}</div></div>
        <div class="header-badge" onclick="G.logout()">🚪</div>
      </div>
    </div>
    <div class="dispatch-summary">
      <span>Hôm nay: <b>${counts.available + counts.on_trip}/${drivers.length}</b> online</span>
      <span>• <span style="color:#10B981">${counts.available} trống</span></span>
      <span>• <span style="color:#EF4444">${counts.on_trip} đang chạy</span></span>
      <span>• <span style="color:#F59E0B">${counts.on_leave} nghỉ</span></span>
    </div>
    <div class="dispatch-grid">
      ${drivers.map(d => {
        const st = getDrvStatus(d.id);
        const shortName = d.name.split(' ').pop();
        const tr = todayTrips(d.id);
        return `<div class="dispatch-card dispatch-${st.status}" onclick="G.driverDetail('${d.id}')">
          <div class="dispatch-card-status">${statusEmoji(st.status)}</div>
          <div class="dispatch-card-name">${shortName}</div>
          <div class="dispatch-card-info">${statusLabel(st.status)}</div>
          ${st.status === 'on_trip' && st.service_type ? `<div class="dispatch-card-svc">${svcIcon(st.service_type)}</div>` : ''}
          <div class="dispatch-card-meta">${timeSince(st.since)} · ${st.trip_count_today || tr.length} cuốc</div>
        </div>`;
      }).join('')}
    </div>
    ${adminAIDispatch()}
    <div class="section" style="margin-top:8px;"><div class="section-header"><div class="section-title">🗺️ Bản đồ tài xế</div><span class="section-action" onclick="G.toggleMapFullscreen()">⛶ Phóng to</span></div></div>
    <div class="map-container" id="map-wrapper"><div id="admin-map" style="width:100%;height:100%;"></div></div>
    <div id="map-filter-counts" class="date-filter" style="padding:8px 16px;"></div>
    <div class="section" style="margin-top:-8px;"><div id="driver-status-list"></div></div>
  </div>`;
}

// =================== AI SMART DISPATCH ===================
function adminAIDispatch() {
  const drivers = D.users.filter(u => u.role === 'driver' && u.status === 'active');
  // Find longest available driver
  let longestAvail = null;
  let longestMin = 0;
  drivers.forEach(d => {
    const st = getDrvStatus(d.id);
    if (st.status === 'available') {
      const min = Math.round((Date.now() - new Date(st.since).getTime()) / 60000);
      if (min > longestMin) { longestMin = min; longestAvail = d; }
    }
  });
  // Warnings
  const warns = [];
  const pendingDebts = (D.debts || []).filter(d => d.status === 'pending');
  const oldDebts = pendingDebts.filter(d => {
    const days = Math.round((Date.now() - new Date(d.date || d.created_at).getTime()) / 86400000);
    return days > 7;
  });
  if (oldDebts.length > 0) warns.push(`⚠️ ${oldDebts.length} khoản nợ > 7 ngày chưa thu`);
  // Revenue
  const todayTripsAll = allTodayTrips();
  const todayRev = todayTripsAll.reduce((s,t) => s + t.amount, 0);
  // Yesterday revenue for comparison
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const ydStr = yesterday.toISOString().split('T')[0];
  const ydTrips = D.trips.filter(t => t.date === ydStr);
  const ydRev = ydTrips.reduce((s,t) => s + t.amount, 0);
  const revChange = ydRev > 0 ? Math.round(((todayRev - ydRev) / ydRev) * 100) : 0;

  return `<div class="section"><div class="ai-dispatch-panel">
    <div class="ai-dispatch-title">🤖 AI Smart Dispatch</div>
    ${longestAvail ? `<div class="ai-dispatch-item ai-suggest">
      <span>💡 Gợi ý: <b>${longestAvail.name.split(' ').pop()}</b> rảnh ${longestMin} phút, hôm nay ${getDrvStatus(longestAvail.id).trip_count_today || todayTrips(longestAvail.id).length} cuốc</span>
    </div>` : ''}
    ${warns.map(w => `<div class="ai-dispatch-item ai-warn">${w}</div>`).join('')}
    <div class="ai-dispatch-item ai-stat">
      📊 Doanh thu hôm nay: <b>${fmt(todayRev)}</b> ${revChange !== 0 ? `(${revChange > 0 ? '↑' : '↓'}${Math.abs(revChange)}% so hôm qua)` : ''}
    </div>
    <div class="ai-dispatch-item ai-stat">
      🏍️ Tổng cuốc: <b>${todayTripsAll.length}</b> · Nợ: <b>${pendingDebts.length}</b> khoản (${fmtFull(pendingDebts.reduce((s,d) => s + d.amount, 0))})
    </div>
  </div></div>`;
}

// =================== MODULE 2: CHIẾT KHẤU ===================
function adminChietKhau() {
  const drivers = D.users.filter(u => u.role === 'driver' && u.status === 'active');
  let totalCK = 0, totalFee = 0;
  const rows = drivers.map(d => {
    // Use revenueSummary if available, else compute from trips
    const rs = (D.revenueSummary || []).find(r => r.name === d.name);
    const dm = D.driverMonthly?.[d.id] || {};
    const allTrips = D.trips.filter(t => t.driver_id === d.id);
    const totalIncome = rs ? rs.total_income : allTrips.reduce((s,t) => s + t.amount, 0);
    const totalOrders = rs ? rs.total_orders : allTrips.length;
    const ck = Math.round(totalIncome * 0.2);
    const fee = dm.fee_month || 0;
    totalCK += ck;
    totalFee += fee;
    return { ...d, totalIncome, totalOrders, ck, fee, rank: rs?.rank || '-' };
  }).sort((a,b) => b.totalIncome - a.totalIncome);

  return `<div class="screen" id="scr-a-chietkhau">
    <div class="header"><div class="header-top"><div><div class="header-name">💰 Chiết Khấu</div><div class="header-date">Hoa hồng 20% · ${vnDate()}</div></div></div></div>
    <div class="stats-grid" style="grid-template-columns:repeat(2,1fr)">
      <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-value text-primary">${fmt(totalCK)}</div><div class="stat-label">Tổng CK 20%</div></div>
      <div class="stat-card"><div class="stat-icon">📋</div><div class="stat-value">${fmt(totalFee)}</div><div class="stat-label">Tổng phí</div></div>
    </div>
    <div class="section">
      <div class="section-title mb-8">👤 Chi tiết từng tài xế</div>
      <div class="ck-table">
        <div class="ck-header"><span>#</span><span>Tên</span><span>Cuốc</span><span>Doanh thu</span><span>CK 20%</span></div>
        ${rows.map((r, i) => `<div class="ck-row">
          <span class="ck-rank">${i + 1}</span>
          <span class="ck-name">${r.name.split(' ').pop()}</span>
          <span>${r.totalOrders}</span>
          <span class="fw-bold">${fmt(r.totalIncome)}</span>
          <span class="text-primary fw-bold">${fmt(r.ck)}</span>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}

// =================== MODULE 3: ĐƠN HÀNG ===================
function adminDonHang() {
  let trips = allTodayTrips();
  const drivers = D.users.filter(u => u.role === 'driver');
  // Filters
  if (adminOrderFilter.service !== 'all') trips = trips.filter(t => t.service_type === adminOrderFilter.service);
  if (adminOrderFilter.driver !== 'all') trips = trips.filter(t => t.driver_id === adminOrderFilter.driver);

  return `<div class="screen" id="scr-a-donhang">
    <div class="header"><div class="header-top"><div><div class="header-name">📋 Đơn Hàng</div><div class="header-date">${trips.length} đơn hôm nay · ${fmtFull(trips.reduce((s,t) => s + t.amount, 0))}</div></div></div></div>
    <div class="date-filter">
      <button class="date-chip ${adminOrderFilter.service==='all'?'active':''}" onclick="G.filterOrders('service','all')">Tất cả</button>
      <button class="date-chip ${adminOrderFilter.service==='xe_om'?'active':''}" onclick="G.filterOrders('service','xe_om')">🏍️ Xe ôm</button>
      <button class="date-chip ${adminOrderFilter.service==='giao_hang_nho'?'active':''}" onclick="G.filterOrders('service','giao_hang_nho')">📦 Giao hộ</button>
      <button class="date-chip ${adminOrderFilter.service==='giao_hang_lon'?'active':''}" onclick="G.filterOrders('service','giao_hang_lon')">🚚 Giao hàng</button>
    </div>
    <div class="date-filter" style="padding-top:0">
      <select class="form-input" style="font-size:13px;padding:8px 12px;" onchange="G.filterOrders('driver', this.value)">
        <option value="all">👤 Tất cả tài xế</option>
        ${drivers.filter(d=>d.role==='driver').map(d => `<option value="${d.id}" ${adminOrderFilter.driver===d.id?'selected':''}>${d.name.split(' ').pop()}</option>`).join('')}
      </select>
    </div>
    <div class="section">
      ${trips.length === 0 ? '<div class="alert alert-info">Chưa có đơn hàng nào</div>' : ''}
      ${trips.map(t => `<div class="order-card">
        <div class="order-left">
          <div class="order-svc">${svcIcon(t.service_type)}</div>
        </div>
        <div class="order-center">
          <div class="order-driver">${driverName(t.driver_id)} <span class="order-svc-name">${svcName(t.service_type)}</span></div>
          <div class="order-note">${t.note || ''}</div>
        </div>
        <div class="order-right">
          <div class="order-amount">${fmtFull(t.amount)}</div>
          <div class="order-time">${timeOf(t.created_at)}</div>
          <span class="order-status ${t.payment_status}">${t.payment_status === 'paid' ? '✅' : '⚠️'}</span>
        </div>
      </div>`).join('')}
    </div>
  </div>`;
}

// =================== MODULE 4: CÔNG NỢ (Smart Debt System) ===================
function adminCongNo() {
  const allDebts = D.debts || [];
  const pending = allDebts.filter(d => d.status === 'pending');
  const collected = allDebts.filter(d => d.status === 'resolved');
  const cancelled = allDebts.filter(d => d.status === 'cancelled');
  const totPending = pending.reduce((s,d) => s + d.amount, 0);
  const totCollected = collected.reduce((s,d) => s + d.amount, 0);

  // Helper: days since debt
  const debtDays = (d) => Math.max(0, Math.round((Date.now() - new Date(d.date || d.created_at).getTime()) / 86400000));

  // Helper: aging badge
  const agingBadge = (d) => {
    const days = debtDays(d);
    if (days <= 3) return '<span class="debt-aging-badge new">🟢 Mới</span>';
    if (days <= 7) return `<span class="debt-aging-badge warning">🟡 ${days} ngày</span>`;
    return `<span class="debt-aging-badge danger">🔴 ${days} ngày</span>`;
  };

  // Customer history count (all-time, including resolved/cancelled)
  const customerHistoryCount = (name) => allDebts.filter(d => (d.customer_name || 'Khách vãng lai') === name).length;

  // Group pending by customer_name
  const grouped = {};
  pending.forEach(d => {
    const name = d.customer_name || 'Khách vãng lai';
    if (!grouped[name]) grouped[name] = { debts: [], total: 0 };
    grouped[name].debts.push(d);
    grouped[name].total += d.amount;
  });

  // DUPLICATE DETECTION: same customer, same date, different drivers
  const duplicateWarnings = [];
  Object.entries(grouped).forEach(([custName, g]) => {
    const byDate = {};
    g.debts.forEach(d => {
      const key = d.date || 'unknown';
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(d);
    });
    Object.entries(byDate).forEach(([date, debts]) => {
      const uniqueDrivers = [...new Set(debts.map(d => d.driver_id))];
      if (uniqueDrivers.length > 1 && debts.length > 1) {
        const driverNames = uniqueDrivers.map(id => driverName(id)).join(' và ');
        const dateStr = date.split('-').reverse().join('/');
        duplicateWarnings.push({
          customer: custName,
          date: dateStr,
          rawDate: date,
          driverNames,
          count: debts.length,
          debtIds: debts.map(d => d.id),
        });
      }
    });
  });

  // Sort groups: highest total first
  const sortedGroups = Object.entries(grouped).sort((a,b) => b[1].total - a[1].total);

  // ========== TAB: PENDING ==========
  const renderPending = () => {
    let html = '';

    // Duplicate warnings
    if (duplicateWarnings.length > 0) {
      html += duplicateWarnings.map(w => `<div class="debt-warning-banner">
        <div class="debt-warning-text">⚠️ CẢNH BÁO TRÙNG: "${w.customer}" có ${w.count} khoản từ ${w.driverNames} cùng ngày ${w.date}. Có thể là cuốc chung — Ghép lại?</div>
        <button class="debt-merge-btn" onclick="G.mergeDebts([${w.debtIds.map(id => `'${id}'`).join(',')}])">🔗 Ghép</button>
      </div>`).join('');
    }

    if (sortedGroups.length === 0) {
      return '<div class="alert alert-success">✅ Không có công nợ!</div>';
    }

    html += sortedGroups.map(([name, g]) => {
      const historyCount = customerHistoryCount(name);
      const oldestDays = Math.max(...g.debts.map(d => debtDays(d)));
      const warnLevel = oldestDays <= 3 ? 'green' : oldestDays <= 7 ? 'yellow' : 'red';
      const warnIcon = warnLevel === 'green' ? '🟢' : warnLevel === 'yellow' ? '⚠️' : '🔴';

      return `<div class="debt-group">
        <div class="debt-group-header">
          <div>
            <span class="debt-group-name">${name}</span>
            <span class="debt-group-count">${g.debts.length} khoản</span>
            ${historyCount > 3 ? '<span class="debt-risk-high">⚡ Nợ thường xuyên</span>' : ''}
          </div>
          <div style="text-align:right">
            <div class="debt-group-total">${fmtFull(g.total)}</div>
            <div style="font-size:11px;color:var(--text-muted);">${warnIcon} ${oldestDays} ngày · Nợ ${historyCount} lần</div>
          </div>
        </div>
        ${g.debts.map(d => {
          const driversInvolved = d.drivers_involved || driverName(d.driver_id);
          const driverList = driversInvolved.toString().split(',').map(x => x.trim()).filter(Boolean);
          const splitInfo = driverList.length > 1 ? `<div class="debt-split-info">💰 ${fmtFull(d.amount)} ÷ ${driverList.length} TX = ${fmtFull(Math.round(d.amount / driverList.length))}/người (${driverList.join(', ')})</div>` : '';

          return `<div class="debt-item">
            <div class="debt-item-info">
              <span>${driverName(d.driver_id)} · ${d.date}</span>
              <div style="display:flex;align-items:center;gap:6px;">
                ${agingBadge(d)}
                <span class="debt-item-amount">${fmtFull(d.amount)}</span>
              </div>
            </div>
            ${d.note ? `<div class="debt-item-note">📝 ${d.note}</div>` : ''}
            ${splitInfo}
            <div class="debt-item-actions">
              <button class="btn btn-sm btn-success" onclick="G.confirmResolve('${d.id}')">✅ Đã thu</button>
              <button class="btn btn-sm btn-outline" onclick="G.cancelDebt('${d.id}')">❌ Xóa</button>
            </div>
          </div>`;
        }).join('')}
      </div>`;
    }).join('');

    return html;
  };

  // ========== TAB: COLLECTED ==========
  const renderCollected = () => {
    if (collected.length === 0) return '<div class="alert alert-info">Chưa có khoản nào đã thu</div>';
    return collected.sort((a,b) => new Date(b.resolved_at || b.date) - new Date(a.resolved_at || a.date)).slice(0, 30).map(d => `<div class="trip-card" style="border-left-color:var(--success);">
      <div class="trip-header">
        <span class="trip-number">✅ ${driverName(d.driver_id)} · ${d.customer_name || 'Khách'}</span>
        <span class="trip-time">${d.date}</span>
      </div>
      <div class="trip-amount" style="font-size:16px;">${fmtFull(d.amount)}</div>
      ${d.resolved_method ? `<div class="trip-note">💳 ${d.resolved_method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}${d.resolved_note ? ' · ' + d.resolved_note : ''}</div>` : ''}
      ${d.resolved_at ? `<div class="trip-commission">Thu lúc: ${new Date(d.resolved_at).toLocaleDateString('vi-VN')} ${timeOf(d.resolved_at)}</div>` : ''}
    </div>`).join('');
  };

  // ========== TAB: STATS ==========
  const renderStats = () => {
    // Build customer stats from ALL debts
    const custStats = {};
    allDebts.forEach(d => {
      const name = d.customer_name || 'Khách vãng lai';
      if (!custStats[name]) custStats[name] = { name, totalTimes: 0, totalAmount: 0, totalCollected: 0, outstanding: 0 };
      custStats[name].totalTimes++;
      custStats[name].totalAmount += d.amount;
      if (d.status === 'resolved') custStats[name].totalCollected += d.amount;
      if (d.status === 'pending') custStats[name].outstanding += d.amount;
    });

    const statsList = Object.values(custStats).sort((a,b) => b.totalTimes - a.totalTimes);
    if (statsList.length === 0) return '<div class="alert alert-info">Chưa có dữ liệu</div>';

    const totalCustomers = statsList.length;
    const repeatOffenders = statsList.filter(c => c.totalTimes > 3).length;

    return `<div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin:0 0 16px;">
      <div class="stat-card" style="opacity:1"><div class="stat-icon">👥</div><div class="stat-value">${totalCustomers}</div><div class="stat-label">Khách nợ</div></div>
      <div class="stat-card" style="opacity:1"><div class="stat-icon">⚡</div><div class="stat-value text-danger">${repeatOffenders}</div><div class="stat-label">Nợ > 3 lần</div></div>
      <div class="stat-card" style="opacity:1"><div class="stat-icon">💰</div><div class="stat-value text-primary">${fmt(totCollected)}</div><div class="stat-label">Đã thu</div></div>
    </div>
    <div class="debt-customer-stats">
      <div class="ck-table">
        <div class="ck-header" style="grid-template-columns:1fr 45px 70px 70px 70px;">
          <span>Khách</span><span>Lần</span><span>Tổng nợ</span><span>Đã thu</span><span>Còn lại</span>
        </div>
        ${statsList.map(c => `<div class="ck-row" style="grid-template-columns:1fr 45px 70px 70px 70px;">
          <span class="ck-name">${c.name} ${c.totalTimes > 3 ? '<span class="debt-risk-high">🔴</span>' : ''}</span>
          <span style="text-align:center;font-weight:700;">${c.totalTimes}</span>
          <span style="font-weight:600;">${fmt(c.totalAmount)}</span>
          <span class="text-success" style="font-weight:600;">${fmt(c.totalCollected)}</span>
          <span class="${c.outstanding > 0 ? 'text-danger' : 'text-success'}" style="font-weight:700;">${c.outstanding > 0 ? fmt(c.outstanding) : '✅'}</span>
        </div>`).join('')}
      </div>
    </div>`;
  };

  // ========== RENDER ==========
  const tabContent = adminDebtTab === 'pending' ? renderPending() :
                     adminDebtTab === 'collected' ? renderCollected() :
                     renderStats();

  return `<div class="screen" id="scr-a-congno">
    <div class="header"><div class="header-top"><div><div class="header-name">📕 Công Nợ</div><div class="header-date">${pending.length} chưa thu · ${fmtFull(totPending)}</div></div>
    <div class="header-badge" onclick="G.addDebtModal()">➕</div></div></div>
    <div class="date-filter">
      <button class="date-chip ${adminDebtTab==='pending'?'active':''}" onclick="G.switchDebtTab('pending')">⏳ Chưa thu (${pending.length})</button>
      <button class="date-chip ${adminDebtTab==='collected'?'active':''}" onclick="G.switchDebtTab('collected')">✅ Đã thu (${collected.length})</button>
      <button class="date-chip ${adminDebtTab==='stats'?'active':''}" onclick="G.switchDebtTab('stats')">📊 Thống kê</button>
    </div>
    <div class="section">
      ${tabContent}
    </div>
  </div>`;
}

// =================== MODULE 5: XIN PHÉP ===================
function adminXinPhep() {
  const requests = D.leaveRequests || [];
  const pendingReqs = requests.filter(r => r.status === 'pending');
  const historyReqs = requests.filter(r => r.status !== 'pending');
  const drivers = D.users.filter(u => u.role === 'driver' && u.status === 'active');
  const onLeave = drivers.filter(d => getDrvStatus(d.id).status === 'on_leave').length;

  const typeLabel = (t) => ({ full_day: '🌅 Nghỉ cả ngày', late: '⏰ Đi trễ', early: '🏃 Về sớm' }[t] || t);
  const statusBadge = (s) => ({ pending: '⏳ Chờ duyệt', approved: '✅ Đã duyệt', rejected: '❌ Từ chối' }[s] || s);

  return `<div class="screen" id="scr-a-xinphep">
    <div class="header"><div class="header-top"><div><div class="header-name">🙋 Xin Phép</div><div class="header-date">Hôm nay: ${onLeave} nghỉ → còn ${drivers.length - onLeave}/${drivers.length} tài xế</div></div>
    <div class="header-badge" onclick="G.addLeaveModal()">➕</div></div></div>
    ${pendingReqs.length > 0 ? `<div class="section" style="margin-top:16px;">
      <div class="section-title mb-8" style="color:var(--warning);">⏳ Chờ duyệt (${pendingReqs.length})</div>
      ${pendingReqs.map(r => {
        const drv = driver(r.driver_id);
        return `<div class="leave-card leave-pending">
          <div class="leave-card-top">
            <div class="leave-card-driver">${drv ? drv.name : 'N/A'}</div>
            <div class="leave-card-type">${typeLabel(r.type)}</div>
          </div>
          <div class="leave-card-date">📅 ${r.date} · ${r.reason || 'Không lý do'}</div>
          <div class="leave-card-actions">
            <button class="btn btn-sm btn-success" onclick="G.handleLeave('${r.id}','approved')">✅ Duyệt</button>
            <button class="btn btn-sm btn-danger" onclick="G.handleLeave('${r.id}','rejected')">❌ Từ chối</button>
          </div>
        </div>`;
      }).join('')}
    </div>` : '<div class="section" style="margin-top:16px;"><div class="alert alert-success">✅ Không có yêu cầu chờ duyệt</div></div>'}
    <div class="section">
      <div class="section-title mb-8">📋 Lịch sử xin phép</div>
      ${historyReqs.length === 0 ? '<div class="alert alert-info">Chưa có lịch sử</div>' :
        historyReqs.slice(0, 15).map(r => {
          const drv = driver(r.driver_id);
          return `<div class="leave-card">
            <div class="leave-card-top">
              <div class="leave-card-driver">${drv ? drv.name.split(' ').pop() : 'N/A'} · ${typeLabel(r.type)}</div>
              <div class="leave-card-status">${statusBadge(r.status)}</div>
            </div>
            <div class="leave-card-date">📅 ${r.date} · ${r.reason || ''}</div>
          </div>`;
        }).join('')}
    </div>
  </div>`;
}

// =================== MODULE 6: QUỸ & TÀI CHÍNH ===================
function adminTaiChinh() {
  const fi = D.fundInfo || { fund_start: 0, fund_current: 0, commission_total: 0, fee_total: 0 };
  const expenses = D.fundExpenses || [];
  const penalties = D.fundPenalties || [];
  const mkt = D.marketingFund || { current: 0, expenses: [] };
  const balance = getFundBalance();

  // Charts data: commission per day (last 7 days)
  const chartData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    const dayTrips = D.trips.filter(t => t.date === ds);
    const dayComm = dayTrips.reduce((s,t) => s + (t.commission_amount || 0), 0);
    chartData.push({ label: ['CN','T2','T3','T4','T5','T6','T7'][d.getDay()], value: dayComm });
  }
  const maxChart = Math.max(...chartData.map(c => c.value), 1);

  return `<div class="screen" id="scr-a-taichinh">
    <div class="header"><div class="header-top"><div><div class="header-name">💼 Quỹ & Tài Chính</div><div class="header-date">${vnDate()}</div></div></div></div>
    <div class="stats-grid" style="grid-template-columns:repeat(2,1fr)">
      <div class="stat-card fund-card-start"><div class="stat-icon">🏦</div><div class="stat-value">${fmt(fi.fund_start || balance)}</div><div class="stat-label">Quỹ đầu kỳ</div></div>
      <div class="stat-card fund-card-current"><div class="stat-icon">💰</div><div class="stat-value text-success">${fmt(fi.fund_current || balance)}</div><div class="stat-label">Quỹ hiện tại</div></div>
      <div class="stat-card"><div class="stat-icon">📈</div><div class="stat-value text-primary">${fmt(fi.commission_total || D.trips.reduce((s,t) => s + (t.commission_amount||0), 0))}</div><div class="stat-label">Tổng CK</div></div>
      <div class="stat-card"><div class="stat-icon">📋</div><div class="stat-value">${fmt(fi.fee_total || 0)}</div><div class="stat-label">Tổng phí</div></div>
    </div>
    <div class="section">
      <div class="section-title mb-8">📊 CK 7 ngày qua</div>
      <div class="chart-container"><div class="chart-bars">
        ${chartData.map(c => `<div class="chart-bar-wrapper"><div class="chart-bar-value">${c.value > 0 ? fmt(c.value) : ''}</div><div class="chart-bar" style="height:${Math.max(c.value/maxChart*100, 5)}%"></div><div class="chart-bar-label">${c.label}</div></div>`).join('')}
      </div></div>
    </div>
    <div class="section">
      <div class="section-header"><div class="section-title">💸 Chi tiêu quỹ</div><button class="btn btn-sm btn-success" onclick="G.addFundExpenseModal()">➕ Thêm</button></div>
      ${expenses.length === 0 ? '<div class="alert alert-info">Chưa có khoản chi</div>' :
        expenses.slice(0, 10).map(e => `<div class="trip-card">
          <div class="trip-header"><span class="trip-number">💸 ${e.name || e.note || 'Chi quỹ'}</span><span class="trip-time">${e.date}</span></div>
          <div class="trip-amount text-warning">-${fmtFull(e.amount)}</div>
          ${e.purpose ? `<div class="trip-note">${e.purpose}</div>` : ''}
        </div>`).join('')}
    </div>
    <div class="section">
      <div class="section-title mb-8">⚠️ Phạt</div>
      ${penalties.length === 0 ? '<div class="alert alert-info">Không có khoản phạt</div>' :
        penalties.slice(0, 10).map(p => `<div class="trip-card" style="border-left-color:var(--danger)">
          <div class="trip-header"><span class="trip-number">⚠️ ${p.name}</span><span class="trip-time">${p.date}</span></div>
          <div class="trip-amount text-danger">${fmtFull(p.amount)}</div>
          <div class="trip-note">${p.reason || ''}</div>
        </div>`).join('')}
    </div>
    <div class="section">
      <div class="section-title mb-8">📣 Quỹ Marketing</div>
      <div class="stat-card" style="opacity:1;text-align:left;padding:16px;">
        <div class="summary-row"><span class="label">Số dư</span><span class="value text-primary fw-bold">${fmtFull(mkt.current || 0)}</span></div>
        ${(mkt.expenses || []).slice(0, 5).map(e => `<div class="summary-row"><span class="label">${e.name || 'Chi'}</span><span class="value text-warning">-${fmtFull(e.amount)}</span></div>`).join('')}
      </div>
    </div>
  </div>`;
}

// =================== OLD ADMIN DASHBOARD (kept as legacy) ===================
function adminDashboard() {
  // Redirect to dispatch
  return adminDispatch();
}

function tripCard(t, showDriver) {
  return `<div class="trip-card ${t.payment_status==='debt'?'debt':''}">
    <div class="trip-header">
      <span class="trip-number">${showDriver ? '🏍️ '+driverName(t.driver_id)+' — ' : '🟣 '}${svcName(t.service_type)} ${t.distance_km ? '('+t.distance_km+'km)' : ''}</span>
      <span class="trip-time">${timeOf(t.created_at)}</span>
    </div>
    <div class="trip-amount">${fmtFull(t.amount)}</div>
    <div class="trip-note">📝 ${t.note}</div>
    <div class="trip-footer">
      <span class="trip-status ${t.payment_status}">${t.payment_status==='paid'?'✅ Đã TT':'⚠️ Nợ'}</span>
      <span class="trip-commission">${payMethodLabel(t.payment_method)} · HH: ${fmtFull(t.commission_amount||0)}</span>
    </div>
    ${t.running_total ? `<div class="trip-commission">📊 Cộng dồn: ${fmtFull(t.running_total)}</div>` : ''}
  </div>`;
}

// Số áo: từ 9 trở lên, không trùng. Trả về số trống nhỏ nhất >= 9.
function nextFreeAoSo(excludeId) {
  const used = new Set(D.users.filter(u => u.role === 'driver' && u.id !== excludeId && u.ao_so).map(u => parseInt(u.ao_so, 10)));
  let n = 9;
  while (used.has(n)) n++;
  return n;
}

function adminDrivers() {
  const drivers = D.users.filter(u => u.role === 'driver');
  const pending = drivers.filter(d => d.status === 'pending');
  const active = drivers.filter(d => d.status === 'active');
  const blocked = drivers.filter(d => d.status === 'blocked');
  return `<div class="screen" id="scr-a-drivers">
    <div class="header"><div class="header-top"><div><div class="header-name">👤 Quản lý tài xế</div><div class="header-date">${pending.length>0?'🟡 '+pending.length+' chờ duyệt · ':''}${active.length} hoạt động · ${blocked.length} khóa</div></div><div class="header-badge" onclick="G.addDriverModal()">➕</div></div></div>
    ${pending.length > 0 ? `
    <div class="section" style="margin-top:16px;">
      <div class="section-title mb-8" style="color:var(--warning);">⏳ Chờ duyệt (${pending.length})</div>
      ${pending.map(d => `<div class="driver-card" style="border-left:3px solid var(--warning);" onclick="G.driverDetail('${d.id}')">
        <div class="driver-top">
          <div class="driver-avatar" style="background:var(--warning);color:#fff;">⏳</div>
          <div><div class="driver-name">${d.name}</div><div class="driver-plate">📞 ${d.phone} · 🏍️ ${d.vehicle_plate||'Chưa có'}</div></div>
          <button class="btn btn-sm btn-success" onclick="event.stopPropagation();G.approveDriver('${d.id}')" style="padding:6px 14px;">✅ Duyệt</button>
        </div>
      </div>`).join('')}
    </div>` : ''}
    <div class="section" style="margin-top:16px;">
    ${drivers.filter(d => d.status !== 'pending').map(d => {
      const tr = todayTrips(d.id);
      const amt = tr.reduce((s,t)=>s+t.amount,0);
      const debt = tr.filter(t=>t.payment_status==='debt').reduce((s,t)=>s+t.amount,0);
      return `<div class="driver-card ${d.status==='blocked'?'blocked':''}" onclick="G.driverDetail('${d.id}')">
        <div class="driver-top">
          <div class="driver-avatar">${d.name.charAt(0)}</div>
          <div><div class="driver-name">${d.name}${d.ao_so?' · 👕#'+d.ao_so:''}${d.status==='paused'?' <span style="font-size:11px;color:var(--text-muted);">(tạm nghỉ)</span>':''}</div><div class="driver-plate">🏍️ ${d.vehicle_plate||'N/A'} · 💰 ${d.commission_value}%${d.wallet !== undefined ? ' · 💵 Ví: '+fmt(d.wallet) : ''}</div></div>
          <div class="driver-status-dot ${d.online&&d.status==='active'?'online':'offline'}"></div>
        </div>
        <div class="driver-stats">
          <div class="driver-stat"><div class="driver-stat-value">${tr.length}</div><div class="driver-stat-label">Cuốc</div></div>
          <div class="driver-stat"><div class="driver-stat-value">${fmt(amt)}</div><div class="driver-stat-label">Doanh thu</div></div>
          <div class="driver-stat"><div class="driver-stat-value ${debt>0?'text-warning':'text-success'}">${fmt(debt)}</div><div class="driver-stat-label">Nợ</div></div>
        </div>
        ${d.status==='blocked'?'<div class="alert alert-danger mt-8">🔒 Đã khóa</div>':''}
      </div>`;
    }).join('')}
    </div>
  </div>`;
}

function adminTrips() {
  const trips = allTodayTrips();
  const totAmt = trips.reduce((s,t)=>s+t.amount,0);
  return `<div class="screen" id="scr-a-trips">
    <div class="header"><div class="header-top"><div><div class="header-name">📋 Tất cả cuốc</div><div class="header-date">${trips.length} cuốc · ${fmtFull(totAmt)}</div></div></div></div>
    <div class="date-filter">
      <button class="date-chip active">Hôm nay</button><button class="date-chip">7 ngày</button><button class="date-chip">Tháng</button>
    </div>
    <div class="section">${trips.map(t => tripCard(t, true)).join('')}</div>
  </div>`;
}

function adminFinance() {
  const trips = allTodayTrips();
  const totAmt = trips.reduce((s,t)=>s+t.amount,0);
  const totPaid = trips.filter(t=>t.payment_status==='paid').reduce((s,t)=>s+t.amount,0);
  const totDebt = trips.filter(t=>t.payment_status==='debt').reduce((s,t)=>s+t.amount,0);
  const totComm = trips.reduce((s,t)=>s+(t.commission_amount||0),0);
  const cash = trips.filter(t=>t.payment_method==='cash').reduce((s,t)=>s+t.amount,0);
  const transfer = trips.filter(t=>t.payment_method==='transfer').reduce((s,t)=>s+t.amount,0);

  const chart = [];
  for (let i=6;i>=0;i--) { const d=new Date();d.setDate(d.getDate()-i);const ds=d.toISOString().split('T')[0];const dt=D.trips.filter(t=>t.date===ds);const a=dt.reduce((s,t)=>s+t.amount,0);chart.push({l:['CN','T2','T3','T4','T5','T6','T7'][d.getDay()],a}); }
  const mx = Math.max(...chart.map(c=>c.a),1);

  const drvFin = D.users.filter(u=>u.role==='driver'&&u.status==='active').map(d => {
    const tr = todayTrips(d.id); const a = tr.reduce((s,t)=>s+t.amount,0);
    return { ...d, totAmt: a, comm: tr.reduce((s,t)=>s+(t.commission_amount||0),0), debt: tr.filter(t=>t.payment_status==='debt').reduce((s,t)=>s+t.amount,0), trips: tr.length };
  });

  return `<div class="screen" id="scr-a-finance">
    <div class="header"><div class="header-top"><div><div class="header-name">💰 Tài chính</div><div class="header-date">${vnDate()}</div></div></div></div>
    <div class="stats-grid" style="grid-template-columns:repeat(2,1fr)">
      <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-value">${fmt(totAmt)}</div><div class="stat-label">Doanh thu</div></div>
      <div class="stat-card"><div class="stat-icon">💵</div><div class="stat-value text-success">${fmt(totComm)}</div><div class="stat-label">Hoa hồng</div></div>
      <div class="stat-card"><div class="stat-icon">💵</div><div class="stat-value">${fmt(cash)}</div><div class="stat-label">Tiền mặt</div></div>
      <div class="stat-card"><div class="stat-icon">🏦</div><div class="stat-value">${fmt(transfer)}</div><div class="stat-label">Chuyển khoản</div></div>
      <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-value">${fmt(totPaid)}</div><div class="stat-label">Đã TT</div></div>
      <div class="stat-card"><div class="stat-icon">⚠️</div><div class="stat-value text-warning">${fmt(totDebt)}</div><div class="stat-label">Còn nợ</div></div>
    </div>
    <div class="section"><div class="section-title mb-8">📊 7 ngày qua</div>
      <div class="chart-container"><div class="chart-bars">${chart.map(c=>`<div class="chart-bar-wrapper"><div class="chart-bar-value">${c.a>0?fmt(c.a):''}</div><div class="chart-bar" style="height:${Math.max(c.a/mx*100,5)}%"></div><div class="chart-bar-label">${c.l}</div></div>`).join('')}</div></div>
    </div>
    <div class="section"><div class="section-header"><div class="section-title">👤 Từng tài xế</div><span class="section-action" onclick="G.showA('scr-a-debts')">Công nợ →</span></div>
    ${drvFin.map(d => `<div class="driver-card"><div class="driver-top"><div class="driver-avatar">${d.name.charAt(0)}</div><div><div class="driver-name">${d.name}</div><div class="driver-plate">${d.trips} cuốc · Ví: ${fmt(d.wallet||0)}</div></div></div>
      <div class="summary-bar"><div class="summary-row"><span class="label">Doanh thu</span><span class="value">${fmtFull(d.totAmt)}</span></div><div class="summary-row"><span class="label">HH (${d.commission_value}%)</span><span class="value text-primary">${fmtFull(d.comm)}</span></div><div class="summary-row"><span class="label">Nợ</span><span class="value ${d.debt>0?'text-warning':'text-success'}">${fmtFull(d.debt)}</span></div></div>
    </div>`).join('')}
    </div>
  </div>`;
}

function adminPricing() {
  const p = D.pricing;
  return `<div class="screen" id="scr-a-pricing">
    <div class="header"><div class="header-top"><div><div class="header-name">🧮 Setup giá dịch vụ</div><div class="header-date">${p.service_types.length} loại · Chỉnh sửa trực tiếp</div></div></div></div>
    
    <div class="section" style="margin-top:16px;">
      <div class="section-header"><div class="section-title">🏍️ Cài đặt giá từng dịch vụ</div><button class="btn btn-sm btn-success" onclick="G.addServiceModal()">➕ Thêm</button></div>
      
      ${p.service_types.map((s, i) => `
        <div class="stat-card" style="opacity:1;text-align:left;padding:16px;margin-bottom:12px;${s.base_service?'border-left:3px solid var(--warning);':''}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div style="font-weight:700;font-size:16px;">${s.name}${s.multiplier>1?' <span style="color:var(--warning);font-size:12px;">×'+s.multiplier+' giá</span>':''}</div>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-sm btn-outline" onclick="G.editServiceModal(${i})" style="padding:4px 10px;font-size:11px;">✏️ Sửa</button>
              ${p.service_types.length > 1 ? `<button class="btn btn-sm btn-outline" onclick="G.deleteService(${i})" style="padding:4px 8px;font-size:11px;color:var(--danger);">❌</button>` : ''}
            </div>
          </div>
          <div class="summary-bar" style="margin:0">
            <div class="summary-row"><span class="label">💰 Mở cửa (km 0)</span><span class="value fw-bold">${fmtFull(s.base_fee)}</span></div>
            <div class="summary-row"><span class="label">🟢 2km đầu</span><span class="value fw-bold text-success">${fmtFull(s.per_km_first2)}/km</span></div>
            <div class="summary-row"><span class="label">🟡 Từ km 3 trở lên</span><span class="value fw-bold text-primary">${fmtFull(s.per_km_after)}/km</span></div>
            <div class="summary-row"><span class="label">⚠️ Giá tối thiểu</span><span class="value">${fmtFull(s.min_fee)}</span></div>
            <div class="summary-row"><span class="label">🔴 Phụ phí cao điểm</span><span class="value text-warning">+${s.surge_percent}%</span></div>
            <div class="summary-row"><span class="label">🌙 Phí đêm</span><span class="value">+${fmtFull(s.night_fee)}</span></div>
            ${s.multiplier > 1 ? `<div class="summary-row" style="background:#FEF3C7;border-radius:6px;padding:4px 8px;"><span class="label">✨ Hệ số nhân</span><span class="value fw-bold text-warning">×${s.multiplier} (${s.base_service?'dựa trên '+p.service_types.find(x=>x.id===s.base_service)?.name:''})</span></div>` : ''}
          </div>
          <div style="margin-top:10px;padding:8px 12px;background:var(--bg-secondary);border-radius:8px;">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">💡 Ví dụ tính nhanh:</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              ${[2,5,8,10,15].map(km => `<span style="font-size:11px;padding:2px 8px;background:var(--bg-card);border-radius:12px;">${km}km = <b>${fmtFull(calcFare(s.id, km))}</b></span>`).join('')}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
    
    <div class="section">
      <div class="section-title mb-8">🧮 Bảng tính giá chi tiết</div>
      <div class="stat-card" style="opacity:1;text-align:left;padding:16px;">
        <div class="form-group"><label class="form-label">Nhập km để tính giá tất cả dịch vụ</label>
          <input type="number" class="form-input" id="calc-km" placeholder="VD: 5" step="0.1" inputmode="decimal" oninput="G.liveCalc()" />
          <div class="quick-amounts" style="margin-top:8px;">
            <button class="quick-amount" onclick="$('calc-km').value='2';G.liveCalc()">2km</button>
            <button class="quick-amount" onclick="$('calc-km').value='5';G.liveCalc()">5km</button>
            <button class="quick-amount" onclick="$('calc-km').value='8';G.liveCalc()">8km</button>
            <button class="quick-amount" onclick="$('calc-km').value='10';G.liveCalc()">10km</button>
            <button class="quick-amount" onclick="$('calc-km').value='15';G.liveCalc()">15km</button>
            <button class="quick-amount" onclick="$('calc-km').value='20';G.liveCalc()">20km</button>
          </div>
        </div>
        <div id="calc-result"></div>
      </div>
    </div>
    
    <div class="section">
      <div class="section-title mb-8">📍 Bảng giá theo tuyến</div>
      ${p.zone_prices.map(z => `<div class="trip-card" style="border-left-color:var(--info)"><div class="trip-header"><span class="trip-number">📍 ${z.from} → ${z.to}</span><span class="trip-time">${fmtFull(z.price)}</span></div></div>`).join('')}
    </div>
    
    <div class="section">
      <div class="section-title mb-8">⏰ Giờ đặc biệt</div>
      <div class="stat-card" style="opacity:1;text-align:left;padding:16px;">
        <div class="summary-row"><span class="label">🔴 Cao điểm sáng</span><span class="value">${p.surge_hours.start}h-${p.surge_hours.end}h</span></div>
        <div class="summary-row"><span class="label">🔴 Cao điểm chiều</span><span class="value">${p.surge_hours.start2}h-${p.surge_hours.end2}h</span></div>
        <div class="summary-row"><span class="label">🌙 Phí đêm</span><span class="value">${p.night_hours.start}h-${p.night_hours.end}h</span></div>
        <div class="summary-row"><span class="label">⏳ Phí chờ</span><span class="value">${fmtFull(p.wait_fee_per_min)}/phút</span></div>
      </div>
    </div>
  </div>`;
}

function adminDebts() {
  const pendingDebts = D.debts.filter(d => d.status === 'pending');
  const resolvedDebts = D.debts.filter(d => d.status === 'resolved');
  const totPending = pendingDebts.reduce((s,d) => s + d.amount, 0);
  return `<div class="screen" id="scr-a-debts">
    <div class="header"><div class="header-top"><div><div class="header-name">⚠️ Công nợ</div><div class="header-date">${pendingDebts.length} chưa thu · ${fmtFull(totPending)}</div></div></div></div>
    <div class="section" style="margin-top:16px;">
      ${pendingDebts.length === 0 ? '<div class="alert alert-success">✅ Không có công nợ!</div>' : ''}
      ${pendingDebts.map(d => `<div class="trip-card debt">
        <div class="trip-header"><span class="trip-number">⚠️ ${driverName(d.driver_id)} — ${d.customer_name||'Khách'}</span><span class="trip-time">${d.date}</span></div>
        <div class="trip-amount">${fmtFull(d.amount)}</div>
        <div class="trip-note">📝 ${d.note||''} ${d.customer_phone ? '· 📞 '+d.customer_phone : ''}</div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn btn-sm btn-success" onclick="G.resolveDebt('${d.id}')">✅ Đã thu</button>
          <button class="btn btn-sm btn-outline" onclick="G.cancelDebt('${d.id}')">❌ Xóa nợ</button>
        </div>
      </div>`).join('')}
    </div>
    ${resolvedDebts.length > 0 ? `<div class="section"><div class="section-title mb-8 text-muted">✅ Đã thu (${resolvedDebts.length})</div>
      ${resolvedDebts.slice(0,5).map(d => `<div class="trip-card"><div class="trip-header"><span class="trip-number">✅ ${driverName(d.driver_id)}</span><span class="trip-time">${d.date}</span></div><div class="trip-amount text-muted" style="font-size:16px;text-decoration:line-through;">${fmtFull(d.amount)}</div></div>`).join('')}
    </div>` : ''}
  </div>`;
}

const ZALO_VIOLATION_LABELS = {
  SKIP_TRA: '⏭️ Bỏ qua trả đơn', SAI_CA: '🕒 Sai ca trực', CUOC_GIA: '🎭 Cuốc giả nghi ngờ',
  GPS_SPOOF: '📡 GPS giả nghi ngờ', DISTANCE_TOO_FAR: '📏 Quãng đường quá xa', THIEU_BUOC: '⚠️ Thiếu bước',
};

function adminZaloAudit() {
  const violations = (D.zaloViolations || []).slice(0, 100);
  const unresolved = violations.filter(v => !v.resolved_at);
  const rowHtml = (v) => {
    const drv = v.driver_id ? D.users.find(u => u.id === v.driver_id) : null;
    const name = drv ? drv.name : `${v.driver_name_zalo || 'Không rõ'} (chưa gán)`;
    const label = ZALO_VIOLATION_LABELS[v.violation_type] || v.violation_type;
    const time = v.occurred_at ? new Date(v.occurred_at).toLocaleString('vi-VN') : '';
    return `<div class="trip-card${v.resolved_at ? '' : ' debt'}">
      <div class="trip-header"><span class="trip-number">${label} — ${name}</span><span class="trip-time">${time}</span></div>
      ${v.cuoc_type ? `<div class="trip-note">📦 ${v.cuoc_type}</div>` : ''}
      ${v.distance_m != null ? `<div class="trip-note">📍 ${Math.round(v.distance_m)}m${v.speed_kmh ? ' · ' + Math.round(v.speed_kmh) + 'km/h' : ''}</div>` : ''}
      ${v.resolved_at ? `<div class="trip-note text-success">✅ Đã xử lý bởi ${v.resolved_by || ''}</div>` :
      `<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
        ${drv ? `<button class="btn btn-sm btn-outline" onclick="G.zaloFineModal('${v.id}')">💸 Phạt</button>
        <button class="btn btn-sm btn-outline" onclick="G.zaloFundModal('${v.id}')">🟣 Cộng quỹ</button>` :
        `<button class="btn btn-sm btn-outline" onclick="G.showA('scr-a-zalo-mapping')">🔗 Gán tài xế trước</button>`}
        <button class="btn btn-sm btn-outline" onclick="G.zaloResolve('${v.id}')">✔️ Bỏ qua</button>
      </div>`}
    </div>`;
  };
  return `<div class="screen" id="scr-a-zalo-audit">
    <div class="header"><div class="header-top"><div><div class="header-name">📱 Zalo Audit</div><div class="header-date">${unresolved.length} vi phạm chưa xử lý / ${violations.length} gần nhất</div></div></div></div>
    <div class="section" style="margin-top:16px;">
      ${violations.length === 0 ? '<div class="alert alert-success">✅ Chưa có vi phạm nào được ghi nhận từ bot Zalo.</div>' : violations.map(rowHtml).join('')}
    </div>
    <div class="section">
      <button class="btn btn-outline mt-8" onclick="G.showA('scr-a-settings')">← Quay lại</button>
    </div>
  </div>`;
}

function adminZaloMapping() {
  const drivers = D.users.filter(u => u.role === 'driver');
  const mappedZaloIds = new Set(drivers.map(d => d.zalo_id).filter(Boolean));
  const seen = new Map();
  (D.zaloViolations || []).forEach(v => {
    if (v.zalo_sender_id && !mappedZaloIds.has(v.zalo_sender_id)) seen.set(v.zalo_sender_id, v.driver_name_zalo);
  });
  const rows = Array.from(seen.entries());
  return `<div class="screen" id="scr-a-zalo-mapping">
    <div class="header"><div class="header-top"><div><div class="header-name">🔗 Ánh xạ tài xế Zalo</div><div class="header-date">${rows.length} tài khoản Zalo chưa gán</div></div></div></div>
    <div class="section" style="margin-top:16px;">
      ${rows.length === 0 ? '<div class="alert alert-success">✅ Tất cả tài khoản Zalo thấy trong vi phạm đã được gán tài xế.</div>' :
        rows.map(([zid, name]) => `<div class="trip-card">
          <div class="trip-header"><span class="trip-number">💬 ${name || 'Không tên'}</span></div>
          <div class="trip-note" style="font-size:11px;color:var(--text-muted);">Zalo ID: ${zid}</div>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <select class="form-input" id="zmap-${zid}" style="flex:1;">
              <option value="">— Chọn tài xế —</option>
              ${drivers.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
            </select>
            <button class="btn btn-sm btn-primary" onclick="G.assignZaloDriver('${zid}')">Gán</button>
          </div>
        </div>`).join('')}
    </div>
    <div class="section">
      <button class="btn btn-outline mt-8" onclick="G.showA('scr-a-zalo-audit')">← Quay lại</button>
    </div>
  </div>`;
}

// ============================================================
// LỊCH TRỰC ĐIỂM (duty roster) — 3 suất/ngày, tự gợi ý người thay
// ============================================================
const DUTY_SLOTS = [
  { id: 'som', name: 'Ca ngày sớm', time: '6h30 → 22h', cap: 2 },
  { id: 'tre', name: 'Ca ngày trễ', time: '9h30 → tối', cap: 0 },   // 0 = đầy đủ full-ca, không giới hạn
  { id: 'toi', name: 'Ca tối',      time: '17h-18h30 → 24h', cap: 4 },
];
const DUTY_WD = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
let dutySelectedDay = (new Date().getDay() + 6) % 7; // 0=T2 ... 6=CN

function ensureDuty() {
  if (!D.settings.duty_roster) D.settings.duty_roster = {};
  for (let w = 0; w < 7; w++) {
    if (!D.settings.duty_roster[w]) D.settings.duty_roster[w] = { som: [], tre: [], toi: [] };
    for (const s of ['som', 'tre', 'toi']) if (!D.settings.duty_roster[w][s]) D.settings.duty_roster[w][s] = [];
  }
  if (!D.settings.duty_constraints) D.settings.duty_constraints = {};
}

function dutyCountWeek(driverId) {
  ensureDuty();
  let n = 0;
  for (let w = 0; w < 7; w++) for (const s of ['som', 'tre', 'toi']) if (D.settings.duty_roster[w][s].includes(driverId)) n++;
  return n;
}

function dutyConstrained(driverId, slot, wd) {
  ensureDuty();
  return (D.settings.duty_constraints[driverId] || []).includes(slot + ':' + wd);
}

function dutyAssignedThatDay(driverId, wd) {
  ensureDuty();
  return ['som', 'tre', 'toi'].some(s => D.settings.duty_roster[wd][s].includes(driverId));
}

// 🤖 AI tự xếp lịch cả tuần — phủ đủ suất, tôn trọng ràng buộc + luật xoay + cân bằng ca
function aiAutoFillRoster() {
  ensureDuty();
  const active = D.users.filter(u => u.role === 'driver' && u.status === 'active');
  const roster = {};
  for (let w = 0; w < 7; w++) roster[w] = { som: [], tre: [], toi: [] };
  const weekCount = {};
  active.forEach(d => weekCount[d.id] = 0);
  const notes = [];
  const canDo = (id, slot, wd) => !(D.settings.duty_constraints[id] || []).includes(slot + ':' + wd);

  for (let w = 0; w < 7; w++) {
    const prevToi = w > 0 ? roster[w - 1].toi : [];
    const used = new Set();

    // 1) Ca tối (cần 4): ưu tiên ít ca, né người vừa trực tối hôm qua (cho nghỉ)
    const poolToi = active.filter(d => canDo(d.id, 'toi', w))
      .sort((a, b) => (prevToi.includes(a.id) - prevToi.includes(b.id)) || (weekCount[a.id] - weekCount[b.id]));
    for (const d of poolToi) {
      if (roster[w].toi.length >= 4) break;
      roster[w].toi.push(d.id); used.add(d.id); weekCount[d.id]++;
    }
    if (roster[w].toi.length < 4) notes.push(`${DUTY_WD[w]}: ca tối thiếu ${4 - roster[w].toi.length} người`);

    // 2) Ca ngày sớm (cần 2): né người trực tối hôm qua (họ vào trễ), ưu tiên ít ca
    const poolSom = active.filter(d => !used.has(d.id) && canDo(d.id, 'som', w) && !prevToi.includes(d.id))
      .sort((a, b) => weekCount[a.id] - weekCount[b.id]);
    for (const d of poolSom) {
      if (roster[w].som.length >= 2) break;
      roster[w].som.push(d.id); used.add(d.id); weekCount[d.id]++;
    }
    if (roster[w].som.length < 2) notes.push(`${DUTY_WD[w]}: ca sớm thiếu ${2 - roster[w].som.length} người`);

    // 3) Ca ngày trễ (đầy đủ còn lại): ưu tiên xếp người trực tối hôm qua vào đây (luật xoay)
    const rest = active.filter(d => !used.has(d.id))
      .sort((a, b) => (prevToi.includes(b.id) - prevToi.includes(a.id)));
    for (const d of rest) {
      if (!canDo(d.id, 'tre', w)) { notes.push(`${DUTY_WD[w]}: ${driverName(d.id)} vướng ràng buộc ca trễ → bỏ trống`); continue; }
      roster[w].tre.push(d.id); used.add(d.id); weekCount[d.id]++;
    }
  }
  return { roster, notes, weekCount };
}

let _aiProposal = null;

// Gợi ý người trực thay: rảnh ngày đó + không vướng ràng buộc, ai ít ca hơn xếp trước
function suggestSubstitutes(slot, wd, excludeId) {
  ensureDuty();
  return D.users
    .filter(u => u.role === 'driver' && u.status === 'active' && u.id !== excludeId)
    .filter(d => !dutyAssignedThatDay(d.id, wd) && !dutyConstrained(d.id, slot, wd))
    .sort((a, b) => dutyCountWeek(a.id) - dutyCountWeek(b.id))
    .slice(0, 3);
}

function adminDutyRoster() {
  ensureDuty();
  const wd = dutySelectedDay;
  const roster = D.settings.duty_roster[wd];
  const tabs = DUTY_WD.map((n, i) =>
    `<button class="date-chip ${i === wd ? 'active' : ''}" onclick="G.dutyPickDay(${i})">${n}</button>`
  ).join('');
  const slotCards = DUTY_SLOTS.map(slot => {
    const ids = roster[slot.id] || [];
    const capTxt = slot.cap ? `cần ${slot.cap}` : 'đầy đủ full-ca';
    const shortfall = slot.cap && ids.length < slot.cap;
    const chips = ids.map(id => {
      const d = driver(id);
      const nm = d ? d.name : '?';
      return `<span style="display:inline-flex;align-items:center;gap:6px;background:var(--bg-card);border:1px solid var(--border);border-radius:20px;padding:4px 10px;margin:3px;font-size:13px;">
        ${nm}
        <span onclick="G.dutyMarkOff('${slot.id}',${wd},'${id}')" title="Nghỉ → gợi ý thay" style="cursor:pointer;color:var(--warning);">🔄</span>
        <span onclick="G.dutyRemove('${slot.id}',${wd},'${id}')" title="Gỡ" style="cursor:pointer;color:var(--danger);">✕</span>
      </span>`;
    }).join('');
    return `<div class="stat-card" style="opacity:1;text-align:left;padding:14px;margin-bottom:10px;${shortfall ? 'border:1px solid var(--warning);' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <div><b>${slot.name}</b> <span style="font-size:12px;color:var(--text-muted);">${slot.time}</span></div>
        <span style="font-size:12px;color:${shortfall ? 'var(--warning)' : 'var(--text-muted)'};">${ids.length}/${capTxt}</span>
      </div>
      <div>${chips || '<span style="font-size:13px;color:var(--text-muted);">Chưa có ai</span>'}</div>
      <button class="btn btn-sm btn-outline mt-8" onclick="G.dutyAddModal('${slot.id}',${wd})">➕ Thêm tài xế</button>
    </div>`;
  }).join('');
  return `<div class="screen" id="scr-a-duty">
    <div class="header"><div class="header-top"><div><div class="header-name">🕒 Lịch trực</div><div class="header-date">Phân ca theo thứ · tự gợi ý người thay</div></div><div class="header-badge" onclick="G.dutyConstraintPick()">⚙️</div></div></div>
    <div class="section" style="margin-top:12px;">
      <button class="btn btn-primary" onclick="G.dutyAIFill()">🤖 AI xếp lịch cả tuần</button>
    </div>
    <div class="date-filter" style="flex-wrap:wrap;">${tabs}</div>
    <div class="section">${slotCards}</div>
    <div class="section">
      <div class="alert alert-info" style="font-size:12px;">🔄 = báo nghỉ (hệ thống gợi ý người thay) · ⚙️ góc trên = cài ràng buộc từng tài xế (VD anh Ngô cấm ca tối T2-T5)</div>
      <button class="btn btn-outline mt-8" onclick="G.showA('scr-a-settings')">← Quay lại</button>
    </div>
  </div>`;
}

function getFundBalance() {
  const inAmt = (D.fundTransactions||[]).reduce((s,t)=>s+(t.amount||0),0);
  const outAmt = (D.fundExpenses||[]).reduce((s,e)=>s+(e.amount||0),0);
  return inAmt - outAmt;
}

function adminQuyConfig() {
  const f = (D.settings.fund) || { per_trip:{enabled:false,amount:0}, per_day:{enabled:false,amount:0,absent_policy:'skip'}, percent:{enabled:false,value:0}, purpose:'' };
  const tripAmts = [500, 1000, 2000, 3000, 5000];
  const dayAmts = [5000, 10000, 15000, 20000, 30000];
  const pctVals = [1, 3, 5, 7, 10, 15];

  const sampleTrips = 30, sampleAmount = 30000;
  const sampleComm = sampleAmount * 0.2;
  let inFund = 0; const inDriver = sampleAmount * sampleTrips;
  if (f.per_trip.enabled) inFund += f.per_trip.amount * sampleTrips;
  if (f.percent.enabled) inFund += sampleComm * sampleTrips * f.percent.value / 100;
  if (f.per_day.enabled) inFund += f.per_day.amount;
  const driverNet = inDriver - inFund;

  const radioPick = (group, vals, selected) => vals.map(v =>
    `<label style="display:inline-block;padding:6px 12px;margin:4px;border-radius:8px;background:${selected===v?'var(--primary)':'var(--bg-card)'};color:${selected===v?'#fff':'var(--text)'};cursor:pointer;font-weight:600;border:1px solid var(--border);">
      <input type="radio" name="quy-${group}" value="${v}" ${selected===v?'checked':''} style="display:none" onchange="G.previewQuy()" /> ${fmt(v)}${group==='pct'?'%':'đ'}
    </label>`).join('');

  return `<div class="screen" id="scr-a-quy-config">
    <div class="header"><div class="header-top"><div><div class="header-name">⚙️ Cài đặt quỹ</div><div class="header-date">Quỹ hiện: ${fmt(getFundBalance())}đ</div></div></div></div>

    <div class="section" style="margin-top:16px;">
      <div class="stat-card" style="opacity:1;text-align:left;padding:16px;">
        <label class="form-label">Mục đích quỹ</label>
        <input type="text" class="form-input" id="quy-purpose" value="${(f.purpose||'').replace(/"/g,'&quot;')}" placeholder="VD: Bảo trì xe + hỗ trợ anh em" />
      </div>
    </div>

    <div class="section">
      <div class="section-title mb-8">📋 Phương thức đóng quỹ (chọn 1 hoặc nhiều)</div>

      <div class="stat-card" style="opacity:1;text-align:left;padding:16px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <input type="checkbox" id="quy-trip-en" ${f.per_trip.enabled?'checked':''} onchange="G.previewQuy()" style="width:20px;height:20px;" />
          <label for="quy-trip-en" style="font-weight:700;">Đóng theo CUỐC (cố định)</label>
        </div>
        <div style="margin-left:30px;">
          <div style="margin-bottom:6px;color:var(--text-muted);font-size:13px;">Mỗi cuốc trừ:</div>
          <div>${radioPick('trip', tripAmts, f.per_trip.amount)}</div>
          <input type="number" class="form-input" id="quy-trip-custom" placeholder="Tự nhập (đ)" value="${tripAmts.includes(f.per_trip.amount)?'':f.per_trip.amount||''}" oninput="G.previewQuy()" style="margin-top:8px;" />
        </div>
      </div>

      <div class="stat-card" style="opacity:1;text-align:left;padding:16px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <input type="checkbox" id="quy-day-en" ${f.per_day.enabled?'checked':''} onchange="G.previewQuy()" style="width:20px;height:20px;" />
          <label for="quy-day-en" style="font-weight:700;">Đóng theo NGÀY (cố định)</label>
        </div>
        <div style="margin-left:30px;">
          <div style="margin-bottom:6px;color:var(--text-muted);font-size:13px;">Mỗi ngày trừ:</div>
          <div>${radioPick('day', dayAmts, f.per_day.amount)}</div>
          <input type="number" class="form-input" id="quy-day-custom" placeholder="Tự nhập (đ)" value="${dayAmts.includes(f.per_day.amount)?'':f.per_day.amount||''}" oninput="G.previewQuy()" style="margin-top:8px;" />
          <div style="margin-top:10px;">
            <div style="font-size:13px;margin-bottom:4px;">Khi tài xế nghỉ:</div>
            <label style="display:inline-flex;align-items:center;gap:6px;margin-right:16px;"><input type="radio" name="quy-absent" value="skip" ${f.per_day.absent_policy==='skip'?'checked':''} /> Không thu (công bằng)</label>
            <label style="display:inline-flex;align-items:center;gap:6px;"><input type="radio" name="quy-absent" value="bu" ${f.per_day.absent_policy==='bu'?'checked':''} /> Bù vào ngày sau</label>
          </div>
        </div>
      </div>

      <div class="stat-card" style="opacity:1;text-align:left;padding:16px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <input type="checkbox" id="quy-pct-en" ${f.percent.enabled?'checked':''} onchange="G.previewQuy()" style="width:20px;height:20px;" />
          <label for="quy-pct-en" style="font-weight:700;">Đóng theo PHẦN TRĂM commission</label>
        </div>
        <div style="margin-left:30px;">
          <div style="margin-bottom:6px;color:var(--text-muted);font-size:13px;">Lấy % từ hoa hồng:</div>
          <div>${radioPick('pct', pctVals, f.percent.value)}</div>
          <input type="number" class="form-input" id="quy-pct-custom" placeholder="Tự nhập (%)" value="${pctVals.includes(f.percent.value)?'':f.percent.value||''}" oninput="G.previewQuy()" style="margin-top:8px;" />
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title mb-8">👁️ Xem trước tác động</div>
      <div id="quy-preview" class="stat-card" style="opacity:1;text-align:left;padding:16px;background:var(--bg-secondary);">
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">Ví dụ: tài xế chạy ${sampleTrips} cuốc, mỗi cuốc ${fmt(sampleAmount)}đ:</div>
        <div class="summary-row"><span class="label">💰 Doanh thu</span><span class="value">${fmt(inDriver)}đ</span></div>
        <div class="summary-row"><span class="label">🟣 Vào quỹ</span><span class="value text-primary fw-bold">${fmt(inFund)}đ</span></div>
        <div class="summary-row"><span class="label">💵 Tài xế nhận</span><span class="value text-success fw-bold">${fmt(driverNet)}đ</span></div>
      </div>
    </div>

    <div class="section">
      <button class="btn btn-primary" onclick="G.saveQuyConfig()">💾 Lưu cài đặt quỹ</button>
      <button class="btn btn-outline mt-8" onclick="G.showA('scr-a-settings')">← Quay lại</button>
    </div>
  </div>`;
}

function adminQuyReport() {
  const balance = getFundBalance();
  const tx = D.fundTransactions || [];
  const ex = D.fundExpenses || [];
  const tdy = today();
  const ym = tdy.substring(0,7);
  const txMonth = tx.filter(t => (t.date||'').startsWith(ym));
  const exMonth = ex.filter(e => (e.date||'').startsWith(ym));
  const txToday = tx.filter(t => t.date === tdy);
  const exToday = ex.filter(e => e.date === tdy);
  const sumIn = arr => arr.reduce((s,t)=>s+(t.amount||0),0);
  const inToday = sumIn(txToday), inMonth = sumIn(txMonth);
  const outToday = sumIn(exToday), outMonth = sumIn(exMonth);
  const drvAgg = {};
  txMonth.forEach(t => {
    if (!t.driver_id) return;
    if (!drvAgg[t.driver_id]) drvAgg[t.driver_id] = { count:0, amount:0 };
    drvAgg[t.driver_id].count++; drvAgg[t.driver_id].amount += t.amount;
  });
  const drvList = Object.entries(drvAgg).map(([did,v]) => ({ name: driverName(did), ...v })).sort((a,b)=>b.amount-a.amount);

  return `<div class="screen" id="scr-a-quy-report">
    <div class="header"><div class="header-top"><div><div class="header-name">🟣 Báo cáo quỹ</div><div class="header-date">Cập nhật: ${vnDate()}</div></div></div></div>

    <div class="section" style="margin-top:16px;">
      <div class="stat-card" style="opacity:1;text-align:left;padding:20px;background:linear-gradient(135deg,#7C3AED,#A855F7);color:#fff;">
        <div style="font-size:13px;opacity:0.9;">QUỸ HIỆN TẠI</div>
        <div style="font-size:32px;font-weight:800;margin:8px 0;">${fmtFull(balance)}</div>
        <div style="font-size:12px;opacity:0.85;">${(D.settings.fund?.purpose)||'Quỹ chung'}</div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card"><div class="stat-icon">⬆️</div><div class="stat-value text-success">${fmt(inToday)}</div><div class="stat-label">Thu hôm nay</div></div>
      <div class="stat-card"><div class="stat-icon">⬇️</div><div class="stat-value text-warning">${fmt(outToday)}</div><div class="stat-label">Chi hôm nay</div></div>
      <div class="stat-card"><div class="stat-icon">📅</div><div class="stat-value">${fmt(inMonth)}</div><div class="stat-label">Thu tháng này</div></div>
      <div class="stat-card"><div class="stat-icon">📅</div><div class="stat-value text-warning">${fmt(outMonth)}</div><div class="stat-label">Chi tháng này</div></div>
    </div>

    <div class="section">
      <div class="section-header"><div class="section-title">💸 Chi tiêu quỹ</div><button class="btn btn-sm btn-success" onclick="G.addFundExpenseModal()">➕ Thêm chi</button></div>
      ${exMonth.length === 0 ? '<div class="alert alert-info">Chưa có khoản chi nào tháng này</div>' :
        exMonth.slice(0,10).map(e => `<div class="trip-card">
          <div class="trip-header"><span class="trip-number">🔧 ${e.note||'Chi quỹ'}</span><span class="trip-time">${e.date}</span></div>
          <div class="trip-amount text-warning">-${fmtFull(e.amount)}</div>
          ${e.target ? `<div class="trip-note">👤 Cho: ${e.target}</div>` : ''}
        </div>`).join('')}
    </div>

    <div class="section">
      <div class="section-title mb-8">👥 Đóng góp tháng (theo tài xế)</div>
      ${drvList.length === 0 ? '<div class="alert alert-info">Chưa có đóng góp tháng này</div>' :
        drvList.map(d => `<div class="trip-card">
          <div class="trip-header"><span class="trip-number">👤 ${d.name}</span><span class="trip-time">${d.count} cuốc</span></div>
          <div class="trip-amount text-primary">${fmtFull(d.amount)}</div>
        </div>`).join('')}
    </div>

    <div class="section">
      <div class="section-title mb-8">📋 Lịch sử thu gần nhất</div>
      ${txMonth.slice(-10).reverse().map(t => `<div class="trip-card">
        <div class="trip-header"><span class="trip-number">${driverName(t.driver_id)} · ${t.source||'cuốc'}</span><span class="trip-time">${t.date}</span></div>
        <div class="trip-amount text-success">+${fmtFull(t.amount)}</div>
      </div>`).join('')}
    </div>

    <div class="section">
      <button class="btn btn-outline mt-8" onclick="G.showA('scr-a-settings')">← Quay lại</button>
    </div>
  </div>`;
}

function adminSettings() {
  return `<div class="screen" id="scr-a-settings">
    <div class="header"><div class="header-top"><div><div class="header-name">⚙️ Cài đặt & Thêm</div></div></div></div>
    <div class="section" style="margin-top:16px;">
      <div class="section-title mb-8">🛣️ Hành trình (giám sát Zalo)</div>
      <div class="driver-card" onclick="G.showA('scr-a-zalo-audit')" style="cursor:pointer;border-left:3px solid #0068FF;"><div class="driver-top"><div class="driver-avatar" style="font-size:24px;background:#0068FF;color:#fff;">📱</div><div><div class="driver-name">Zalo Audit</div><div class="driver-plate">${(D.zaloViolations||[]).filter(v=>!v.resolved_at).length} vi phạm chưa xử lý</div></div></div></div>
      <div class="driver-card" onclick="G.showA('scr-a-zalo-mapping')" style="cursor:pointer"><div class="driver-top"><div class="driver-avatar" style="font-size:24px">🔗</div><div><div class="driver-name">Ánh xạ tài xế Zalo</div><div class="driver-plate">Gán Zalo ID vào tài khoản tài xế</div></div></div></div>
    </div>
    <div class="section">
      <div class="section-title mb-8">💰 Tài chính & Lịch trực</div>
      <div class="driver-card" onclick="G.showA('scr-a-duty')" style="cursor:pointer;border-left:3px solid #F59E0B;"><div class="driver-top"><div class="driver-avatar" style="font-size:24px;background:#F59E0B;color:#fff;">🕒</div><div><div class="driver-name">Lịch trực</div><div class="driver-plate">Phân ca theo thứ · tự gợi ý người thay</div></div></div></div>
      <div class="driver-card" onclick="G.showA('scr-a-pricing')" style="cursor:pointer"><div class="driver-top"><div class="driver-avatar" style="font-size:24px">🧮</div><div><div class="driver-name">Bảng giá dịch vụ</div><div class="driver-plate">Cài đặt giá theo km, tuyến, giờ</div></div></div></div>
      <div class="driver-card" onclick="G.showA('scr-a-quy-config')" style="cursor:pointer;border-left:3px solid #7C3AED;"><div class="driver-top"><div class="driver-avatar" style="font-size:24px;background:#7C3AED;color:#fff;">🟣</div><div><div class="driver-name">Cài đặt quỹ</div><div class="driver-plate">${D.settings.fund?.per_trip?.enabled?'☑Cuốc ':''}${D.settings.fund?.per_day?.enabled?'☑Ngày ':''}${D.settings.fund?.percent?.enabled?'☑%':''} · ${(D.settings.fund?.purpose||'Chưa cài')}</div></div></div></div>
      <div class="driver-card" onclick="G.showA('scr-a-quy-report')" style="cursor:pointer;border-left:3px solid #10B981;"><div class="driver-top"><div class="driver-avatar" style="font-size:24px;background:#10B981;color:#fff;">📊</div><div><div class="driver-name">Báo cáo quỹ</div><div class="driver-plate">Hiện có: ${fmt(getFundBalance())}đ</div></div></div></div>
      <div class="driver-card" onclick="G.showA('scr-a-debts')" style="cursor:pointer"><div class="driver-top"><div class="driver-avatar" style="font-size:24px">⚠️</div><div><div class="driver-name">Quản lý công nợ</div><div class="driver-plate">${D.debts.filter(d=>d.status==='pending').length} khoản chưa thu</div></div></div></div>
    </div>
    <div class="section">
      <div class="section-title mb-8">⚙️ Khác</div>
      <div class="driver-card" style="cursor:pointer"><div class="driver-top"><div class="driver-avatar" style="font-size:24px">📊</div><div><div class="driver-name">Nhật ký hoạt động</div><div class="driver-plate">${D.activityLog.length} bản ghi</div></div></div></div>
    </div>
    <div class="section">
      <div class="section-title mb-8">💰 Hoa hồng mặc định</div>
      <div class="stat-card" style="opacity:1;text-align:left;padding:20px;">
        <div class="form-group"><label class="form-label">Loại</label>
          <select class="form-input" id="set-ct" onchange="$('set-cl').textContent=this.value==='percent'?'Phần trăm (%)':'Số tiền/cuốc (đ)'"><option value="percent" ${D.settings.default_commission_type==='percent'?'selected':''}>Phần trăm (%)</option><option value="fixed" ${D.settings.default_commission_type==='fixed'?'selected':''}>Cố định/cuốc</option></select>
        </div>
        <div class="form-group"><label class="form-label" id="set-cl">Phần trăm (%)</label><input type="number" class="form-input" id="set-cv" value="${D.settings.default_commission_value}" /></div>
        <button class="btn btn-primary" onclick="G.saveSettings()">💾 Lưu</button>
      </div>
    </div>
    <div class="section">
      <div class="section-title mb-8">📱 Ứng dụng</div>
      <div class="stat-card" style="opacity:1;text-align:left;padding:16px;">
        <div class="summary-row"><span class="label">Phiên bản</span><span class="value">2.0 Pro</span></div>
        <div class="summary-row"><span class="label">Tài xế</span><span class="value">${D.users.filter(u=>u.role==='driver').length}</span></div>
        <div class="summary-row"><span class="label">Tổng cuốc</span><span class="value">${D.trips.length}</span></div>
        <div class="summary-row"><span class="label">Hóa đơn</span><span class="value">${D.invoices.length}</span></div>
      </div>
    </div>
    <div class="section">
      <button class="btn btn-danger" onclick="G.logout()">🚪 Đăng xuất</button>
      <button class="btn btn-outline mt-8" onclick="G.reset()">🔄 Reset dữ liệu mẫu</button>
    </div>
  </div>`;
}

function adminNav() {
  return `<div class="bottom-nav admin-nav-bar" id="nav-a">
    <button class="nav-item active" onclick="G.showA('scr-a-dispatch')"><span class="nav-icon">📡</span><span class="nav-label">Điều phối</span></button>
    <button class="nav-item" onclick="G.showA('scr-a-chietkhau')"><span class="nav-icon">💰</span><span class="nav-label">Chiết khấu</span></button>
    <button class="nav-item" onclick="G.showA('scr-a-donhang')"><span class="nav-icon">📋</span><span class="nav-label">Đơn hàng</span></button>
    <button class="nav-item" onclick="G.showA('scr-a-congno')"><span class="nav-icon">📕</span><span class="nav-label">Công nợ</span></button>
    <button class="nav-item" onclick="G.showA('scr-a-xinphep')"><span class="nav-icon">🙋</span><span class="nav-label">Xin phép</span></button>
    <button class="nav-item" onclick="G.showA('scr-a-taichinh')"><span class="nav-icon">💼</span><span class="nav-label">Tài chính</span></button>
    <button class="nav-item" onclick="G.showA('scr-a-settings')"><span class="nav-icon">⚙️</span><span class="nav-label">Cài đặt</span></button>
  </div>`;
}

// ============================================================
// DRIVER SCREENS
// ============================================================
function renderDriver() {
  app().innerHTML = [
    driverHome(), driverHistory(), driverReport(), driverWallet(), driverProfile(),
    `<button class="fab-add" id="fab-main" onclick="G.fabAction()">${activeTrip ? '🔴' : '➕'}</button>`,
    `<div class="modal-overlay" id="modal-ov" onclick="G.closeModal()"><div class="modal-sheet" onclick="event.stopPropagation()" id="modal-c"></div></div>`,
    driverNav()
  ].join('');
  show('scr-d-home','nav-d', driverScreens);
  startDriverGPS();
  if (activeTrip) {
    updateActiveTripBar();
    const fab = document.getElementById('fab-main');
    if (fab) { fab.style.background = 'linear-gradient(135deg, #EF4444, #DC2626)'; }
  }
}

function updateActiveTripBar() {
  const bar = document.getElementById('active-trip-bar');
  if (!bar || !activeTrip) { if(bar) bar.style.display='none'; return; }
  const elapsed = Math.round((Date.now() - activeTrip.startTime.getTime()) / 60000);
  bar.style.display = 'block';
  bar.className = 'gps-status';
  bar.style.background = '#FEF3C7';
  bar.style.color = '#92400E';
  bar.innerHTML = `🟡 Đang chạy cuốc từ <b>${activeTrip.startAddress?.substring(0,25)||'...'}</b> — ${elapsed} phút<br><small>Bấm 🔴 để kết thúc & tự động tính tiền</small>`;
}

const driverScreens = ['scr-d-home','scr-d-history',null,'scr-d-wallet','scr-d-profile'];

function driverHome() {
  const tr = todayTrips(U.id);
  const tot = tr.reduce((s,t)=>s+t.amount,0);
  const paid = tr.filter(t=>t.payment_status==='paid').reduce((s,t)=>s+t.amount,0);
  const debt = tr.filter(t=>t.payment_status==='debt').reduce((s,t)=>s+t.amount,0);
  const comm = tr.reduce((s,t)=>s+(t.commission_amount||0),0);
  const pendingDebts = D.debts.filter(d => d.driver_id === U.id && d.status === 'pending');
  const totalDebtAmt = pendingDebts.reduce((s,d) => s + d.amount, 0);
  return `<div class="screen" id="scr-d-home">
    <div class="header"><div class="header-top">
      <div><div class="header-greeting">Xin chào 👋</div><div class="header-name">${U.name}</div><div class="header-date">📅 ${vnDate()}${isSurge()?' · 🔴 Cao điểm':''}${isNight()?' · 🌙 Đêm':''}</div></div>
      <div class="header-badge" onclick="G.showD('scr-d-profile')">${U.name.charAt(0)}</div>
    </div></div>
    <div id="gps-indicator" class="gps-status" onclick="G.toggleGPS()"><div class="gps-pulse"></div> 📍 Đang kết nối GPS...</div>
    <div id="active-trip-bar" style="display:none;"></div>

    <!-- ⚡ QUICK ENTRY — Nhập nhanh cuốc xe -->
    <div class="section" style="margin-top:8px;">
      <div class="stat-card" style="opacity:1;padding:16px;background:linear-gradient(135deg,#7C3AED 0%,#A855F7 100%);color:#fff;border:none;">
        <div style="font-size:15px;font-weight:700;margin-bottom:12px;">⚡ Nhập nhanh cuốc</div>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="number" id="q-amt" placeholder="Số tiền cuốc..." inputmode="numeric"
            style="flex:1;padding:14px;border-radius:12px;border:none;font-size:20px;font-weight:800;background:rgba(255,255,255,0.95);color:#1a1a2e;text-align:center;"
            oninput="G.quickCalc()" />
        </div>
        <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
          <button onclick="G.quickSet(15000)" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.4);background:rgba(255,255,255,0.15);color:#fff;font-weight:600;font-size:13px;cursor:pointer;">15k</button>
          <button onclick="G.quickSet(20000)" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.4);background:rgba(255,255,255,0.15);color:#fff;font-weight:600;font-size:13px;cursor:pointer;">20k</button>
          <button onclick="G.quickSet(30000)" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.4);background:rgba(255,255,255,0.15);color:#fff;font-weight:600;font-size:13px;cursor:pointer;">30k</button>
          <button onclick="G.quickSet(50000)" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.4);background:rgba(255,255,255,0.15);color:#fff;font-weight:600;font-size:13px;cursor:pointer;">50k</button>
          <button onclick="G.quickSet(80000)" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.4);background:rgba(255,255,255,0.15);color:#fff;font-weight:600;font-size:13px;cursor:pointer;">80k</button>
          <button onclick="G.quickSet(100000)" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.4);background:rgba(255,255,255,0.15);color:#fff;font-weight:600;font-size:13px;cursor:pointer;">100k</button>
          <button onclick="G.quickSet(150000)" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.4);background:rgba(255,255,255,0.15);color:#fff;font-weight:600;font-size:13px;cursor:pointer;">150k</button>
        </div>
        <div id="q-preview" style="margin-top:10px;padding:10px 12px;background:rgba(0,0,0,0.2);border-radius:10px;display:none;">
          <div style="display:flex;justify-content:space-between;font-size:13px;"><span>Chiếc khấu ${U.commission_value}%</span><span id="q-comm" style="font-weight:700;">0đ</span></div>
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:4px;"><span>Anh giữ lại</span><span id="q-keep" style="font-weight:700;color:#34D399;">0đ</span></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button onclick="G.quickSaveTrip('paid')" style="flex:1;padding:14px;border-radius:12px;border:none;background:#10B981;color:#fff;font-size:15px;font-weight:700;cursor:pointer;">✅ Đã TT</button>
          <button onclick="G.quickSaveTrip('debt')" style="flex:1;padding:14px;border-radius:12px;border:none;background:#F59E0B;color:#fff;font-size:15px;font-weight:700;cursor:pointer;">⚠️ Nợ</button>
        </div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card"><div class="stat-icon">🏍️</div><div class="stat-value">${tr.length}</div><div class="stat-label">Cuốc</div></div>
      <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-value">${fmt(tot)}</div><div class="stat-label">Tổng</div></div>
      <div class="stat-card"><div class="stat-icon">💵</div><div class="stat-value text-success">${fmt(tot-comm)}</div><div class="stat-label">Giữ lại</div></div>
      <div class="stat-card"><div class="stat-icon">📈</div><div class="stat-value text-primary">${fmt(comm)}</div><div class="stat-label">Nộp CT</div></div>
      <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-value">${fmt(paid)}</div><div class="stat-label">Đã TT</div></div>
      <div class="stat-card"><div class="stat-icon">⚠️</div><div class="stat-value text-warning">${fmt(debt)}</div><div class="stat-label">Nợ</div></div>
    </div>

    <!-- 💳 Công nợ nhanh -->
    ${pendingDebts.length > 0 ? `
    <div class="section">
      <div class="section-header"><div class="section-title">⚠️ Công nợ (${pendingDebts.length})</div><span class="section-action" style="color:var(--warning);font-weight:700;">${fmtFull(totalDebtAmt)}</span></div>
      ${pendingDebts.slice(0,3).map(d => `
        <div class="trip-card debt" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;">
          <div>
            <div style="font-weight:600;">${d.customer_name || 'Khách'} ${d.customer_phone ? '· '+d.customer_phone : ''}</div>
            <div style="font-size:12px;color:var(--text-muted);">${d.date} · ${d.note || ''}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-weight:700;color:var(--warning);">${fmtFull(d.amount)}</span>
            <button onclick="G.quickResolveDebt('${d.id}')" style="padding:6px 10px;border-radius:8px;border:none;background:#10B981;color:#fff;font-weight:600;font-size:12px;cursor:pointer;">✅ Thu</button>
          </div>
        </div>
      `).join('')}
      ${pendingDebts.length > 3 ? `<div style="text-align:center;padding:8px;"><button class="btn btn-sm btn-outline" onclick="G.showDriverDebts()">Xem tất cả ${pendingDebts.length} khoản →</button></div>` : ''}
    </div>` : ''}

    <div class="section"><div class="section-header"><div class="section-title">🟣 Cuốc hôm nay</div><span class="section-action" onclick="G.showD('scr-d-history')">Lịch sử →</span></div>
      ${tr.length===0?'<div class="alert alert-warning">Nhập số tiền ở ô trên rồi bấm ✅ hoặc ⚠️!</div>':''}
      ${tr.map(t => tripCard(t, false)).join('')}
    </div>
  </div>`;
}

function driverHistory() {
  const tr = todayTrips(U.id);
  return `<div class="screen" id="scr-d-history">
    <div class="header"><div class="header-top"><div><div class="header-name">📋 Lịch sử</div><div class="header-date">${tr.length} cuốc · ${fmtFull(tr.reduce((s,t)=>s+t.amount,0))}</div></div></div></div>
    <div class="date-filter"><button class="date-chip active">Hôm nay</button><button class="date-chip">Tuần</button><button class="date-chip">Tháng</button></div>
    <div class="section">${tr.map(t => tripCard(t, false)).join('')}</div>
  </div>`;
}

function driverReport() {
  const tr = todayTrips(U.id); const tot=tr.reduce((s,t)=>s+t.amount,0); const comm=tr.reduce((s,t)=>s+(t.commission_amount||0),0);
  const chart=[];for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const ds=d.toISOString().split('T')[0];const dt=D.trips.filter(t=>t.driver_id===U.id&&t.date===ds);chart.push({l:['CN','T2','T3','T4','T5','T6','T7'][d.getDay()],a:dt.reduce((s,t)=>s+t.amount,0)});}
  const mx=Math.max(...chart.map(c=>c.a),1);
  return `<div class="screen" id="scr-d-report">
    <div class="header"><div class="header-top"><div><div class="header-name">📊 Báo cáo</div><div class="header-date">${vnDate()}</div></div></div></div>
    <div class="section" style="margin-top:16px;"><div class="section-title mb-8">📈 7 ngày qua</div>
      <div class="chart-container"><div class="chart-bars">${chart.map(c=>`<div class="chart-bar-wrapper"><div class="chart-bar-value">${c.a>0?fmt(c.a):''}</div><div class="chart-bar" style="height:${Math.max(c.a/mx*100,5)}%"></div><div class="chart-bar-label">${c.l}</div></div>`).join('')}</div></div>
    </div>
    <div class="section"><div class="section-title mb-8">📋 Chi tiết hôm nay</div>
      <div class="stat-card" style="opacity:1;text-align:left;padding:20px;">
        <div class="summary-row"><span class="label">Cuốc</span><span class="value fw-bold">${tr.length}</span></div>
        <div class="summary-row"><span class="label">Doanh thu</span><span class="value fw-bold">${fmtFull(tot)}</span></div>
        <div class="summary-row"><span class="label">HH (${U.commission_value}%)</span><span class="value text-primary">${fmtFull(comm)}</span></div>
        <div class="summary-row"><span class="label">Giữ lại</span><span class="value text-success fw-bold">${fmtFull(tot-comm)}</span></div>
        <div class="summary-row"><span class="label">Đã TT</span><span class="value">${fmtFull(tr.filter(t=>t.payment_status==='paid').reduce((s,t)=>s+t.amount,0))}</span></div>
        <div class="summary-row"><span class="label">Nợ</span><span class="value text-warning">${fmtFull(tr.filter(t=>t.payment_status==='debt').reduce((s,t)=>s+t.amount,0))}</span></div>
        ${tr.length>0?`<div class="summary-row"><span class="label">TB/cuốc</span><span class="value">${fmtFull(Math.round(tot/tr.length))}</span></div>`:''}
      </div>
    </div>
  </div>`;
}

function driverWallet() {
  return `<div class="screen" id="scr-d-wallet">
    <div class="header"><div class="header-top"><div><div class="header-name">💵 Ví tiền</div><div class="header-date">Số dư hiện tại</div></div></div></div>
    <div class="section" style="margin-top:16px;">
      <div class="stat-card" style="opacity:1;text-align:center;padding:24px;">
        <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Số dư ví</div>
        <div style="font-size:36px;font-weight:800;color:var(--primary);margin:8px 0;">${fmtFull(U.wallet||0)}</div>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;">
          <button class="btn btn-sm btn-primary" style="flex:1" onclick="G.walletAction('deposit')">➕ Nạp tiền</button>
          <button class="btn btn-sm btn-outline" style="flex:1" onclick="G.walletAction('withdraw')">💸 Rút tiền</button>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-title mb-8">📋 Lịch sử ví</div>
      ${(D.walletHistory||[]).filter(w=>w.driver_id===U.id).slice(-10).reverse().map(w => `
        <div class="trip-card" style="border-left-color:${w.type==='deposit'?'var(--success)':'var(--danger)'}">
          <div class="trip-header"><span class="trip-number">${w.type==='deposit'?'➕ Nạp':'💸 Rút'}</span><span class="trip-time">${w.date||''}</span></div>
          <div class="trip-amount" style="color:${w.type==='deposit'?'var(--success)':'var(--danger)'}">${w.type==='deposit'?'+':'-'}${fmtFull(w.amount)}</div>
          <div class="trip-note">📝 ${w.note||''}</div>
        </div>
      `).join('') || '<div class="alert alert-warning">Chưa có giao dịch</div>'}
    </div>
  </div>`;
}

function driverProfile() {
  return `<div class="screen" id="scr-d-profile">
    <div class="header"><div class="header-top"><div><div class="header-name">👤 Hồ sơ</div></div></div></div>
    <div class="section" style="margin-top:16px;">
      <div class="stat-card" style="opacity:1;text-align:center;padding:24px;">
        <div style="width:80px;height:80px;background:var(--primary-bg);border-radius:24px;display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:800;color:var(--primary);margin:0 auto 12px;">${U.name.charAt(0)}</div>
        <div style="font-size:20px;font-weight:700;">${U.name}</div>
        <div style="color:var(--text-muted)">🏍️ ${U.vehicle_plate||''}</div>
      </div>
    </div>
    <div class="section"><div class="stat-card" style="opacity:1;text-align:left;padding:20px;">
      <div class="summary-row"><span class="label">SĐT</span><span class="value">${U.phone}</span></div>
      <div class="summary-row"><span class="label">Biển số</span><span class="value">${U.vehicle_plate||'N/A'}</span></div>
      <div class="summary-row"><span class="label">Hoa hồng</span><span class="value">${U.commission_value}%</span></div>
      <div class="summary-row"><span class="label">Ví tiền</span><span class="value text-primary">${fmtFull(U.wallet||0)}</span></div>
      <div class="summary-row"><span class="label">Trạng thái</span><span class="value text-success">🟢 Hoạt động</span></div>
    </div></div>
    <div class="section"><button class="btn btn-danger" onclick="G.logout()">🚪 Đăng xuất</button></div>
  </div>`;
}

function driverNav() {
  return `<div class="bottom-nav" id="nav-d">
    <button class="nav-item active" onclick="G.showD('scr-d-home')"><span class="nav-icon">🏠</span><span class="nav-label">Trang chủ</span></button>
    <button class="nav-item" onclick="G.showD('scr-d-history')"><span class="nav-icon">📋</span><span class="nav-label">Lịch sử</span></button>
    <button class="nav-item" style="opacity:0;pointer-events:none"><span class="nav-icon">&nbsp;</span><span class="nav-label">&nbsp;</span></button>
    <button class="nav-item" onclick="G.showD('scr-d-wallet')"><span class="nav-icon">💵</span><span class="nav-label">Ví tiền</span></button>
    <button class="nav-item" onclick="G.showD('scr-d-profile')"><span class="nav-icon">👤</span><span class="nav-label">Hồ sơ</span></button>
  </div>`;
}

// ============================================================
// MODALS
// ============================================================
function openModal(html) { $('modal-c').innerHTML = html; $('modal-ov').classList.add('active'); }

// ADD TRIP (Driver) — with fare calculator
window.G = {
  setRole(r) {
    document.querySelectorAll('.role-tab').forEach(t=>t.classList.remove('active'));
    const el = $(`rt-${r}`);
    if (el) el.classList.add('active');
  },

  switchAuthTab(tab) {
    document.querySelectorAll('.role-tab').forEach(t=>t.classList.remove('active'));
    $(`tab-${tab}`).classList.add('active');
    $('form-login').style.display = tab === 'login' ? 'block' : 'none';
    $('form-register').style.display = tab === 'register' ? 'block' : 'none';
  },

  async register() {
    const phone = $('reg-phone').value.trim();
    const name = $('reg-name').value.trim();
    const pass = $('reg-pass').value;
    const plate = $('reg-plate').value.trim();
    const errEl = $('reg-err');
    const okEl = $('reg-ok');
    const showErr = msg => { errEl.textContent = msg; errEl.style.display = 'flex'; okEl.style.display = 'none'; };

    if (!phone || !name || !pass) { showErr('❌ Vui lòng nhập SĐT, họ tên và mật khẩu'); return; }
    if (!/^0\d{9,10}$/.test(phone)) { showErr('❌ SĐT không hợp lệ (bắt đầu bằng 0, 10-11 số)'); return; }
    if (pass.length < 6) { showErr('❌ Mật khẩu tối thiểu 6 ký tự'); return; }

    // Check phone uniqueness — load latest cloud data first if online (3s timeout)
    if (DB_ONLINE) {
      try {
        const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
        const cloud = await withTimeout(loadDataFromCloud(), 3000);
        if (cloud) D = cloud;
      } catch (e) { /* fallback to local */ }
    }
    if (D.users.find(u => u.phone === phone)) {
      showErr('❌ SĐT này đã được đăng ký');
      return;
    }

    const pw_hash = await hashPassword(pass);
    const newDriver = {
      id: 'd' + Date.now(),
      name, phone, password: pass, password_hash: pw_hash,
      role: 'driver',
      vehicle_plate: plate, vehicle_type: 'xe_may',
      status: 'pending',
      commission_type: 'percent',
      commission_value: D.settings?.default_commission_value || 20,
      online: false, wallet: 0,
      created_at: today(),
    };
    D.users.push(newDriver);
    addLog('driver_register', `Đăng ký mới: ${name} (${phone})`);
    saveData(D);
    if (DB_ONLINE) dbSaveUser(newDriver).catch(e => console.error('Register sync:', e));

    errEl.style.display = 'none';
    okEl.innerHTML = `✅ Đăng ký thành công!<br>Tài khoản đang <b>chờ admin duyệt</b>. Anh sẽ được thông báo khi tài khoản kích hoạt.`;
    okEl.style.display = 'flex';
    $('reg-phone').value = '';
    $('reg-name').value = '';
    $('reg-pass').value = '';
    $('reg-plate').value = '';
  },
  async login() {
    const phone = $('inp-phone').value.trim(), pass = $('inp-pass').value;
    if (!phone || !pass) { $('login-err').textContent = '❌ Nhập SĐT và mật khẩu!'; $('login-err').style.display = 'flex'; return; }
    
    // Show loading
    const btn = document.querySelector('#scr-login .btn-primary');
    if (btn) { btn.textContent = '⏳ Đang đăng nhập...'; btn.disabled = true; }
    
    try {
      // Load cloud data first (if available, with 3s timeout)
      if (DB_ONLINE) {
        try {
          const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
          const cloud = await withTimeout(loadDataFromCloud(), 3000);
          if (cloud) { D = cloud; }
        } catch (e) { console.warn('Cloud load skipped:', e?.message || e); }
      }
      
      // Find user by phone
      let user = D.users.find(u => u.phone === phone);
      if (!user) {
        $('login-err').textContent = '❌ Sai SĐT hoặc mật khẩu!';
        $('login-err').style.display = 'flex';
        if (btn) { btn.textContent = '🚀 Đăng nhập'; btn.disabled = false; }
        return;
      }
      
      // Verify password (hash or plaintext fallback)
      let passOk = false;
      if (user.password_hash) {
        passOk = await verifyPassword(pass, user.password_hash);
      } else if (user.password) {
        passOk = user.password === pass;
        // Migrate: hash the plaintext password
        if (passOk && DB_ONLINE) {
          user.password_hash = await hashPassword(pass);
          dbSaveUser(user);
        }
      }
      
      if (!passOk) {
        $('login-err').textContent = '❌ Sai SĐT hoặc mật khẩu!';
        $('login-err').style.display = 'flex';
        if (btn) { btn.textContent = '🚀 Đăng nhập'; btn.disabled = false; }
        return;
      }
      
      if (user.status === 'blocked') {
        $('login-err').textContent = '🔒 Tài khoản đã bị khóa!';
        $('login-err').style.display = 'flex';
        if (btn) { btn.textContent = '🚀 Đăng nhập'; btn.disabled = false; }
        return;
      }
      if (user.status === 'pending') {
        $('login-err').textContent = '⏳ Tài khoản đang chờ admin duyệt!';
        $('login-err').style.display = 'flex';
        if (btn) { btn.textContent = '🚀 Đăng nhập'; btn.disabled = false; }
        return;
      }
      
      U = user;
      addLog('login', `${user.name} đăng nhập`);
      user.role === 'admin' ? renderAdmin() : renderDriver();
    } catch (err) {
      console.error('Login error:', err);
      // Fallback to local
      const user = D.users.find(u => u.phone === phone && u.password === pass);
      if (user && user.status !== 'blocked') {
        U = user;
        addLog('login', `${user.name} đăng nhập (offline)`);
        user.role === 'admin' ? renderAdmin() : renderDriver();
      } else {
        $('login-err').textContent = '❌ Sai SĐT hoặc mật khẩu!';
        $('login-err').style.display = 'flex';
      }
      if (btn) { btn.textContent = '🚀 Đăng nhập'; btn.disabled = false; }
    }
  },
  logout() { addLog('logout', `${U?.name} đăng xuất`); stopDriverGPS(); if(adminMap){adminMap.remove();adminMap=null;} driverMarkers={}; U = null; renderLogin(); },
  closeModal() { $('modal-ov').classList.remove('active'); },
  showA(id) {
    show(id, 'nav-a', adminScreens);
    if (id === 'scr-a-dispatch') setTimeout(() => initAdminMap(), 100);
    // Re-render dynamic modules
    if (id === 'scr-a-donhang') { const el = document.getElementById('scr-a-donhang'); if (el) el.outerHTML = adminDonHang(); show('scr-a-donhang', 'nav-a', adminScreens); }
    if (id === 'scr-a-congno') { const el = document.getElementById('scr-a-congno'); if (el) el.outerHTML = adminCongNo(); show('scr-a-congno', 'nav-a', adminScreens); }
    if (id === 'scr-a-xinphep') { const el = document.getElementById('scr-a-xinphep'); if (el) el.outerHTML = adminXinPhep(); show('scr-a-xinphep', 'nav-a', adminScreens); }
    if (id === 'scr-a-zalo-audit') { const el = document.getElementById('scr-a-zalo-audit'); if (el) el.outerHTML = adminZaloAudit(); show('scr-a-zalo-audit', 'nav-a', adminScreens); }
    if (id === 'scr-a-zalo-mapping') { const el = document.getElementById('scr-a-zalo-mapping'); if (el) el.outerHTML = adminZaloMapping(); show('scr-a-zalo-mapping', 'nav-a', adminScreens); }
    if (id === 'scr-a-duty') { const el = document.getElementById('scr-a-duty'); if (el) el.outerHTML = adminDutyRoster(); show('scr-a-duty', 'nav-a', adminScreens); }
  },

  // NEW MODULE HANDLERS
  filterOrders(key, value) {
    adminOrderFilter[key] = value;
    const el = document.getElementById('scr-a-donhang');
    if (el) el.outerHTML = adminDonHang();
    show('scr-a-donhang', 'nav-a', adminScreens);
  },

  switchDebtTab(tab) {
    adminDebtTab = tab;
    const el = document.getElementById('scr-a-congno');
    if (el) el.outerHTML = adminCongNo();
    show('scr-a-congno', 'nav-a', adminScreens);
  },

  // DEBT: Confirm resolve with proof modal
  confirmResolve(id) {
    const d = D.debts.find(x => x.id === id);
    if (!d) return;
    openModal(`<div class="modal-handle"></div>
      <div class="modal-title">✅ Thu nợ — ${d.customer_name || 'Khách'}</div>
      <div class="summary-bar mb-16">
        <div class="summary-row"><span class="label">Số tiền</span><span class="value fw-bold">${fmtFull(d.amount)}</span></div>
        <div class="summary-row"><span class="label">Tài xế</span><span class="value">${driverName(d.driver_id)}</span></div>
        <div class="summary-row"><span class="label">Ngày nợ</span><span class="value">${d.date}</span></div>
      </div>
      <div class="form-group"><label class="form-label">Số tiền thực thu</label>
        <input type="number" class="form-input" id="resolve-amount" value="${d.amount}" inputmode="numeric" />
      </div>
      <div class="form-group"><label class="form-label">Hình thức thu</label>
        <select class="form-input" id="resolve-method">
          <option value="cash">💵 Tiền mặt</option>
          <option value="transfer">🏦 Chuyển khoản</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">Ghi chú</label>
        <input type="text" class="form-input" id="resolve-note" placeholder="VD: Thu tại quán..." />
      </div>
      <div class="form-group"><label class="form-label">Ngày thu</label>
        <input type="date" class="form-input" id="resolve-date" value="${today()}" />
      </div>
      <button class="btn btn-success" onclick="G.submitResolve('${d.id}')">✅ Xác nhận đã thu</button>
      <button class="btn btn-outline mt-8" onclick="G.closeModal()">Hủy</button>
    `);
  },

  submitResolve(id) {
    const d = D.debts.find(x => x.id === id);
    if (!d) return;
    d.status = 'resolved';
    d.resolved_at = new Date().toISOString();
    d.resolved_amount = parseInt($('resolve-amount')?.value) || d.amount;
    d.resolved_method = $('resolve-method')?.value || 'cash';
    d.resolved_note = $('resolve-note')?.value || '';
    d.resolved_date = $('resolve-date')?.value || today();
    addLog('debt_resolve', `Thu nợ ${fmtFull(d.amount)} — ${d.customer_name || 'Khách'} (${d.resolved_method === 'cash' ? 'TM' : 'CK'})`);
    saveData(D);
    if (DB_ONLINE) dbUpdateDebt(id, { status: 'resolved', resolved_at: d.resolved_at, resolved_method: d.resolved_method, resolved_note: d.resolved_note }).catch(e => console.error('Debt sync:', e));
    G.closeModal(); renderAdmin(); G.showA('scr-a-congno');
  },

  // DEBT: Merge duplicate debts
  mergeDebts(debtIds) {
    if (!debtIds || debtIds.length < 2) return;
    const debts = debtIds.map(id => D.debts.find(x => x.id === id)).filter(Boolean);
    if (debts.length < 2) return;
    const names = [...new Set(debts.map(d => driverName(d.driver_id)))];
    const maxAmount = Math.max(...debts.map(d => d.amount));
    if (!confirm(`Ghép ${debts.length} khoản nợ?\n\nGiữ số tiền cao nhất: ${fmtFull(maxAmount)}\nTài xế: ${names.join(', ')}`)) return;
    // Keep the first debt, update it
    const keeper = debts[0];
    keeper.amount = maxAmount;
    keeper.drivers_involved = names.join(', ');
    keeper.note = (keeper.note || '') + ` [Ghép từ ${debts.length} khoản]`;
    // Cancel the rest
    for (let i = 1; i < debts.length; i++) {
      debts[i].status = 'cancelled';
      debts[i].note = (debts[i].note || '') + ' [Đã ghép → ' + keeper.id + ']';
    }
    addLog('debt_merge', `Ghép ${debts.length} nợ → ${fmtFull(maxAmount)} (${names.join(', ')})`);
    saveData(D);
    renderAdmin(); G.showA('scr-a-congno');
  },

  // DEBT: Add new debt modal
  addDebtModal() {
    const drivers = D.users.filter(u => u.role === 'driver' && u.status === 'active');
    const existingCustomers = [...new Set((D.debts || []).map(d => d.customer_name).filter(Boolean))];
    openModal(`<div class="modal-handle"></div>
      <div class="modal-title">➕ Thêm công nợ</div>
      <div class="form-group"><label class="form-label">Tên khách nợ</label>
        <input type="text" class="form-input" id="debt-customer" placeholder="VD: Anh Phong" list="debt-cust-list" />
        <datalist id="debt-cust-list">${existingCustomers.map(c => `<option value="${c}">`).join('')}</datalist>
      </div>
      <div class="form-group"><label class="form-label">Số tiền nợ</label>
        <input type="number" class="form-input" id="debt-amount" placeholder="VD: 50000" inputmode="numeric" />
        <div class="quick-amounts" style="margin-top:8px;">
          <button class="quick-amount" onclick="$('debt-amount').value='30000'">30k</button>
          <button class="quick-amount" onclick="$('debt-amount').value='50000'">50k</button>
          <button class="quick-amount" onclick="$('debt-amount').value='100000'">100k</button>
          <button class="quick-amount" onclick="$('debt-amount').value='200000'">200k</button>
        </div>
      </div>
      <div class="form-group"><label class="form-label">Tài xế liên quan</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px;" id="debt-drivers-wrap">
          ${drivers.map(d => `<label style="display:flex;align-items:center;gap:4px;padding:6px 10px;background:var(--bg);border-radius:8px;font-size:13px;cursor:pointer;border:1px solid var(--border);">
            <input type="checkbox" value="${d.id}" name="debt-drivers" style="accent-color:var(--primary);" /> ${d.name.split(' ').pop()}
          </label>`).join('')}
        </div>
      </div>
      <div class="form-group"><label class="form-label">Ghi chú</label>
        <input type="text" class="form-input" id="debt-note" placeholder="VD: Giao hàng Q.7" />
      </div>
      <div class="form-group"><label class="form-label">Ngày</label>
        <input type="date" class="form-input" id="debt-date" value="${today()}" />
      </div>
      <button class="btn btn-primary" onclick="G.submitDebt()">💾 Lưu công nợ</button>
      <button class="btn btn-outline mt-8" onclick="G.closeModal()">Hủy</button>
    `);
  },

  submitDebt() {
    const customer = $('debt-customer')?.value?.trim();
    const amount = parseInt($('debt-amount')?.value) || 0;
    const note = $('debt-note')?.value?.trim() || '';
    const date = $('debt-date')?.value || today();
    if (!customer) { alert('Nhập tên khách nợ!'); return; }
    if (amount <= 0) { alert('Nhập số tiền!'); return; }
    const checkedDrivers = [...document.querySelectorAll('input[name="debt-drivers"]:checked')].map(cb => cb.value);
    const driverId = checkedDrivers[0] || 'admin1';
    const driverNames = checkedDrivers.map(id => driverName(id)).join(', ');
    const debt = {
      id: 'debt' + Date.now(),
      driver_id: driverId,
      drivers_involved: driverNames || driverName(driverId),
      amount,
      customer_name: customer,
      customer_phone: '',
      status: 'pending',
      created_at: new Date().toISOString(),
      date,
      note,
    };
    D.debts.push(debt);
    addLog('debt_add', `Thêm nợ: ${customer} — ${fmtFull(amount)}`);
    saveData(D);
    if (DB_ONLINE) dbSaveDebt(debt).catch(e => console.error('Debt sync:', e));
    G.closeModal(); renderAdmin(); G.showA('scr-a-congno');
  },

  addLeaveModal() {
    const drivers = D.users.filter(u => u.role === 'driver' && u.status === 'active');
    openModal(`<div class="modal-handle"></div><div class="modal-title">🙋 Tạo đơn xin phép</div>
      <div class="form-group"><label class="form-label">Tài xế</label>
        <select class="form-input" id="leave-driver">${drivers.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label class="form-label">Ngày</label>
        <input type="date" class="form-input" id="leave-date" value="${today()}" />
      </div>
      <div class="form-group"><label class="form-label">Loại</label>
        <select class="form-input" id="leave-type">
          <option value="full_day">🌅 Nghỉ cả ngày</option>
          <option value="late">⏰ Đi trễ</option>
          <option value="early">🏃 Về sớm</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">Lý do</label>
        <input type="text" class="form-input" id="leave-reason" placeholder="VD: Việc gia đình..." />
      </div>
      <button class="btn btn-primary" onclick="G.submitLeave()">📝 Gửi đơn</button>
      <button class="btn btn-outline mt-8" onclick="G.closeModal()">Hủy</button>
    `);
  },

  submitLeave() {
    const req = {
      id: 'lr' + Date.now(),
      driver_id: $('leave-driver')?.value,
      date: $('leave-date')?.value || today(),
      type: $('leave-type')?.value || 'full_day',
      reason: $('leave-reason')?.value?.trim() || '',
      status: 'pending',
      created_at: new Date().toISOString()
    };
    if (!D.leaveRequests) D.leaveRequests = [];
    D.leaveRequests.push(req);
    addLog('leave_request', `Xin phép: ${driverName(req.driver_id)} — ${req.type}`);
    saveData(D);
    G.closeModal();
    renderAdmin();
    G.showA('scr-a-xinphep');
  },

  handleLeave(id, action) {
    const req = (D.leaveRequests || []).find(r => r.id === id);
    if (!req) return;
    req.status = action;
    if (action === 'approved' && D.driverStatus?.[req.driver_id]) {
      D.driverStatus[req.driver_id].status = 'on_leave';
      D.driverStatus[req.driver_id].since = new Date().toISOString();
    }
    addLog('leave_' + action, `${action === 'approved' ? 'Duyệt' : 'Từ chối'} phép: ${driverName(req.driver_id)}`);
    saveData(D);
    renderAdmin();
    G.showA('scr-a-xinphep');
  },
  
  focusDriver(id) {
    const pos = DEMO_POSITIONS[id];
    if (pos && adminMap) {
      adminMap.setView([pos.lat, pos.lng], 15, { animate: true });
      if (driverMarkers[id]) driverMarkers[id].openPopup();
    }
  },
  
  filterMap(filter) {
    window._mapFilter = filter;
    updateDriverStatusList();
  },
  
  toggleMapFullscreen() {
    const wrapper = document.getElementById('map-wrapper');
    if (!wrapper) return;
    if (wrapper.classList.contains('map-fullscreen')) {
      wrapper.classList.remove('map-fullscreen');
    } else {
      wrapper.classList.add('map-fullscreen');
    }
    if (adminMap) setTimeout(() => adminMap.invalidateSize(), 300);
  },
  toggleGPS() { if(gpsWatchId) { stopDriverGPS(); updateGPSStatus(false); } else { startDriverGPS(); } },
  showD(id) { show(id, 'nav-d', driverScreens); },

  // FAB button action: Start trip or End trip
  fabAction() {
    if (activeTrip) {
      G.endTrip();
    } else {
      G.showTripOptions();
    }
  },

  // Show trip options: 1-Tap or Manual
  showTripOptions() {
    openModal(`
      <div class="modal-handle"></div>
      <div class="modal-title">➕ Tạo cuốc mới</div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <button class="btn btn-primary" onclick="G.startOneTap()" style="padding:20px;font-size:18px;">
          🚀 1-Tap Bắt đầu cuốc<br>
          <span style="font-size:12px;opacity:0.8;">GPS tự tính km + tiền</span>
        </button>
        <button class="btn btn-outline" onclick="G.fareEstimateModal()">
          🧭 Dự toán giá trước
        </button>
        <button class="btn btn-outline" onclick="G.closeModal();G.addTripModal()">
          ✍️ Nhập tay (cách cũ)
        </button>
      </div>
      <button class="btn btn-outline mt-16" onclick="G.closeModal()">Hủy</button>
    `);
  },

  // 🚀 1-TAP: Bắt đầu cuốc
  async startOneTap() {
    G.closeModal();
    const pos = await getCurrentPosition();
    const address = await reverseGeocode(pos.lat, pos.lng);
    
    activeTrip = {
      startPos: pos,
      startAddress: address,
      startTime: new Date(),
      trackPoints: [{ ...pos, t: Date.now() }],
    };
    tripTrackPoints = [{ ...pos, t: Date.now() }];
    
    // Update FAB to red stop button
    const fab = document.getElementById('fab-main');
    if (fab) { fab.textContent = '🔴'; fab.style.background = 'linear-gradient(135deg, #EF4444, #DC2626)'; }
    
    updateActiveTripBar();
    addLog('trip_1tap_start', `Bắt đầu từ ${address}`);
  },

  // 🔴 1-TAP: Kết thúc cuốc
  async endTrip() {
    if (!activeTrip) return;
    const endPos = await getCurrentPosition();
    const endAddress = await reverseGeocode(endPos.lat, endPos.lng);
    
    // Tính km bằng OSRM (đường thực tế)
    const route = await osrmDistance(activeTrip.startPos.lat, activeTrip.startPos.lng, endPos.lat, endPos.lng);
    
    // Tính thời gian thực tế
    const durationMin = Math.round((Date.now() - activeTrip.startTime.getTime()) / 60000);
    
    // Tính Haversine để so khớp
    const hvKm = Math.round(haversine(activeTrip.startPos.lat, activeTrip.startPos.lng, endPos.lat, endPos.lng) * 10) / 10;
    
    // Mở modal xác nhận cuốc với dữ liệu tự động
    const tr = todayTrips(U.id);
    const runTot = tr.length > 0 ? tr[0].running_total : 0;
    const nextNum = tr.length > 0 ? tr[0].trip_number + 1 : 1;
    const svcs = D.pricing.service_types;
    const defaultSvc = svcs[0].id;
    const autoFare = calcFare(defaultSvc, route.km);
    const comm = Math.round(autoFare * U.commission_value / 100);
    const verify = verifyDistance(hvKm, route.km);
    
    openModal(`
      <div class="modal-handle"></div>
      <div class="modal-title">✅ Cuốc #${nextNum} hoàn thành!</div>
      
      <div class="alert alert-success">📍 GPS tự động tính toán</div>
      
      <div class="summary-bar mb-16">
        <div class="summary-row"><span class="label">📍 Điểm đón</span><span class="value" style="font-size:12px;max-width:55%;text-align:right;">${activeTrip.startAddress}</span></div>
        <div class="summary-row"><span class="label">🏁 Điểm trả</span><span class="value" style="font-size:12px;max-width:55%;text-align:right;">${endAddress}</span></div>
        <div class="summary-row"><span class="label">🛣️ Khoảng cách (đường thực)</span><span class="value fw-bold text-primary">${route.km} km</span></div>
        ${route.duration_min > 0 ? `<div class="summary-row"><span class="label">⏱️ OSRM ước tính</span><span class="value">${route.duration_min} phút</span></div>` : ''}
        <div class="summary-row"><span class="label">⏰ Thực tế chạy</span><span class="value">${durationMin} phút</span></div>
        <div class="summary-row"><span class="label">📶 Chim bay (Haversine)</span><span class="value text-muted">${hvKm} km</span></div>
        ${!verify.ok ? `<div class="summary-row"><span class="label">⚠️ Chênh lệch</span><span class="value text-danger">${verify.diff}% — Kiểm tra!</span></div>` : ''}
      </div>
      
      <div class="form-group"><label class="form-label">🏍️ Loại dịch vụ</label>
        <select class="form-input" id="trip-svc" onchange="G.recalcOneTap(${route.km},${runTot})">
          ${svcs.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}
        </select>
      </div>
      
      <div class="form-group"><label class="form-label">💰 Số tiền <span class="text-muted">(OSRM tự tính)</span></label>
        <input type="number" class="form-input" id="trip-amt" value="${autoFare}" style="font-size:24px;font-weight:800;color:var(--primary);" inputmode="numeric" />
      </div>
      
      <div class="form-group"><label class="form-label">💳 Thanh toán</label>
        <div class="payment-toggle" id="pay-toggle">
          <button class="payment-option active paid" data-v="paid" onclick="G.setPay('paid')"><span class="payment-icon">✅</span><span class="payment-text">Đã TT</span></button>
          <button class="payment-option" data-v="debt" onclick="G.setPay('debt')"><span class="payment-icon">⚠️</span><span class="payment-text">Nợ</span></button>
        </div>
        <select class="form-input" id="trip-paymethod" style="font-size:13px;margin-top:8px;"><option value="cash">💵 Tiền mặt</option><option value="transfer">🏦 Chuyển khoản</option></select>
      </div>
      
      <div class="summary-bar">
        <div class="summary-row"><span class="label">Cộng dồn trước</span><span class="value">${fmtFull(runTot)}</span></div>
        <div class="summary-row"><span class="label">Cuốc này</span><span class="value fw-bold">${fmtFull(autoFare)}</span></div>
        <div class="summary-row"><span class="label">HH (${U.commission_value}%)</span><span class="value text-primary">${fmtFull(comm)}</span></div>
        <div class="summary-row highlight"><span class="label">Tổng mới</span><span class="value">${fmtFull(runTot + autoFare)}</span></div>
        ${isSurge()?'<div class="summary-row"><span class="label">🔴 Cao điểm</span><span class="value text-warning">+phụ phí</span></div>':''}
        ${route.fallback?'<div class="summary-row"><span class="label">⚠️</span><span class="value text-muted">OSRM offline, dùng Haversine</span></div>':''}
      </div>
      
      <input type="hidden" id="trip-km" value="${route.km}" />
      <input type="hidden" id="trip-note" value="${activeTrip.startAddress} → ${endAddress}" />
      
      <button class="btn btn-primary mt-16" onclick="G.saveTrip(${nextNum},${runTot})">💾 Xác nhận & Lưu cuốc</button>
      <button class="btn btn-outline mt-8" onclick="G.closeModal()">Để sau</button>
    `);
    
    // Reset active trip
    activeTrip = null;
    tripTrackPoints = [];
    const fab = document.getElementById('fab-main');
    if (fab) { fab.textContent = '➕'; fab.style.background = ''; }
    const bar = document.getElementById('active-trip-bar');
    if (bar) bar.style.display = 'none';
  },
  
  // Recalc when service type changes in 1-Tap confirmation
  recalcOneTap(km, runTot) {
    const svc = $('trip-svc')?.value;
    if (svc && km > 0) {
      const fare = calcFare(svc, km);
      $('trip-amt').value = fare;
    }
  },

  // 🧭 Dự toán giá trước khi chạy
  async fareEstimateModal() {
    G.closeModal();
    const pos = await getCurrentPosition();
    const address = await reverseGeocode(pos.lat, pos.lng);
    
    openModal(`
      <div class="modal-handle"></div>
      <div class="modal-title">🧭 Dự toán giá</div>
      <div class="alert alert-success">📍 Vị trí: ${address}</div>
      
      <div class="form-group"><label class="form-label">🛣️ Khoảng cách ước tính</label>
        <input type="number" class="form-input" id="est-km" placeholder="Nhập km..." step="0.1" inputmode="decimal" oninput="G.updateEstimate()" />
        <div class="quick-amounts" style="margin-top:8px;">
          <button class="quick-amount" onclick="$('est-km').value='2';G.updateEstimate()">2km</button>
          <button class="quick-amount" onclick="$('est-km').value='5';G.updateEstimate()">5km</button>
          <button class="quick-amount" onclick="$('est-km').value='8';G.updateEstimate()">8km</button>
          <button class="quick-amount" onclick="$('est-km').value='12';G.updateEstimate()">12km</button>
          <button class="quick-amount" onclick="$('est-km').value='20';G.updateEstimate()">20km</button>
        </div>
      </div>
      
      <div id="estimate-results"></div>
      
      <button class="btn btn-primary mt-16" onclick="G.closeModal();G.startOneTap()">🚀 Bắt đầu cuốc ngay</button>
      <button class="btn btn-outline mt-8" onclick="G.closeModal()">Hủy</button>
    `);
  },

  updateEstimate() {
    const km = parseFloat($('est-km')?.value) || 0;
    const el = $('estimate-results');
    if (!el || km <= 0) { if(el) el.innerHTML=''; return; }
    
    const fares = estimateAllFares(km);
    el.innerHTML = `
      <div class="summary-bar">
        <div class="summary-row" style="font-weight:700;padding:8px 0;"><span class="label">💰 Bảng giá ${km}km</span><span class="value">${isSurge()?'🔴 Cao điểm':'🟢 Bình thường'}</span></div>
        ${fares.map(f => `<div class="summary-row"><span class="label">${f.name}</span><span class="value fw-bold text-primary">${fmtFull(f.fare)}</span></div>`).join('')}
        ${isNight()?'<div class="summary-row"><span class="label">🌙 Phí đêm</span><span class="value text-warning">Đã tính</span></div>':''}
      </div>
    `;
  },

  // ADD TRIP (Manual mode)
  addTripModal() {
    const tr = todayTrips(U.id);
    const runTot = tr.length > 0 ? tr[0].running_total : 0;
    const nextNum = tr.length > 0 ? tr[0].trip_number + 1 : 1;
    const svcs = D.pricing.service_types;
    openModal(`
      <div class="modal-handle"></div>
      <div class="modal-title">➕ Cuốc mới #${nextNum}</div>
      <div class="form-group"><label class="form-label">🏍️ Loại dịch vụ</label>
        <select class="form-input" id="trip-svc" onchange="G.recalcFare()">
          ${svcs.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label class="form-label">📏 Khoảng cách (km)</label>
        <input type="number" class="form-input" id="trip-km" placeholder="VD: 5.2" step="0.1" inputmode="decimal" onchange="G.recalcFare()" oninput="G.recalcFare()" />
        <div class="quick-amounts" style="margin-top:8px;">
          <button class="quick-amount" onclick="$('trip-km').value='2';G.recalcFare()">2km</button>
          <button class="quick-amount" onclick="$('trip-km').value='5';G.recalcFare()">5km</button>
          <button class="quick-amount" onclick="$('trip-km').value='8';G.recalcFare()">8km</button>
          <button class="quick-amount" onclick="$('trip-km').value='10';G.recalcFare()">10km</button>
          <button class="quick-amount" onclick="$('trip-km').value='15';G.recalcFare()">15km</button>
        </div>
      </div>
      <div class="form-group"><label class="form-label">💰 Số tiền <span class="text-muted">(tự tính hoặc nhập tay)</span></label>
        <input type="number" class="form-input" id="trip-amt" placeholder="Tự động tính..." style="font-size:20px;font-weight:700;" inputmode="numeric" oninput="G.updateSummary(${runTot})" />
        <div class="quick-amounts" style="margin-top:8px;">
          <button class="quick-amount" onclick="$('trip-amt').value='20000';G.updateSummary(${runTot})">20k</button>
          <button class="quick-amount" onclick="$('trip-amt').value='50000';G.updateSummary(${runTot})">50k</button>
          <button class="quick-amount" onclick="$('trip-amt').value='80000';G.updateSummary(${runTot})">80k</button>
          <button class="quick-amount" onclick="$('trip-amt').value='100000';G.updateSummary(${runTot})">100k</button>
          <button class="quick-amount" onclick="$('trip-amt').value='150000';G.updateSummary(${runTot})">150k</button>
        </div>
      </div>
      <div class="form-group"><label class="form-label">📝 Ghi chú</label>
        <input type="text" class="form-input" id="trip-note" placeholder="Giao hàng Q.3, chở khách..." />
      </div>
      <div class="form-group"><label class="form-label">💳 Thanh toán</label>
        <div class="payment-toggle" id="pay-toggle">
          <button class="payment-option active paid" data-v="paid" onclick="G.setPay('paid')"><span class="payment-icon">✅</span><span class="payment-text">Đã TT</span></button>
          <button class="payment-option" data-v="debt" onclick="G.setPay('debt')"><span class="payment-icon">⚠️</span><span class="payment-text">Nợ</span></button>
        </div>
        <div style="margin-top:8px;">
          <select class="form-input" id="trip-paymethod" style="font-size:13px;">
            <option value="cash">💵 Tiền mặt</option>
            <option value="transfer">🏦 Chuyển khoản</option>
          </select>
        </div>
      </div>
      <div class="summary-bar" id="trip-sum">
        <div class="summary-row"><span class="label">Cộng dồn trước</span><span class="value">${fmtFull(runTot)}</span></div>
        <div class="summary-row"><span class="label">Cuốc này</span><span class="value" id="s-amt">0đ</span></div>
        <div class="summary-row"><span class="label">HH (${U.commission_value}%)</span><span class="value text-primary" id="s-comm">0đ</span></div>
        <div class="summary-row highlight"><span class="label">Tổng mới</span><span class="value" id="s-total">${fmtFull(runTot)}</span></div>
        ${isSurge()?'<div class="summary-row"><span class="label">🔴 Đang cao điểm</span><span class="value text-warning">+phụ phí</span></div>':''}
        ${isNight()?'<div class="summary-row"><span class="label">🌙 Phí đêm</span><span class="value">+phụ phí</span></div>':''}
      </div>
      <button class="btn btn-primary mt-16" onclick="G.saveTrip(${nextNum},${runTot})">💾 Lưu cuốc</button>
      <button class="btn btn-outline mt-8" onclick="G.closeModal()">Hủy</button>
    `);
    setTimeout(()=>$('trip-km')?.focus(), 300);
  },

  recalcFare() {
    const svc = $('trip-svc')?.value;
    const km = parseFloat($('trip-km')?.value) || 0;
    if (km > 0 && svc) {
      const fare = calcFare(svc, km);
      $('trip-amt').value = fare;
    }
    const tr = todayTrips(U.id);
    const runTot = tr.length > 0 ? tr[0].running_total : 0;
    this.updateSummary(runTot);
  },

  updateSummary(runTot) {
    const amt = parseInt($('trip-amt')?.value) || 0;
    const comm = Math.round(amt * U.commission_value / 100);
    if ($('s-amt')) $('s-amt').textContent = fmtFull(amt);
    if ($('s-comm')) $('s-comm').textContent = fmtFull(comm);
    if ($('s-total')) $('s-total').textContent = fmtFull(runTot + amt);
  },

  setPay(v) {
    document.querySelectorAll('#pay-toggle .payment-option').forEach(b => {
      b.classList.remove('active','paid','debt');
      if (b.dataset.v === v) { b.classList.add('active', v); }
    });
    window._payStatus = v;
    if (v === 'debt') $('trip-paymethod').value = 'pending';
  },

  saveTrip(num, prevTot) {
    const amt = parseInt($('trip-amt')?.value) || 0;
    if (amt <= 0) { alert('Nhập số tiền!'); return; }
    const svc = $('trip-svc')?.value || 'xe_om';
    const km = parseFloat($('trip-km')?.value) || 0;
    const note = $('trip-note')?.value?.trim() || 'Không ghi chú';
    const payStatus = window._payStatus || 'paid';
    const payMethod = payStatus === 'debt' ? 'pending' : ($('trip-paymethod')?.value || 'cash');
    const comm = Math.round(amt * U.commission_value / 100);
    const now = new Date();
    const tid = 't' + Date.now();

    const trip = {
      id: tid, driver_id: U.id, trip_number: num, amount: amt, note,
      payment_status: payStatus, payment_method: payMethod,
      service_type: svc, distance_km: km,
      customer_name: '', customer_phone: '',
      running_total: prevTot + amt, commission_amount: comm,
      created_at: now.toISOString(), date: today(), is_locked: false,
    };
    D.trips.push(trip);

    // Fund contribution (auto-deduct theo cài đặt)
    const fundCfg = D.settings.fund || {};
    let fundContrib = 0;
    if (fundCfg.per_trip?.enabled) fundContrib += fundCfg.per_trip.amount || 0;
    if (fundCfg.percent?.enabled) fundContrib += Math.round(comm * (fundCfg.percent.value || 0) / 100);
    if (fundContrib > 0) {
      const ftx = {
        id: 'ftx' + Date.now(), trip_id: tid, driver_id: U.id,
        amount: fundContrib, source: 'cuoc', note: 'Cuốc #' + num,
        date: today(), created_at: now.toISOString(),
      };
      if (!D.fundTransactions) D.fundTransactions = [];
      D.fundTransactions.push(ftx);
      const drv = D.users.find(u => u.id === U.id);
      if (drv) drv.wallet = (drv.wallet || 0) - fundContrib;
    }

    // Create invoice
    const invoice = { id: 'inv'+Date.now(), trip_id: tid, driver_id: U.id, amount: amt, service_type: svc, distance_km: km, commission: comm, payment_status: payStatus, payment_method: payMethod, created_at: now.toISOString(), date: today() };
    D.invoices.push(invoice);

    // Create debt if needed
    let debtRecord = null;
    if (payStatus === 'debt') {
      debtRecord = { id: 'debt'+Date.now(), trip_id: tid, driver_id: U.id, amount: amt, customer_name: '', customer_phone: '', status: 'pending', created_at: now.toISOString(), date: today(), note };
      D.debts.push(debtRecord);
    }

    addLog('trip_create', `Cuốc #${num}: ${fmtFull(amt)} — ${svcName(svc)} ${km}km`);
    window._payStatus = 'paid';
    activeTrip = null; tripTrackPoints = [];
    saveData(D);

    // Sync to cloud
    if (DB_ONLINE) {
      dbSaveTrip(trip).catch(e => console.error('Trip sync:', e));
      dbSaveInvoice(invoice).catch(e => console.error('Invoice sync:', e));
      if (debtRecord) dbSaveDebt(debtRecord).catch(e => console.error('Debt sync:', e));
    }

    G.closeModal();
    renderDriver();
  },

  // ⚡ QUICK ENTRY FUNCTIONS
  quickCalc() {
    const amt = parseInt($('q-amt')?.value) || 0;
    const preview = $('q-preview');
    if (amt > 0 && preview) {
      const commAmt = Math.round(amt * U.commission_value / 100);
      $('q-comm').textContent = fmtFull(commAmt);
      $('q-keep').textContent = fmtFull(amt - commAmt);
      preview.style.display = 'block';
    } else if (preview) {
      preview.style.display = 'none';
    }
  },

  quickSet(val) {
    const el = $('q-amt');
    if (el) { el.value = val; G.quickCalc(); }
  },

  quickSaveTrip(payStatus) {
    const amt = parseInt($('q-amt')?.value) || 0;
    if (amt <= 0) { alert('Nhập số tiền cuốc!'); $('q-amt')?.focus(); return; }

    // If debt, ask for customer info
    if (payStatus === 'debt') {
      G.quickDebtModal(amt);
      return;
    }

    // Save directly for paid trips
    G._doQuickSave(amt, payStatus, '', '');
  },

  quickDebtModal(amt) {
    const comm = Math.round(amt * U.commission_value / 100);
    openModal(`
      <div class="modal-handle"></div>
      <div class="modal-title">⚠️ Ghi nợ ${fmtFull(amt)}</div>
      <div class="summary-bar mb-16">
        <div class="summary-row"><span class="label">Cuốc</span><span class="value fw-bold">${fmtFull(amt)}</span></div>
        <div class="summary-row"><span class="label">Chiếc khấu ${U.commission_value}%</span><span class="value text-primary">${fmtFull(comm)}</span></div>
      </div>
      <div class="form-group"><label class="form-label">👤 Tên khách (tùy chọn)</label>
        <input type="text" class="form-input" id="qd-name" placeholder="VD: Anh Phong, Chị Duyên..." />
      </div>
      <div class="form-group"><label class="form-label">📞 SĐT khách (tùy chọn)</label>
        <input type="tel" class="form-input" id="qd-phone" placeholder="09..." />
      </div>
      <button class="btn btn-primary mt-16" onclick="G._doQuickSave(${amt},'debt',$('qd-name')?.value||'',$('qd-phone')?.value||'')">⚠️ Lưu nợ</button>
      <button class="btn btn-outline mt-8" onclick="G.closeModal()">Hủy</button>
    `);
    setTimeout(() => $('qd-name')?.focus(), 300);
  },

  _doQuickSave(amt, payStatus, custName, custPhone) {
    const tr = todayTrips(U.id);
    const runTot = tr.length > 0 ? tr[0].running_total : 0;
    const nextNum = tr.length > 0 ? tr[0].trip_number + 1 : 1;
    const comm = Math.round(amt * U.commission_value / 100);
    const now = new Date();
    const tid = 't' + Date.now();
    const payMethod = payStatus === 'debt' ? 'pending' : 'cash';

    const trip = {
      id: tid, driver_id: U.id, trip_number: nextNum, amount: amt,
      note: payStatus === 'debt' ? `Nợ: ${custName || 'Khách'}` : 'Nhập nhanh',
      payment_status: payStatus, payment_method: payMethod,
      service_type: 'xe_om', distance_km: 0,
      customer_name: custName, customer_phone: custPhone,
      running_total: runTot + amt, commission_amount: comm,
      created_at: now.toISOString(), date: today(), is_locked: false,
    };
    D.trips.push(trip);

    // Fund contribution
    const fundCfg = D.settings.fund || {};
    let fundContrib = 0;
    if (fundCfg.per_trip?.enabled) fundContrib += fundCfg.per_trip.amount || 0;
    if (fundCfg.percent?.enabled) fundContrib += Math.round(comm * (fundCfg.percent.value || 0) / 100);
    if (fundContrib > 0) {
      const ftx = {
        id: 'ftx' + Date.now(), trip_id: tid, driver_id: U.id,
        amount: fundContrib, source: 'cuoc', note: 'Cuốc #' + nextNum,
        date: today(), created_at: now.toISOString(),
      };
      if (!D.fundTransactions) D.fundTransactions = [];
      D.fundTransactions.push(ftx);
      const drv = D.users.find(u => u.id === U.id);
      if (drv) drv.wallet = (drv.wallet || 0) - fundContrib;
    }

    // Invoice
    const invoice = { id: 'inv'+Date.now(), trip_id: tid, driver_id: U.id, amount: amt, service_type: 'xe_om', distance_km: 0, commission: comm, payment_status: payStatus, payment_method: payMethod, created_at: now.toISOString(), date: today() };
    D.invoices.push(invoice);

    // Debt
    let debtRecord = null;
    if (payStatus === 'debt') {
      debtRecord = { id: 'debt'+Date.now(), trip_id: tid, driver_id: U.id, amount: amt, customer_name: custName, customer_phone: custPhone, status: 'pending', created_at: now.toISOString(), date: today(), note: `Cuốc #${nextNum}` };
      D.debts.push(debtRecord);
    }

    addLog('trip_quick', `⚡ Cuốc #${nextNum}: ${fmtFull(amt)} ${payStatus === 'debt' ? '(NỢ: '+custName+')' : '(Đã TT)'}`);
    saveData(D);

    // Sync to cloud
    if (DB_ONLINE) {
      dbSaveTrip(trip).catch(e => console.error('Trip sync:', e));
      dbSaveInvoice(invoice).catch(e => console.error('Invoice sync:', e));
      if (debtRecord) dbSaveDebt(debtRecord).catch(e => console.error('Debt sync:', e));
    }

    G.closeModal();
    renderDriver();
  },

  quickResolveDebt(debtId) {
    const d = D.debts.find(x => x.id === debtId);
    if (!d) return;
    if (!confirm(`Thu nợ ${fmtFull(d.amount)} từ ${d.customer_name || 'Khách'}?`)) return;
    d.status = 'resolved';
    d.resolved_at = new Date().toISOString();
    addLog('debt_resolve', `Thu nợ: ${fmtFull(d.amount)} — ${d.customer_name || 'Khách'}`);
    saveData(D);
    if (DB_ONLINE) dbSaveDebt(d).catch(e => console.error('Debt sync:', e));
    renderDriver();
  },

  showDriverDebts() {
    const pendingDebts = D.debts.filter(d => d.driver_id === U.id && d.status === 'pending');
    const totalAmt = pendingDebts.reduce((s,d) => s + d.amount, 0);
    openModal(`
      <div class="modal-handle"></div>
      <div class="modal-title">⚠️ Công nợ: ${fmtFull(totalAmt)}</div>
      ${pendingDebts.map(d => `
        <div class="trip-card debt" style="margin-bottom:8px;">
          <div class="trip-header"><span class="trip-number">${d.customer_name || 'Khách'} ${d.customer_phone ? '· '+d.customer_phone : ''}</span><span class="trip-time">${d.date}</span></div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;">
            <div class="trip-amount" style="font-size:18px;">${fmtFull(d.amount)}</div>
            <button class="btn btn-sm btn-success" onclick="G.quickResolveDebt('${d.id}')">✅ Đã thu</button>
          </div>
          ${d.note ? `<div class="trip-note">📝 ${d.note}</div>` : ''}
        </div>
      `).join('') || '<div class="alert alert-success">✅ Không có nợ!</div>'}
      <button class="btn btn-outline mt-16" onclick="G.closeModal()">Đóng</button>
    `);
  },

  // ADMIN MODALS
  addDriverModal() {
    openModal(`<div class="modal-handle"></div><div class="modal-title">➕ Thêm tài xế</div>
      <div class="form-group"><label class="form-label">Họ tên</label><input type="text" class="form-input" id="nd-name" placeholder="Nguyễn Văn..." /></div>
      <div class="form-group"><label class="form-label">SĐT (đăng nhập)</label><input type="tel" class="form-input" id="nd-phone" placeholder="09..." /></div>
      <div class="form-group"><label class="form-label">Mật khẩu</label><input type="text" class="form-input" id="nd-pass" value="123456" /></div>
      <div class="form-group"><label class="form-label">Biển số xe</label><input type="text" class="form-input" id="nd-plate" placeholder="59P1-..." /></div>
      <div class="form-group"><label class="form-label">Hoa hồng (%)</label><input type="number" class="form-input" id="nd-comm" value="${D.settings.default_commission_value}" /></div>
      <button class="btn btn-primary" onclick="G.addDriver()">✅ Tạo tài khoản</button>
      <button class="btn btn-outline mt-8" onclick="G.closeModal()">Hủy</button>
    `);
  },

  async addDriver() {
    const name=$('nd-name').value.trim(), phone=$('nd-phone').value.trim(), pass=$('nd-pass').value, plate=$('nd-plate').value.trim(), comm=parseInt($('nd-comm').value)||20;
    if (!name||!phone) { alert('Nhập đầy đủ!'); return; }
    if (D.users.find(u=>u.phone===phone)) { alert('SĐT đã tồn tại!'); return; }
    const pw_hash = await hashPassword(pass);
    const newDriver = { id:'d'+Date.now(), name, phone, password:pass, password_hash:pw_hash, role:'driver', vehicle_plate:plate, vehicle_type:'xe_may', status:'active', commission_type:'percent', commission_value:comm, online:false, wallet:0, created_at:today() };
    D.users.push(newDriver);
    addLog('driver_create', `Thêm TX: ${name}`);
    saveData(D);
    if (DB_ONLINE) dbSaveUser(newDriver).catch(e => console.error('Driver sync:', e));
    G.closeModal(); renderAdmin();
  },

  editUniformModal(id) {
    const d = driver(id); if(!d) return;
    const sizes = ['S','M','L','XL','XXL'];
    openModal(`<div class="modal-handle"></div><div class="modal-title">👕 Quản lý áo — ${d.name}</div>
      <div class="form-group"><label class="form-label">Số áo (từ 9 trở lên, không trùng)</label><input type="number" min="9" class="form-input" id="ao-so" value="${d.ao_so||''}" placeholder="Gợi ý số trống: ${nextFreeAoSo(d.id)}" inputmode="numeric" style="font-size:20px;font-weight:700;" /><div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Số áo bắt đầu từ 9. Anh em không được trùng số.</div></div>
      <div class="form-group"><label class="form-label">Size áo</label>
        <select class="form-input" id="ao-size">
          <option value="">— Chọn size —</option>
          ${sizes.map(s=>`<option value="${s}" ${d.ao_size===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label class="form-label">Số lượng áo đã cấp</label><input type="number" class="form-input" id="ao-sl" value="${d.ao_soluong||''}" placeholder="VD: 2" inputmode="numeric" /></div>
      <button class="btn btn-primary" onclick="G.saveUniform('${d.id}')">💾 Lưu</button>
      <button class="btn btn-outline mt-8" onclick="G.closeModal()">Hủy</button>
    `);
  },

  saveUniform(id) {
    const d = D.users.find(u=>u.id===id); if(!d) return;
    const raw = $('ao-so').value.trim();
    if (raw) {
      const num = parseInt(raw, 10);
      if (isNaN(num) || num < 9) { alert('Số áo phải từ 9 trở lên!'); return; }
      const dup = D.users.find(u => u.id !== id && u.role === 'driver' && u.ao_so && parseInt(u.ao_so, 10) === num);
      if (dup) { alert(`Số áo ${num} đã có "${dup.name}" dùng! Chọn số khác (gợi ý: ${nextFreeAoSo(id)}).`); return; }
      d.ao_so = String(num);
    } else {
      d.ao_so = null;
    }
    d.ao_size = $('ao-size').value || null;
    const sl = parseInt($('ao-sl').value);
    d.ao_soluong = isNaN(sl) ? null : sl;
    addLog('driver_uniform', `Cập nhật áo ${d.name}: #${d.ao_so||'-'} size ${d.ao_size||'-'} x${d.ao_soluong||0}`);
    saveData(D);
    if (DB_ONLINE) {
      dbUpdateUserField(id, 'ao_so', d.ao_so).catch(e => console.error('Uniform sync:', e));
      dbUpdateUserField(id, 'ao_size', d.ao_size).catch(e => console.error('Uniform sync:', e));
      dbUpdateUserField(id, 'ao_soluong', d.ao_soluong).catch(e => console.error('Uniform sync:', e));
    }
    G.closeModal(); renderAdmin(); G.showA('scr-a-drivers');
  },

  driverDetail(id) {
    const d = driver(id); if(!d) return;
    const tr = todayTrips(id); const amt=tr.reduce((s,t)=>s+t.amount,0); const comm=tr.reduce((s,t)=>s+(t.commission_amount||0),0); const debt=tr.filter(t=>t.payment_status==='debt').reduce((s,t)=>s+t.amount,0);
    openModal(`<div class="modal-handle"></div><div class="modal-title">👤 ${d.name}</div>
      <div class="summary-bar mb-16">
        <div class="summary-row"><span class="label">SĐT</span><span class="value">${d.phone||'N/A'}</span></div>
        <div class="summary-row"><span class="label">CCCD</span><span class="value">${d.cccd||'N/A'}</span></div>
        <div class="summary-row"><span class="label">Ngày sinh</span><span class="value">${d.dob||'N/A'}</span></div>
        <div class="summary-row"><span class="label">Biển số</span><span class="value">${d.vehicle_plate||'N/A'}</span></div>
        <div class="summary-row"><span class="label">Trạng thái</span><span class="value ${d.status==='active'?'text-success':(d.status==='paused'?'text-muted':'text-danger')}">${d.status==='active'?'🟢 Hoạt động':(d.status==='paused'?'⏸️ Tạm nghỉ':'🔴 Khóa')}</span></div>
        <div class="summary-row"><span class="label">Hoa hồng</span><span class="value">${d.commission_value}%</span></div>
        <div class="summary-row"><span class="label">Ví tiền</span><span class="value text-primary">${fmtFull(d.wallet||0)}</span></div>
      </div>
      <div class="summary-bar mb-16">
        <div class="summary-row"><span class="label">👕 Số áo</span><span class="value fw-bold">${d.ao_so?'#'+d.ao_so:'Chưa cấp'}</span></div>
        <div class="summary-row"><span class="label">Size áo</span><span class="value">${d.ao_size||'N/A'}</span></div>
        <div class="summary-row"><span class="label">Số lượng áo</span><span class="value">${d.ao_soluong?d.ao_soluong+' cái':'N/A'}</span></div>
        <div class="summary-row"><span class="label">Tiền cọc</span><span class="value">${d.deposit_note||'N/A'}</span></div>
        <div class="summary-row"><span class="label">Tiền áo</span><span class="value">${d.uniform_note||'N/A'}</span></div>
      </div>
      <div class="summary-bar mb-16">
        <div class="summary-row"><span class="label">Cuốc hôm nay</span><span class="value fw-bold">${tr.length}</span></div>
        <div class="summary-row"><span class="label">Doanh thu</span><span class="value fw-bold">${fmtFull(amt)}</span></div>
        <div class="summary-row"><span class="label">Hoa hồng</span><span class="value text-primary fw-bold">${fmtFull(comm)}</span></div>
        <div class="summary-row"><span class="label">Nợ</span><span class="value ${debt>0?'text-warning':'text-success'} fw-bold">${fmtFull(debt)}</span></div>
      </div>
      ${d.status==='pending' ? `<button class="btn btn-success" onclick="G.approveDriver('${d.id}')">✅ Duyệt tài khoản</button>` : ''}
      ${d.status==='active'?`<button class="btn btn-danger mt-8" onclick="G.toggleBlock('${d.id}',true)">🔒 Khóa</button>`:''}
      ${d.status==='blocked'?`<button class="btn btn-success mt-8" onclick="G.toggleBlock('${d.id}',false)">🔓 Mở khóa</button>`:''}
      <button class="btn btn-outline mt-8" onclick="G.editUniformModal('${d.id}')">👕 Quản lý áo</button>
      <button class="btn btn-outline mt-8" onclick="G.editDriverName('${d.id}')">✏️ Đổi tên</button>
      <button class="btn btn-outline mt-8" onclick="G.deleteDriver('${d.id}')" style="color:var(--danger);border-color:var(--danger);">🗑️ Xóa tài khoản</button>
      <button class="btn btn-outline mt-8" onclick="G.closeModal()">Đóng</button>
    `);
  },

  approveDriver(id) {
    const u = D.users.find(x=>x.id===id);
    if (!u) return;
    u.status = 'active';
    addLog('driver_approve', `Duyệt TX: ${u.name}`);
    saveData(D);
    if (DB_ONLINE) dbUpdateUserField(id, 'status', 'active').catch(e => console.error('Approve sync:', e));
    G.closeModal(); renderAdmin(); G.showA('scr-a-drivers');
    alert('✅ Đã duyệt ' + u.name);
  },

  deleteDriver(id) {
    const u = D.users.find(x=>x.id===id);
    if (!u) return;
    if (!confirm(`🗑️ Xóa hẳn tài khoản "${u.name}"?\n\nCảnh báo: KHÔNG khôi phục lại được.`)) return;
    D.users = D.users.filter(x => x.id !== id);
    addLog('driver_delete', `Xóa TX: ${u.name} (${u.phone})`);
    saveData(D);
    // TODO: dbDeleteUser if exists
    G.closeModal(); renderAdmin(); G.showA('scr-a-drivers');
  },

  editDriverName(id) {
    const u = D.users.find(x=>x.id===id);
    if (!u) return;
    const newName = prompt('Đổi tên tài xế:', u.name);
    if (!newName || newName.trim() === '' || newName === u.name) return;
    u.name = newName.trim();
    addLog('driver_rename', `Đổi tên: ${u.phone} → ${u.name}`);
    saveData(D);
    if (DB_ONLINE) dbUpdateUserField(id, 'name', u.name).catch(e => console.error('Rename sync:', e));
    G.closeModal(); renderAdmin(); G.showA('scr-a-drivers');
  },

  toggleBlock(id, block) {
    const u = D.users.find(x=>x.id===id);
    if(u) {
      u.status = block?'blocked':'active';
      addLog(block?'driver_block':'driver_unblock', u.name);
      saveData(D);
      if (DB_ONLINE) dbUpdateUserField(id, 'status', u.status).catch(e => console.error('Block sync:', e));
      G.closeModal(); renderAdmin();
    }
  },

  resolveDebt(id) {
    // Legacy: redirect to modal-based flow
    G.confirmResolve(id);
  },

  cancelDebt(id) {
    if (!confirm('Xóa khoản nợ này?')) return;
    const d = D.debts.find(x=>x.id===id);
    if(d) {
      d.status='cancelled';
      addLog('debt_cancel', `Xóa nợ ${fmtFull(d.amount)}`);
      saveData(D);
      if (DB_ONLINE) dbUpdateDebt(id, { status: 'cancelled' }).catch(e => console.error('Debt sync:', e));
      renderAdmin(); G.showA('scr-a-congno');
    }
  },

  // ============ LỊCH TRỰC ============
  dutyPickDay(w) { dutySelectedDay = w; renderAdmin(); G.showA('scr-a-duty'); },

  _dutySaveAndRefresh() {
    saveData(D);
    if (DB_ONLINE) dbSaveSettings(D.settings).catch(e => console.error('Duty sync:', e));
    renderAdmin(); G.showA('scr-a-duty');
  },

  dutyAddModal(slot, wd) {
    ensureDuty();
    const slotObj = DUTY_SLOTS.find(s => s.id === slot);
    const avail = D.users.filter(u => u.role === 'driver' && u.status === 'active'
      && !dutyAssignedThatDay(u.id, wd) && !dutyConstrained(u.id, slot, wd));
    openModal(`<div class="modal-handle"></div><div class="modal-title">➕ ${slotObj.name} — ${DUTY_WD[wd]}</div>
      ${avail.length === 0 ? '<div class="alert alert-info">Không còn tài xế rảnh/hợp lệ cho suất này.</div>' :
        avail.map(d => `<button class="btn btn-outline mt-8" style="text-align:left;" onclick="G.dutyAdd('${slot}',${wd},'${d.id}')">${d.name} <span style="color:var(--text-muted);font-size:12px;">· ${dutyCountWeek(d.id)} ca/tuần</span></button>`).join('')}
      <button class="btn btn-outline mt-8" onclick="G.closeModal()">Đóng</button>`);
  },

  dutyAdd(slot, wd, id) {
    ensureDuty();
    if (!D.settings.duty_roster[wd][slot].includes(id)) D.settings.duty_roster[wd][slot].push(id);
    addLog('duty_assign', `Xếp ${driverName(id)} vào ${slot} ${DUTY_WD[wd]}`);
    G.closeModal(); G._dutySaveAndRefresh();
  },

  dutyRemove(slot, wd, id) {
    ensureDuty();
    D.settings.duty_roster[wd][slot] = D.settings.duty_roster[wd][slot].filter(x => x !== id);
    G._dutySaveAndRefresh();
  },

  dutyMarkOff(slot, wd, id) {
    const subs = suggestSubstitutes(slot, wd, id);
    const slotObj = DUTY_SLOTS.find(s => s.id === slot);
    openModal(`<div class="modal-handle"></div><div class="modal-title">🔄 ${driverName(id)} nghỉ — ${slotObj.name} ${DUTY_WD[wd]}</div>
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">Gợi ý người trực thay (ưu tiên ít ca, không vướng ràng buộc):</div>
      ${subs.length === 0 ? '<div class="alert alert-warning">⚠️ Không có người thay hợp lệ — cần xử lý tay.</div>' :
        subs.map(d => `<button class="btn btn-outline mt-8" style="text-align:left;" onclick="G.dutySubstitute('${slot}',${wd},'${id}','${d.id}')">${d.name} <span style="color:var(--text-muted);font-size:12px;">· ${dutyCountWeek(d.id)} ca/tuần</span></button>`).join('')}
      <button class="btn btn-outline mt-8" onclick="G.closeModal()">Đóng</button>`);
  },

  dutySubstitute(slot, wd, offId, subId) {
    ensureDuty();
    const arr = D.settings.duty_roster[wd][slot];
    const i = arr.indexOf(offId);
    if (i >= 0) arr[i] = subId; else if (!arr.includes(subId)) arr.push(subId);
    addLog('duty_substitute', `${driverName(offId)} nghỉ → ${driverName(subId)} thay (${slot} ${DUTY_WD[wd]})`);
    G.closeModal(); G._dutySaveAndRefresh();
  },

  dutyAIFill() {
    const { roster, notes } = aiAutoFillRoster();
    _aiProposal = roster;
    const preview = DUTY_WD.map((wn, w) => {
      const r = roster[w];
      const line = (slot, label) => `<div style="font-size:12px;margin:2px 0;"><b>${label}:</b> ${(r[slot].map(id => driverName(id)).join(', ')) || '<span style="color:var(--warning);">trống</span>'}</div>`;
      return `<div class="stat-card" style="opacity:1;text-align:left;padding:10px 12px;margin-bottom:8px;">
        <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${wn}</div>
        ${line('som', 'Sớm 6h30')}${line('tre', 'Trễ 9h30')}${line('toi', 'Tối')}
      </div>`;
    }).join('');
    openModal(`<div class="modal-handle"></div><div class="modal-title">🤖 AI đề xuất lịch tuần</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">Đã tôn trọng ràng buộc + luật xoay (ai trực tối → hôm sau vào trễ) + cân bằng số ca. Xem rồi bấm áp dụng, sau đó vẫn chỉnh tay được.</div>
      ${notes.length ? `<div class="alert alert-warning" style="font-size:12px;">⚠️ ${notes.slice(0,6).join('<br>')}${notes.length>6?'<br>...':''}</div>` : '<div class="alert alert-success" style="font-size:12px;">✅ Phủ đủ mọi suất, không vướng ràng buộc.</div>'}
      <div style="max-height:340px;overflow-y:auto;margin:8px 0;">${preview}</div>
      <button class="btn btn-primary" onclick="G.dutyAIApply()">✅ Áp dụng lịch này</button>
      <button class="btn btn-outline mt-8" onclick="G.closeModal()">Hủy</button>`);
  },

  dutyAIApply() {
    if (!_aiProposal) return;
    ensureDuty();
    D.settings.duty_roster = _aiProposal;
    _aiProposal = null;
    addLog('duty_ai_fill', 'AI tự xếp lịch trực cả tuần');
    G.closeModal(); G._dutySaveAndRefresh();
  },

  dutyConstraintPick() {
    const drivers = D.users.filter(u => u.role === 'driver');
    openModal(`<div class="modal-handle"></div><div class="modal-title">⚙️ Ràng buộc tài xế</div>
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">Chọn tài xế để cài ca nào ngày nào KHÔNG được trực:</div>
      ${drivers.map(d => { const c = (D.settings.duty_constraints?.[d.id] || []).length; return `<button class="btn btn-outline mt-8" style="text-align:left;" onclick="G.dutyConstraintModal('${d.id}')">${d.name}${c ? ` <span style="color:var(--warning);font-size:12px;">· ${c} ràng buộc</span>` : ''}</button>`; }).join('')}
      <button class="btn btn-outline mt-8" onclick="G.closeModal()">Đóng</button>`);
  },

  dutyConstraintModal(id) {
    ensureDuty();
    const d = driver(id);
    const cur = D.settings.duty_constraints[id] || [];
    const grid = DUTY_SLOTS.map(s => `
      <div style="margin-bottom:10px;"><div style="font-weight:600;font-size:13px;margin-bottom:4px;">${s.name}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">
        ${DUTY_WD.map((w, wi) => { const key = s.id + ':' + wi; const on = cur.includes(key); return `<label style="font-size:12px;padding:5px 9px;border-radius:6px;border:1px solid var(--border);background:${on ? 'var(--danger)' : 'var(--bg-card)'};color:${on ? '#fff' : 'var(--text)'};cursor:pointer;"><input type="checkbox" data-key="${key}" ${on ? 'checked' : ''} style="display:none;" onchange="this.parentNode.style.background=this.checked?'var(--danger)':'var(--bg-card)';this.parentNode.style.color=this.checked?'#fff':'var(--text)';">${w}</label>`; }).join('')}
      </div></div>`).join('');
    openModal(`<div class="modal-handle"></div><div class="modal-title">⚙️ ${d.name} — cấm trực</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">Bấm ô ĐỎ = ca đó ngày đó KHÔNG được trực. VD: anh Ngô bấm đỏ Ca tối ở T2, T3, T4, T5.</div>
      ${grid}
      <button class="btn btn-primary mt-8" onclick="G.dutySaveConstraint('${id}')">💾 Lưu ràng buộc</button>
      <button class="btn btn-outline mt-8" onclick="G.closeModal()">Hủy</button>`);
  },

  dutySaveConstraint(id) {
    ensureDuty();
    const keys = [...document.querySelectorAll('#modal-c input[type=checkbox][data-key]')].filter(c => c.checked).map(c => c.getAttribute('data-key'));
    D.settings.duty_constraints[id] = keys;
    addLog('duty_constraint', `Cập nhật ràng buộc ${driverName(id)}: ${keys.length} mục`);
    G.closeModal(); G._dutySaveAndRefresh();
  },

  // ============ ZALO AUDIT ============
  zaloFineModal(id) {
    const v = D.zaloViolations.find(x => x.id === id);
    const drv = v && D.users.find(u => u.id === v.driver_id);
    if (!v || !drv) return;
    openModal(`<div class="modal-handle"></div><div class="modal-title">💸 Phạt ${drv.name}</div>
      <div class="form-group"><label class="form-label">Số tiền phạt</label><input type="number" class="form-input" id="zf-amt" placeholder="Nhập số tiền..." style="font-size:20px;font-weight:700;" inputmode="numeric" /></div>
      <div class="form-group"><label class="form-label">Lý do</label><input type="text" class="form-input" id="zf-note" value="${ZALO_VIOLATION_LABELS[v.violation_type] || v.violation_type}" /></div>
      <button class="btn btn-primary" onclick="G.zaloFineSave('${id}')">💾 Xác nhận phạt</button>
      <button class="btn btn-outline mt-8" onclick="G.closeModal()">Hủy</button>
    `);
  },

  zaloFineSave(id) {
    const v = D.zaloViolations.find(x => x.id === id);
    const drv = v && D.users.find(u => u.id === v.driver_id);
    const amt = parseInt($('zf-amt')?.value) || 0;
    if (!v || !drv || amt <= 0) { alert('Nhập số tiền!'); return; }
    const note = $('zf-note')?.value?.trim() || 'Phạt vi phạm Zalo';
    drv.wallet = (drv.wallet || 0) - amt;
    const wEntry = { id: 'w' + Date.now(), driver_id: drv.id, type: 'fine', amount: amt, note, balance: drv.wallet, date: today(), at: new Date().toISOString() };
    D.walletHistory.push(wEntry);
    v.resolved_at = new Date().toISOString(); v.resolved_by = U?.name || 'admin';
    addLog('zalo_fine', `Phạt ${drv.name}: ${fmtFull(amt)} — ${note}`);
    saveData(D);
    if (DB_ONLINE) {
      dbSaveWalletEntry(wEntry).catch(e => console.error('Fine sync:', e));
      dbUpdateUserField(drv.id, 'wallet', drv.wallet).catch(e => console.error('Fine sync:', e));
      dbResolveViolation(id, U?.name || 'admin').catch(e => console.error('Violation sync:', e));
    }
    G.closeModal(); renderAdmin(); G.showA('scr-a-zalo-audit');
  },

  zaloFundModal(id) {
    const v = D.zaloViolations.find(x => x.id === id);
    const drv = v && D.users.find(u => u.id === v.driver_id);
    if (!v || !drv) return;
    openModal(`<div class="modal-handle"></div><div class="modal-title">🟣 Cộng quỹ từ ${drv.name}</div>
      <div class="form-group"><label class="form-label">Số tiền đóng quỹ</label><input type="number" class="form-input" id="zq-amt" placeholder="Nhập số tiền..." style="font-size:20px;font-weight:700;" inputmode="numeric" /></div>
      <div class="form-group"><label class="form-label">Ghi chú</label><input type="text" class="form-input" id="zq-note" value="${ZALO_VIOLATION_LABELS[v.violation_type] || v.violation_type}" /></div>
      <button class="btn btn-primary" onclick="G.zaloFundSave('${id}')">💾 Xác nhận</button>
      <button class="btn btn-outline mt-8" onclick="G.closeModal()">Hủy</button>
    `);
  },

  zaloFundSave(id) {
    const v = D.zaloViolations.find(x => x.id === id);
    const drv = v && D.users.find(u => u.id === v.driver_id);
    const amt = parseInt($('zq-amt')?.value) || 0;
    if (!v || !drv || amt <= 0) { alert('Nhập số tiền!'); return; }
    const note = $('zq-note')?.value?.trim() || 'Đóng quỹ từ vi phạm Zalo';
    const ftx = { id: 'ftx' + Date.now(), trip_id: null, driver_id: drv.id, amount: amt, source: 'zalo_violation', note, date: today(), created_at: new Date().toISOString() };
    if (!D.fundTransactions) D.fundTransactions = [];
    D.fundTransactions.push(ftx);
    drv.wallet = (drv.wallet || 0) - amt;
    v.resolved_at = new Date().toISOString(); v.resolved_by = U?.name || 'admin';
    addLog('zalo_fund', `Quỹ từ ${drv.name}: ${fmtFull(amt)} — ${note}`);
    saveData(D);
    if (DB_ONLINE) {
      dbUpdateUserField(drv.id, 'wallet', drv.wallet).catch(e => console.error('Fund sync:', e));
      dbResolveViolation(id, U?.name || 'admin').catch(e => console.error('Violation sync:', e));
    }
    G.closeModal(); renderAdmin(); G.showA('scr-a-zalo-audit');
  },

  zaloResolve(id) {
    const v = D.zaloViolations.find(x => x.id === id);
    if (!v) return;
    v.resolved_at = new Date().toISOString(); v.resolved_by = U?.name || 'admin';
    addLog('zalo_resolve', `Bỏ qua vi phạm ${v.violation_type} — ${v.driver_name_zalo || ''}`);
    saveData(D);
    if (DB_ONLINE) dbResolveViolation(id, U?.name || 'admin').catch(e => console.error('Violation sync:', e));
    renderAdmin(); G.showA('scr-a-zalo-audit');
  },

  assignZaloDriver(zaloId) {
    const sel = $('zmap-' + zaloId);
    const driverId = sel?.value;
    if (!driverId) { alert('Chọn tài xế!'); return; }
    const drv = D.users.find(u => u.id === driverId);
    if (!drv) return;
    drv.zalo_id = zaloId;
    (D.zaloViolations || []).forEach(v => { if (v.zalo_sender_id === zaloId) v.driver_id = driverId; });
    addLog('zalo_map', `Gán Zalo ${zaloId} → ${drv.name}`);
    saveData(D);
    if (DB_ONLINE) {
      dbUpdateUserField(driverId, 'zalo_id', zaloId).catch(e => console.error('Map sync:', e));
      dbBackfillViolationDriver(zaloId, driverId).catch(e => console.error('Map sync:', e));
    }
    renderAdmin(); G.showA('scr-a-zalo-mapping');
  },

  saveSettings() {
    D.settings.default_commission_type = $('set-ct').value;
    D.settings.default_commission_value = parseInt($('set-cv').value)||20;
    addLog('settings_update', `HH: ${D.settings.default_commission_value}%`);
    saveData(D);
    if (DB_ONLINE) dbSaveSettings(D.settings).catch(e => console.error('Settings sync:', e));
    alert('✅ Đã lưu!');
  },

  // ============ PRICING MANAGEMENT ============
  editServiceModal(idx) {
    const s = D.pricing.service_types[idx];
    if (!s) return;
    openModal(`
      <div class="modal-handle"></div>
      <div class="modal-title">✏️ Sửa giá: ${s.name}</div>
      <div class="form-group"><label class="form-label">Tên dịch vụ</label><input type="text" class="form-input" id="svc-name" value="${s.name}" /></div>
      <div class="form-group"><label class="form-label">💰 Phí mở cửa (km 0)</label><input type="number" class="form-input" id="svc-base" value="${s.base_fee}" inputmode="numeric" /><div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Phí cơ bản khi bắt đầu cuốc</div></div>
      <div class="form-group"><label class="form-label">🟢 Giá/km — 2km đầu</label><input type="number" class="form-input" id="svc-km1" value="${s.per_km_first2}" inputmode="numeric" style="font-size:20px;font-weight:700;color:var(--success);" /><div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Áp dụng từ km 0 → km 2</div></div>
      <div class="form-group"><label class="form-label">🟡 Giá/km — Từ km 3 trở lên</label><input type="number" class="form-input" id="svc-km2" value="${s.per_km_after}" inputmode="numeric" style="font-size:20px;font-weight:700;color:var(--primary);" /><div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Áp dụng từ km 3 trở đi (thường rẻ hơn)</div></div>
      <div class="form-group"><label class="form-label">⚠️ Giá tối thiểu</label><input type="number" class="form-input" id="svc-min" value="${s.min_fee}" inputmode="numeric" /><div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Cuốc ngắn dưới mức này vẫn tính = giá tối thiểu</div></div>
      <div class="form-group"><label class="form-label">🔴 Phụ phí cao điểm (%)</label><input type="number" class="form-input" id="svc-surge" value="${s.surge_percent}" inputmode="numeric" /><div style="font-size:11px;color:var(--text-muted);margin-top:4px;">VD: 30 = cộng thêm 30% giờ cao điểm</div></div>
      <div class="form-group"><label class="form-label">🌙 Phí đêm (cộng thêm)</label><input type="number" class="form-input" id="svc-night" value="${s.night_fee}" inputmode="numeric" /></div>
      <div class="form-group"><label class="form-label">✨ Hệ số nhân giá (1 = bình thường, 2 = gấp đôi)</label><input type="number" class="form-input" id="svc-multi" value="${s.multiplier||1}" step="0.5" inputmode="decimal" /><div style="font-size:11px;color:var(--text-muted);margin-top:4px;">VD: Xe ôm có xe = ×2 giá xe ôm thường</div></div>
      <div class="alert alert-success" style="margin-top:12px;">💡 Công thức: Mở cửa + (2km đầu × giá/km) + (km còn lại × giá/km) + cao điểm + đêm</div>
      <button class="btn btn-primary mt-8" onclick="G.saveService(${idx})">💾 Lưu thay đổi</button>
      <button class="btn btn-outline mt-8" onclick="G.closeModal()">Hủy</button>
    `);
  },

  addServiceModal() {
    openModal(`
      <div class="modal-handle"></div>
      <div class="modal-title">➕ Thêm dịch vụ mới</div>
      <div class="form-group"><label class="form-label">Tên dịch vụ</label><input type="text" class="form-input" id="svc-name" placeholder="VD: 🏍️ Xe ôm có xe" /></div>
      <div class="form-group"><label class="form-label">💰 Phí mở cửa</label><input type="number" class="form-input" id="svc-base" value="15000" inputmode="numeric" /></div>
      <div class="form-group"><label class="form-label">🟢 Giá/km — 2km đầu</label><input type="number" class="form-input" id="svc-km1" value="5000" inputmode="numeric" style="font-size:20px;font-weight:700;color:var(--success);" /></div>
      <div class="form-group"><label class="form-label">🟡 Giá/km — Từ km 3+</label><input type="number" class="form-input" id="svc-km2" value="4000" inputmode="numeric" style="font-size:20px;font-weight:700;color:var(--primary);" /></div>
      <div class="form-group"><label class="form-label">⚠️ Giá tối thiểu</label><input type="number" class="form-input" id="svc-min" value="15000" inputmode="numeric" /></div>
      <div class="form-group"><label class="form-label">🔴 Phụ phí cao điểm (%)</label><input type="number" class="form-input" id="svc-surge" value="20" inputmode="numeric" /></div>
      <div class="form-group"><label class="form-label">🌙 Phí đêm</label><input type="number" class="form-input" id="svc-night" value="10000" inputmode="numeric" /></div>
      <div class="form-group"><label class="form-label">✨ Hệ số nhân (1=thường, 2=gấp đôi)</label><input type="number" class="form-input" id="svc-multi" value="1" step="0.5" inputmode="decimal" /></div>
      <button class="btn btn-primary mt-8" onclick="G.saveService(-1)">✅ Tạo dịch vụ</button>
      <button class="btn btn-outline mt-8" onclick="G.closeModal()">Hủy</button>
    `);
  },

  saveService(idx) {
    const name = $('svc-name')?.value?.trim();
    if (!name) { alert('Nhập tên dịch vụ!'); return; }
    const svc = {
      id: idx >= 0 ? D.pricing.service_types[idx].id : 'svc_'+Date.now(),
      name,
      base_fee: parseInt($('svc-base')?.value)||0,
      per_km_first2: parseInt($('svc-km1')?.value)||0,
      per_km_after: parseInt($('svc-km2')?.value)||0,
      min_fee: parseInt($('svc-min')?.value)||0,
      surge_percent: parseInt($('svc-surge')?.value)||0,
      night_fee: parseInt($('svc-night')?.value)||0,
      multiplier: parseFloat($('svc-multi')?.value)||1,
    };
    if (idx >= 0) {
      // Preserve base_service if editing
      svc.base_service = D.pricing.service_types[idx].base_service;
      D.pricing.service_types[idx] = svc;
      addLog('pricing_edit', `Sửa giá: ${name}`);
    } else {
      D.pricing.service_types.push(svc);
      addLog('pricing_add', `Thêm dịch vụ: ${name}`);
    }
    saveData(D);
    if (DB_ONLINE) dbSavePricing(D.pricing).catch(e => console.error('Pricing sync:', e));
    G.closeModal(); renderAdmin(); G.showA('scr-a-pricing');
  },

  deleteService(idx) {
    const s = D.pricing.service_types[idx];
    if (!confirm(`Xóa dịch vụ "${s.name}"?`)) return;
    D.pricing.service_types.splice(idx, 1);
    addLog('pricing_delete', `Xóa dịch vụ: ${s.name}`);
    saveData(D);
    if (DB_ONLINE) dbSavePricing(D.pricing).catch(e => console.error('Pricing sync:', e));
    renderAdmin(); G.showA('scr-a-pricing');
  },

  liveCalc() {
    const km = parseFloat($('calc-km')?.value) || 0;
    const el = $('calc-result');
    if (!el || km <= 0) { if(el) el.innerHTML=''; return; }
    
    const svcs = D.pricing.service_types;
    el.innerHTML = `
      <div style="margin-top:12px;">
        ${svcs.map(s => {
          const d = calcFareDetail(s, km);
          return `<div class="summary-bar" style="margin-bottom:10px;">
            <div class="summary-row" style="font-weight:700;padding:6px 0;"><span class="label">${s.name}${s.multiplier>1?' ×'+s.multiplier:''}</span><span class="value fw-bold text-primary" style="font-size:18px;">${fmtFull(d.total)}</span></div>
            <div class="summary-row"><span class="label">  💰 Mở cửa</span><span class="value">${fmtFull(d.base)}</span></div>
            <div class="summary-row"><span class="label">  🟢 ${Math.min(km,2)}km × ${fmtFull(s.per_km_first2)}</span><span class="value">${fmtFull(d.kmFee1)}</span></div>
            ${km > 2 ? `<div class="summary-row"><span class="label">  🟡 ${(km-2).toFixed(1)}km × ${fmtFull(s.per_km_after)}</span><span class="value">${fmtFull(d.kmFee2)}</span></div>` : ''}
            ${d.surgeFee > 0 ? `<div class="summary-row"><span class="label">  🔴 Cao điểm +${s.surge_percent}%</span><span class="value text-warning">+${fmtFull(d.surgeFee)}</span></div>` : ''}
            ${d.nightFee > 0 ? `<div class="summary-row"><span class="label">  🌙 Phí đêm</span><span class="value">+${fmtFull(d.nightFee)}</span></div>` : ''}
          </div>`;
        }).join('')}
      </div>
    `;
  },

  walletAction(type) {
    const label = type==='deposit'?'Nạp tiền':'Rút tiền';
    openModal(`<div class="modal-handle"></div><div class="modal-title">${type==='deposit'?'➕':'💸'} ${label}</div>
      <div class="form-group"><label class="form-label">Số tiền</label><input type="number" class="form-input" id="w-amt" placeholder="Nhập số tiền..." style="font-size:20px;font-weight:700;" inputmode="numeric" /></div>
      <div class="form-group"><label class="form-label">Ghi chú</label><input type="text" class="form-input" id="w-note" placeholder="VD: Nạp từ Momo..." /></div>
      <button class="btn btn-primary" onclick="G.walletSave('${type}')">💾 Xác nhận ${label}</button>
      <button class="btn btn-outline mt-8" onclick="G.closeModal()">Hủy</button>
    `);
  },

  walletSave(type) {
    const amt = parseInt($('w-amt')?.value)||0;
    if (amt <= 0) { alert('Nhập số tiền!'); return; }
    if (type==='withdraw' && amt > (U.wallet||0)) { alert('Số dư không đủ!'); return; }
    const note = $('w-note')?.value?.trim() || (type==='deposit'?'Nạp tiền':'Rút tiền');
    U.wallet = (U.wallet||0) + (type==='deposit'?amt:-amt);
    const usr = D.users.find(u=>u.id===U.id); if(usr) usr.wallet = U.wallet;
    const wEntry = { id:'w'+Date.now(), driver_id:U.id, type, amount:amt, note, balance:U.wallet, date:today(), at:new Date().toISOString() };
    D.walletHistory.push(wEntry);
    addLog(`wallet_${type}`, `${fmtFull(amt)} — ${note}`);
    saveData(D);
    if (DB_ONLINE) {
      dbSaveWalletEntry(wEntry).catch(e => console.error('Wallet sync:', e));
      dbUpdateUserField(U.id, 'wallet', U.wallet).catch(e => console.error('Wallet sync:', e));
    }
    G.closeModal(); renderDriver(); G.showD('scr-d-wallet');
  },

  reset() {
    if (confirm('🔄 Reset toàn bộ?')) { localStorage.removeItem(STORAGE_KEY); D = loadData(); renderLogin(); }
  },

  // ============================================================
  // FUND (Quỹ) HANDLERS
  // ============================================================
  previewQuy() {
    const tripEn = $('quy-trip-en')?.checked;
    const dayEn = $('quy-day-en')?.checked;
    const pctEn = $('quy-pct-en')?.checked;
    const tripCustom = parseInt($('quy-trip-custom')?.value);
    const dayCustom = parseInt($('quy-day-custom')?.value);
    const pctCustom = parseInt($('quy-pct-custom')?.value);
    const tripRadio = parseInt(document.querySelector('input[name="quy-trip"]:checked')?.value || 0);
    const dayRadio = parseInt(document.querySelector('input[name="quy-day"]:checked')?.value || 0);
    const pctRadio = parseInt(document.querySelector('input[name="quy-pct"]:checked')?.value || 0);
    const tripAmt = tripCustom || tripRadio || 0;
    const dayAmt = dayCustom || dayRadio || 0;
    const pctVal = pctCustom || pctRadio || 0;
    const sampleTrips = 30, sampleAmount = 30000;
    const sampleComm = sampleAmount * 0.2;
    let inFund = 0;
    if (tripEn) inFund += tripAmt * sampleTrips;
    if (pctEn) inFund += sampleComm * sampleTrips * pctVal / 100;
    if (dayEn) inFund += dayAmt;
    const inDriver = sampleAmount * sampleTrips;
    const driverNet = inDriver - inFund;
    const preview = $('quy-preview');
    if (preview) {
      preview.innerHTML = `
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">Ví dụ: tài xế chạy ${sampleTrips} cuốc, mỗi cuốc ${fmt(sampleAmount)}đ:</div>
        <div class="summary-row"><span class="label">💰 Doanh thu</span><span class="value">${fmt(inDriver)}đ</span></div>
        <div class="summary-row"><span class="label">🟣 Vào quỹ</span><span class="value text-primary fw-bold">${fmt(inFund)}đ</span></div>
        <div class="summary-row"><span class="label">💵 Tài xế nhận</span><span class="value text-success fw-bold">${fmt(driverNet)}đ</span></div>
      `;
    }
  },

  saveQuyConfig() {
    const tripCustom = parseInt($('quy-trip-custom')?.value);
    const dayCustom = parseInt($('quy-day-custom')?.value);
    const pctCustom = parseInt($('quy-pct-custom')?.value);
    const tripRadio = parseInt(document.querySelector('input[name="quy-trip"]:checked')?.value || 0);
    const dayRadio = parseInt(document.querySelector('input[name="quy-day"]:checked')?.value || 0);
    const pctRadio = parseInt(document.querySelector('input[name="quy-pct"]:checked')?.value || 0);
    const absentPolicy = document.querySelector('input[name="quy-absent"]:checked')?.value || 'skip';
    if (!D.settings) D.settings = {};
    D.settings.fund = {
      purpose: $('quy-purpose')?.value?.trim() || 'Quỹ chung',
      per_trip: { enabled: !!$('quy-trip-en')?.checked, amount: tripCustom || tripRadio || 0 },
      per_day: { enabled: !!$('quy-day-en')?.checked, amount: dayCustom || dayRadio || 0, absent_policy: absentPolicy },
      percent: { enabled: !!$('quy-pct-en')?.checked, value: pctCustom || pctRadio || 0 },
    };
    addLog('quy_config', 'Cập nhật cài đặt quỹ');
    saveData(D);
    alert('✅ Đã lưu cài đặt quỹ');
    renderAdmin(); G.showA('scr-a-quy-config');
  },

  addFundExpenseModal() {
    const drivers = D.users.filter(u => u.role === 'driver');
    openModal(`<div class="modal-handle"></div><div class="modal-title">💸 Thêm khoản chi quỹ</div>
      <div class="form-group"><label class="form-label">Số tiền (đ)</label><input type="number" class="form-input" id="fex-amt" placeholder="VD: 500000" /></div>
      <div class="form-group"><label class="form-label">Mục đích</label><input type="text" class="form-input" id="fex-note" placeholder="VD: Bảo trì xe" /></div>
      <div class="form-group"><label class="form-label">Cho ai (tùy chọn)</label>
        <select class="form-input" id="fex-target"><option value="">— Không chọn —</option>${drivers.map(d => `<option value="${d.name}">${d.name}</option>`).join('')}</select>
      </div>
      <button class="btn btn-primary" onclick="G.addFundExpense()">💾 Lưu</button>
      <button class="btn btn-outline mt-8" onclick="G.closeModal()">Hủy</button>
    `);
  },

  addFundExpense() {
    const amt = parseInt($('fex-amt')?.value) || 0;
    const note = $('fex-note')?.value?.trim() || 'Chi quỹ';
    const target = $('fex-target')?.value || '';
    if (amt <= 0) { alert('Nhập số tiền hợp lệ'); return; }
    const exp = {
      id: 'fex' + Date.now(), amount: amt, note, target,
      date: today(), created_at: new Date().toISOString(),
    };
    if (!D.fundExpenses) D.fundExpenses = [];
    D.fundExpenses.push(exp);
    addLog('fund_expense', `Chi quỹ ${fmt(amt)}đ — ${note}`);
    saveData(D);
    G.closeModal(); renderAdmin(); G.showA('scr-a-quy-report');
  }
};

// ============================================================
// INIT
// ============================================================
(async function init() {
  // Try to seed Supabase with default data on first run
  if (DB_ONLINE) {
    try {
      const defaults = getDefaultData();
      generateSampleTrips(defaults);
      // Race với timeout 5s để app không bao giờ hang nếu Supabase chậm/down
      const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('Supabase timeout')), ms))]);
      await withTimeout(seedDatabase(defaults), 5000);
      const cloud = await withTimeout(loadDataFromCloud(), 5000);
      if (cloud) D = cloud;
    } catch (e) {
      console.warn('Supabase init failed, using localStorage:', e?.message || e);
    }
  }
  renderLogin();
  console.log(`🟣 Tím Go v2.0 Pro — ${DB_ONLINE ? '☁️ Cloud Mode' : '💾 Local Mode'}`);
})();
