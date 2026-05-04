interface Category {
  id: number;
  name: string;
  type?: string;
}

export function getModuleSelectionPageHtml(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  licenseKey: string;
  systemId: string;
  apiKey: string;
  categories: Category[];
  selectedIds: number[] | null;
  error?: string;
}): string {
  const errorHtml = opts.error
    ? `<div class="error">${opts.error}</div>`
    : "";

  const selectedSet = new Set(opts.selectedIds ?? []);
  const noRestriction = opts.selectedIds === null || opts.selectedIds.length === 0;

  const groupedRows = opts.categories
    .map((cat) => {
      const checked = noRestriction ? false : selectedSet.has(cat.id);
      return `
        <label class="cat-row${checked ? ' checked' : ''}">
          <input type="checkbox" name="category_id" value="${cat.id}"${checked ? " checked" : ""}>
          <span class="cat-name">${escapeHtml(cat.name)}</span>
          <span class="cat-id">#${cat.id}</span>
        </label>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="hu">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MiniCRM MCP - Modulok kiválasztása</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'DM Sans', sans-serif;
            background: #0a0c10;
            color: #e8eaf0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }
        .card {
            background: #12151c;
            border: 1px solid #1e2330;
            border-radius: 16px;
            padding: 36px;
            width: 100%;
            max-width: 540px;
        }
        h1 {
            font-size: 22px;
            font-weight: 700;
            margin-bottom: 6px;
            letter-spacing: -0.02em;
        }
        h1 span { color: #4f7df5; }
        .subtitle {
            font-size: 14px;
            color: #8890a4;
            margin-bottom: 22px;
            line-height: 1.55;
        }
        .info {
            background: #4f7df515;
            border: 1px solid #4f7df540;
            color: #a5bff5;
            padding: 12px 14px;
            border-radius: 10px;
            font-size: 13px;
            line-height: 1.55;
            margin-bottom: 20px;
        }
        .toolbar {
            display: flex;
            gap: 8px;
            margin-bottom: 12px;
            flex-wrap: wrap;
        }
        .toolbar button {
            background: #1e2330;
            color: #c0c8de;
            border: 1px solid #2a3040;
            padding: 8px 14px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            font-family: 'DM Sans', sans-serif;
        }
        .toolbar button:hover { border-color: #4f7df5; color: #4f7df5; }
        .cat-list {
            background: #0a0c10;
            border: 1px solid #1e2330;
            border-radius: 12px;
            max-height: 360px;
            overflow-y: auto;
            padding: 6px;
            margin-bottom: 16px;
        }
        .cat-row {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.15s;
            user-select: none;
        }
        .cat-row:hover { background: #1a1f2b; }
        .cat-row.checked { background: #4f7df515; }
        .cat-row input { margin: 0; cursor: pointer; }
        .cat-name { flex: 1; font-size: 14px; color: #e8eaf0; }
        .cat-id { font-size: 11px; color: #555d74; font-family: monospace; }
        .empty {
            padding: 24px;
            text-align: center;
            color: #555d74;
            font-size: 13px;
        }
        button.submit {
            width: 100%;
            padding: 14px;
            background: #4f7df5;
            color: #fff;
            border: none;
            border-radius: 10px;
            font-family: 'DM Sans', sans-serif;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
            margin-top: 8px;
        }
        button.submit:hover { background: #6b93ff; }
        button.submit:disabled { opacity: 0.5; cursor: not-allowed; }
        .secondary {
            background: transparent !important;
            color: #8890a4 !important;
            font-size: 13px !important;
            margin-top: 8px;
            padding: 10px !important;
            text-decoration: underline;
        }
        .secondary:hover { color: #4f7df5 !important; background: transparent !important; }
        .error {
            background: #f0606015;
            border: 1px solid #f0606040;
            color: #f06060;
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 13px;
            margin-bottom: 16px;
        }
        .selection-info {
            font-size: 12px;
            color: #8890a4;
            margin-bottom: 8px;
            text-align: right;
        }
        .selection-info strong { color: #4f7df5; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Mini<span>CRM</span> MCP</h1>
        <div class="subtitle">Válaszd ki, mely <strong>modulokhoz</strong> férhessen hozzá Claude. A többi modul láthatatlan marad — gyorsabb keresés, kontrolláltabb adathozzáférés.</div>
        ${errorHtml}
        <div class="info">
            <strong>Tipp:</strong> Csak azokat jelöld be, amiket a napi munkádhoz használsz. Ha utólag módosítani szeretnéd, lépj be újra Claude-ból.
        </div>
        <form method="POST" action="/authorize/select-modules" id="modulesForm">
            <input type="hidden" name="client_id" value="${escapeHtml(opts.clientId)}">
            <input type="hidden" name="redirect_uri" value="${escapeHtml(opts.redirectUri)}">
            <input type="hidden" name="state" value="${escapeHtml(opts.state)}">
            <input type="hidden" name="code_challenge" value="${escapeHtml(opts.codeChallenge)}">
            <input type="hidden" name="code_challenge_method" value="${escapeHtml(opts.codeChallengeMethod)}">
            <input type="hidden" name="license_key" value="${escapeHtml(opts.licenseKey)}">
            <input type="hidden" name="system_id" value="${escapeHtml(opts.systemId)}">
            <input type="hidden" name="api_key" value="${escapeHtml(opts.apiKey)}">

            <div class="toolbar">
                <button type="button" onclick="selectAll(true)">Mind kiválaszt</button>
                <button type="button" onclick="selectAll(false)">Egyiket sem</button>
            </div>
            <div class="selection-info">Kiválasztva: <strong id="selectedCount">0</strong> / ${opts.categories.length}</div>
            <div class="cat-list">
                ${opts.categories.length ? groupedRows : '<div class="empty">Nincs elérhető modul a fiókban.</div>'}
            </div>

            <button type="submit" class="submit" id="submitBtn">Mentés és csatlakozás</button>
            <button type="submit" name="all_modules" value="1" class="submit secondary">Mégis minden modul (nincs korlátozás)</button>
        </form>
    </div>
    <script>
        const form = document.getElementById('modulesForm');
        const countEl = document.getElementById('selectedCount');
        const checkboxes = () => Array.from(document.querySelectorAll('input[name="category_id"]'));
        function updateCount() {
            const n = checkboxes().filter(c => c.checked).length;
            countEl.textContent = n;
        }
        function selectAll(state) {
            checkboxes().forEach(c => { c.checked = state; c.closest('.cat-row').classList.toggle('checked', state); });
            updateCount();
        }
        document.querySelectorAll('.cat-row').forEach(row => {
            const input = row.querySelector('input');
            input.addEventListener('change', () => {
                row.classList.toggle('checked', input.checked);
                updateCount();
            });
        });
        form.addEventListener('submit', () => {
            document.getElementById('submitBtn').disabled = true;
            document.getElementById('submitBtn').textContent = 'Mentés...';
        });
        updateCount();
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
