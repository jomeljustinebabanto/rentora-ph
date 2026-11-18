const API_URL = 'api/rentora.php';
const UI_PREFS_KEY = 'rentora_ui_prefs_v1';

let appState = {
  csrf: '',
  currentUser: null,
  profile: null,
  lastDashboardTab: 'tenants',
  currentFilter: 'all',
  tipIndex: 0,
  config: {
    waterFee: 150.00,
    ratePerKwh: 14.2700
  },
  tenants: [],
  invoices: [],
  announcements: []
};

function round2(num) {
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

function round4(num) {
  return Math.round((Number(num) + Number.EPSILON) * 10000) / 10000;
}

function formatMoney(num) {
  return round2(num).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatRate(num) {
  return round4(num).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  });
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function capitalizeWord(str) {
  const s = String(str || '').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function waitMs(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeGender(val) {
  const clean = String(val || '').trim().toLowerCase();
  if (clean === 'female' || clean === 'f') return 'Female';
  return 'Male';
}

function getAvatarSvg(gender, size = 40) {
  const isFemale = normalizeGender(gender) === 'Female';
  if (isFemale) {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="32" fill="#FCE7F3" />
        <path d="M18 27C18 16.5 24 11 32 11C40 11 46 16.5 46 27V44C46 46 44 47 42 47H22C20 47 18 46 18 44V27Z" fill="#1F2937" />
        <path d="M14 58C14 48.6 22 42 32 42C42 42 50 48.6 50 58" fill="#065F46" />
        <polygon points="27,42 37,42 32,53" fill="#FFFFFF" />
        <rect x="28" y="34" width="8" height="10" rx="4" fill="#E8B896" />
        <ellipse cx="32" cy="25" rx="9.5" ry="11.5" fill="#F2C6A0" />
        <path d="M22.5 23C23.5 16.5 27.5 14 32 14C36.5 14 40.5 16.5 41.5 23C38.5 19.5 35.5 18 32 18C28.5 18 25.5 19.5 22.5 23Z" fill="#1F2937" />
      </svg>
    `;
  }
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="32" fill="#E5E7EB" />
      <path d="M14 58C14 48.6 22 42 32 42C42 42 50 48.6 50 58" fill="#1F2937" />
      <polygon points="27,42 37,42 32,54" fill="#FFFFFF" />
      <polygon points="31,44 33,44 34,54 32,57 30,54" fill="#DC2626" />
      <rect x="28" y="34" width="8" height="10" rx="4" fill="#E8B896" />
      <ellipse cx="32" cy="25" rx="10" ry="12" fill="#F2C6A0" />
      <path d="M22 23C22 15.5 26.5 11 32 11C37.5 11 42 15.5 42 23C41 18.5 37.5 17 32 17C26.5 17 23 18.5 22 23Z" fill="#374151" />
    </svg>
  `;
}

// TOP OF BROWSER LOADING LINE
function setTopBrowserLoading(active, progressPercent = 0) {
  const wrap = document.getElementById('topBrowserLoader');
  const bar = document.getElementById('topBrowserLoaderBar');
  const submitBtn = document.getElementById('loginSubmitBtn');

  if (submitBtn) {
    submitBtn.disabled = !!active;
    submitBtn.style.opacity = active ? '0.7' : '1';
    submitBtn.style.cursor = active ? 'not-allowed' : 'pointer';
  }

  if (!wrap || !bar) return;

  if (!active) {
    wrap.classList.remove('is-active');
    bar.classList.remove('is-running');
    bar.style.width = '0%';
    return;
  }

  wrap.classList.add('is-active');

  if (progressPercent > 0) {
    bar.classList.remove('is-running');
    bar.style.width = `${Math.min(100, Math.max(0, progressPercent))}%`;
  } else {
    bar.style.width = '';
    bar.classList.add('is-running');
  }
}

function showNotice(message, isError = false) {
  const el = document.getElementById('appNotice');
  if (!el) return;
  el.textContent = message;
  el.className = `fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold border transition-all ${
    isError
      ? 'bg-rose-900 text-rose-100 border-rose-700'
      : 'bg-slate-900 text-emerald-300 border-slate-700'
  }`;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 3500);
}

function showAlert(id, message, isSuccess = false) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!message) {
    el.textContent = '';
    el.classList.add('hidden');
  } else {
    el.textContent = message;
    el.className = isSuccess
      ? 'p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-medium'
      : 'p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium';
    el.classList.remove('hidden');
  }
}

async function apiGet(action) {
  const res = await fetch(`${API_URL}?action=${encodeURIComponent(action)}`, {
    credentials: 'same-origin',
    cache: 'no-store'
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('Server returned an unexpected response.');
  }
  if (!res.ok || !data.success) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}

async function apiPost(action, fields = {}) {
  const body = new URLSearchParams({ action, ...fields });
  const res = await fetch(API_URL, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'X-CSRF-TOKEN': appState.csrf
    },
    body
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('Server returned an unexpected response.');
  }
  if (!res.ok || !data.success) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}

function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('hidden');
  el.classList.add('flex');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('hidden');
  el.classList.remove('flex');
}

function closeAllModals() {
  const modalIds = [
    'signUpModal',
    'addTenantModal',
    'tenantLoginModal',
    'createInvoiceModal',
    'paymentModal',
    'smsModal',
    'receiptModal'
  ];
  modalIds.forEach(closeModal);
}

function handleBackdropClick(event, id) {
  if (event.target && event.target.id === id) {
    closeModal(id);
  }
}

function togglePasswordVisibility(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  if (icon) icon.classList.toggle('text-emerald-600', isHidden);
}

// TOP-RIGHT USER DROPDOWN MENU
function toggleUserDropdown(event) {
  event.stopPropagation();
  const menu = document.getElementById('userDropdownMenu');
  if (!menu) return;
  menu.classList.toggle('is-open');
}

