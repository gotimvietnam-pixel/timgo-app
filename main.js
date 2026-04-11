/* ========================================
   🟣 TÍM GO v2.0 — Professional Edition
   Hệ thống quản lý tài xế chuyên nghiệp
   ======================================== */

import './style.css';
import {
  initSupabase, isSupabaseOnline, loadAllData, hashPassword, verifyPassword,
  dbSaveUser, dbUpdateUserField, dbSaveTrip, dbSaveInvoice, dbSaveDebt,
  dbUpdateDebt, dbSaveWalletEntry, dbSavePricing, dbSaveSettings, dbAddLog,
  seedDatabase, dbLogin,
} from './supabase.js';

// ============================================================
// DATA STORE
// ============================================================
const STORAGE_KEY = 'timgo_v2_data';
const DB_ONLINE = initSupabase();

function getDefaultData() {
  const today = new Date().toISOString().split('T')[0];
  return {
    users: [
      { id: 'admin1', name: 'Admin Tím Go', phone: '0901234567', password: '123456', role: 'admin', status: 'active', created_at: today },
      { id: 'd1', name: 'Nguyễn Văn An', phone: '0911111111', password: '111111', role: 'driver', vehicle_plate: '59P1-12345', vehicle_type: 'xe_may', status: 'active', commission_type: 'percent', commission_value: 20, online: true, wallet: 500000, created_at: today },
      { id: 'd2', name: 'Trần Minh Bảo', phone: '0922222222', password: '222222', role: 'driver', vehicle_plate: '59P1-67890', vehicle_type: 'xe_may', status: 'active', commission_type: 'percent', commission_value: 20, online: true, wallet: 320000, created_at: today },
      { id: 'd3', name: 'Lê Hoàng Cường', phone: '0933333333', password: '333333', role: 'driver', vehicle_plate: '59P1-11111', vehicle_type: 'xe_may', status: 'active', commission_type: 'percent', commission_value: 20, online: false, wallet: 180000, created_at: today },
      { id: 'd4', name: 'Phạm Thanh Dũng', phone: '0944444444', password: '444444', role: 'driver', vehicle_plate: '59P2-22222', vehicle_type: 'xe_may', status: 'active', commission_type: 'percent', commission_value: 20, online: true, wallet: 760000, created_at: today },
      { id: 'd5', name: 'Võ Quốc Em', phone: '0955555555', password: '555555', role: 'driver', vehicle_plate: '59P2-33333', vehicle_type: 'xe_may', status: 'active', commission_type: 'percent', commission_value: 15, online: true, wallet: 420000, created_at: today },
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
    settings: { default_commission_type: 'percent', default_commission_value: 20, calc_method: 'km' },
    walletHistory: [],
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
      if (!d.pricing) d.pricing = getDefaultData().pricing;
      return d;
    }
  } catch (e) {}
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
          <button class="role-tab active" id="rt-admin" onclick="G.setRole('admin')">🔑 Admin</button>
          <button class="role-tab" id="rt-driver" onclick="G.setRole('driver')">🏍️ Tài xế</button>
        </div>
        <div class="form-group">
          <label class="form-label">Số điện thoại</label>
          <input type="tel" class="form-input" id="inp-phone" placeholder="VD: 0901234567" />
        </div>
        <div class="form-group">
          <label class="form-label">Mật khẩu</label>
          <input type="password" class="form-input" id="inp-pass" placeholder="Nhập mật khẩu" />
        </div>
        <div id="login-err" class="alert alert-danger" style="display:none"></div>
        <button class="btn btn-primary" onclick="G.login()">Đăng nhập</button>
        <div class="text-center text-muted" style="margin-top:16px;font-size:11px;">
          🔑 Admin: 0901234567 / 123456<br>🏍️ TX: 0911111111 / 111111
        </div>
      </div>
    </div>`;
}

// ============================================================
// ADMIN SCREENS
// ============================================================
function renderAdmin() {
  stopDriverGPS();
  app().innerHTML = [
    adminDashboard(), adminDrivers(), adminTrips(), adminFinance(),
    adminPricing(), adminDebts(), adminSettings(),
    `<div class="modal-overlay" id="modal-ov" onclick="G.closeModal()"><div class="modal-sheet" onclick="event.stopPropagation()" id="modal-c"></div></div>`,
    adminNav()
  ].join('');
  show('scr-a-dash', 'nav-a', adminScreens);
  // Init map after DOM is ready
  setTimeout(() => initAdminMap(), 100);
}

const adminScreens = ['scr-a-dash','scr-a-drivers','scr-a-trips','scr-a-finance','scr-a-more'];

function adminDashboard() {
  const trips = allTodayTrips();
  const drivers = D.users.filter(u => u.role === 'driver');
  const active = drivers.filter(d => d.status === 'active');
  const online = active.filter(d => d.online).length;
  const totAmt = trips.reduce((s,t) => s + t.amount, 0);
  const totDebt = trips.filter(t => t.payment_status === 'debt').reduce((s,t) => s + t.amount, 0);
  const totComm = trips.reduce((s,t) => s + (t.commission_amount||0), 0);

  const warns = [];
  active.forEach(d => {
    if (d.online) {
      const dt = todayTrips(d.id);
      if (dt.length === 0) warns.push({t:'danger', m:`🔴 ${d.name} — Online nhưng chưa có cuốc`});
      if (dt.filter(x=>x.payment_status==='debt').length >= 2) warns.push({t:'warning', m:`🟡 ${d.name} — Nhiều cuốc nợ liên tiếp`});
    }
  });

  return `<div class="screen" id="scr-a-dash">
    <div class="header">
      <div class="header-top">
        <div><div class="header-greeting">Xin chào, Admin 👋</div><div class="header-name">Tím Go</div><div class="header-date">📅 ${vnDate()}${isSurge() ? ' — 🔴 GIỜ CAO ĐIỂM' : ''}${isNight() ? ' — 🌙 Phí đêm' : ''}</div></div>
        <div class="header-badge" onclick="G.logout()">🚪</div>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-icon">🟢</div><div class="stat-value">${online}/${active.length}</div><div class="stat-label">TX Online</div></div>
      <div class="stat-card"><div class="stat-icon">🏍️</div><div class="stat-value">${trips.length}</div><div class="stat-label">Tổng cuốc</div></div>
      <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-value">${fmt(totAmt)}</div><div class="stat-label">Doanh thu</div></div>
      <div class="stat-card"><div class="stat-icon">⚠️</div><div class="stat-value text-warning">${fmt(totDebt)}</div><div class="stat-label">Khách nợ</div></div>
      <div class="stat-card"><div class="stat-icon">📈</div><div class="stat-value text-primary">${D.settings.default_commission_value}%</div><div class="stat-label">Hoa hồng</div></div>
      <div class="stat-card"><div class="stat-icon">💵</div><div class="stat-value text-success">${fmt(totComm)}</div><div class="stat-label">Phải thu</div></div>
    </div>
    <div class="section" style="margin-top:-8px;"><div class="section-header"><div class="section-title">🗺️ Bản đồ tài xế</div><span class="section-action" onclick="G.toggleMapFullscreen()">⛶ Phóng to</span></div></div>
    <div class="map-container" id="map-wrapper"><div id="admin-map" style="width:100%;height:100%;"></div></div>
    <div id="map-filter-counts" class="date-filter" style="padding:8px 16px;"></div>
    <div class="section" style="margin-top:-8px;">
      <div id="driver-status-list"></div>
    </div>
    ${warns.length ? `<div class="section"><div class="section-title mb-8">⚠️ Cảnh báo</div>${warns.map(w=>`<div class="alert alert-${w.t}">${w.m}</div>`).join('')}</div>` : ''}
    <div class="section"><div class="section-header"><div class="section-title">📋 Cuốc gần nhất</div><span class="section-action" onclick="G.showA('scr-a-trips')">Xem tất cả →</span></div>
    ${trips.slice(0,5).map(t => tripCard(t, true)).join('')}
    </div>
  </div>`;
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

function adminDrivers() {
  const drivers = D.users.filter(u => u.role === 'driver');
  return `<div class="screen" id="scr-a-drivers">
    <div class="header"><div class="header-top"><div><div class="header-name">👤 Quản lý tài xế</div><div class="header-date">${drivers.filter(d=>d.status==='active').length} hoạt động · ${drivers.length} tổng</div></div><div class="header-badge" onclick="G.addDriverModal()">➕</div></div></div>
    <div class="section" style="margin-top:16px;">
    ${drivers.map(d => {
      const tr = todayTrips(d.id);
      const amt = tr.reduce((s,t)=>s+t.amount,0);
      const debt = tr.filter(t=>t.payment_status==='debt').reduce((s,t)=>s+t.amount,0);
      return `<div class="driver-card ${d.status==='blocked'?'blocked':''}" onclick="G.driverDetail('${d.id}')">
        <div class="driver-top">
          <div class="driver-avatar">${d.name.charAt(0)}</div>
          <div><div class="driver-name">${d.name}</div><div class="driver-plate">🏍️ ${d.vehicle_plate||'N/A'} · 💰 ${d.commission_value}%${d.wallet !== undefined ? ' · 💵 Ví: '+fmt(d.wallet) : ''}</div></div>
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

function adminSettings() {
  return `<div class="screen" id="scr-a-settings">
    <div class="header"><div class="header-top"><div><div class="header-name">⚙️ Cài đặt & Thêm</div></div></div></div>
    <div class="section" style="margin-top:16px;">
      <div class="section-title mb-8">📱 Menu</div>
      <div class="driver-card" onclick="G.showA('scr-a-pricing')" style="cursor:pointer"><div class="driver-top"><div class="driver-avatar" style="font-size:24px">🧮</div><div><div class="driver-name">Bảng giá dịch vụ</div><div class="driver-plate">Cài đặt giá theo km, tuyến, giờ</div></div></div></div>
      <div class="driver-card" onclick="G.showA('scr-a-debts')" style="cursor:pointer"><div class="driver-top"><div class="driver-avatar" style="font-size:24px">⚠️</div><div><div class="driver-name">Quản lý công nợ</div><div class="driver-plate">${D.debts.filter(d=>d.status==='pending').length} khoản chưa thu</div></div></div></div>
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
  return `<div class="bottom-nav" id="nav-a">
    <button class="nav-item active" onclick="G.showA('scr-a-dash')"><span class="nav-icon">🏠</span><span class="nav-label">Tổng quan</span></button>
    <button class="nav-item" onclick="G.showA('scr-a-drivers')"><span class="nav-icon">👤</span><span class="nav-label">Tài xế</span></button>
    <button class="nav-item" onclick="G.showA('scr-a-trips')"><span class="nav-icon">📋</span><span class="nav-label">Cuốc</span></button>
    <button class="nav-item" onclick="G.showA('scr-a-finance')"><span class="nav-icon">💰</span><span class="nav-label">Tài chính</span></button>
    <button class="nav-item" onclick="G.showA('scr-a-settings')"><span class="nav-icon">⚙️</span><span class="nav-label">Thêm</span></button>
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
  return `<div class="screen" id="scr-d-home">
    <div class="header"><div class="header-top">
      <div><div class="header-greeting">Xin chào 👋</div><div class="header-name">${U.name}</div><div class="header-date">📅 ${vnDate()}${isSurge()?' · 🔴 Cao điểm':''}${isNight()?' · 🌙 Đêm':''}</div></div>
      <div class="header-badge" onclick="G.showD('scr-d-profile')">${U.name.charAt(0)}</div>
    </div></div>
    <div id="gps-indicator" class="gps-status" onclick="G.toggleGPS()"><div class="gps-pulse"></div> 📍 Đang kết nối GPS...</div>
    <div id="active-trip-bar" style="display:none;"></div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-icon">🏍️</div><div class="stat-value">${tr.length}</div><div class="stat-label">Cuốc</div></div>
      <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-value">${fmt(tot)}</div><div class="stat-label">Tổng</div></div>
      <div class="stat-card"><div class="stat-icon">💵</div><div class="stat-value text-success">${fmt(tot-comm)}</div><div class="stat-label">Giữ lại</div></div>
      <div class="stat-card"><div class="stat-icon">📈</div><div class="stat-value text-primary">${fmt(comm)}</div><div class="stat-label">Nộp CT</div></div>
      <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-value">${fmt(paid)}</div><div class="stat-label">Đã TT</div></div>
      <div class="stat-card"><div class="stat-icon">⚠️</div><div class="stat-value text-warning">${fmt(debt)}</div><div class="stat-label">Nợ</div></div>
    </div>
    <div class="section"><div class="section-header"><div class="section-title">🟣 Cuốc hôm nay</div><span class="section-action" onclick="G.showD('scr-d-history')">Lịch sử →</span></div>
      ${tr.length===0?'<div class="alert alert-warning">Chưa có cuốc. Bấm ➕ để thêm!</div>':''}
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
    $(`rt-${r}`).classList.add('active');
  },
  async login() {
    const phone = $('inp-phone').value.trim(), pass = $('inp-pass').value;
    if (!phone || !pass) { $('login-err').textContent = '❌ Nhập SĐT và mật khẩu!'; $('login-err').style.display = 'flex'; return; }
    
    // Show loading
    const btn = document.querySelector('#scr-login .btn-primary');
    if (btn) { btn.textContent = '⏳ Đang đăng nhập...'; btn.disabled = true; }
    
    try {
      // Load cloud data first (if available)
      if (DB_ONLINE) {
        const cloud = await loadDataFromCloud();
        if (cloud) { D = cloud; }
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
  showA(id) { show(id, 'nav-a', adminScreens); if(id==='scr-a-dash') setTimeout(()=>initAdminMap(),100); },
  
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

  driverDetail(id) {
    const d = driver(id); if(!d) return;
    const tr = todayTrips(id); const amt=tr.reduce((s,t)=>s+t.amount,0); const comm=tr.reduce((s,t)=>s+(t.commission_amount||0),0); const debt=tr.filter(t=>t.payment_status==='debt').reduce((s,t)=>s+t.amount,0);
    openModal(`<div class="modal-handle"></div><div class="modal-title">👤 ${d.name}</div>
      <div class="summary-bar mb-16">
        <div class="summary-row"><span class="label">SĐT</span><span class="value">${d.phone}</span></div>
        <div class="summary-row"><span class="label">Biển số</span><span class="value">${d.vehicle_plate||'N/A'}</span></div>
        <div class="summary-row"><span class="label">Trạng thái</span><span class="value ${d.status==='active'?'text-success':'text-danger'}">${d.status==='active'?'🟢 Hoạt động':'🔴 Khóa'}</span></div>
        <div class="summary-row"><span class="label">Hoa hồng</span><span class="value">${d.commission_value}%</span></div>
        <div class="summary-row"><span class="label">Ví tiền</span><span class="value text-primary">${fmtFull(d.wallet||0)}</span></div>
      </div>
      <div class="summary-bar mb-16">
        <div class="summary-row"><span class="label">Cuốc hôm nay</span><span class="value fw-bold">${tr.length}</span></div>
        <div class="summary-row"><span class="label">Doanh thu</span><span class="value fw-bold">${fmtFull(amt)}</span></div>
        <div class="summary-row"><span class="label">Hoa hồng</span><span class="value text-primary fw-bold">${fmtFull(comm)}</span></div>
        <div class="summary-row"><span class="label">Nợ</span><span class="value ${debt>0?'text-warning':'text-success'} fw-bold">${fmtFull(debt)}</span></div>
      </div>
      ${d.status==='active'?`<button class="btn btn-danger" onclick="G.toggleBlock('${d.id}',true)">🔒 Khóa</button>`:`<button class="btn btn-success" onclick="G.toggleBlock('${d.id}',false)">🔓 Mở khóa</button>`}
      <button class="btn btn-outline mt-8" onclick="G.closeModal()">Đóng</button>
    `);
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
    const d = D.debts.find(x=>x.id===id);
    if(d) {
      d.status='resolved'; d.resolved_at=new Date().toISOString();
      addLog('debt_resolve', `Thu nợ ${fmtFull(d.amount)}`);
      saveData(D);
      if (DB_ONLINE) dbUpdateDebt(id, { status: 'resolved', resolved_at: d.resolved_at }).catch(e => console.error('Debt sync:', e));
      renderAdmin(); G.showA('scr-a-debts');
    }
  },

  cancelDebt(id) {
    if (!confirm('Xóa khoản nợ này?')) return;
    const d = D.debts.find(x=>x.id===id);
    if(d) {
      d.status='cancelled';
      addLog('debt_cancel', `Xóa nợ ${fmtFull(d.amount)}`);
      saveData(D);
      if (DB_ONLINE) dbUpdateDebt(id, { status: 'cancelled' }).catch(e => console.error('Debt sync:', e));
      renderAdmin(); G.showA('scr-a-debts');
    }
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
      await seedDatabase(defaults);
      // Load from cloud
      const cloud = await loadDataFromCloud();
      if (cloud) D = cloud;
    } catch (e) {
      console.warn('Supabase init failed, using localStorage:', e);
    }
  }
  renderLogin();
  console.log(`🟣 Tím Go v2.0 Pro — ${DB_ONLINE ? '☁️ Cloud Mode' : '💾 Local Mode'}`);
})();
