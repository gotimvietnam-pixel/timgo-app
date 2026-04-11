/* ========================================
   🟣 TÍM GO — Supabase Data Layer
   Thay thế localStorage bằng Supabase
   ======================================== */

import { createClient } from '@supabase/supabase-js';

// ============================================================
// INIT
// ============================================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabase = null;
let isOnline = false;

export function initSupabase() {
  if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    isOnline = true;
    console.log('🟣 Supabase connected!');
  } else {
    console.warn('⚠️ Supabase keys missing — using localStorage fallback');
    isOnline = false;
  }
  return isOnline;
}

export function isSupabaseOnline() { return isOnline && supabase !== null; }

// ============================================================
// PASSWORD HASHING (SHA-256 + salt)
// ============================================================
const SALT = 'timgo_salt_2026_pro';

export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + SALT);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password, hash) {
  const computed = await hashPassword(password);
  return computed === hash;
}

// ============================================================
// LOAD ALL DATA (on login)
// ============================================================
export async function loadAllData() {
  if (!isOnline) return null;

  try {
    const [
      { data: users },
      { data: trips },
      { data: debts },
      { data: invoices },
      { data: walletHistory },
      { data: activityLog },
      { data: pricingRows },
      { data: settingsRows },
    ] = await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('trips').select('*').order('created_at', { ascending: false }),
      supabase.from('debts').select('*').order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('wallet_history').select('*').order('created_at', { ascending: false }),
      supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('pricing').select('*'),
      supabase.from('settings').select('*'),
    ]);

    const pricing = pricingRows?.[0]?.config || null;
    const settings = settingsRows?.[0]?.config || null;

    return {
      users: users || [],
      trips: trips || [],
      debts: debts || [],
      invoices: invoices || [],
      walletHistory: walletHistory || [],
      activityLog: activityLog || [],
      pricing,
      settings,
      shifts: [],
    };
  } catch (err) {
    console.error('❌ loadAllData error:', err);
    return null;
  }
}

// ============================================================
// USER OPERATIONS
// ============================================================
export async function dbLogin(phone) {
  if (!isOnline) return null;
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .single();
  if (error) return null;
  return data;
}

export async function dbSaveUser(user) {
  if (!isOnline) return;
  const { error } = await supabase
    .from('users')
    .upsert(mapUserToDB(user), { onConflict: 'id' });
  if (error) console.error('❌ saveUser:', error);
}

export async function dbUpdateUserField(userId, field, value) {
  if (!isOnline) return;
  const { error } = await supabase
    .from('users')
    .update({ [field]: value })
    .eq('id', userId);
  if (error) console.error('❌ updateUserField:', error);
}

function mapUserToDB(u) {
  return {
    id: u.id,
    name: u.name,
    phone: u.phone,
    password_hash: u.password_hash || u.password || '',
    role: u.role,
    status: u.status || 'active',
    vehicle_plate: u.vehicle_plate || null,
    vehicle_type: u.vehicle_type || 'xe_may',
    commission_type: u.commission_type || 'percent',
    commission_value: u.commission_value || 20,
    online: u.online || false,
    wallet: u.wallet || 0,
    created_at: u.created_at || new Date().toISOString(),
  };
}

// ============================================================
// TRIP OPERATIONS
// ============================================================
export async function dbSaveTrip(trip) {
  if (!isOnline) return;
  const { error } = await supabase.from('trips').insert({
    id: trip.id,
    driver_id: trip.driver_id,
    trip_number: trip.trip_number,
    amount: trip.amount,
    note: trip.note || '',
    payment_status: trip.payment_status,
    payment_method: trip.payment_method || 'cash',
    service_type: trip.service_type,
    distance_km: trip.distance_km || 0,
    customer_name: trip.customer_name || '',
    customer_phone: trip.customer_phone || '',
    running_total: trip.running_total || 0,
    commission_amount: trip.commission_amount || 0,
    date: trip.date,
    created_at: trip.created_at,
  });
  if (error) console.error('❌ saveTrip:', error);
}

