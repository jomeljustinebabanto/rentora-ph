const STORAGE_KEY = 'rentora_verified_data_v5';
const AUTH_SESSION_KEY = 'rentora_auth_session';
let speechTimer = null;
let activeFilter = 'all';
let usePhpBackend = false;

let appData = {
  config: { mainBill: 7850.00, mainKwh: 550.00, waterFee: 150.00, ratePerKwh: 14.27 },
  users: {},
  tenants: [],
  invoices: []
};

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  renderAll();
}

function loadDefaultSampleData() {
  appData = {
    config: { mainBill: 7850.00, mainKwh: 550.00, waterFee: 150.00, ratePerKwh: 14.27 },
    users: {},
    tenants: [
      { id: '1', room: 'Room 101', name: 'Marco Ramos', phone: '0917-555-0101', rent: 2600.00, currentMeter: 1240.00 },
      { id: '2', room: 'Room 102', name: 'Chloe Anne Santos', phone: '0918-555-0102', rent: 2800.00, currentMeter: 890.00 }
    ],
    invoices: [
      {
        id: 'INV-2026-001', tenantId: '1', room: 'Room 101', tenantName: 'Marco Ramos',
        period: '2026-08', prevReading: 1180.00, currReading: 1240.00, kwhUsed: 60.00,
        ratePerKwh: 14.27, powerAmount: 856.20, waterAmount: 150.00, rentAmount: 2600.00,
        totalAmount: 3606.20, amountPaid: 3606.20, status: 'Paid', paidAt: '2026-09-02',
        payMethod: 'GCash (Ref # 88201)', createdAt: '2026-09-01'
      },
      {
        id: 'INV-2026-002', tenantId: '2', room: 'Room 102', tenantName: 'Chloe Anne Santos',
        period: '2026-09', prevReading: 820.00, currReading: 890.00, kwhUsed: 70.00,
        ratePerKwh: 14.27, powerAmount: 998.90, waterAmount: 150.00, rentAmount: 2800.00,
        totalAmount: 3948.90, amountPaid: 0.00, status: 'Unpaid', paidAt: null,
        payMethod: null, createdAt: '2026-09-25'
      }
    ]
  };
  saveState();
}

function togglePasswordVisibility(inputId, iconId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

function toggleRatePanel() {
  document.getElementById('ratePanel').classList.toggle('hidden');
}

function updateRateDisplay() {
  document.getElementById('cfgMainBill').value = round2(appData.config.mainBill).toFixed(2);
  document.getElementById('cfgMainKwh').value = round2(appData.config.mainKwh).toFixed(2);
  document.getElementById('cfgWaterFee').value = round2(appData.config.waterFee).toFixed(2);
  document.getElementById('statPowerRate').innerText = `₱${getRate().toFixed(4)} / kWh`;
}

function switchTab(tab) {
  const tenantsView = document.getElementById('viewTenants');
  const billingView = document.getElementById('viewBilling');
  const tBtn = document.getElementById('tabBtnTenants');
  const bBtn = document.getElementById('tabBtnBilling');

  if (tab === 'tenants') {
    tenantsView.classList.remove('hidden');
    billingView.classList.add('hidden');
    tBtn.className = 'guide-hover pb-2.5 border-b-2 border-emerald-600 text-emerald-700 font-semibold cursor-pointer';
    bBtn.className = 'guide-hover pb-2.5 border-b-2 border-transparent text-slate-500 hover:text-slate-800 font-semibold cursor-pointer';
  } else {
    billingView.classList.remove('hidden');
    tenantsView.classList.add('hidden');
    bBtn.className = 'guide-hover pb-2.5 border-b-2 border-emerald-600 text-emerald-700 font-semibold cursor-pointer';
    tBtn.className = 'guide-hover pb-2.5 border-b-2 border-transparent text-slate-500 hover:text-slate-800 font-semibold cursor-pointer';
  }
  applyVisibility();
}

function renderTenants() {
  const grid = document.getElementById('tenantsGrid');
  const search = (document.getElementById('tenantSearch').value || '').toLowerCase();
  grid.innerHTML = '';
  if (!isLandlord()) return;

  const filtered = appData.tenants.filter(t =>
    t.room.toLowerCase().includes(search) || t.name.toLowerCase().includes(search)
  );

  filtered.forEach(t => {
    const key = t.room.toLowerCase(), hasLogin = Object.values(appData.users).some(u => u.role === 'tenant' && u.room === key);
    const iv = appData.invites && appData.invites[key], pending = !hasLogin && iv && iv.exp > Date.now();
    const card = document.createElement('div');
    card.className = 'bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between';
    card.innerHTML = `
      <div>
        <div class="flex justify-between items-start">
          <span class="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">${esc(t.room)} / MONTHLY</span>
          <button type="button" onclick="deleteTenant('${sid(t.id)}')" class="text-xs text-rose-500 hover:text-rose-700 font-medium cursor-pointer">Remove</button>
        </div>
        <h3 class="font-bold text-slate-800 text-base mt-2">${esc(t.name)}</h3>
        <p class="text-xs text-slate-500">${esc(t.phone)}</p>
        <div class="mt-2 flex items-center justify-between gap-2 text-[11px]"><span class="${hasLogin ? 'text-emerald-700' : 'text-slate-400'}">${hasLogin ? 'Login: active' : pending ? 'Invite code pending' : 'No login yet'}</span><button type="button" onclick="makeInvite('${sid(t.id)}')" data-tip="${hasLogin ? 'Remove this tenant login and make a new invite code.' : 'Make a one-time code so this tenant can create an account.'}" class="guide-hover font-semibold text-slate-700 hover:text-slate-900 underline cursor-pointer">${hasLogin ? 'Reset login' : pending ? 'New invite code' : 'Invite code'}</button></div>
        <div class="mt-4 pt-3 border-t border-slate-100 space-y-1 text-xs">
          <div class="flex justify-between text-slate-600"><span>Base Rent:</span><span class="font-semibold text-slate-800">₱${round2(t.rent).toFixed(2)}</span></div>
          <div class="flex justify-between text-slate-600"><span>Water Share:</span><span class="font-semibold text-slate-800">₱${round2(appData.config.waterFee).toFixed(2)}</span></div>
          <div class="flex justify-between text-slate-600"><span>Last Meter Reading:</span><span class="font-semibold text-slate-800">${round2(t.currentMeter).toFixed(2)} kWh</span></div>
        </div>
      </div>
      <button type="button" onclick="prepareBillForTenant('${sid(t.id)}')" data-tip="Generate monthly bill for ${esc(t.name)}." class="guide-hover mt-4 w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium text-xs py-2.5 rounded-xl transition border border-emerald-200 cursor-pointer">
        Generate Room Bill
      </button>
    `;
    grid.appendChild(card);
  });
}

function prepareBillForTenant(tenantId) {
  switchTab('billing');
  openCreateInvoiceModal();
  document.getElementById('invTenantSelect').value = tenantId;
  onTenantSelectedForBill();
}

function openCreateInvoiceModal() {
  const select = document.getElementById('invTenantSelect');
  select.innerHTML = '<option value="">Select Tenant</option>';
  appData.tenants.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.innerText = `${t.room} - ${t.name}`;
    select.appendChild(opt);
  });
  document.getElementById('invPeriod').value = localDate().substring(0, 7);
  document.getElementById('invPrevReading').value = '';
  document.getElementById('invCurrReading').value = '';
  document.getElementById('meterValidationAlert').classList.add('hidden');
  calculateLivePreview();
  openModal('createInvoiceModal');
}

