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
  .badge.trial { background:#4f7df520; color:var(--accent); }
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

  <table>
    <thead><tr>
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

  <div id="detailPanel" class="detail-panel hidden">
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

<script>
let SECRET = '';
const API = '/admin/api';

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

async function fetchLicenses() {
  try {
    const data = await api('/licenses');
    if (data.error) { alert(data.error); return; }
    document.getElementById('loginBar').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('connStatus').textContent = 'Csatlakozva';
    document.getElementById('connStatus').style.color = '#3dd68c';
    renderLicenses(data.licenses);
  } catch(e) { alert('Hiba: ' + e.message); }
}

function renderLicenses(licenses) {
  const now = new Date();
  let active = 0, inactive = 0, totalCalls = 0;
  licenses.forEach(l => {
    totalCalls += l.total_calls || 0;
    const expired = l.expiresAt && new Date(l.expiresAt) < now;
    if (l.active && !expired) active++; else inactive++;
  });
  document.getElementById('totalLic').textContent = licenses.length;
  document.getElementById('activeLic').textContent = active;
  document.getElementById('inactiveLic').textContent = inactive;
  document.getElementById('totalCalls').textContent = totalCalls;

  const tbody = document.getElementById('licTable');
  tbody.innerHTML = licenses.map(l => {
    const expired = l.expiresAt && new Date(l.expiresAt) < now;
    const isTrial = l.note && l.note.startsWith('trial:');
    let badge = '';
    if (!l.active) badge = '<span class="badge inactive">Visszavont</span>';
    else if (expired) badge = '<span class="badge expired">Lejárt</span>';
    else if (isTrial) badge = '<span class="badge trial">Próba</span>';
    else badge = '<span class="badge active">Aktív</span>';

    const userName = l.note ? (isTrial ? l.note.replace('trial: ','').split('|')[0].trim() : l.note) : '-';
    const lastUsed = l.last_used ? new Date(l.last_used+'Z').toLocaleString('hu-HU') : '-';
    const expiry = l.expiresAt ? new Date(l.expiresAt).toLocaleDateString('hu-HU') : 'Végtelen';

    return '<tr>' +
      '<td>' + badge + '</td>' +
      '<td>' + esc(userName) + '</td>' +
      '<td style="font-size:12px;color:var(--text2)">' + esc(l.email) + '</td>' +
      '<td class="key-cell" onclick="navigator.clipboard.writeText(\\'' + l.key + '\\');this.style.color=\\'#3dd68c\\';setTimeout(()=>this.style.color=\\'\\',1000)" title="Kattints a másoláshoz">' + esc(l.key) + '</td>' +
      '<td style="font-size:12px">' + (l.boundSystemId || '-') + '</td>' +
      '<td style="font-weight:600">' + (l.total_calls || 0) + '</td>' +
      '<td style="font-size:12px;color:var(--text2)">' + lastUsed + '</td>' +
      '<td style="font-size:12px">' + expiry + '</td>' +
      '<td class="actions">' +
        '<button class="btn-sm" onclick="showDetail(\\'' + l.key + '\\',\\'' + esc(userName) + '\\')">Részletek</button>' +
        '<button class="btn-sm" onclick="openEditModal(\\'' + l.key + '\\',\\'' + esc(l.note||'') + '\\',\\'' + esc(l.email) + '\\',\\'' + (l.expiresAt||'') + '\\')">Szerk.</button>' +
        (l.active ?
          '<button class="btn-sm danger" onclick="revokeLicense(\\'' + l.key + '\\')">Tiltás</button>' :
          '<button class="btn-sm green" onclick="reactivateLicense(\\'' + l.key + '\\')">Aktiválás</button>') +
        '<button class="btn-sm danger" onclick="purgeLicense(\\'' + l.key + '\\',\\'' + esc(l.email) + '\\')">Törlés</button>' +
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