function closeUserDropdown() {
  const menu = document.getElementById('userDropdownMenu');
  if (menu) menu.classList.remove('is-open');
}

function openProfileFromMenu() {
  closeUserDropdown();
  switchTab('profile');
  switchProfileSubTab('profile');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openSettingsFromMenu() {
  closeUserDropdown();
  switchTab('profile');
  switchProfileSubTab('settings');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function returnToDashboard() {
  const isLandlord = appState.currentUser?.role === 'landlord';
  const target = appState.lastDashboardTab || (isLandlord ? 'tenants' : 'billing');
  switchTab(!isLandlord && target === 'tenants' ? 'billing' : target);
}

// INNER SUB-TABS INSIDE PROFILE VIEW
function switchProfileSubTab(subTab) {
  const isProfile = subTab !== 'settings';
  const viewProfile = document.getElementById('profileSubViewProfile');
  const viewSettings = document.getElementById('profileSubViewSettings');
  const btnProfile = document.getElementById('subTabBtnProfile');
  const btnSettings = document.getElementById('subTabBtnSettings');

  if (viewProfile) viewProfile.classList.toggle('hidden', !isProfile);
  if (viewSettings) viewSettings.classList.toggle('hidden', isProfile);
  if (btnProfile) btnProfile.classList.toggle('is-active', isProfile);
  if (btnSettings) btnSettings.classList.toggle('is-active', !isProfile);
}

// UI SETTINGS (Text size, Density, Theme, Guide)
function getUiPrefs() {
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    textSize: 'normal',
    density: 'comfortable',
    theme: 'light',
    guide: 'show'
  };
}

function applyUiPrefs(prefs) {
  document.documentElement.classList.toggle('ui-large-text', prefs.textSize === 'large');
  document.body.classList.toggle('ui-compact', prefs.density === 'compact');
  document.body.classList.toggle('ui-dark', prefs.theme === 'dark');

  const widget = document.getElementById('rentoraHelperWidget');
  if (widget) {
    widget.classList.toggle('guide-hidden', prefs.guide === 'hide');
  }

  const selText = document.getElementById('uiSettingTextSize');
  const selDensity = document.getElementById('uiSettingDensity');
  const selTheme = document.getElementById('uiSettingTheme');
  const selGuide = document.getElementById('uiSettingGuide');
  if (selText) selText.value = prefs.textSize;
  if (selDensity) selDensity.value = prefs.density;
  if (selTheme) selTheme.value = prefs.theme;
  if (selGuide) selGuide.value = prefs.guide;
}

function updateUiSettings() {
  const prefs = {
    textSize: document.getElementById('uiSettingTextSize')?.value || 'normal',
    density: document.getElementById('uiSettingDensity')?.value || 'comfortable',
    theme: document.getElementById('uiSettingTheme')?.value || 'light',
    guide: document.getElementById('uiSettingGuide')?.value || 'show'
  };
  localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
  applyUiPrefs(prefs);
  showNotice('Display settings saved.');
}

// AUTHENTICATION
function openSignUp() {
  showAlert('signUpErrorAlert', '');
  document.getElementById('signUpForm')?.reset();
  openModal('signUpModal');
}

async function handleSignUpSubmit(event) {
  event.preventDefault();
  showAlert('signUpErrorAlert', '');

  const houseName = document.getElementById('regHouseName').value.trim();
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  const password2 = document.getElementById('regPassword2').value;

  if (password !== password2) {
    showAlert('signUpErrorAlert', 'Passwords do not match.');
    return;
  }

  try {
    const data = await apiPost('register', {
      house_name: houseName,
      username,
      password
    });
    appState.csrf = data.csrf;
    closeModal('signUpModal');

    showAlert('loginSuccessAlert', 'Account created! Sign in successful.', true);
    setTopBrowserLoading(true, 45);

    await Promise.all([
      enterDashboard(data.user, true),
      waitMs(650)
    ]);

    setTopBrowserLoading(true, 100);
    await waitMs(250);

    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainDashboardView').classList.remove('hidden');
    document.getElementById('rentoraHelperWidget')?.classList.add('is-visible');
    setTopBrowserLoading(false);
    showAlert('loginSuccessAlert', '');
  } catch (err) {
    setTopBrowserLoading(false);
    showAlert('signUpErrorAlert', err.message);
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  showAlert('loginErrorAlert', '');
  showAlert('loginSuccessAlert', '');
  setTopBrowserLoading(false);

  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const data = await apiPost('login', { username, password });
    appState.csrf = data.csrf;

    showAlert('loginSuccessAlert', 'Sign in successful!', true);
    setTopBrowserLoading(true, 45);

    await Promise.all([
      enterDashboard(data.user, true),
      waitMs(650)
    ]);

    setTopBrowserLoading(true, 100);
    await waitMs(250);

    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainDashboardView').classList.remove('hidden');
    document.getElementById('rentoraHelperWidget')?.classList.add('is-visible');
    setTopBrowserLoading(false);
    showAlert('loginSuccessAlert', '');
  } catch (err) {
    setTopBrowserLoading(false);
    showAlert('loginErrorAlert', err.message);
  }
}

async function handleLogout() {
  closeUserDropdown();
  closeAllModals();

  document.getElementById('mainDashboardView').classList.add('hidden');
  document.getElementById('rentoraHelperWidget')?.classList.remove('is-visible');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('loginPassword').value = '';
  showAlert('loginErrorAlert', '');
  showAlert('loginSuccessAlert', 'You have signed out.', true);
  setTopBrowserLoading(true, 40);

  try {
    await apiPost('logout');
  } catch (e) {}

  appState.currentUser = null;
  appState.profile = null;
  appState.tenants = [];
  appState.invoices = [];
  appState.announcements = [];

  try {
    const [ping] = await Promise.all([
      apiGet('ping'),
      waitMs(650)
    ]);
    appState.csrf = ping.csrf;
  } catch (e) {
    await waitMs(500);
  }

  setTopBrowserLoading(true, 100);
  await waitMs(300);
  setTopBrowserLoading(false);
}

// DATA LOADING & NAVIGATION
async function loadAppData() {
  const data = await apiGet('load');
  appState.config = {
    waterFee: round2(data.config?.waterFee ?? 150),
    ratePerKwh: round4(data.config?.ratePerKwh ?? 14.27)
  };
  appState.profile = data.profile || null;
  appState.tenants = Array.isArray(data.tenants) ? data.tenants : [];
  appState.invoices = Array.isArray(data.invoices) ? data.invoices : [];
  appState.announcements = Array.isArray(data.announcements) ? data.announcements : [];
}

async function enterDashboard(user, deferShow = false) {
  appState.currentUser = user;
  const isLandlord = user.role === 'landlord';
  appState.lastDashboardTab = isLandlord ? 'tenants' : 'billing';

  applyUiPrefs(getUiPrefs());

  document.querySelectorAll('[data-landlord]').forEach(el => {
    el.classList.toggle('hidden', !isLandlord);
  });

  await loadAppData();
  renderAll();
  switchTab(appState.lastDashboardTab);

  if (!deferShow) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainDashboardView').classList.remove('hidden');
    document.getElementById('rentoraHelperWidget')?.classList.add('is-visible');
  }
}