function onTenantSelectedForBill() {
  const tenantId = document.getElementById('invTenantSelect').value;
  const tenant = appData.tenants.find(t => String(t.id) === String(tenantId));
  document.getElementById('invPrevReading').value = tenant ? round2(tenant.currentMeter).toFixed(2) : '';
  calculateLivePreview();
}

function calculateLivePreview() {
  const tenantId = document.getElementById('invTenantSelect').value;
  const tenant = appData.tenants.find(t => String(t.id) === String(tenantId));
  const prev = round2(document.getElementById('invPrevReading').value);
  const currStr = document.getElementById('invCurrReading').value.trim();
  const currParsed = parseFloat(currStr);
  const alertBox = document.getElementById('meterValidationAlert');

  let kwhUsed = 0;
  if (currStr !== '' && !isNaN(currParsed)) {
    if (round2(currParsed) < prev) {
      alertBox.classList.remove('hidden');
    } else {
      alertBox.classList.add('hidden');
      kwhUsed = round2(round2(currParsed) - prev);
    }
  } else {
    alertBox.classList.add('hidden');
  }

  const rate = getRate();
  const powerCost = round2(kwhUsed * rate);
  const waterCost = round2(appData.config.waterFee);
  const rentCost = tenant ? round2(tenant.rent) : 0;
  const grandTotal = round2(powerCost + waterCost + rentCost);

  document.getElementById('prevKwhUsed').innerText = kwhUsed.toFixed(2);
  document.getElementById('prevRate').innerText = rate.toFixed(4);
  document.getElementById('prevPowerCost').innerText = powerCost.toFixed(2);
  document.getElementById('prevWaterCost').innerText = waterCost.toFixed(2);
  document.getElementById('prevRentCost').innerText = rentCost.toFixed(2);
  document.getElementById('prevGrandTotal').innerText = grandTotal.toFixed(2);
}

function filterInvoices(filter) {
  activeFilter = filter;
  renderInvoices();
}

function promptPayment(invoiceId) {
  if (!needLandlord()) return;
  const inv = appData.invoices.find(i => i.id === invoiceId);
  if (!inv) return;
  const remaining = round2(inv.totalAmount - (inv.amountPaid || 0));
  document.getElementById('payInvoiceId').value = inv.id;
  document.getElementById('payInvoiceDisplay').innerText = `${inv.id} (${inv.room})`;
  document.getElementById('payAmountDisplay').innerText = `₱${remaining.toFixed(2)}`;
  { const p = document.getElementById('payAmountInput'); p.max = remaining.toFixed(2); p.value = remaining.toFixed(2); }
  document.getElementById('payRef').value = '';
  openModal('paymentModal');
}

function openSmsReminder(invoiceId) {
  if (!needLandlord()) return;
  const inv = appData.invoices.find(i => i.id === invoiceId);
  if (!inv) return;
  const remaining = round2(inv.totalAmount - (inv.amountPaid || 0));
  document.getElementById('smsRecipient').innerText = inv.tenantName;
  document.getElementById('smsMessageBox').value =
    `Hello ${inv.tenantName}! Rentora bill for ${inv.room} (${inv.period}):\n` +
    `- Electricity (${round2(inv.kwhUsed).toFixed(2)} kWh): ₱${round2(inv.powerAmount).toFixed(2)}\n` +
    `- Water: ₱${round2(inv.waterAmount).toFixed(2)}\n` +
    `- Rent: ₱${round2(inv.rentAmount).toFixed(2)}\n` +
    `BALANCE DUE: ₱${remaining.toFixed(2)}. Thank you! - Ate Elena`;
  openModal('smsModal');
}

