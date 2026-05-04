interface License {
  key: string;
  active: boolean;
  email: string;
  createdAt: string;
  expiresAt: string | null;
  note?: string;
  boundSystemId?: string;
  allowedCategoryIds?: number[] | null;
}

interface Category {
  id: number;
  name: string;
}

const SHARED_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --bg: #0a0c10; --card: #12151c; --card-2: #181c26;
    --border: #1e2330; --border-light: #2a3040;
    --text: #e8eaf0; --text2: #8890a4; --dim: #555d74;
    --accent: #4f7df5; --accent-bright: #6b93ff;
    --green: #3dd68c; --amber: #e8a040; --red: #f06060;
  }
  body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
  .header { padding: 18px 28px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
  .header h1 { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }
  .header h1 span { color: var(--accent); }
  .container { max-width: 1100px; margin: 0 auto; padding: 28px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 26px; }
  .badge { display: inline-block; padding: 3px 9px; border-radius: 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.4px; }
  .badge.admin { background: linear-gradient(135deg, #c8702a, #e8a040); color: #0a0c10; }
  .badge.employee { background: #4f7df520; color: var(--accent-bright); }
  .badge.active { background: #3dd68c20; color: var(--green); }
  .badge.inactive { background: #f0606020; color: var(--red); }
  .badge.expired { background: #e8a04020; color: var(--amber); }
  .btn { padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid var(--border); background: transparent; color: var(--text2); font-family: 'DM Sans', sans-serif; transition: all 0.15s; }
  .btn:hover { border-color: var(--accent); color: var(--accent); }
  .btn-primary { background: var(--accent); color: #fff; border: none; }
  .btn-primary:hover { background: var(--accent-bright); color: #fff; }
  .btn-sm { padding: 6px 12px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 12px 14px; font-size: 11px; color: var(--dim); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--border); background: var(--card-2); font-weight: 600; }
  td { padding: 14px; font-size: 13px; border-bottom: 1px solid var(--border); vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #ffffff05; }
  .empty { text-align: center; padding: 40px; color: var(--dim); font-size: 14px; }
  .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 100; align-items: center; justify-content: center; }
  .modal-overlay.open { display: flex; }
  .modal { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 28px; width: 520px; max-width: 92vw; max-height: 90vh; overflow-y: auto; }
  .modal h3 { font-size: 17px; margin-bottom: 6px; }
  .modal .modal-sub { font-size: 13px; color: var(--text2); margin-bottom: 18px; }
  .modal-cat-list { background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 6px; max-height: 320px; overflow-y: auto; margin-bottom: 16px; }
  .modal-cat-row { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 7px; cursor: pointer; transition: background 0.12s; }
  .modal-cat-row:hover { background: #1a1f2b; }
  .modal-cat-row.checked { background: #4f7df515; }
  .modal-cat-row input { margin: 0; cursor: pointer; }
  .modal-cat-row .name { flex: 1; }
  .modal-cat-row .id { font-size: 11px; color: var(--dim); font-family: monospace; }
  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 18px; }
  .modal-toolbar { display: flex; gap: 6px; margin-bottom: 10px; }
`;

export function getTeamLoginPageHtml(opts: { error?: string; defaultSystemId?: string } = {}): string {
  const errorHtml = opts.error ? `<div class="error">${escapeHtml(opts.error)}</div>` : "";
  return `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MiniCRM MCP - Csapat admin</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  ${SHARED_STYLES}
  body { display: flex; align-items: center; justify-content: center; padding: 24px; }
  .login-card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 40px; width: 100%; max-width: 420px; }
  .login-card h1 { font-size: 22px; font-weight: 700; margin-bottom: 6px; letter-spacing: -0.02em; }
  .login-card .subtitle { font-size: 14px; color: var(--text2); margin-bottom: 24px; }
  label { display: block; font-size: 13px; font-weight: 500; color: var(--text2); margin-bottom: 6px; margin-top: 14px; }
  input { width: 100%; padding: 12px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color 0.2s; }
  input:focus { border-color: var(--accent); }
  input::placeholder { color: var(--dim); }
  .hint { font-size: 12px; color: var(--dim); margin-top: 4px; }
  button.submit { width: 100%; padding: 14px; background: var(--accent); color: #fff; border: none; border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s; margin-top: 22px; }
  button.submit:hover { background: var(--accent-bright); }
  .error { background: #f0606015; border: 1px solid #f0606040; color: var(--red); padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; }
</style>
</head>
<body>
  <div class="login-card">
    <h1>Mini<span style="color:var(--accent)">CRM</span> MCP — Csapat admin</h1>
    <div class="subtitle">Lépj be a System ID-val és az admin jelszóval.</div>
    ${errorHtml}
    <form method="POST" action="/team/login">
      <label for="system_id">MiniCRM System ID</label>
      <input type="text" id="system_id" name="system_id" placeholder="pl. 53832" value="${escapeHtml(opts.defaultSystemId || '')}" required>
      <div class="hint">A böngésző címsorában: r3.minicrm.hu/<strong>XXXXX</strong>/...</div>

      <label for="admin_password">Admin jelszó</label>
      <input type="password" id="admin_password" name="admin_password" placeholder="Cégadmin jelszó" required>
      <div class="hint">Ezt az első bejelentkezéskor állítottad be Claude-on keresztül.</div>

      <button type="submit" class="submit">Belépés</button>
    </form>
  </div>
</body>
</html>`;
}

export function getTeamDashboardHtml(opts: {
  systemId: string;
  adminEmail?: string;
  adminLicenseKey: string | null;
  licenses: License[];
  categories: Category[];
}): string {
  const now = new Date();
  const sortedLicenses = [...opts.licenses].sort((a, b) => {
    if (a.key === opts.adminLicenseKey) return -1;
    if (b.key === opts.adminLicenseKey) return 1;
    return a.email.localeCompare(b.email, "hu");
  });

  const rows = sortedLicenses.map((l) => {
    const expired = l.expiresAt && new Date(l.expiresAt) < now;
    const isAdmin = l.key === opts.adminLicenseKey;
    const isTrial = l.note && l.note.startsWith("trial:");

    let statusBadge = "";
    if (!l.active) statusBadge = '<span class="badge inactive">Visszavont</span>';
    else if (expired) statusBadge = '<span class="badge expired">Lejárt</span>';
    else statusBadge = '<span class="badge active">Aktív</span>';

    const roleBadge = isAdmin
      ? '<span class="badge admin">Cégadmin</span>'
      : '<span class="badge employee">Alkalmazott</span>';

    const userName = isTrial
      ? (l.note || "").replace("trial: ", "").split("|")[0].trim() || l.email
      : (l.note || l.email);

    const allowedSummary = l.allowedCategoryIds === null || l.allowedCategoryIds === undefined
      ? "<em style=\"color:var(--text2)\">Minden modul</em>"
      : l.allowedCategoryIds.length === 0
        ? "<em style=\"color:var(--amber)\">Egyik sem (módosítsd)</em>"
        : l.allowedCategoryIds
            .map((id) => {
              const cat = opts.categories.find((c) => c.id === id);
              return cat ? escapeHtml(cat.name) : `#${id}`;
            })
            .join(", ");

    const expiryText = l.expiresAt
      ? new Date(l.expiresAt).toLocaleDateString("hu-HU")
      : "Végtelen";

    return `<tr>
      <td>${roleBadge}</td>
      <td><strong>${escapeHtml(userName)}</strong><div style="font-size:12px;color:var(--text2);margin-top:2px">${escapeHtml(l.email)}</div></td>
      <td>${statusBadge}</td>
      <td style="font-size:12px">${allowedSummary}</td>
      <td style="font-size:12px;color:var(--text2)">${expiryText}</td>
      <td>
        <button class="btn btn-sm" onclick='openModulesModal(${JSON.stringify({ key: l.key, name: userName, allowed: l.allowedCategoryIds ?? null })})'>Modulok</button>
      </td>
    </tr>`;
  }).join("");

  const catCheckboxData = JSON.stringify(opts.categories);

  return `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MiniCRM MCP - Csapat</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${SHARED_STYLES}</style>
</head>
<body>

<div class="header">
  <h1>Mini<span>CRM</span> MCP — Csapat (System ID: ${escapeHtml(opts.systemId)})</h1>
  <div style="display:flex;gap:8px;align-items:center">
    ${opts.adminEmail ? `<span style="font-size:12px;color:var(--text2)">${escapeHtml(opts.adminEmail)}</span>` : ''}
    <form method="POST" action="/team/logout" style="display:inline"><button class="btn btn-sm" type="submit">Kijelentkezés</button></form>
  </div>
</div>

<div class="container">
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <h2 style="font-size:16px;font-weight:700">Licencek (${sortedLicenses.length})</h2>
      <span style="font-size:12px;color:var(--text2)">A "Modulok" gombbal állíthatod be, mely MiniCRM modulokhoz férhet hozzá az adott alkalmazott Claude-ban.</span>
    </div>

    ${sortedLicenses.length === 0 ? '<div class="empty">Nincs licenc kötve ehhez a tenanthoz.</div>' : `
    <table>
      <thead><tr>
        <th>Szerep</th>
        <th>Felhasználó</th>
        <th>Állapot</th>
        <th>Engedélyezett modulok</th>
        <th>Lejárat</th>
        <th></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`}
  </div>
</div>

<!-- Modules Modal -->
<div class="modal-overlay" id="modulesModal">
  <div class="modal">
    <h3 id="modulesTitle">Modulok beállítása</h3>
    <div class="modal-sub">Csak a kiválasztott modulokhoz fér hozzá Claude. Üres lista = Claude bejelentkezésre kérdezz rá.</div>
    <form method="POST" id="modulesForm">
      <input type="hidden" name="license_key" id="modules_key">
      <div class="modal-toolbar">
        <button type="button" class="btn btn-sm" onclick="modalSelectAll(true)">Mind</button>
        <button type="button" class="btn btn-sm" onclick="modalSelectAll(false)">Egyiket sem</button>
      </div>
      <div class="modal-cat-list" id="modalCatList"></div>
      <div class="modal-actions">
        <button type="button" class="btn" onclick="closeModulesModal()">Mégse</button>
        <button type="submit" name="all_modules" value="1" class="btn">Minden modul (nincs korlát)</button>
        <button type="submit" class="btn btn-primary">Mentés</button>
      </div>
    </form>
  </div>
</div>

<script>
const ALL_CATEGORIES = ${catCheckboxData};

function openModulesModal(license) {
  const modal = document.getElementById('modulesModal');
  document.getElementById('modulesTitle').textContent = 'Modulok beállítása — ' + license.name;
  document.getElementById('modules_key').value = license.key;
  document.getElementById('modulesForm').action = '/team/license/' + encodeURIComponent(license.key) + '/modules';

  const list = document.getElementById('modalCatList');
  const allowed = license.allowed;
  const isUnrestricted = allowed === null;
  const allowSet = new Set(allowed || []);
  list.innerHTML = ALL_CATEGORIES.map(cat => {
    const checked = !isUnrestricted && allowSet.has(cat.id);
    return '<label class="modal-cat-row' + (checked ? ' checked' : '') + '">' +
      '<input type="checkbox" name="category_id" value="' + cat.id + '"' + (checked ? ' checked' : '') + '>' +
      '<span class="name">' + escHtml(cat.name) + '</span>' +
      '<span class="id">#' + cat.id + '</span>' +
    '</label>';
  }).join('');
  list.querySelectorAll('.modal-cat-row').forEach(row => {
    const cb = row.querySelector('input');
    cb.addEventListener('change', () => row.classList.toggle('checked', cb.checked));
  });
  modal.classList.add('open');
}

function closeModulesModal() {
  document.getElementById('modulesModal').classList.remove('open');
}

function modalSelectAll(state) {
  document.querySelectorAll('#modalCatList input[type="checkbox"]').forEach(c => {
    c.checked = state;
    c.closest('.modal-cat-row').classList.toggle('checked', state);
  });
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