function switchTab(tab) {
  const isLandlord = appState.currentUser?.role === 'landlord';
  if (tab !== 'profile') {
    appState.lastDashboardTab = tab;
  }

  const views = ['tenants', 'billing', 'announcements', 'profile'];
  const viewMap = {
    tenants: 'viewTenants',
    billing: 'viewBilling',
    announcements: 'viewAnnouncements',
    profile: 'viewProfile'
  };
  const btnMap = {
    tenants: 'tabBtnTenants',
    billing: 'tabBtnBilling',
    announcements: 'tabBtnAnnouncements'
  };

  views.forEach(v => {
    const viewEl = document.getElementById(viewMap[v]);
    if (!viewEl) return;
    if (v === 'tenants' && !isLandlord) {
      viewEl.classList.add('hidden');
    } else {
      viewEl.classList.toggle('hidden', v !== tab);
    }
  });

  Object.keys(btnMap).forEach(t => {
    const btnEl = document.getElementById(btnMap[t]);
    if (!btnEl) return;

    if (t === 'tenants') {
      btnEl.classList.toggle('hidden', !isLandlord);
    }

    const active = t === tab;
    btnEl.classList.toggle('border-emerald-600', active);
    btnEl.classList.toggle('text-emerald-700', active);
    btnEl.classList.toggle('border-transparent', !active);
    btnEl.classList.toggle('text-slate-500', !active);
    btnEl.classList.toggle('hover:text-slate-800', !active);
  });

  if (tab === 'profile') {
    switchProfileSubTab('profile');
  }
}

function renderAll() {
  renderHeaderProfile();
  renderStats();
  renderTenants();
  renderInvoices();
  renderAnnouncements();
  renderProfile();
}

function renderHeaderProfile() {
  const p = appState.profile;
  const u = appState.currentUser;
  if (!u) return;

  const isLandlord = u.role === 'landlord';
  const gender = normalizeGender(p?.gender || u.gender || 'Male');
  const houseName = p?.houseName || u.houseName || 'Boarding House Portal';

  const shortName = !isLandlord && p?.firstName
    ? p.firstName
    : capitalizeWord(u.username);
  const fullName = isLandlord
    ? (p?.houseName || capitalizeWord(u.username))
    : (p?.fullName || capitalizeWord(u.username));
  const roleLabel = isLandlord ? 'Landlord' : `Tenant • ${gender}`;
  const subLabel = isLandlord
    ? `@${u.username}`
    : `${p?.room || u.room || 'Room'} • @${u.username}`;

  const headerSub = document.getElementById('headerHouseSubtitle');
  if (headerSub) headerSub.textContent = houseName;

  const headerAvatar = document.getElementById('headerAvatarSlot');
  const dropdownAvatar = document.getElementById('dropdownAvatarSlot');
  if (headerAvatar) headerAvatar.innerHTML = getAvatarSvg(gender, 40);
  if (dropdownAvatar) dropdownAvatar.innerHTML = getAvatarSvg(gender, 56);

  document.getElementById('headerShortName').textContent = shortName;
  document.getElementById('dropdownFullName').textContent = fullName;
  document.getElementById('dropdownRoleLabel').textContent = roleLabel;
  document.getElementById('dropdownSubLabel').textContent = subLabel;
}

function renderStats() {
  if (appState.currentUser?.role !== 'landlord') return;

  document.getElementById('statTotalRooms').textContent = appState.tenants.length;

  let pendingCount = 0;
  let unpaidTotal = 0;
  let paidTotal = 0;

  appState.invoices.forEach(inv => {
    if (inv.status === 'Void') return;
    paidTotal += Number(inv.amountPaid || 0);
    const bal = round2(Number(inv.totalAmount || 0) - Number(inv.amountPaid || 0));
    if (bal > 0) {
      pendingCount += 1;
      unpaidTotal += bal;
    }
  });

  document.getElementById('statPendingBills').textContent = pendingCount;
  document.getElementById('statUnpaidTotal').textContent = `₱${formatMoney(unpaidTotal)}`;
  document.getElementById('statPaidTotal').textContent = `₱${formatMoney(paidTotal)}`;
}