function openModal(id) {
  hideGuideSpeech();
  const el = document.getElementById(id);
  if (el) { el.classList.remove('hidden'); el.classList.add('flex'); }
}

function closeModal(id) {
  hideGuideSpeech();
  const el = document.getElementById(id);
  if (el) { el.classList.remove('flex'); el.classList.add('hidden'); }
}

function handleBackdropClick(e, id) {
  if (e.target.id === id) closeModal(id);
}

function showGuideSpeech(text, autoHideMs = 0) {
  if (speechTimer) clearTimeout(speechTimer);
  const bubble = document.getElementById('guideSpeechBubble');
  const speech = document.getElementById('guideSpeechText');
  if (speech && text) speech.innerText = text;
  if (bubble) {
    bubble.classList.remove('opacity-0', 'translate-y-2', 'invisible');
    bubble.classList.add('opacity-100', 'translate-y-0', 'visible');
  }
  if (autoHideMs > 0) speechTimer = setTimeout(hideGuideSpeech, autoHideMs);
}

function hideGuideSpeech() {
  if (speechTimer) clearTimeout(speechTimer);
  const bubble = document.getElementById('guideSpeechBubble');
  if (bubble) {
    bubble.classList.remove('opacity-100', 'translate-y-0', 'visible');
    bubble.classList.add('opacity-0', 'translate-y-2', 'invisible');
  }
}

function setupMemojiTracker() {
  const headWrapper = document.getElementById('memojiHeadWrapper');
  window.addEventListener('mousemove', (e) => {
    if (!headWrapper) return;
    const rect = headWrapper.getBoundingClientRect();
    const tiltY = Math.max(-18, Math.min(18, (e.clientX - (rect.left + rect.width / 2)) / 45));
    const tiltX = Math.max(-14, Math.min(14, -(e.clientY - (rect.top + rect.height / 2)) / 55));
    headWrapper.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
  });

  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('.guide-hover');
    if (target && target.getAttribute('data-tip')) showGuideSpeech(target.getAttribute('data-tip'));
  });
  document.addEventListener('mouseout', (e) => {
    const target = e.target.closest('.guide-hover');
    if (target && !target.contains(e.relatedTarget)) hideGuideSpeech();
  });
}

function triggerMemojiWink() {
  showGuideSpeech('Accurate records without math errors!', 2500);
}

/* ===== Rentora v6: fixes ===== */
const SESSION_DAYS = 7;
let noticeTimer = null;

function round2(v) { const n = Number(v); return isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0; }
function round4(v) { const n = Number(v); return isFinite(n) ? Math.round((n + Number.EPSILON) * 1e4) / 1e4 : 0; }
function getRate() { const c = appData.config; return c.mainKwh > 0 ? round4(c.mainBill / c.mainKwh) : round4(c.ratePerKwh); }
function paidOf(i) { return round2(i.amountPaid != null ? i.amountPaid : (i.status === 'Paid' ? i.totalAmount : 0)); }
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function sid(v) { return String(v).replace(/[^\w.-]/g, ''); }
function localDate() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

function notify(msg, isError) {
  const el = document.getElementById('appNotice');
  el.textContent = msg;
  el.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[60] max-w-sm px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg ' + (isError ? 'bg-rose-600 text-white' : 'bg-emerald-700 text-white');
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => el.classList.add('hidden'), isError ? 6000 : 3000);
  return false;
}

/* ---- Saving: change data only after the server says OK ---- */
async function callServer(action, payload) {
  try {
    const fd = new FormData();
    fd.append('action', action);
    Object.entries(payload).forEach(([k, v]) => fd.append(k, v));
    const d = await (await fetch('api/rentora.php', { method: 'POST', body: fd })).json();
    if (!d.success) return notify(d.message || 'The server did not accept this change.', true);
    return true;
  } catch (err) { return notify('Could not reach the server. Nothing was saved.', true); }
}
async function reloadFromServer() {
  const d = await (await fetch('api/rentora.php?action=load')).json();
  if (d.success) { appData.config = d.config; appData.tenants = d.tenants; appData.invoices = d.invoices; }
}
async function commit(action, payload, apply) {
  if (usePhpBackend) {
    if (!await callServer(action, payload)) return false;
    try { await reloadFromServer(); } catch (err) { notify('Saved, but refresh failed. Please reload the page.', true); }
  } else apply();
  saveState();
  return true;
}

