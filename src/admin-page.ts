export function getAdminDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MiniCRM MCP - Admin</title>
<style>
  :root {
    --bg: #0a0e17; --card: #111827; --border: #1e2330; --border-light: #2a3040;
    --text: #e2e8f0; --text2: #8892a8; --dim: #5a6478;
    --accent: #4f7df5; --accent-bright: #6b93ff;
    --green: #3dd68c; --amber: #e8a040; --red: #f06060;
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:var(--bg); color:var(--text); }
  .header { padding:16px 24px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; }
  .header h1 { font-size:18px; font-weight:700; }
  .header h1 span { color:var(--accent); }
  .login-bar { padding:16px 24px; background:var(--card); border-bottom:1px solid var(--border); display:flex; gap:12px; align-items:center; }
  .login-bar input { padding:8px 12px; background:var(--bg); border:1px solid var(--border); border-radius:6px; color:var(--text); font-size:13px; width:300px; }
  .login-bar button { padding:8px 16px; background:var(--accent); color:#fff; border:none; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; }
  .login-bar button:hover { background:var(--accent-bright); }
  .container { padding:24px; max-width:1200px; margin:0 auto; }
  .stats-row { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px; }
  .stat-card { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:16px; }
  .stat-card .label { font-size:12px; color:var(--dim); text-transform:uppercase; letter-spacing:0.05em; }
  .stat-card .value { font-size:28px; font-weight:700; margin-top:4px; }
  .stat-card .value.green { color:var(--green); }
  .stat-card .value.amber { color:var(--amber); }
  .stat-card .value.red { color:var(--red); }
  table { width:100%; border-collapse:collapse; background:var(--card); border:1px solid var(--border); border-radius:10px; overflow:hidden; }
  th { text-align:left; padding:12px 16px; font-size:12px; color:var(--dim); text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid var(--border); background:var(--bg); }
  td { padding:10px 16px; font-size:13px; border-bottom:1px solid var(--border); }
  tr:last-child td { border-bottom:none; }
  tr:hover td { background:#ffffff06; }
  .badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600; }
  .badge.active { background:#3dd68c20; color:var(--green); }
  .badge.inactive { background:#f0606020; color:var(--red); }
  .badge.expired { background:#e8a04020; color:var(--amber); }
  .badge.trial { background:#e8a04020; color:var(--amber); }
  .badge.subscription { background:#3dd68c25; color:var(--green); }
  .badge.manual { background:#5a647825; color:var(--text2); }
  .filter-btn { padding:6px 14px; background:var(--card); border:1px solid var(--border); color:var(--text2); border-radius:8px; font-size:12px; cursor:pointer; transition:all .15s; }
  .filter-btn:hover { border-color:var(--accent); color:var(--text); }
  .filter-btn.active { background:var(--accent); border-color:var(--accent); color:#fff; }
  .filter-btn .filter-count { display:inline-block; margin-left:4px; padding:0 6px; background:rgba(255,255,255,0.12); border-radius:4px; font-size:10px; font-weight:700; }
  .filter-btn.active .filter-count { background:rgba(255,255,255,0.25); }
  .key-cell { font-family:monospace; font-size:11px; color:var(--text2); word-break:break-all; cursor:pointer; }
  .key-cell:hover { color:var(--accent-bright); }
  .note-cell { font-size:12px; color:var(--text2); max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .actions { display:flex; gap:6px; }
  .btn-sm { padding:4px 10px; border:1px solid var(--border); border-radius:4px; font-size:11px; cursor:pointer; background:transparent; color:var(--text2); }
  .btn-sm:hover { border-color:var(--accent); color:var(--accent); }
  .btn-sm.danger:hover { border-color:var(--red); color:var(--red); }
  .btn-sm.green:hover { border-color:var(--green); color:var(--green); }
  .toolbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
  .toolbar h2 { font-size:16px; font-weight:600; }
  .btn-primary { padding:8px 16px; background:var(--accent); color:#fff; border:none; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; }
  .btn-primary:hover { background:var(--accent-bright); }
  .modal-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:100; align-items:center; justify-content:center; }
  .modal-overlay.open { display:flex; }
  .modal { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:24px; width:420px; max-width:90vw; }
  .modal h3 { font-size:16px; margin-bottom:16px; }
  .modal label { display:block; font-size:12px; color:var(--text2); margin-bottom:4px; margin-top:12px; }
  .modal input, .modal select { width:100%; padding:8px 12px; background:var(--bg); border:1px solid var(--border); border-radius:6px; color:var(--text); font-size:13px; }
  .modal-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:20px; }
  .hidden { display:none; }
  .detail-panel { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:20px; margin-top:16px; }
  .detail-panel h3 { font-size:15px; margin-bottom:12px; }
  .detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .tool-bar { display:flex; align-items:center; gap:8px; margin-bottom:6px; }
  .tool-bar .name { font-size:13px; font-family:monospace; color:var(--accent-bright); flex:1; }
  .tool-bar .count { font-size:12px; color:var(--dim); }
  .tool-bar .bar-bg { flex:2; height:6px; background:var(--bg); border-radius:3px; overflow:hidden; }
  .tool-bar .bar-fill { height:100%; background:var(--accent); border-radius:3px; }
  .empty { text-align:center; padding:40px; color:var(--dim); font-size:14px; }
  @media(max-width:768px) { .stats-row { grid-template-columns:1fr 1fr; } .detail-grid { grid-template-columns:1fr; } }
</style>
</head>
<body>

<div class="header">
  <h1>Mini<span>CRM</span> MCP Admin</h1>
  <span id="connStatus" style="font-size:12px;color:var(--dim);">Nincs csatlakozva</span>
</div>

<div class="login-bar" id="loginBar">
  <input type="password" id="secretInput" placeholder="Admin Secret">
  <button onclick="login()">Bejelentkezés</button>
</div>

<div class="container hidden" id="dashboard">
  <div class="stats-row">
    <div class="stat-card"><div class="label">Összes licenc</div><div class="value" id="totalLic">-</div></div>
    <div class="stat-card"><div class="label">Aktív</div><div class="value green" id="activeLic">-</div></div>
    <div class="stat-card"><div class="label">Lejárt / Visszavont</div><div class="value red" id="inactiveLic">-</div></div>
    <div class="stat-card"><div class="label">Összes API hívás</div><div class="value amber" id="totalCalls">-</div></div>
  </div>

  <div class="toolbar">
    <h2>Licencek</h2>
    <button class="btn-primary" onclick="openCreateModal()">+ Új licenc</button>
  </div>

  <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
    <button class="btn-sm filter-btn active" data-filter="all" onclick="setLicenseFilter('all')">Mind <span class="filter-count" id="cnt-all">-</span></button>
    <button class="btn-sm filter-btn" data-filter="trial" onclick="setLicenseFilter('trial')">Próba <span class="filter-count" id="cnt-trial">-</span></button>
    <button class="btn-sm filter-btn" data-filter="subscription" onclick="setLicenseFilter('subscription')">Előfizető <span class="filter-count" id="cnt-subscription">-</span></button>
    <button class="btn-sm filter-btn" data-filter="expired" onclick="setLicenseFilter('expired')">Lejárt <span class="filter-count" id="cnt-expired">-</span></button>
    <button class="btn-sm filter-btn" data-filter="inactive" onclick="setLicenseFilter('inactive')">Visszavont <span class="filter-count" id="cnt-inactive">-</span></button>
  </div>

  <table>
    <thead><tr>
      <th>Típus</th>
      <th>Állapot</th>
      <th>Felhasználó</th>
      <th>Email</th>
      <th>Licenckulcs</th>
      <th>System ID</th>
      <th>Hívások</th>
      <th>Utolsó használat</th>
      <th>Lejárat</th>
      <th>Műveletek</th>
    </tr></thead>
    <tbody id="licTable"></tbody>
  </table>

  <div class="toolbar" style="margin-top:32px;">
    <h2>Leadek <span id="leadCount" style="font-size:13px;color:var(--dim);font-weight:normal;"></span></h2>
    <button class="btn-sm" onclick="fetchLeads()">Frissítés</button>
  </div>

  <table>
    <thead><tr>
      <th>Dátum</th>
      <th>Név</th>
      <th>Cég</th>
      <th>Telefon</th>
      <th>Email</th>
      <th>Felh. szám</th>
      <th>Licenc</th>
      <th>Forrás</th>
      <th>Műveletek</th>
    </tr></thead>
    <tbody id="leadTable"><tr><td colspan="9" class="empty">Bejelentkezés után tölt be...</td></tr></tbody>
  </table>

  <div class="toolbar" style="margin-top:32px;">
    <h2>Hibabejelentések <span id="bugCount" style="font-size:13px;color:var(--dim);font-weight:normal;"></span></h2>
    <button class="btn-sm" onclick="fetchBugs()">Frissítés</button>
  </div>

  <table>
    <thead><tr>
      <th>Dátum</th>
      <th>Állapot</th>
      <th>Bejelentő</th>
      <th>Kategória</th>
      <th>Leírás</th>
      <th>Képek</th>
      <th>Műveletek</th>
    </tr></thead>
    <tbody id="bugTable"><tr><td colspan="7" class="empty">Bejelentkezés után tölt be...</td></tr></tbody>
  </table>

  <div id="detailPanel" class="detail-panel hidden" style="margin-top:24px;">
    <h3 id="detailTitle">Részletek</h3>
    <div class="detail-grid">
      <div>
        <h4 style="font-size:13px;color:var(--dim);margin-bottom:8px;">Eszközhasználat</h4>
        <div id="toolBreakdown"></div>
      </div>
      <div>
        <h4 style="font-size:13px;color:var(--dim);margin-bottom:8px;">Utolsó hívások</h4>
        <div id="recentCalls" style="max-height:300px;overflow-y:auto;"></div>
      </div>
    </div>
  </div>
</div>

<!-- Create Modal -->
<div class="modal-overlay" id="createModal">
  <div class="modal">
    <h3>Új licenc létrehozása</h3>
    <label>Email *</label>
    <input type="email" id="newEmail" placeholder="email@ceg.hu">
    <label>Felhasználó neve</label>
    <input type="text" id="newNote" placeholder="Név vagy megjegyzés">
    <label>Lejárat (üres = végtelen)</label>
    <input type="date" id="newExpiry">
    <div class="modal-actions">
      <button class="btn-sm" onclick="closeModal('createModal')">Mégse</button>
      <button class="btn-primary" onclick="createLicense()">Létrehozás</button>
    </div>
  </div>
</div>

<!-- Extend Modal -->
<div class="modal-overlay" id="extendModal">
  <div class="modal">
    <h3>Próbaidőszak hosszabbítása</h3>
    <input type="hidden" id="extendKey">
    <div id="extendInfo" style="font-size:13px;color:var(--text2);line-height:1.5;margin-bottom:12px;"></div>
    <label>Hány nappal hosszabbítsuk?</label>
    <div style="display:flex;gap:6px;margin-bottom:8px;">
      <button class="btn-sm" onclick="setExtendDays(7)">+7 nap</button>
      <button class="btn-sm" onclick="setExtendDays(14)">+14 nap</button>
      <button class="btn-sm" onclick="setExtendDays(30)">+30 nap</button>
      <button class="btn-sm" onclick="setExtendDays(90)">+90 nap</button>
    </div>
    <input type="number" id="extendDays" min="1" max="3650" placeholder="Egyedi (pl. 21)">
    <div id="extendPreview" style="margin-top:10px;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;font-size:13px;color:var(--text2);"></div>
    <div class="modal-actions">
      <button class="btn-sm" onclick="closeModal('extendModal')">Mégse</button>
      <button class="btn-primary" onclick="saveExtend()">Hosszabbítás</button>
    </div>
  </div>
</div>

<!-- Edit Modal -->
<div class="modal-overlay" id="editModal">
  <div class="modal">
    <h3>Licenc szerkesztése</h3>
    <input type="hidden" id="editKey">
    <label>Felhasználó neve / Megjegyzés</label>
    <input type="text" id="editNote">
    <label>Email</label>
    <input type="email" id="editEmail">
    <label>Lejárat</label>
    <input type="date" id="editExpiry">
    <div class="modal-actions">
      <button class="btn-sm" onclick="closeModal('editModal')">Mégse</button>
      <button class="btn-primary" onclick="saveLicense()">Mentés</button>
    </div>
  </div>
</div>

<!-- Subscribe Modal (trial → subscription conversion) -->
<div class="modal-overlay" id="subscribeModal">
  <div class="modal">
    <h3>Előfizetésre váltás</h3>
    <input type="hidden" id="subKey">
    <div id="subInfo" style="font-size:13px;color:var(--text2);line-height:1.5;margin-bottom:12px;"></div>
    <label>Csomag</label>
    <div style="display:flex;gap:6px;margin-bottom:8px;">
      <button type="button" class="btn-sm" onclick="setSubPlan('monthly')">Havi (+1 hónap)</button>
      <button type="button" class="btn-sm" onclick="setSubPlan('yearly')">Éves (+1 év)</button>
      <button type="button" class="btn-sm" onclick="setSubPlan('custom')">Egyedi</button>
    </div>
    <div id="subPlanBadge" style="margin-bottom:8px"></div>
    <div id="subCustomDays" class="hidden" style="margin-top:8px">
      <label>Egyedi napok száma</label>
      <input type="number" id="subCustomDaysInput" min="1" max="3650" placeholder="pl. 60">
    </div>
    <label style="margin-top:12px">Indulás dátuma</label>
    <input type="date" id="subStartDate">
    <label style="margin-top:12px">Fizetési megjegyzés (opcionális)</label>
    <input type="text" id="subPaymentNote" placeholder="pl. Banki utalás, 2026-05-05, 30000 Ft">
    <div id="subPreview" style="margin-top:12px;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;font-size:13px;color:var(--text2);"></div>
    <div class="modal-actions">
      <button class="btn-sm" onclick="closeModal('subscribeModal')">Mégse</button>
      <button class="btn-primary" onclick="saveSubscribe()">Mentés</button>
    </div>
  </div>
</div>

<!-- Renew Modal (subscription renewal) -->
<div class="modal-overlay" id="renewModal">
  <div class="modal">
    <h3>Előfizetés megújítása</h3>
    <input type="hidden" id="renewKey">
    <div id="renewInfo" style="font-size:13px;color:var(--text2);line-height:1.5;margin-bottom:12px;"></div>
    <label>Mennyivel hosszabbítjuk?</label>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
      <button type="button" class="btn-sm" onclick="setRenewMode('month',1)">+1 hónap</button>
      <button type="button" class="btn-sm" onclick="setRenewMode('month',3)">+3 hónap</button>
      <button type="button" class="btn-sm" onclick="setRenewMode('month',6)">+6 hónap</button>
      <button type="button" class="btn-sm" onclick="setRenewMode('year',1)">+1 év</button>
      <button type="button" class="btn-sm" onclick="setRenewMode('day',null)">Egyedi nap</button>
    </div>
    <div id="renewCustom" class="hidden" style="margin-top:8px">
      <input type="number" id="renewCustomDaysInput" min="1" max="3650" placeholder="pl. 45">
    </div>
    <label style="margin-top:12px">Új csomag (opcionális)</label>
    <select id="renewPlanSelect">
      <option value="">Változatlan</option>
      <option value="monthly">Havi</option>
      <option value="yearly">Éves</option>
      <option value="custom">Egyedi</option>
    </select>
    <label style="margin-top:12px">Megjegyzés (opcionális)</label>
    <input type="text" id="renewNote" placeholder="pl. 2026-Q3 megújítás">
    <div id="renewPreview" style="margin-top:12px;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;font-size:13px;color:var(--text2);"></div>
    <div class="modal-actions">
      <button class="btn-sm" onclick="closeModal('renewModal')">Mégse</button>
      <button class="btn-primary" onclick="saveRenew()">Megújítás</button>
    </div>
  </div>
</div>

<!-- Bug Detail Modal -->
<div class="modal-overlay" id="bugModal">
  <div class="modal" style="width:720px;max-width:96vw;max-height:88vh;overflow-y:auto;">
    <h3 id="bugModalTitle">Hibabejelentés</h3>
    <div id="bugModalContent" style="margin-top:14px;"></div>
    <div class="modal-actions">
      <button class="btn-sm" onclick="closeModal('bugModal')">Bezár</button>
      <button class="btn-sm green" id="bugResolveBtn" onclick="toggleBugResolve()">Megoldottnak jelöl</button>
      <button class="btn-sm danger" id="bugDeleteBtn" onclick="deleteBug()">Törlés</button>
    </div>
  </div>
</div>

<script>
let SECRET = '';
const API = '/admin/api';
let CURRENT_BUG = null;

function login() {
  SECRET = document.getElementById('secretInput').value;
  fetchLicenses();
}

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: { 'Authorization': 'Bearer ' + SECRET, 'Content-Type': 'application/json', ...(opts.headers||{}) },
  });
  return res.json();
}

let TENANTS_BY_SID = {};

async function fetchLicenses() {
  try {
    const [data, tdata] = await Promise.all([api('/licenses'), api('/tenants').catch(() => ({tenants:[]}))]);
    if (data.error) { alert(data.error); return; }
    document.getElementById('loginBar').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('connStatus').textContent = 'Csatlakozva';
    document.getElementById('connStatus').style.color = '#3dd68c';
    TENANTS_BY_SID = {};
    for (const t of (tdata.tenants || [])) TENANTS_BY_SID[t.systemId] = t;
    renderLicenses(data.licenses);
    fetchLeads();
    fetchBugs();
  } catch(e) { alert('Hiba: ' + e.message); }
}

async function fetchBugs() {
  try {
    const data = await api('/bug-reports');
    if (data.error) { document.getElementById('bugTable').innerHTML = '<tr><td colspan="7" class="empty">Hiba: ' + esc(data.error) + '</td></tr>'; return; }
    renderBugs(data.reports || []);
  } catch(e) {
    document.getElementById('bugTable').innerHTML = '<tr><td colspan="7" class="empty">Hiba: ' + esc(e.message) + '</td></tr>';
  }
}

function renderBugs(bugs) {
  const open = bugs.filter(b => b.status !== 'resolved').length;
  document.getElementById('bugCount').textContent = '(' + open + ' nyitott / ' + bugs.length + ' összes)';
  const tbody = document.getElementById('bugTable');
  if (!bugs.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">Még nincs hibabejelentés</td></tr>'; return; }
  const catLabels = { ui:'Felület', tool:'Eszköz', performance:'Teljesítmény', auth:'Bejelentkezés', data:'Adatok', other:'Egyéb' };
  tbody.innerHTML = bugs.map(b => {
    const date = new Date(b.createdAt).toLocaleString('hu-HU');
    const reporter = b.name ? esc(b.name) : '<em style="color:var(--dim)">Névtelen</em>';
    const reporterEmail = b.email ? '<div style="font-size:11px;color:var(--text2)">' + esc(b.email) + '</div>' : '';
    const desc = b.descriptionPreview.length > 100 ? esc(b.descriptionPreview.substring(0,100)) + '…' : esc(b.descriptionPreview);
    const statusBadge = b.status === 'resolved'
      ? '<span class="badge active">Megoldva</span>'
      : '<span class="badge inactive">Nyitott</span>';
    const cat = b.category ? esc(catLabels[b.category] || b.category) : '-';
    const imgIndicator = b.imageCount > 0
      ? '<span style="display:inline-block;background:#4f7df520;color:var(--accent-bright);padding:2px 8px;border-radius:5px;font-size:11px;font-weight:600">📎 ' + b.imageCount + '</span>'
      : '<span style="color:var(--dim)">—</span>';
    return '<tr style="cursor:pointer" onclick="openBugModal(\\'' + encodeURIComponent(b.id) + '\\')">' +
      '<td style="font-size:12px;color:var(--text2)">' + esc(date) + '</td>' +
      '<td>' + statusBadge + '</td>' +
      '<td>' + reporter + reporterEmail + '</td>' +
      '<td style="font-size:12px">' + cat + '</td>' +
      '<td style="font-size:12px;color:var(--text2)">' + desc + '</td>' +
      '<td>' + imgIndicator + '</td>' +
      '<td><button class="btn-sm" onclick="event.stopPropagation();openBugModal(\\'' + encodeURIComponent(b.id) + '\\')">Megnyitás</button></td>' +
    '</tr>';
  }).join('');
}

async function openBugModal(idEnc) {
  const data = await api('/bug-reports/' + idEnc);
  if (data.error) { alert('Hiba: ' + data.error); return; }
  CURRENT_BUG = data;
  const catLabels = { ui:'Felület / megjelenés', tool:'Eszköz nem működik', performance:'Lassú / akadozik', auth:'Bejelentkezés / hozzáférés', data:'Adatok rosszul jelennek meg', other:'Egyéb' };
  const created = new Date(data.createdAt).toLocaleString('hu-HU');
  document.getElementById('bugModalTitle').textContent = 'Hibabejelentés — ' + (data.name || 'Névtelen');

  let html = '';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;font-size:13px">';
  html += '<div><div style="color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Bejelentő</div><div>' + (data.name ? esc(data.name) : '<em>Névtelen</em>') + '</div></div>';
  html += '<div><div style="color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Email</div><div>' + (data.email ? esc(data.email) : '<em>—</em>') + '</div></div>';
  html += '<div><div style="color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Kategória</div><div>' + (data.category ? esc(catLabels[data.category] || data.category) : '—') + '</div></div>';
  html += '<div><div style="color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Időpont</div><div>' + esc(created) + '</div></div>';
  html += '</div>';

  html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:14px;font-size:13px;line-height:1.6;white-space:pre-wrap">' + esc(data.description) + '</div>';

  if (data.images && data.images.length) {
    html += '<div style="font-size:11px;color:var(--dim);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Csatolt képek (' + data.images.length + ')</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">';
    for (let i = 0; i < data.images.length; i++) {
      const img = data.images[i];
      const src = 'data:' + img.mimeType + ';base64,' + img.base64;
      html += '<a href="' + src + '" target="_blank" style="display:block;aspect-ratio:1;border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--bg)">';
      html += '<img src="' + src + '" style="width:100%;height:100%;object-fit:cover" alt="' + esc(img.filename) + '">';
      html += '</a>';
    }
    html += '</div>';
  }

  if (data.userAgent) {
    html += '<div style="margin-top:14px;font-size:11px;color:var(--dim);font-family:monospace;word-break:break-all">' + esc(data.userAgent) + '</div>';
  }

  document.getElementById('bugModalContent').innerHTML = html;
  document.getElementById('bugResolveBtn').textContent = data.status === 'resolved' ? 'Újranyitás' : 'Megoldottnak jelöl';
  document.getElementById('bugModal').classList.add('open');
}

async function toggleBugResolve() {
  if (!CURRENT_BUG) return;
  const action = CURRENT_BUG.status === 'resolved' ? 'reopen' : 'resolve';
  await api('/bug-reports/' + encodeURIComponent(CURRENT_BUG.id) + '/' + action, { method:'POST' });
  closeModal('bugModal');
  fetchBugs();
}

async function deleteBug() {
  if (!CURRENT_BUG) return;
  if (!confirm('Biztosan törlöd ezt a hibabejelentést? Ez nem visszavonható.')) return;
  await api('/bug-reports/' + encodeURIComponent(CURRENT_BUG.id), { method:'DELETE' });
  closeModal('bugModal');
  fetchBugs();
}

async function resetTenantPassword(systemId, adminEmail) {
  if (!confirm('Új admin jelszó generálása ehhez a tenanthoz?\\nSystem ID: ' + systemId + '\\nAdmin: ' + (adminEmail||'-') + '\\n\\nA régi jelszó azonnal érvénytelenné válik.')) return;
  const data = await api('/tenants/' + encodeURIComponent(systemId) + '/reset-password', { method:'POST' });
  if (data.error) { alert('Hiba: ' + data.error); return; }
  prompt('Új admin jelszó (másold ki most, később már nem lesz látható):', data.newPassword);
}

async function fetchLeads() {
  try {
    const data = await api('/leads');
    if (data.error) { document.getElementById('leadTable').innerHTML = '<tr><td colspan="9" class="empty">Hiba: ' + esc(data.error) + '</td></tr>'; return; }
    renderLeads(data.leads || []);
  } catch(e) {
    document.getElementById('leadTable').innerHTML = '<tr><td colspan="9" class="empty">Hiba: ' + esc(e.message) + '</td></tr>';
  }
}

function renderLeads(leads) {
  document.getElementById('leadCount').textContent = '(' + leads.length + ')';
  const tbody = document.getElementById('leadTable');
  if (!leads.length) { tbody.innerHTML = '<tr><td colspan="9" class="empty">Még nincs lead</td></tr>'; return; }
  tbody.innerHTML = leads.map(l => {
    const date = l.createdAt ? new Date(l.createdAt).toLocaleString('hu-HU') : '-';
    const licShort = l.licenseKey ? (l.licenseKey.substring(0, 12) + '…') : '-';
    return '<tr>' +
      '<td style="font-size:12px;color:var(--text2)">' + esc(date) + '</td>' +
      '<td>' + esc(l.name || '-') + '</td>' +
      '<td>' + esc(l.company || '-') + '</td>' +
      '<td style="font-size:12px">' + esc(l.phone || '-') + '</td>' +
      '<td style="font-size:12px;color:var(--text2)">' + esc(l.email || '-') + '</td>' +
      '<td style="text-align:center">' + (l.userCount || '-') + '</td>' +
      '<td class="key-cell" title="' + esc(l.licenseKey||'') + '" onclick="if(this.dataset.k){navigator.clipboard.writeText(this.dataset.k);this.style.color=\\'#3dd68c\\';setTimeout(()=>this.style.color=\\'\\',1000)}" data-k="' + esc(l.licenseKey||'') + '">' + esc(licShort) + '</td>' +
      '<td style="font-size:12px"><span class="badge trial">' + esc(l.source || '-') + '</span></td>' +
      '<td class="actions">' +
        '<button class="btn-sm danger" onclick="deleteLead(\\'' + encodeURIComponent(l.id) + '\\',\\'' + esc(l.email||'') + '\\')">Törlés</button>' +
      '</td></tr>';
  }).join('');
}

async function deleteLead(idEnc, email) {
  if (!confirm('Lead törlése: ' + email + '\\n\\nEz csak a lead-rekordot törli, a licencet nem érinti. Biztos?')) return;
  const data = await api('/leads/' + idEnc, { method:'DELETE' });
  if (data.error) { alert('Hiba: ' + data.error); return; }
  fetchLeads();
}

let LICENSE_FILTER = 'all';
let ALL_LICENSES = [];

function getLicenseType(l) {
  if (l.type === 'subscription' || l.type === 'trial') return l.type;
  if (l.note && l.note.startsWith('trial:')) return 'trial';
  return 'manual';
}

function setLicenseFilter(f) {
  LICENSE_FILTER = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === f));
  renderLicenses(ALL_LICENSES);
}

function renderLicenses(licenses) {
  ALL_LICENSES = licenses;
  const now = new Date();
  let active = 0, inactive = 0, totalCalls = 0;
  let cnt = { all: licenses.length, trial: 0, subscription: 0, expired: 0, inactive: 0 };
  licenses.forEach(l => {
    totalCalls += l.total_calls || 0;
    const expired = l.expiresAt && new Date(l.expiresAt) < now;
    const t = getLicenseType(l);
    if (l.active && !expired) active++; else inactive++;
    if (!l.active) cnt.inactive++;
    else if (expired) cnt.expired++;
    else if (t === 'trial') cnt.trial++;
    else if (t === 'subscription') cnt.subscription++;
  });
  document.getElementById('totalLic').textContent = licenses.length;
  document.getElementById('activeLic').textContent = active;
  document.getElementById('inactiveLic').textContent = inactive;
  document.getElementById('totalCalls').textContent = totalCalls;
  for (const k of Object.keys(cnt)) {
    const el = document.getElementById('cnt-' + k);
    if (el) el.textContent = cnt[k];
  }

  // Apply filter
  let filtered = licenses;
  if (LICENSE_FILTER !== 'all') {
    filtered = licenses.filter(l => {
      const expired = l.expiresAt && new Date(l.expiresAt) < now;
      const t = getLicenseType(l);
      if (LICENSE_FILTER === 'inactive') return !l.active;
      if (LICENSE_FILTER === 'expired') return l.active && expired;
      if (LICENSE_FILTER === 'trial') return l.active && !expired && t === 'trial';
      if (LICENSE_FILTER === 'subscription') return l.active && !expired && t === 'subscription';
      return true;
    });
  }

  const tbody = document.getElementById('licTable');
  if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="10" class="empty">Nincs találat erre a szűrőre.</td></tr>'; return; }
  tbody.innerHTML = filtered.map(l => {
    const expired = l.expiresAt && new Date(l.expiresAt) < now;
    const isTrial = l.note && l.note.startsWith('trial:');
    const type = getLicenseType(l);
    let typeBadge = '';
    if (type === 'trial') typeBadge = '<span class="badge trial">Próba</span>';
    else if (type === 'subscription') {
      const planLabel = l.subscriptionPlan === 'monthly' ? ' havi' : l.subscriptionPlan === 'yearly' ? ' éves' : '';
      typeBadge = '<span class="badge subscription">Előfizető' + planLabel + '</span>';
    } else typeBadge = '<span class="badge manual">Manuális</span>';

    let statusBadge = '';
    if (!l.active) statusBadge = '<span class="badge inactive">Visszavont</span>';
    else if (expired) statusBadge = '<span class="badge expired">Lejárt</span>';
    else statusBadge = '<span class="badge active">Aktív</span>';

    const userName = l.note ? (isTrial ? l.note.replace('trial: ','').split('|')[0].trim() : l.note) : '-';
    const lastUsed = l.last_used ? new Date(l.last_used+'Z').toLocaleString('hu-HU') : '-';
    const expiry = l.expiresAt ? new Date(l.expiresAt).toLocaleDateString('hu-HU') : 'Végtelen';

    // Customer admin vs employee badge
    const tenant = l.boundSystemId ? TENANTS_BY_SID[l.boundSystemId] : null;
    let roleBadge = '';
    if (tenant && tenant.exists) {
      if (tenant.adminLicenseKey === l.key) {
        roleBadge = '<span class="badge" style="background:linear-gradient(135deg,#c8702a,#e8a040);color:#0a0c10;padding:2px 7px;border-radius:5px;font-size:10px;margin-left:6px;font-weight:700">CÉGADMIN</span>';
      } else {
        roleBadge = '<span class="badge" style="background:#4f7df520;color:var(--accent-bright);padding:2px 7px;border-radius:5px;font-size:10px;margin-left:6px;font-weight:600">Alkalmazott</span>';
      }
    }
    const isAdminLicense = tenant && tenant.exists && tenant.adminLicenseKey === l.key;
    const resetBtn = isAdminLicense
      ? '<button class="btn-sm" style="margin-left:4px" onclick="resetTenantPassword(\\'' + l.boundSystemId + '\\',\\'' + esc(tenant.adminEmail||'') + '\\')" title="Új admin jelszó">🔑</button>'
      : '';

    // Type-specific actions
    let extendBtn = '';
    let convertBtn = '';
    if (type === 'subscription') {
      extendBtn = '<button class="btn-sm green" onclick="openRenewModal(\\'' + l.key + '\\',\\'' + esc(userName) + '\\',\\'' + (l.expiresAt||'') + '\\',\\'' + (l.subscriptionPlan||'') + '\\')">Megújítás</button>';
    } else {
      extendBtn = '<button class="btn-sm" onclick="openExtendModal(\\'' + l.key + '\\',\\'' + esc(userName) + '\\',\\'' + (l.expiresAt||'') + '\\')">Próba +</button>';
      convertBtn = '<button class="btn-sm green" onclick="openSubscribeModal(\\'' + l.key + '\\',\\'' + esc(userName) + '\\',\\'' + (l.expiresAt||'') + '\\')">Előfizetésre vált</button>';
    }

    return '<tr>' +
      '<td>' + typeBadge + '</td>' +
      '<td>' + statusBadge + '</td>' +
      '<td>' + esc(userName) + roleBadge + '</td>' +
      '<td style="font-size:12px;color:var(--text2)">' + esc(l.email) + '</td>' +
      '<td class="key-cell" onclick="navigator.clipboard.writeText(\\'' + l.key + '\\');this.style.color=\\'#3dd68c\\';setTimeout(()=>this.style.color=\\'\\',1000)" title="Kattints a másoláshoz">' + esc(l.key) + '</td>' +
      '<td style="font-size:12px">' + (l.boundSystemId || '-') + '</td>' +
      '<td style="font-weight:600">' + (l.total_calls || 0) + '</td>' +
      '<td style="font-size:12px;color:var(--text2)">' + lastUsed + '</td>' +
      '<td style="font-size:12px">' + expiry + '</td>' +
      '<td class="actions">' +
        '<button class="btn-sm" onclick="showDetail(\\'' + l.key + '\\',\\'' + esc(userName) + '\\')">Részletek</button>' +
        '<button class="btn-sm" onclick="openEditModal(\\'' + l.key + '\\',\\'' + esc(l.note||'') + '\\',\\'' + esc(l.email) + '\\',\\'' + (l.expiresAt||'') + '\\')">Szerk.</button>' +
        extendBtn + convertBtn +
        (l.active ?
          '<button class="btn-sm danger" onclick="revokeLicense(\\'' + l.key + '\\')">Tiltás</button>' :
          '<button class="btn-sm green" onclick="reactivateLicense(\\'' + l.key + '\\')">Aktiválás</button>') +
        '<button class="btn-sm danger" onclick="purgeLicense(\\'' + l.key + '\\',\\'' + esc(l.email) + '\\')">Törlés</button>' +
        resetBtn +
      '</td></tr>';
  }).join('');
}

function esc(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

async function showDetail(key, name) {
  const data = await api('/usage/' + key);
  document.getElementById('detailPanel').classList.remove('hidden');
  document.getElementById('detailTitle').textContent = name + ' - Használati részletek';

  const tb = document.getElementById('toolBreakdown');
  if (data.tools && data.tools.length) {
    const max = data.tools[0].count;
    tb.innerHTML = data.tools.map(t =>
      '<div class="tool-bar">' +
        '<span class="name">' + (t.tool_name||'(egyéb)') + '</span>' +
        '<span class="count">' + t.count + '</span>' +
        '<div class="bar-bg"><div class="bar-fill" style="width:' + (t.count/max*100) + '%"></div></div>' +
      '</div>'
    ).join('');
  } else { tb.innerHTML = '<div class="empty">Nincs adat</div>'; }

  const rc = document.getElementById('recentCalls');
  if (data.recent && data.recent.length) {
    rc.innerHTML = data.recent.map(r =>
      '<div style="padding:4px 0;border-bottom:1px solid var(--border);font-size:12px;">' +
        '<span style="color:var(--accent)">' + (r.tool_name||'-') + '</span> ' +
        '<span style="color:var(--dim)">' + new Date(r.timestamp+'Z').toLocaleString('hu-HU') + '</span>' +
        (r.success ? '' : ' <span style="color:var(--red)">HIBA</span>') +
      '</div>'
    ).join('');
  } else { rc.innerHTML = '<div class="empty">Nincs adat</div>'; }
}

function openCreateModal() { document.getElementById('createModal').classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

async function createLicense() {
  const email = document.getElementById('newEmail').value;
  const note = document.getElementById('newNote').value;
  const exp = document.getElementById('newExpiry').value;
  if (!email) { alert('Email megadása kötelező!'); return; }
  const body = { email, note: note || undefined, expiresAt: exp ? new Date(exp).toISOString() : undefined };
  const data = await api('/licenses', { method:'POST', body:JSON.stringify(body) });
  if (data.key) {
    alert('Licenc létrehozva: ' + data.key);
    closeModal('createModal');
    fetchLicenses();
  } else { alert(data.error || 'Hiba'); }
}

function openEditModal(key, note, email, expiresAt) {
  document.getElementById('editKey').value = key;
  document.getElementById('editNote').value = note;
  document.getElementById('editEmail').value = email;
  document.getElementById('editExpiry').value = expiresAt ? expiresAt.split('T')[0] : '';
  document.getElementById('editModal').classList.add('open');
}

async function saveLicense() {
  const key = document.getElementById('editKey').value;
  const note = document.getElementById('editNote').value;
  const email = document.getElementById('editEmail').value;
  const exp = document.getElementById('editExpiry').value;
  const body = { note, email, expiresAt: exp ? new Date(exp).toISOString() : null };
  await api('/licenses/' + key, { method:'PUT', body:JSON.stringify(body) });
  closeModal('editModal');
  fetchLicenses();
}

async function revokeLicense(key) {
  if (!confirm('Biztosan visszavonja ezt a licencet?')) return;
  await api('/licenses/' + key, { method:'DELETE' });
  fetchLicenses();
}

async function reactivateLicense(key) {
  await api('/licenses/' + key + '/reactivate', { method:'POST' });
  fetchLicenses();
}

let _extendBase = null;  // Date object: starting point for the extension
let _extendCurrent = null;  // current expiresAt as Date or null

function openExtendModal(key, userName, expiresAt) {
  document.getElementById('extendKey').value = key;
  const now = new Date();
  _extendCurrent = expiresAt ? new Date(expiresAt) : null;
  // Base = max(now, current) so '+N days' always extends, never shortens
  _extendBase = (_extendCurrent && _extendCurrent > now) ? _extendCurrent : now;
  const currentTxt = _extendCurrent ? _extendCurrent.toLocaleDateString('hu-HU') : 'nincs (végtelen volt)';
  const baseTxt = _extendBase.toLocaleDateString('hu-HU');
  const baseLabel = (_extendCurrent && _extendCurrent > now) ? 'jelenlegi lejárat' : 'mai nap (lejárt licencnél innen számít)';
  document.getElementById('extendInfo').innerHTML =
    '<strong>' + esc(userName) + '</strong><br>' +
    'Jelenlegi lejárat: <strong>' + esc(currentTxt) + '</strong><br>' +
    'Hosszabbítás kezdete: <strong>' + esc(baseTxt) + '</strong> <span style="color:var(--dim)">(' + esc(baseLabel) + ')</span>';
  document.getElementById('extendDays').value = '';
  document.getElementById('extendPreview').textContent = 'Új lejárat: -';
  document.getElementById('extendModal').classList.add('open');
  document.getElementById('extendDays').oninput = updateExtendPreview;
}

function setExtendDays(n) {
  document.getElementById('extendDays').value = n;
  updateExtendPreview();
}

function updateExtendPreview() {
  const days = parseInt(document.getElementById('extendDays').value);
  const preview = document.getElementById('extendPreview');
  if (!days || days < 1 || !_extendBase) { preview.textContent = 'Új lejárat: -'; return; }
  const next = new Date(_extendBase.getTime() + days * 24 * 60 * 60 * 1000);
  preview.innerHTML = 'Új lejárat: <strong style="color:var(--green)">' + next.toLocaleDateString('hu-HU') + '</strong>';
}

async function saveExtend() {
  const key = document.getElementById('extendKey').value;
  const days = parseInt(document.getElementById('extendDays').value);
  if (!days || days < 1) { alert('Adj meg pozitív napok számát.'); return; }
  if (!_extendBase) { alert('Hiba: hiányzik a kiindulási dátum.'); return; }
  const next = new Date(_extendBase.getTime() + days * 24 * 60 * 60 * 1000);
  const data = await api('/licenses/' + key, { method:'PUT', body:JSON.stringify({ expiresAt: next.toISOString() }) });
  if (data.error) { alert('Hiba: ' + data.error); return; }
  closeModal('extendModal');
  fetchLicenses();
}

// === Subscribe (trial → subscription) ===
let _subPlan = null;

function addMonths(d, n) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
function addYears(d, n) { const x = new Date(d); x.setFullYear(x.getFullYear() + n); return x; }
function todayDateStr() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }

function openSubscribeModal(key, userName, expiresAt) {
  document.getElementById('subKey').value = key;
  _subPlan = 'monthly';
  document.getElementById('subInfo').innerHTML =
    '<strong>' + esc(userName) + '</strong> próbából előfizetésre váltása.<br>' +
    'Jelenlegi lejárat: <strong>' + (expiresAt ? new Date(expiresAt).toLocaleDateString('hu-HU') : 'nincs') + '</strong>';
  document.getElementById('subStartDate').value = todayDateStr();
  document.getElementById('subPaymentNote').value = '';
  document.getElementById('subCustomDaysInput').value = '';
  document.getElementById('subCustomDays').classList.add('hidden');
  setSubPlan('monthly');
  document.getElementById('subscribeModal').classList.add('open');
  document.getElementById('subStartDate').oninput = updateSubPreview;
  document.getElementById('subCustomDaysInput').oninput = updateSubPreview;
}

function setSubPlan(plan) {
  _subPlan = plan;
  document.getElementById('subPlanBadge').innerHTML =
    'Választott: <strong style="color:var(--green)">' +
    (plan === 'monthly' ? 'Havi (30 nap)' : plan === 'yearly' ? 'Éves (1 év)' : 'Egyedi') +
    '</strong>';
  document.getElementById('subCustomDays').classList.toggle('hidden', plan !== 'custom');
  updateSubPreview();
}

function computeSubExpiry() {
  const startStr = document.getElementById('subStartDate').value;
  if (!startStr) return null;
  const start = new Date(startStr + 'T00:00:00');
  if (_subPlan === 'monthly') return addMonths(start, 1);
  if (_subPlan === 'yearly') return addYears(start, 1);
  if (_subPlan === 'custom') {
    const days = parseInt(document.getElementById('subCustomDaysInput').value);
    if (!days || days < 1) return null;
    return new Date(start.getTime() + days * 86400000);
  }
  return null;
}

function updateSubPreview() {
  const exp = computeSubExpiry();
  const p = document.getElementById('subPreview');
  if (!exp) { p.textContent = 'Új lejárat: -'; return; }
  p.innerHTML = 'Új lejárat: <strong style="color:var(--green)">' + exp.toLocaleDateString('hu-HU') + '</strong>';
}

async function saveSubscribe() {
  const key = document.getElementById('subKey').value;
  const startStr = document.getElementById('subStartDate').value;
  const exp = computeSubExpiry();
  if (!exp) { alert('Add meg a csomag adatait (egyedinél a napok számát is).'); return; }
  const body = {
    type: 'subscription',
    subscriptionPlan: _subPlan,
    subscriptionStartedAt: new Date(startStr + 'T00:00:00').toISOString(),
    expiresAt: exp.toISOString(),
    paymentNote: document.getElementById('subPaymentNote').value.trim() || undefined,
  };
  const data = await api('/licenses/' + key, { method:'PUT', body: JSON.stringify(body) });
  if (data.error) { alert('Hiba: ' + data.error); return; }
  closeModal('subscribeModal');
  fetchLicenses();
}

// === Renew (subscription renewal) ===
let _renewBase = null;
let _renewMode = { kind: 'month', n: 1 };
let _renewCurrentExpiry = null;

function openRenewModal(key, userName, expiresAt, currentPlan) {
  document.getElementById('renewKey').value = key;
  const now = new Date();
  _renewCurrentExpiry = expiresAt ? new Date(expiresAt) : null;
  _renewBase = (_renewCurrentExpiry && _renewCurrentExpiry > now) ? _renewCurrentExpiry : now;
  const baseLabel = (_renewCurrentExpiry && _renewCurrentExpiry > now) ? 'jelenlegi lejárat' : 'mai nap (lejárt — innen)';
  document.getElementById('renewInfo').innerHTML =
    '<strong>' + esc(userName) + '</strong><br>' +
    'Jelenlegi lejárat: <strong>' + (_renewCurrentExpiry ? _renewCurrentExpiry.toLocaleDateString('hu-HU') : 'nincs') + '</strong><br>' +
    'Megújítás kezdete: <strong>' + _renewBase.toLocaleDateString('hu-HU') + '</strong> <span style="color:var(--dim)">(' + esc(baseLabel) + ')</span><br>' +
    'Jelenlegi csomag: <strong>' + (currentPlan === 'monthly' ? 'Havi' : currentPlan === 'yearly' ? 'Éves' : currentPlan || '—') + '</strong>';
  document.getElementById('renewCustom').classList.add('hidden');
  document.getElementById('renewCustomDaysInput').value = '';
  document.getElementById('renewPlanSelect').value = '';
  document.getElementById('renewNote').value = '';
  setRenewMode('month', 1);
  document.getElementById('renewModal').classList.add('open');
  document.getElementById('renewCustomDaysInput').oninput = updateRenewPreview;
}

function setRenewMode(kind, n) {
  _renewMode = { kind, n };
  document.getElementById('renewCustom').classList.toggle('hidden', kind !== 'day');
  updateRenewPreview();
}

function computeRenewExpiry() {
  if (!_renewBase) return null;
  if (_renewMode.kind === 'month') return addMonths(_renewBase, _renewMode.n);
  if (_renewMode.kind === 'year') return addYears(_renewBase, _renewMode.n);
  if (_renewMode.kind === 'day') {
    const days = parseInt(document.getElementById('renewCustomDaysInput').value);
    if (!days || days < 1) return null;
    return new Date(_renewBase.getTime() + days * 86400000);
  }
  return null;
}

function updateRenewPreview() {
  const exp = computeRenewExpiry();
  const p = document.getElementById('renewPreview');
  if (!exp) { p.textContent = 'Új lejárat: -'; return; }
  const label = _renewMode.kind === 'month' ? '+' + _renewMode.n + ' hónap'
    : _renewMode.kind === 'year' ? '+' + _renewMode.n + ' év'
    : '+' + (parseInt(document.getElementById('renewCustomDaysInput').value) || 0) + ' nap';
  p.innerHTML = label + ' → <strong style="color:var(--green)">' + exp.toLocaleDateString('hu-HU') + '</strong>';
}

async function saveRenew() {
  const key = document.getElementById('renewKey').value;
  const exp = computeRenewExpiry();
  if (!exp) { alert('Egyedi módnál add meg a napok számát.'); return; }
  const body = { expiresAt: exp.toISOString() };
  const newPlan = document.getElementById('renewPlanSelect').value;
  if (newPlan) body.subscriptionPlan = newPlan;
  const note = document.getElementById('renewNote').value.trim();
  if (note) body.paymentNote = note;
  const data = await api('/licenses/' + key, { method:'PUT', body: JSON.stringify(body) });
  if (data.error) { alert('Hiba: ' + data.error); return; }
  closeModal('renewModal');
  fetchLicenses();
}

async function purgeLicense(key, email) {
  if (!confirm('VÉGLEGES TÖRLÉS\\n\\nFelhasználó: ' + email + '\\nLicenc: ' + key + '\\n\\nA licenc teljesen eltávolításra kerül a rendszerből, és az e-mail címmel újra lehet regisztrálni. Ez nem visszavonható!\\n\\nBiztosan folytatod?')) return;
  const confirmEmail = prompt('Megerősítéshez írd be a felhasználó e-mail címét:');
  if (confirmEmail !== email) { alert('Az e-mail nem egyezik. Törlés megszakítva.'); return; }
  const data = await api('/licenses/' + key + '/permanent', { method:'DELETE' });
  if (data.error) { alert('Hiba: ' + data.error); return; }
  alert('Licenc véglegesen törölve. Az e-mail címmel újra lehet regisztrálni.');
  fetchLicenses();
}
</script>
</body>
</html>`;
}