// TENANTS & ROOMS
function renderTenants() {
  const grid = document.getElementById('tenantsGrid');
  if (!grid) return;

  const query = (document.getElementById('tenantSearch')?.value || '').trim().toLowerCase();
  document.getElementById('countTenantsBadge').textContent = appState.tenants.length;

  const filtered = appState.tenants.filter(
    t => t.room.toLowerCase().includes(query) || t.name.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="col-span-full bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-400">No rooms or tenants found. Click "+ Add New Tenant" to register a room.</div>';
    return;
  }

  grid.innerHTML = filtered.map(t => {
    const gender = normalizeGender(t.gender);
    const isFemale = gender === 'Female';
    const genderBadgeClass = isFemale ? 'gender-badge-female' : 'gender-badge-male';

    return `
      <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between space-y-4">
        <div>
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">${escapeHtml(t.room)}</span>
              <span class="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${genderBadgeClass}">${escapeHtml(gender)}</span>
            </div>
            <span class="text-xs text-slate-400 font-mono">Meter: ${round2(t.currentMeter).toFixed(2)} kWh</span>
          </div>
          <div class="flex items-center gap-3 mt-3">
            <span class="avatar-md">${getAvatarSvg(gender, 44)}</span>
            <div class="min-w-0">
              <h3 class="font-bold text-slate-800 text-base truncate">${escapeHtml(t.name)}</h3>
              <p class="text-xs text-slate-500 mt-0.5">${escapeHtml(t.phone)}</p>
            </div>
          </div>
          <p class="text-xs font-semibold text-slate-700 mt-3">Base Rent: ₱${formatMoney(t.rent)} / mo</p>
          <p class="text-[11px] text-slate-500 mt-1">
            Portal Login: ${t.login ? `<span class="font-mono font-semibold text-emerald-700">${escapeHtml(t.login)}</span>` : '<span class="text-amber-600">Not set</span>'}
          </p>
        </div>
        <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <button type="button" onclick="openTenantLoginModal(${t.id})" class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 cursor-pointer">
            ${t.login ? 'Reset Login' : 'Set Login'}
          </button>
          <button type="button" onclick="deleteTenant(${t.id})" class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 cursor-pointer">
            Remove
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function handleSaveTenant(event) {
  event.preventDefault();
  const room = document.getElementById('tRoom').value.trim();
  const lastName = document.getElementById('tLastName').value.trim();
  const firstName = document.getElementById('tFirstName').value.trim();
  const middleName = document.getElementById('tMiddleName').value.trim();
  const gender = document.getElementById('tGender').value;
  const phone = document.getElementById('tPhone').value.trim();
  const rent = document.getElementById('tRent').value;
  const meter = document.getElementById('tMeter').value;
  const username = document.getElementById('tUser').value.trim();
  const password = document.getElementById('tPass').value;

  if (!gender) {
    showNotice('Please select Male or Female for the tenant profile.', true);
    return;
  }

  try {
    await apiPost('add_room', {
      room_no: room,
      last_name: lastName,
      first_name: firstName,
      middle_name: middleName,
      gender,
      phone,
      base_rent: rent,
      current_meter: meter,
      username,
      password
    });
    document.getElementById('tenantForm').reset();
    closeModal('addTenantModal');
    await loadAppData();
    renderAll();
    showNotice(`${room} (${gender}) registered successfully.`);
  } catch (err) {
    showNotice(err.message, true);
  }
}

async function deleteTenant(roomId) {
  if (!confirm('Remove this room and its tenant login?')) return;
  try {
    await apiPost('delete_room', { room_id: roomId });
    await loadAppData();
    renderAll();
    showNotice('Room removed.');
  } catch (err) {
    showNotice(err.message, true);
  }
}

function openTenantLoginModal(roomId) {
  const tenant = appState.tenants.find(t => t.id === roomId);
  if (!tenant) return;
  document.getElementById('tlRoomId').value = tenant.id;
  document.getElementById('tlRoomLabel').textContent = `${tenant.room} - ${tenant.name}`;
  document.getElementById('tlUsername').value = tenant.login || '';
  document.getElementById('tlPassword').value = '';
  openModal('tenantLoginModal');
}

async function handleSetTenantLogin(event) {
  event.preventDefault();
  const roomId = Number(document.getElementById('tlRoomId').value);
  const username = document.getElementById('tlUsername').value.trim();
  const password = document.getElementById('tlPassword').value;

  try {
    await apiPost('set_tenant_login', {
      room_id: roomId,
      username,
      password
    });
    closeModal('tenantLoginModal');
    await loadAppData();
    renderAll();
    showNotice('Tenant login credentials saved.');
  } catch (err) {
    showNotice(err.message, true);
  }
}

// BILLING & INVOICES
function filterInvoices(filter) {
  appState.currentFilter = filter;
  document.querySelectorAll('.invFilterBtn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderInvoices();
}

function renderInvoices() {
  const tbody = document.getElementById('invoicesTableBody');
  if (!tbody) return;

  const isLandlord = appState.currentUser?.role === 'landlord';
  document.getElementById('countInvoicesBadge').textContent = appState.invoices.length;

  const filtered = appState.invoices.filter(inv => {
    if (appState.currentFilter === 'unpaid') return inv.status === 'Unpaid' || inv.status === 'Partial';
    if (appState.currentFilter === 'paid') return inv.status === 'Paid';
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-xs text-slate-400">No invoices match the selected filter.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(inv => {
    const balance = round2(Number(inv.totalAmount) - Number(inv.amountPaid));
    let badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
    if (inv.status === 'Paid') badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (inv.status === 'Void') badgeClass = 'bg-slate-100 text-slate-500 border-slate-200';

    const landlordActions = isLandlord && inv.status !== 'Void'
      ? `
        ${inv.status !== 'Paid' ? `<button type="button" onclick="openPaymentModal('${escapeHtml(inv.id)}')" class="table-action-btn btn-pay">Pay</button>` : ''}
        <button type="button" onclick="openSmsModal('${escapeHtml(inv.id)}')" class="table-action-btn btn-sms">SMS</button>
        <button type="button" onclick="voidInvoice('${escapeHtml(inv.id)}')" class="table-action-btn btn-void">Void</button>
      `
      : '';

    return `
      <tr class="hover:bg-slate-50/70">
        <td class="p-3.5 font-mono text-xs font-semibold text-slate-700">${escapeHtml(inv.id)}</td>
        <td class="p-3.5">
          <div class="font-bold text-slate-800 text-xs">${escapeHtml(inv.room)}</div>
          <div class="text-xs text-slate-500">${escapeHtml(inv.tenantName)}</div>
        </td>
        <td class="p-3.5 text-xs text-slate-600">${escapeHtml(inv.period)}</td>
        <td class="p-3.5 text-xs text-slate-600">${round2(inv.kwhUsed).toFixed(2)} kWh</td>
        <td class="p-3.5 text-xs">
          <div class="font-bold text-slate-800">₱${formatMoney(inv.totalAmount)}</div>
          ${inv.status !== 'Void' && balance > 0 ? `<div class="text-[11px] text-amber-600">Bal: ₱${formatMoney(balance)}</div>` : ''}
        </td>
        <td class="p-3.5">
          <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${badgeClass}">${escapeHtml(inv.status)}</span>
        </td>
        <td class="p-3.5 text-right">
          <div class="inline-flex flex-wrap items-center justify-end gap-1.5">
            <button type="button" onclick="openReceiptModal('${escapeHtml(inv.id)}')" class="table-action-btn btn-statement">Statement</button>
            ${landlordActions}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openCreateInvoiceModal() {
  if (appState.tenants.length === 0) {
    showNotice('Add at least one room tenant before creating a bill.', true);
    return;
  }

  const select = document.getElementById('invTenantSelect');
  select.innerHTML = appState.tenants.map(
    t => `<option value="${t.id}">${escapeHtml(t.room)} - ${escapeHtml(t.name)}</option>`
  ).join('');

  const now = new Date();
  document.getElementById('invPeriod').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  document.getElementById('invRatePerKwh').value = round4(appState.config.ratePerKwh);
  document.getElementById('invWaterFee').value = round2(appState.config.waterFee).toFixed(2);

  onTenantSelectedForBill();
  openModal('createInvoiceModal');
}

function onTenantSelectedForBill() {
  const tenantId = Number(document.getElementById('invTenantSelect').value);
  const tenant = appState.tenants.find(t => t.id === tenantId);
  if (!tenant) return;

  document.getElementById('invPrevReading').value = round2(tenant.currentMeter).toFixed(2);
  document.getElementById('invCurrReading').value = round2(tenant.currentMeter).toFixed(2);
  calculateLivePreview();
}

function calculateLivePreview() {
  const tenantId = Number(document.getElementById('invTenantSelect').value);
  const tenant = appState.tenants.find(t => t.id === tenantId);
  if (!tenant) return;

  const prev = parseFloat(document.getElementById('invPrevReading').value) || 0;
  const curr = parseFloat(document.getElementById('invCurrReading').value) || 0;
  const rate = Math.max(0, parseFloat(document.getElementById('invRatePerKwh').value) || 0);
  const waterCost = round2(Math.max(0, parseFloat(document.getElementById('invWaterFee').value) || 0));
  const alertEl = document.getElementById('meterValidationAlert');

  let kwhUsed = 0;
  if (curr < prev) {
    alertEl.classList.remove('hidden');
  } else {
    alertEl.classList.add('hidden');
    kwhUsed = round2(curr - prev);
  }

  const powerCost = round2(kwhUsed * rate);
  const rentCost = round2(tenant.rent);
  const grandTotal = round2(powerCost + waterCost + rentCost);

  document.getElementById('prevKwhUsed').textContent = kwhUsed.toFixed(2);
  document.getElementById('prevRate').textContent = formatRate(rate);
  document.getElementById('prevPowerCost').textContent = formatMoney(powerCost);
  document.getElementById('prevWaterCost').textContent = formatMoney(waterCost);
  document.getElementById('prevRentCost').textContent = formatMoney(rentCost);
  document.getElementById('prevGrandTotal').textContent = formatMoney(grandTotal);
}

async function handleCreateInvoice(event) {
  event.preventDefault();
  const roomId = document.getElementById('invTenantSelect').value;
  const period = document.getElementById('invPeriod').value;
  const prev = parseFloat(document.getElementById('invPrevReading').value) || 0;
  const curr = parseFloat(document.getElementById('invCurrReading').value);
  const ratePerKwh = document.getElementById('invRatePerKwh').value;
  const waterFee = document.getElementById('invWaterFee').value;

  if (isNaN(curr) || curr < prev) {
    showNotice('Current meter reading cannot be lower than the previous reading.', true);
    return;
  }

  try {
    const res = await apiPost('create_bill', {
      room_id: roomId,
      billing_period: period,
      curr_reading: curr,
      rate_per_kwh: ratePerKwh,
      water_fee: waterFee
    });
    closeModal('createInvoiceModal');
    await loadAppData();
    renderAll();
    showNotice(`Invoice ${res.code} generated.`);
  } catch (err) {
    showNotice(err.message, true);
  }
}

function openPaymentModal(invoiceCode) {
  const inv = appState.invoices.find(i => i.id === invoiceCode);
  if (!inv) return;

  const balance = round2(Number(inv.totalAmount) - Number(inv.amountPaid));
  document.getElementById('payInvoiceId').value = inv.id;
  document.getElementById('payInvoiceDisplay').textContent = `${inv.id} (${inv.room})`;
  document.getElementById('payAmountDisplay').textContent = `₱${formatMoney(balance)}`;
  document.getElementById('payAmountInput').value = balance.toFixed(2);
  document.getElementById('payRef').value = '';
  openModal('paymentModal');
}

async function handleRecordPayment(event) {
  event.preventDefault();
  const invoiceCode = document.getElementById('payInvoiceId').value;
  const inv = appState.invoices.find(i => i.id === invoiceCode);
  if (!inv) return;

  const amount = parseFloat(document.getElementById('payAmountInput').value);
  const channel = document.getElementById('payChannel').value;
  const ref = document.getElementById('payRef').value.trim();

  if (isNaN(amount) || amount <= 0) {
    showNotice('Enter a valid payment amount.', true);
    return;
  }

  const newTotalPaid = round2(Number(inv.amountPaid) + amount);
  const payMethod = ref ? `${channel} (${ref})` : channel;

  try {
    await apiPost('record_payment', {
      invoice_code: inv.id,
      amount_paid: newTotalPaid,
      pay_method: payMethod
    });
    closeModal('paymentModal');
    await loadAppData();
    renderAll();
    showNotice('Payment recorded.');
  } catch (err) {
    showNotice(err.message, true);
  }
}

async function voidInvoice(invoiceCode) {
  const reason = prompt(`Why void ${invoiceCode}? (required)`);
  if (!reason || !reason.trim()) return;

  try {
    await apiPost('void_bill', {
      invoice_code: invoiceCode,
      reason: reason.trim()
    });
    await loadAppData();
    renderAll();
    showNotice(`Invoice ${invoiceCode} voided.`);
  } catch (err) {
    showNotice(err.message, true);
  }
}

function openSmsModal(invoiceCode) {
  const inv = appState.invoices.find(i => i.id === invoiceCode);
  if (!inv) return;

  const tenant = appState.tenants.find(t => t.id === inv.tenantId);
  const balance = round2(Number(inv.totalAmount) - Number(inv.amountPaid));
  const houseName = appState.profile?.houseName || 'Rentora';

  document.getElementById('smsRecipient').textContent = `${inv.tenantName} (${tenant?.phone || 'No phone'})`;
  document.getElementById('smsMessageBox').value =
    `Hi ${inv.tenantName} (${inv.room}), your ${houseName} bill for ${inv.period} (${inv.id}) is ready.\n` +
    `Meter: ${round2(inv.prevReading).toFixed(2)} -> ${round2(inv.currReading).toFixed(2)} (${round2(inv.kwhUsed).toFixed(2)} kWh)\n` +
    `Power: ₱${formatMoney(inv.powerAmount)} | Water: ₱${formatMoney(inv.waterAmount)} | Rent: ₱${formatMoney(inv.rentAmount)}\n` +
    `Total: ₱${formatMoney(inv.totalAmount)} | Balance Due: ₱${formatMoney(balance)}. Thank you!`;

  openModal('smsModal');
}

function copySmsText() {
  const box = document.getElementById('smsMessageBox');
  if (!box) return;
  const text = box.value;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => showNotice('SMS reminder copied.'))
      .catch(() => {
        box.select();
        document.execCommand('copy');
        showNotice('SMS reminder copied.');
      });
  } else {
    box.select();
    document.execCommand('copy');
    showNotice('SMS reminder copied.');
  }
}

function openReceiptModal(invoiceCode) {
  const inv = appState.invoices.find(i => i.id === invoiceCode);
  if (!inv) return;

  const houseTitle = document.getElementById('receiptHouseTitle');
  if (houseTitle) {
    houseTitle.textContent = (appState.profile?.houseName || 'RENTORA BOARDING HOUSE').toUpperCase();
  }

  const balance = round2(Number(inv.totalAmount) - Number(inv.amountPaid));
  document.getElementById('receiptContent').innerHTML = `
    <div class="flex justify-between"><span>Invoice ID:</span><span class="font-mono font-bold">${escapeHtml(inv.id)}</span></div>
    <div class="flex justify-between"><span>Room / Tenant:</span><span class="font-semibold">${escapeHtml(inv.room)} - ${escapeHtml(inv.tenantName)}</span></div>
    <div class="flex justify-between"><span>Billing Period:</span><span>${escapeHtml(inv.period)}</span></div>
    <div class="flex justify-between"><span>Status:</span><span class="font-bold">${escapeHtml(inv.status)}</span></div>
    <hr class="my-2 border-slate-200" />
    <div class="flex justify-between"><span>Sub-Meter Reading:</span><span>${round2(inv.prevReading).toFixed(2)} to ${round2(inv.currReading).toFixed(2)} kWh</span></div>
    <div class="flex justify-between"><span>Electricity (${round2(inv.kwhUsed).toFixed(2)} kWh @ ₱${formatRate(inv.ratePerKwh)}):</span><span>₱${formatMoney(inv.powerAmount)}</span></div>
    <div class="flex justify-between"><span>Water Utility Share:</span><span>₱${formatMoney(inv.waterAmount)}</span></div>
    <div class="flex justify-between"><span>Monthly Base Rent:</span><span>₱${formatMoney(inv.rentAmount)}</span></div>
    <hr class="my-2 border-slate-200" />
    <div class="flex justify-between font-bold text-slate-900 text-sm"><span>Total Amount:</span><span>₱${formatMoney(inv.totalAmount)}</span></div>
    <div class="flex justify-between text-emerald-700 font-semibold"><span>Amount Paid:</span><span>₱${formatMoney(inv.amountPaid)}</span></div>
    <div class="flex justify-between font-bold text-amber-700"><span>Remaining Balance:</span><span>₱${formatMoney(balance)}</span></div>
    ${inv.payMethod ? `<div class="flex justify-between text-[11px] text-slate-500 pt-1"><span>Payment Method:</span><span>${escapeHtml(inv.payMethod)} (${escapeHtml(inv.paidAt || '')})</span></div>` : ''}
    ${inv.voidReason ? `<div class="text-[11px] text-rose-600 pt-1">Void Reason: ${escapeHtml(inv.voidReason)}</div>` : ''}
  `;
  openModal('receiptModal');
}

// ANNOUNCEMENTS
function populateAnnouncementRooms() {
  const select = document.getElementById('annTargetRoom');
  if (!select) return;
  const current = select.value || 'ALL';
  const options = ['<option value="ALL">All Rooms</option>'].concat(
    appState.tenants.map(t => `<option value="${escapeHtml(t.room)}">${escapeHtml(t.room)} (${escapeHtml(t.name)})</option>`)
  );
  select.innerHTML = options.join('');
  const exists = Array.from(select.options).some(opt => opt.value === current);
  select.value = exists ? current : 'ALL';
}

function resetAnnouncementEditor() {
  document.getElementById('annEditId').value = '';
  document.getElementById('announcementForm')?.reset();
  document.getElementById('annEditorHeading').textContent = 'Post New Announcement';
  document.getElementById('annSubmitBtn').textContent = 'Post Announcement';
  document.getElementById('annCancelEditBtn').classList.add('hidden');
}

function editAnnouncement(id) {
  const ann = appState.announcements.find(a => a.id === id);
  if (!ann) return;
  document.getElementById('annEditId').value = ann.id;
  document.getElementById('annTitle').value = ann.title;
  document.getElementById('annPriority').value = ann.priority;
  document.getElementById('annTargetRoom').value = ann.targetRoom;
  document.getElementById('annBody').value = ann.body;
  document.getElementById('annEditorHeading').textContent = 'Edit Announcement';
  document.getElementById('annSubmitBtn').textContent = 'Update Announcement';
  document.getElementById('annCancelEditBtn').classList.remove('hidden');
  document.getElementById('annTitle').focus();
}

async function handleSaveAnnouncement(event) {
  event.preventDefault();
  const id = document.getElementById('annEditId').value;
  const title = document.getElementById('annTitle').value.trim();
  const priority = document.getElementById('annPriority').value;
  const targetRoom = document.getElementById('annTargetRoom').value;
  const body = document.getElementById('annBody').value.trim();

  try {
    await apiPost('save_announcement', {
      id,
      title,
      priority,
      target_room: targetRoom,
      body
    });
    resetAnnouncementEditor();
    await loadAppData();
    renderAll();
    showNotice(id ? 'Announcement updated.' : 'Announcement posted.');
  } catch (err) {
    showNotice(err.message, true);
  }
}

async function deleteAnnouncement(id) {
  if (!confirm('Delete this announcement?')) return;
  try {
    await apiPost('delete_announcement', { id });
    if (String(document.getElementById('annEditId').value) === String(id)) {
      resetAnnouncementEditor();
    }
    await loadAppData();
    renderAll();
    showNotice('Announcement deleted.');
  } catch (err) {
    showNotice(err.message, true);
  }
}

function renderAnnouncements() {
  const feed = document.getElementById('announcementsFeed');
  if (!feed) return;

  const isLandlord = appState.currentUser?.role === 'landlord';
  if (isLandlord) populateAnnouncementRooms();

  document.getElementById('countAnnouncementsBadge').textContent = appState.announcements.length;

  if (appState.announcements.length === 0) {
    feed.innerHTML = '<div class="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-400">No announcements posted yet.</div>';
    return;
  }

  feed.innerHTML = appState.announcements.map(ann => {
    let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
    let badgeLabel = 'General Notice';
    if (ann.priority === 'important') {
      badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
      badgeLabel = 'Important Reminder';
    } else if (ann.priority === 'urgent') {
      badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
      badgeLabel = 'Urgent Alert';
    }

    const audienceLabel = ann.targetRoom === 'ALL' ? 'All Rooms' : ann.targetRoom;
    const formattedBody = escapeHtml(ann.body).replace(/\n/g, '<br>');

    const adminControls = isLandlord
      ? `
        <div class="flex items-center gap-2">
          <button type="button" onclick="editAnnouncement(${ann.id})" class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 cursor-pointer">Edit</button>
          <button type="button" onclick="deleteAnnouncement(${ann.id})" class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 cursor-pointer">Delete</button>
        </div>
      `
      : '';

    return `
      <article class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${badgeClass}">${badgeLabel}</span>
              <span class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">${escapeHtml(audienceLabel)}</span>
              <span class="text-[11px] text-slate-400">${escapeHtml(ann.createdAt)}</span>
            </div>
            <h3 class="font-bold text-slate-900 text-base pt-1">${escapeHtml(ann.title)}</h3>
          </div>
          ${adminControls}
        </div>
        <p class="text-sm text-slate-600 leading-relaxed">${formattedBody}</p>
        <p class="text-[11px] text-slate-400 pt-1 border-t border-slate-100">Posted by ${escapeHtml(ann.postedBy)}</p>
      </article>
    `;
  }).join('');
}

// PROFILE & PASSWORD
function renderProfile() {
  const p = appState.profile;
  if (!p) return;

  const isLandlord = p.role === 'landlord';
  const gender = normalizeGender(p.gender || 'Male');
  const isFemale = gender === 'Female';

  const profileAvatar = document.getElementById('profileAvatarSlot');
  if (profileAvatar) profileAvatar.innerHTML = getAvatarSvg(gender, 56);

  const genderBadge = document.getElementById('profileGenderBadge');
  if (genderBadge) {
    genderBadge.textContent = gender;
    genderBadge.className = `inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
      isFemale ? 'gender-badge-female' : 'gender-badge-male'
    }`;
    genderBadge.classList.toggle('hidden', isLandlord);
  }

  document.getElementById('profileRoleBadge').textContent = isLandlord ? 'Landlord Account' : 'Tenant Account';
  document.getElementById('profileFullName').textContent = isLandlord
    ? (p.houseName || capitalizeWord(p.username))
    : (p.fullName || p.username);
  document.getElementById('profileUsername').textContent = p.username;

  const tenantBox = document.getElementById('profileTenantDetails');
  const landlordBox = document.getElementById('profileLandlordDetails');

  if (isLandlord) {
    tenantBox.classList.add('hidden');
    landlordBox.classList.remove('hidden');
    document.getElementById('profileTotalRooms').textContent = p.totalRooms ?? appState.tenants.length;
    document.getElementById('profileTenantLogins').textContent = p.tenantAccounts ?? 0;
    const houseInput = document.getElementById('profHouseNameInput');
    if (houseInput) houseInput.value = p.houseName || '';
  } else {
    landlordBox.classList.add('hidden');
    tenantBox.classList.remove('hidden');
    document.getElementById('profileTenantHouse').textContent = p.houseName || 'Rentora Boarding House';
    document.getElementById('profileRoom').textContent = p.room || '-';
    document.getElementById('profileGenderText').textContent = gender;
    document.getElementById('profilePhone').textContent = p.phone || '-';
    document.getElementById('profileRent').textContent = `₱${formatMoney(p.baseRent || 0)}`;
    document.getElementById('profileMeter').textContent = `${round2(p.currentMeter || 0).toFixed(2)} kWh`;
  }
}

async function handleUpdateHouseName(event) {
  event.preventDefault();
  const houseName = document.getElementById('profHouseNameInput').value.trim();
  if (!houseName) return;

  try {
    await apiPost('update_house_name', { house_name: houseName });
    await loadAppData();
    renderAll();
    showNotice('Boarding house name updated.');
  } catch (err) {
    showNotice(err.message, true);
  }
}

async function handleProfilePasswordSubmit(event) {
  event.preventDefault();
  showAlert('profilePassAlert', '');

  const current = document.getElementById('profCurrPass').value;
  const password = document.getElementById('profNewPass').value;
  const password2 = document.getElementById('profNewPass2').value;

  if (password !== password2) {
    showAlert('profilePassAlert', 'New passwords do not match.');
    return;
  }

  try {
    await apiPost('change_password', { current, password });
    document.getElementById('profilePasswordForm').reset();
    showAlert('profilePassAlert', 'Password updated successfully.', true);
  } catch (err) {
    showAlert('profilePassAlert', err.message);
  }
}

function downloadBackup() {
  const payload = JSON.stringify({
    exportedAt: new Date().toISOString(),
    houseName: appState.profile?.houseName || '',
    config: appState.config,
    tenants: appState.tenants,
    invoices: appState.invoices,
    announcements: appState.announcements
  }, null, 2);

  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rentora-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showNotice('Backup downloaded.');
}

// INTERACTIVE HELPER GUIDE
function showGuideMessage(text, autoHideMs = 0) {
  const bubble = document.getElementById('guideSpeechBubble');
  const speechText = document.getElementById('guideSpeechText');
  if (!bubble || !speechText) return;

  clearTimeout(bubble._hideTimer);
  speechText.textContent = text;
  bubble.classList.remove('bubble-hidden');

  if (autoHideMs > 0) {
    bubble._hideTimer = setTimeout(() => {
      bubble.classList.add('bubble-hidden');
    }, autoHideMs);
  }
}

function hideGuideMessage() {
  const bubble = document.getElementById('guideSpeechBubble');
  if (!bubble) return;
  clearTimeout(bubble._hideTimer);
  bubble.classList.add('bubble-hidden');
}

function initMemojiGuide() {
  const leftIris = document.getElementById('leftIris');
  const rightIris = document.getElementById('rightIris');

  document.addEventListener('mouseover', event => {
    const target = event.target.closest('.guide-hover');
    if (!target) return;
    const tip = target.getAttribute('data-tip');
    if (!tip) return;
    showGuideMessage(tip, 0);
  });

  document.addEventListener('mouseout', event => {
    const target = event.target.closest('.guide-hover');
    if (!target) return;
    if (event.relatedTarget && target.contains(event.relatedTarget)) return;
    hideGuideMessage();
  });

  document.addEventListener('mousemove', event => {
    if (!leftIris || !rightIris) return;
    const x = Math.max(-2, Math.min(2, (event.clientX / window.innerWidth - 0.5) * 4));
    const y = Math.max(-2, Math.min(2, (event.clientY / window.innerHeight - 0.5) * 4));
    const transform = `translate(${x}px, ${y}px)`;
    leftIris.style.transform = transform;
    rightIris.style.transform = transform;
  });
}

function triggerMemojiWink() {
  const rightLid = document.getElementById('rightLid');

  if (rightLid) {
    rightLid.style.height = '100%';
    setTimeout(() => { rightLid.style.height = '0%'; }, 320);
  }

  const isLandlord = appState.currentUser?.role === 'landlord';
  const tips = isLandlord
    ? [
        'Click your name at the top right to open your Profile or Display Settings.',
        'Click "+ Calculate New Room Bill" in Monthly Billing to compute electricity, water, and rent.',
        'Use the Announcements tab to send notices to all rooms or a specific room.'
      ]
    : [
        'Click your name at the top right to open your Profile or Display Settings.',
        'Click "Statement" on any bill row to view or print your itemized computation.',
        'Check the Announcements tab for boarding house updates.'
      ];

  const tip = tips[appState.tipIndex % tips.length];
  appState.tipIndex += 1;
  showGuideMessage(tip, 6000);
}

document.addEventListener('click', event => {
  const wrapper = document.getElementById('userMenuWrapper');
  if (wrapper && !wrapper.contains(event.target)) {
    closeUserDropdown();
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeUserDropdown();
    closeAllModals();
  }
});

async function init() {
  applyUiPrefs(getUiPrefs());
  initMemojiGuide();

  try {
    const ping = await apiGet('ping');
    appState.csrf = ping.csrf || '';

    if (ping.user) {
      await enterDashboard(ping.user, false);
    }
  } catch (err) {
    showAlert('loginErrorAlert', err.message || 'Unable to reach server.');
  }
}

window.onload = init;