async function init() {
  try {
    const res = await fetch('api/rentora.php?action=load');
    const data = res.ok ? await res.json() : null;
    if (data && data.success) { usePhpBackend = true; Object.assign(appData, { config: data.config, tenants: data.tenants, invoices: data.invoices }); }
  } catch (err) { usePhpBackend = false; }
  let local = null;
  try { local = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) {}
  if (usePhpBackend) { appData.users = (local && local.users) || {}; appData.landlordCode = local && local.landlordCode; appData.invites = (local && local.invites) || {}; }
  else if (local && local.config && Array.isArray(local.tenants) && Array.isArray(local.invoices)) appData = local;
  else loadDefaultSampleData();
  appData.users = appData.users || {};
  Object.keys(appData.users).forEach(k => { if (typeof appData.users[k] !== 'object') delete appData.users[k]; }); // old plain-text accounts
  document.getElementById('dbModeBadge').innerText = usePhpBackend ? 'PHP + MySQL Active' : 'Browser Storage Only';
  try { await seedTestAccounts(); } catch (e) { console.warn('Test accounts not created:', e.message); }
  const note = document.getElementById('testModeNote'); if (note) note.classList.toggle('hidden', !TEST_MODE);
  checkLoginSession(); updateRateDisplay(); renderAll(); setupMemojiTracker(); setupFocusTips();
}

/* ---- Passwords (PBKDF2 in the browser) and roles ---- */
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
async function hashPw(pw, saltHex) {
  if (!window.crypto || !crypto.subtle) throw new Error('Open this site with HTTPS (or localhost) so passwords can be protected.');
  const salt = saltHex ? unhex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' }, key, 256);
  return { salt: hex(salt), hash: hex(bits) };
}
async function makeUser(pw, role, room) { return { ...await hashPw(pw), role, room: (room || '').toLowerCase() }; }
async function checkPw(u, pw) { return !!u && (await hashPw(pw, u.salt)).hash === u.hash; }

function getSession() {
  for (const st of [sessionStorage, localStorage]) {
    try {
      const s = JSON.parse(st.getItem(AUTH_SESSION_KEY) || 'null');
      if (s && s.exp > Date.now() && appData.users[s.user]) return s;
    } catch (e) {}
  }
  return null;
}
function currentUser() { const s = getSession(); return s ? { name: s.user, ...appData.users[s.user] } : null; }
function isLandlord() { const u = currentUser(); return !!u && u.role === 'landlord'; }
function needLandlord() { if (isLandlord()) return true; notify('Only the landlord can do this.', true); return false; }

function startSession(user) {
  const keep = document.getElementById('rememberMe').checked;
  localStorage.removeItem(AUTH_SESSION_KEY); sessionStorage.removeItem(AUTH_SESSION_KEY);
  (keep ? localStorage : sessionStorage).setItem(AUTH_SESSION_KEY, JSON.stringify({ user, exp: Date.now() + (keep ? SESSION_DAYS * 864e5 : 288e5) }));
  checkLoginSession();
}
function checkLoginSession() {
  const s = getSession();
  document.getElementById('loginScreen').classList.toggle('hidden', !!s);
  document.getElementById('mainDashboardView').classList.toggle('hidden', !s);
  if (s) applyRole();
}
async function handleLoginSubmit(e) {
  e.preventDefault();
  const user = document.getElementById('loginUsername').value.trim().toLowerCase();
  const pass = document.getElementById('loginPassword').value;
  const box = document.getElementById('loginErrorAlert');
  const fail = m => { box.textContent = m; box.classList.remove('hidden'); };
  box.classList.add('hidden');
  try {
    if (Object.keys(appData.users).length === 0) return fail('There are no accounts yet. Press "Create account" first.');
    if (!await checkPw(appData.users[user], pass)) return fail('Wrong username or password.');
    startSession(user);
    await ensureLandlordCode(user);
  } catch (err) { fail(err.message); }
}
function handleLogout() {
  if (!confirm('Are you sure you want to sign out?')) return;
  localStorage.removeItem(AUTH_SESSION_KEY); sessionStorage.removeItem(AUTH_SESSION_KEY);
  document.getElementById('loginPassword').value = '';
  checkLoginSession();
}
function applyVisibility() { const t = !isLandlord(); document.querySelectorAll('[data-landlord]').forEach(el => el.classList.toggle('hidden', t)); }
function applyRole() {
  const u = currentUser();
  document.getElementById('currentUserBadge').textContent = (u.role === 'tenant' ? 'Tenant: ' : 'Landlord: ') + u.name;
  switchTab(u.role === 'tenant' ? 'billing' : 'tenants');
  renderAll();
}
async function handleResetPasswordSubmit(e) { // now "Change password": needs the current password
  e.preventDefault();
  const u = currentUser(), box = document.getElementById('resetErrorAlert');
  const old = document.getElementById('resetUsername').value, nw = document.getElementById('resetNewPassword').value;
  const fail = m => { box.textContent = m; box.classList.remove('hidden'); };
  if (!u) return fail('Please sign in first.');
  if (nw.length < 8) return fail('Use 8 or more characters.');
  try {
    if (!await checkPw(u, old)) return fail('Current password is wrong.');
    appData.users[u.name] = await makeUser(nw, u.role, u.room);
    saveState(); box.classList.add('hidden');
    document.getElementById('resetPasswordForm').reset(); closeModal('resetPasswordModal'); notify('Password changed.');
  } catch (err) { fail(err.message); }
}