// ============================================================
// INVOICE OPERATIONS
// ============================================================
export async function dbSaveInvoice(inv) {
  if (!isOnline) return;
  const { error } = await supabase.from('invoices').insert({
    id: inv.id,
    trip_id: inv.trip_id,
    driver_id: inv.driver_id,
    amount: inv.amount,
    service_type: inv.service_type,
    distance_km: inv.distance_km || 0,
    commission: inv.commission || 0,
    payment_status: inv.payment_status,
    payment_method: inv.payment_method || 'cash',
    date: inv.date,
    created_at: inv.created_at,
  });
  if (error) console.error('❌ saveInvoice:', error);
}

// ============================================================
// DEBT OPERATIONS
// ============================================================
export async function dbSaveDebt(debt) {
  if (!isOnline) return;
  const { error } = await supabase.from('debts').insert({
    id: debt.id,
    trip_id: debt.trip_id,
    driver_id: debt.driver_id,
    amount: debt.amount,
    customer_name: debt.customer_name || '',
    customer_phone: debt.customer_phone || '',
    status: debt.status || 'pending',
    note: debt.note || '',
    date: debt.date,
    created_at: debt.created_at,
  });
  if (error) console.error('❌ saveDebt:', error);
}

export async function dbUpdateDebt(debtId, updates) {
  if (!isOnline) return;
  const { error } = await supabase.from('debts').update(updates).eq('id', debtId);
  if (error) console.error('❌ updateDebt:', error);
}

// ============================================================
// WALLET OPERATIONS
// ============================================================
export async function dbSaveWalletEntry(entry) {
  if (!isOnline) return;
  const { error } = await supabase.from('wallet_history').insert({
    id: entry.id,
    driver_id: entry.driver_id,
    type: entry.type,
    amount: entry.amount,
    balance: entry.balance || 0,
    note: entry.note || '',
    date: entry.date,
    created_at: entry.at || new Date().toISOString(),
  });
  if (error) console.error('❌ saveWalletEntry:', error);
}

// ============================================================
// PRICING & SETTINGS
// ============================================================
export async function dbSavePricing(config) {
  if (!isOnline) return;
  const { error } = await supabase.from('pricing').upsert({ id: 'default', config }, { onConflict: 'id' });
  if (error) console.error('❌ savePricing:', error);
}

export async function dbSaveSettings(config) {
  if (!isOnline) return;
  const { error } = await supabase.from('settings').upsert({ id: 'default', config }, { onConflict: 'id' });
  if (error) console.error('❌ saveSettings:', error);
}

// ============================================================
// ACTIVITY LOG
// ============================================================
export async function dbAddLog(entry) {
  if (!isOnline) return;
  const { error } = await supabase.from('activity_log').insert({
    id: entry.id,
    user_id: entry.user_id || null,
    user_name: entry.user_name || '',
    action: entry.action,
    detail: entry.detail || '',
    created_at: entry.created_at || new Date().toISOString(),
  });
  if (error) console.error('❌ addLog:', error);
}

// ============================================================
// SEED: Import sample data to Supabase (first time)
// ============================================================
export async function seedDatabase(defaultData) {
  if (!isOnline) return;
  
  // Check if already seeded
  const { data: existing } = await supabase.from('users').select('id').limit(1);
  if (existing && existing.length > 0) {
    console.log('📦 Database already has data, skipping seed');
    return;
  }

  console.log('🌱 Seeding database...');

  // Hash passwords before inserting
  const usersToInsert = [];
  for (const u of defaultData.users) {
    const hashed = await hashPassword(u.password);
    usersToInsert.push(mapUserToDB({ ...u, password_hash: hashed }));
  }
  
  await supabase.from('users').insert(usersToInsert);
  
  if (defaultData.trips.length > 0) {
    // Insert in batches of 50
    for (let i = 0; i < defaultData.trips.length; i += 50) {
      const batch = defaultData.trips.slice(i, i + 50);
      await supabase.from('trips').insert(batch);
    }
  }
  
  if (defaultData.invoices.length > 0) {
    for (let i = 0; i < defaultData.invoices.length; i += 50) {
      const batch = defaultData.invoices.slice(i, i + 50);
      await supabase.from('invoices').insert(batch);
    }
  }
  
  if (defaultData.debts.length > 0) {
    await supabase.from('debts').insert(defaultData.debts);
  }
  
  await supabase.from('pricing').upsert({ id: 'default', config: defaultData.pricing }, { onConflict: 'id' });
  await supabase.from('settings').upsert({ id: 'default', config: defaultData.settings }, { onConflict: 'id' });
  
  console.log('✅ Database seeded!');
}