/* ---- Rates, tenants ---- */
async function saveUtilityRates() {
  if (!needLandlord()) return;
  const v = id => parseFloat(document.getElementById(id).value);
  const bill = v('cfgMainBill'), kwh = v('cfgMainKwh'), water = v('cfgWaterFee');
  if (!(bill >= 0) || !(kwh > 0) || !(water >= 0)) return notify('Enter valid numbers. Total kWh must be more than zero.', true);
  const rate = round4(bill / kwh);
  const cfg = { mainBill: round2(bill), mainKwh: round2(kwh), waterFee: round2(water), ratePerKwh: rate };
  const ok = await commit('update_rates', { main_bill: cfg.mainBill, main_kwh: cfg.mainKwh, water_fee: cfg.waterFee, rate_per_kwh: rate }, () => { appData.config = cfg; });
  if (ok) { updateRateDisplay(); notify(`Rate updated to ₱${rate.toFixed(4)} per kWh.`); }
}
async function handleSaveTenant(e) {
  e.preventDefault();
  if (!needLandlord()) return;
  const g = id => document.getElementById(id).value.trim();
  const room = g('tRoom'), name = g('tName'), phone = g('tPhone'), user = g('tUser').toLowerCase(), pass = document.getElementById('tPass').value;
  const rent = round2(g('tRent')), meter = round2(g('tMeter')), id = 't_' + Date.now();
  if (appData.tenants.some(t => t.room.toLowerCase() === room.toLowerCase())) return notify(`${room} already has a tenant.`, true);
  if (user && appData.users[user]) return notify('That username is taken.', true);
  if (user && pass.length < 8) return notify('Temporary password needs 8 or more characters.', true);
  try {
    const login = user ? await makeUser(pass, 'tenant', room) : null;
    const ok = await commit('add_room', { room_no: room, tenant_name: name, phone, base_rent: rent, current_meter: meter },
      () => appData.tenants.push({ id, room, name, phone, rent, currentMeter: meter }));
    if (!ok) return;
    if (login) { appData.users[user] = login; saveState(); }
    closeModal('addTenantModal'); document.getElementById('tenantForm').reset(); notify(`Added ${name} to ${room}.`);
  } catch (err) { notify(err.message, true); }
}
async function deleteTenant(id) {
  if (!needLandlord()) return;
  const t = appData.tenants.find(x => String(x.id) === String(id));
  if (!t || !confirm(`Remove ${t.name} (${t.room})? Old bills stay in the list.`)) return;
  const ok = await commit('delete_room', { room_id: id }, () => { appData.tenants = appData.tenants.filter(x => String(x.id) !== String(id)); });
  if (ok) { Object.keys(appData.users).forEach(k => { if (appData.users[k].room === t.room.toLowerCase()) delete appData.users[k]; }); if (appData.invites) delete appData.invites[t.room.toLowerCase()]; saveState(); }
}

/* ---- Bills and payments ---- */
async function handleCreateInvoice(e) {
  e.preventDefault();
  if (!needLandlord()) return;
  const tenant = appData.tenants.find(t => String(t.id) === String(document.getElementById('invTenantSelect').value));
  if (!tenant) return;
  const period = document.getElementById('invPeriod').value;
  const prev = round2(document.getElementById('invPrevReading').value), curr = round2(document.getElementById('invCurrReading').value);
  if (curr < prev) return notify('Current reading cannot be lower than the previous reading.', true);
  if (curr - prev > appData.config.mainKwh) return notify('This room used more kWh than the whole main bill. Please check the reading.', true);
  if (appData.invoices.some(i => String(i.tenantId) === String(tenant.id) && i.period === period && i.status !== 'Void'))
    return notify(`${tenant.room} already has a bill for ${period}. Void it first to make a new one.`, true);
  const kwhUsed = round2(curr - prev), rate = getRate();
  const powerCost = round2(kwhUsed * rate), waterCost = round2(appData.config.waterFee), rentCost = round2(tenant.rent);
  const total = round2(powerCost + waterCost + rentCost), id = 'INV-' + Date.now().toString(36).toUpperCase(), createdAt = localDate();
  const ok = await commit('create_bill', { invoice_code: id, room_id: tenant.id, room_no: tenant.room, tenant_name: tenant.name, billing_period: period,
    prev_reading: prev, curr_reading: curr, kwh_used: kwhUsed, rate_per_kwh: rate, electricity: powerCost, water: waterCost, base_rent: rentCost, total, created_at: createdAt }, () => {
    appData.invoices.unshift({ id, tenantId: tenant.id, room: tenant.room, tenantName: tenant.name, period, prevReading: prev, currReading: curr, kwhUsed, ratePerKwh: rate,
      powerAmount: powerCost, waterAmount: waterCost, rentAmount: rentCost, totalAmount: total, amountPaid: 0, status: 'Unpaid', paidAt: null, payMethod: null, createdAt });
    tenant.currentMeter = curr;
  });
  if (ok) { closeModal('createInvoiceModal'); notify(`Created bill for ${tenant.room}. Total: ₱${total.toFixed(2)}.`); }
}
async function handleRecordPayment(e) {
  e.preventDefault();
  if (!needLandlord()) return;
  const inv = appData.invoices.find(i => i.id === document.getElementById('payInvoiceId').value);
  if (!inv || inv.status === 'Void') return;
  const paidNow = round2(document.getElementById('payAmountInput').value), remaining = round2(inv.totalAmount - paidOf(inv));
  if (!(paidNow > 0) || paidNow > remaining) return notify(`Enter an amount from 0.01 up to ₱${remaining.toFixed(2)}.`, true);
  const method = document.getElementById('payChannel').value, ref = document.getElementById('payRef').value.trim() || 'No reference';
  if (ref !== 'No reference' && appData.invoices.some(i => i.payMethod && i.payMethod.includes(`${method} (${ref})`)) && !confirm('This reference was already used. Save anyway?')) return;
  const paidTotal = round2(paidOf(inv) + paidNow), paidAt = localDate(), status = paidTotal >= inv.totalAmount ? 'Paid' : 'Partial';
  const entry = `${method} (${ref}): ₱${paidNow.toFixed(2)}, ${paidAt}`, payMethod = inv.payMethod ? `${inv.payMethod}; ${entry}` : entry;
  const ok = await commit('record_payment', { invoice_code: inv.id, amount_paid: paidTotal, status, pay_method: payMethod, paid_at: paidAt },
    () => Object.assign(inv, { amountPaid: paidTotal, status, payMethod, paidAt }));
  if (ok) { closeModal('paymentModal'); notify(`Recorded ₱${paidNow.toFixed(2)} for ${inv.room}.`); }
}
async function voidInvoice(id) { // server needs a "void_bill" action (see notes)
  if (!needLandlord()) return;
  const inv = appData.invoices.find(i => i.id === id);
  if (!inv || inv.status === 'Void') return;
  const reason = (prompt(`Why void ${inv.id}? (required)`) || '').trim();
  if (!reason) return;
  const ok = await commit('void_bill', { invoice_code: inv.id, reason }, () => {
    Object.assign(inv, { status: 'Void', voidReason: reason, voidedAt: localDate() });
    const t = appData.tenants.find(x => String(x.id) === String(inv.tenantId));
    if (t && round2(t.currentMeter) === round2(inv.currReading)) t.currentMeter = inv.prevReading;
  });
  if (ok) notify(`${inv.id} voided.`);
}
async function copySmsText() {
  const box = document.getElementById('smsMessageBox');
  try { await navigator.clipboard.writeText(box.value); closeModal('smsModal'); notify('SMS text copied.'); }
  catch (err) { box.select(); notify('Could not copy. The text is selected, press Ctrl+C.', true); }
}

/* ---- Screens ---- */
function visibleInvoices() {
  const u = currentUser();
  if (!u) return [];
  return u.role === 'landlord' ? appData.invoices : appData.invoices.filter(i => String(i.room).toLowerCase() === u.room);
}
function showReceipt(id) {
  const inv = visibleInvoices().find(i => i.id === id);
  if (!inv) return;
  const paid = paidOf(inv), bal = inv.status === 'Void' ? 0 : round2(inv.totalAmount - paid), m = n => `₱${round2(n).toFixed(2)}`;
  const row = (a, b, c = '') => `<div class="flex justify-between py-1 ${c}"><span>${a}</span><span>${b}</span></div>`;
  document.getElementById('receiptContent').innerHTML =
    row('Invoice:', `<b class="font-mono">${esc(inv.id)}</b>`, 'border-b border-dashed') +
    row('Room &amp; Tenant:', `<b>${esc(inv.room)} (${esc(inv.tenantName)})</b>`, 'border-b border-dashed') +
    row('Period:', esc(inv.period), 'border-b border-dashed') +
    '<div class="pt-2 space-y-1 bg-slate-50 p-2.5 rounded-xl border mt-2">' +
    row('Meter Range:', `${round2(inv.prevReading).toFixed(2)} to ${round2(inv.currReading).toFixed(2)} kWh`) +
    row(`Electricity (${round2(inv.kwhUsed).toFixed(2)} kWh @ ₱${Number(inv.ratePerKwh).toFixed(4)}):`, m(inv.powerAmount)) +
    row('Water Fee:', m(inv.waterAmount)) + row('Base Rent:', m(inv.rentAmount)) + '</div>' +
    row('TOTAL BILL:', `<b>${m(inv.totalAmount)}</b>`, 'pt-2 text-sm') + row('Amount Paid:', m(paid)) +
    (inv.paidAt ? row('Last Payment Date:', esc(inv.paidAt)) : '') +
    (inv.payMethod ? `<div class="py-1 text-slate-600">Payments: ${esc(inv.payMethod)}</div>` : '') +
    row('Remaining Balance:', `<b>₱${bal.toFixed(2)}</b>`) +
    (inv.status === 'Void' ? `<p class="text-rose-600 font-bold">VOID: ${esc(inv.voidReason || '')}</p>` : '') +
    `<p class="pt-2 text-[10px] text-slate-400">Printed ${localDate()}</p>`;
  openModal('receiptModal');
}
function renderInvoices() {
  const tbody = document.getElementById('invoicesTableBody'), land = isLandlord();
  tbody.innerHTML = '';
  let list = visibleInvoices();
  if (activeFilter === 'paid') list = list.filter(i => i.status === 'Paid');
  if (activeFilter === 'unpaid') list = list.filter(i => i.status !== 'Paid' && i.status !== 'Void');
  list.forEach(inv => {
    const bal = inv.status === 'Void' ? 0 : round2(inv.totalAmount - paidOf(inv));
    const color = { Paid: 'bg-emerald-100 text-emerald-700', Void: 'bg-slate-200 text-slate-600' }[inv.status] || 'bg-amber-100 text-amber-700';
    const open = inv.status === 'Unpaid' || inv.status === 'Partial';
    const btn = (fn, tip, cls, label) => `<button type="button" onclick="${fn}('${sid(inv.id)}')" data-tip="${tip}" class="guide-hover cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg ${cls}">${label}</button>`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="p-3.5 font-mono text-xs font-semibold">${esc(inv.id)}</td>
      <td class="p-3.5 font-medium">${esc(inv.room)} <span class="text-xs text-slate-400">(${esc(inv.tenantName)})</span></td>
      <td class="p-3.5">${esc(inv.period)}</td>
      <td class="p-3.5">${round2(inv.kwhUsed).toFixed(2)} kWh</td>
      <td class="p-3.5"><span class="font-bold">₱${round2(inv.totalAmount).toFixed(2)}</span><span class="block text-xs text-slate-500">Balance ₱${bal.toFixed(2)}</span></td>
      <td class="p-3.5"><span class="text-xs px-2.5 py-0.5 rounded-full font-semibold ${color}">${esc(inv.status)}</span></td>
      <td class="p-3.5 text-right whitespace-nowrap"><div class="inline-flex items-center justify-end gap-1.5">
        ${btn('showReceipt', 'View and print this statement.', 'bg-white hover:bg-emerald-50 text-slate-700 border border-slate-300', 'Receipt')}
        ${land && open ? btn('openSmsReminder', 'Make an SMS reminder text.', 'bg-amber-100 text-amber-800 border border-amber-300', 'SMS') + btn('promptPayment', 'Record a payment.', 'bg-emerald-600 text-white', 'Pay') : ''}
        ${land && inv.status !== 'Void' ? btn('voidInvoice', 'Cancel this bill. It stays in history.', 'bg-white text-rose-600 border border-rose-200', 'Void') : ''}
      </div></td>`;
    tbody.appendChild(tr);
  });
}
function renderAll() {
  let paid = 0, total = 0;
  appData.invoices.filter(i => i.status !== 'Void').forEach(i => { paid = round2(paid + paidOf(i)); total = round2(total + round2(i.totalAmount)); });
  document.getElementById('statTotalRooms').innerText = appData.tenants.length;
  document.getElementById('countTenantsBadge').innerText = appData.tenants.length;
  document.getElementById('countInvoicesBadge').innerText = visibleInvoices().length;
  document.getElementById('statUnpaidTotal').innerText = `₱${round2(total - paid).toFixed(2)}`;
  document.getElementById('statPaidTotal').innerText = `₱${paid.toFixed(2)}`;
  renderTenants(); renderInvoices();
}

/* ---- Backup, keyboard and focus help ---- */
function downloadBackup() { // passwords are not included
  if (!needLandlord()) return;
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), config: appData.config, tenants: appData.tenants, invoices: appData.invoices }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `rentora-backup-${localDate()}.json`; a.click(); URL.revokeObjectURL(a.href);
}
function setupFocusTips() {
  document.addEventListener('focusin', e => { const t = e.target.closest('.guide-hover'); if (t && t.dataset.tip) showGuideSpeech(t.dataset.tip); });
  document.addEventListener('focusout', hideGuideSpeech);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('[id$="Modal"].flex').forEach(m => closeModal(m.id)); });
}

/* ---- Create account (tenant or landlord) ---- */
function hasLandlord() { return Object.values(appData.users).some(u => u.role === 'landlord'); }
async function ensureLandlordCode(user) { // older landlord accounts get an access code once
  if (appData.landlordCode || appData.users[user].role !== 'landlord') return;
  const c = prompt('Set a landlord access code (6 or more characters). You need it to add other landlord accounts.');
  if (c && c.length >= 6) { appData.landlordCode = await hashPw(c); saveState(); notify('Landlord access code saved.'); }
}
function openSignUp() {
  document.getElementById('signUpForm').reset();
  document.getElementById('signUpErrorAlert').classList.add('hidden');
  document.getElementById('regRole').value = hasLandlord() ? 'tenant' : 'landlord';
  updateSignUpFields();
  openModal('signUpModal');
}
function updateSignUpFields() {
  const land = document.getElementById('regRole').value === 'landlord';
  document.getElementById('regTenantFields').classList.toggle('hidden', land);
  document.getElementById('regLandlordFields').classList.toggle('hidden', !land);
  document.getElementById('regRoom').required = !land;
  document.getElementById('regInvite').required = !land;
  document.getElementById('regCode').required = land;
  document.getElementById('regCodeHint').textContent = hasLandlord()
    ? 'Enter the landlord access code. Ask the current landlord for it.'
    : 'You are the first landlord. Make an access code (6+ characters). You need it to add other landlord accounts. Keep it safe.';
}
async function handleSignUpSubmit(e) {
  e.preventDefault();
  const g = id => document.getElementById(id).value.trim();
  const role = g('regRole'), user = g('regUsername').toLowerCase(), pass = document.getElementById('regPassword').value;
  const box = document.getElementById('signUpErrorAlert');
  const fail = m => { box.textContent = m; box.classList.remove('hidden'); };
  box.classList.add('hidden');
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(user)) return fail('Username: 3 to 30 letters, numbers, dot, dash or underscore.');
  if (pass.length < 8) return fail('Use a password of 8 or more characters.');
  if (pass !== document.getElementById('regPassword2').value) return fail('The two passwords do not match.');
  if (appData.users[user]) return fail('That username is taken.');
  try {
    if (role === 'landlord') {
      const code = document.getElementById('regCode').value;
      if (!hasLandlord()) {
        if (code.length < 6) return fail('Make a landlord access code of 6 or more characters.');
        appData.landlordCode = await hashPw(code);
      } else if (!appData.landlordCode) return fail('A landlord account already exists. The landlord must sign in once to set the access code.');
      else if (!await checkPw(appData.landlordCode, code)) return fail('Wrong landlord access code.');
      appData.users[user] = await makeUser(pass, 'landlord');
    } else {
      const room = g('regRoom').toLowerCase(), code = normCode(g('regInvite'));
      const t = appData.tenants.find(x => x.room.toLowerCase() === room), iv = appData.invites && appData.invites[room];
      const bad = 'Room or invite code is not valid. Ask your landlord for a new invite code.';
      if (!t || !iv) return fail(bad);
      if (iv.exp < Date.now()) { delete appData.invites[room]; saveState(); return fail('This invite code has expired. Ask your landlord for a new one.'); }
      if (!await checkPw(iv, code)) {
        iv.tries = (iv.tries || 0) + 1;
        if (iv.tries >= 5) { delete appData.invites[room]; saveState(); return fail('Too many wrong tries. Ask your landlord for a new invite code.'); }
        saveState(); return fail(bad);
      }
      if (Object.values(appData.users).some(u => u.role === 'tenant' && u.room === room)) return fail('This room already has an account. Ask your landlord for help.');
      appData.users[user] = await makeUser(pass, 'tenant', t.room);
      delete appData.invites[room];
    }
    saveState(); closeModal('signUpModal');
    document.getElementById('loginUsername').value = user; document.getElementById('loginPassword').value = '';
    notify('Account created. You can sign in now.');
  } catch (err) { fail(err.message); }
}

/* ---- Change landlord access code ---- */
function openCodeModal() {
  if (!needLandlord()) return;
  document.getElementById('codeForm').reset();
  document.getElementById('codeErrorAlert').classList.add('hidden');
  openModal('codeModal');
}
async function handleChangeCode(e) {
  e.preventDefault();
  const u = currentUser(), box = document.getElementById('codeErrorAlert');
  const fail = m => { box.textContent = m; box.classList.remove('hidden'); };
  box.classList.add('hidden');
  if (!u || u.role !== 'landlord') return fail('Only the landlord can change the access code.');
  const pw = document.getElementById('codePassword').value, code = document.getElementById('codeNew').value;
  if (code.length < 6) return fail('Use an access code of 6 or more characters.');
  if (code !== document.getElementById('codeNew2').value) return fail('The two codes do not match.');
  if (code === pw) return fail('Use a code that is different from your password.');
  try {
    if (!await checkPw(u, pw)) return fail('Your account password is wrong.');
    appData.landlordCode = await hashPw(code);
    saveState();
    document.getElementById('codeForm').reset(); closeModal('codeModal'); notify('Access code changed.');
  } catch (err) { fail(err.message); }
}

/* ---- Tenant invite codes (one use, 7 days, 5 tries) ---- */
const INVITE_DAYS = 7;
const normCode = v => String(v).toUpperCase().replace(/[^A-Z0-9]/g, '');
function randomCode() { // no I, L, O, 0, 1; no bias (248 = 31 x 8)
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let c = '';
  while (c.length < 8) for (const x of crypto.getRandomValues(new Uint8Array(16))) if (x < 248 && c.length < 8) c += A[x % 31];
  return c.slice(0, 4) + '-' + c.slice(4);
}
async function makeInvite(id) {
  if (!needLandlord()) return;
  const t = appData.tenants.find(x => String(x.id) === String(id));
  if (!t) return;
  const key = t.room.toLowerCase(), has = Object.keys(appData.users).filter(k => appData.users[k].role === 'tenant' && appData.users[k].room === key);
  if (has.length && !confirm(`${t.room} already has a login (${has.join(', ')}). Remove it and make a new invite code? Bills are not deleted.`)) return;
  try {
    const code = randomCode();
    has.forEach(k => delete appData.users[k]);
    appData.invites = appData.invites || {};
    appData.invites[key] = { ...await hashPw(normCode(code)), exp: Date.now() + INVITE_DAYS * 864e5, tries: 0 };
    saveState();
    document.getElementById('inviteRoomLabel').textContent = `${t.room} (${t.name})`;
    document.getElementById('inviteCodeText').textContent = code;
    document.getElementById('inviteNote').textContent = `Shown only once. It works one time and ends in ${INVITE_DAYS} days. The tenant presses Create account, chooses "I am a tenant", and enters the room and this code.`;
    openModal('inviteModal');
  } catch (err) { notify(err.message, true); }
}
async function copyInviteCode() {
  try { await navigator.clipboard.writeText(document.getElementById('inviteCodeText').textContent); notify('Invite code copied.'); }
  catch (err) { notify('Could not copy. Select the code and press Ctrl+C.', true); }
}

/* ---- TEST MODE: demo logins. Set TEST_MODE to false before going live. ---- */
const TEST_MODE = true;
async function seedTestAccounts() {
  if (!TEST_MODE) return;
  let changed = false;
  if (!appData.users.owner) { appData.users.owner = await makeUser('Owner12345', 'landlord'); changed = true; }
  if (!appData.users.tenant101) { appData.users.tenant101 = await makeUser('Tenant12345', 'tenant', 'Room 101'); changed = true; }
  if (!appData.landlordCode) { appData.landlordCode = await hashPw('access123'); changed = true; } // never replaces your own code
  if (changed) saveState();
}

window.onload = init;