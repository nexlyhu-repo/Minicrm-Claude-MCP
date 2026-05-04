export function getTenantSetupPageHtml(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  licenseKey: string;
  systemId: string;
  apiKey: string;
  defaultEmail?: string;
  error?: string;
}): string {
  const errorHtml = opts.error
    ? `<div class="error">${opts.error}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="hu">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MiniCRM MCP - Cégadmin beállítása</title>
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
            max-width: 460px;
        }
        h1 { font-size: 22px; font-weight: 700; margin-bottom: 6px; letter-spacing: -0.02em; }
        h1 span { color: #4f7df5; }
        .subtitle { font-size: 14px; color: #8890a4; margin-bottom: 22px; line-height: 1.55; }
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
        .badge {
            display: inline-block;
            background: linear-gradient(135deg, #c8702a, #e8a040);
            color: #0a0c10;
            padding: 3px 9px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.4px;
            text-transform: uppercase;
            margin-right: 6px;
        }
        label { display: block; font-size: 13px; font-weight: 500; color: #8890a4; margin-bottom: 6px; margin-top: 14px; }
        input {
            width: 100%; padding: 12px 14px;
            background: #0a0c10; border: 1px solid #1e2330;
            border-radius: 8px; color: #e8eaf0;
            font-family: 'DM Sans', sans-serif; font-size: 14px;
            outline: none; transition: border-color 0.2s;
        }
        input:focus { border-color: #4f7df5; }
        input::placeholder { color: #555d74; }
        .hint { font-size: 12px; color: #555d74; margin-top: 4px; }
        button.submit {
            width: 100%; padding: 14px;
            background: #4f7df5; color: #fff; border: none; border-radius: 10px;
            font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600;
            cursor: pointer; transition: background 0.2s; margin-top: 20px;
        }
        button.submit:hover { background: #6b93ff; }
        button.submit:disabled { opacity: 0.5; cursor: not-allowed; }
        .error {
            background: #f0606015; border: 1px solid #f0606040;
            color: #f06060; padding: 10px 14px; border-radius: 8px;
            font-size: 13px; margin-bottom: 16px;
        }
    </style>
</head>
<body>
    <div class="card">
        <h1>Mini<span>CRM</span> MCP</h1>
        <div class="subtitle"><span class="badge">Új tenant</span> Cégadmin beállítása</div>
        ${errorHtml}
        <div class="info">
            <strong>Te leszel ennek a MiniCRM fióknak a Claude-admin felelőse.</strong><br>
            Az itt megadott jelszóval később egyedül te léphetsz be a csapat-panelbe (<code>/team</code>), ahol a többi alkalmazott licencét és modul-jogosultságát kezelheted. Ezt a jelszót <strong>NE</strong> add ki az alkalmazottaknak — ők a saját licenckulcsukkal Claude-ban dolgoznak, de a /team admin panelhez nem férnek hozzá.
        </div>
        <form method="POST" action="/authorize/setup-tenant" id="setupForm">
            <input type="hidden" name="client_id" value="${escapeHtml(opts.clientId)}">
            <input type="hidden" name="redirect_uri" value="${escapeHtml(opts.redirectUri)}">
            <input type="hidden" name="state" value="${escapeHtml(opts.state)}">
            <input type="hidden" name="code_challenge" value="${escapeHtml(opts.codeChallenge)}">
            <input type="hidden" name="code_challenge_method" value="${escapeHtml(opts.codeChallengeMethod)}">
            <input type="hidden" name="license_key" value="${escapeHtml(opts.licenseKey)}">
            <input type="hidden" name="system_id" value="${escapeHtml(opts.systemId)}">
            <input type="hidden" name="api_key" value="${escapeHtml(opts.apiKey)}">

            <label for="admin_email">Admin email</label>
            <input type="email" id="admin_email" name="admin_email" placeholder="te@ceg.hu" value="${escapeHtml(opts.defaultEmail || '')}" required>
            <div class="hint">Ide küldhetjük az értesítéseket (jelszó-reset stb.).</div>

            <label for="admin_password">Admin jelszó</label>
            <input type="password" id="admin_password" name="admin_password" placeholder="legalább 8 karakter" minlength="8" required>
            <div class="hint">Csak Te ismered. Nem osztható meg az alkalmazottakkal.</div>

            <label for="admin_password2">Jelszó megerősítése</label>
            <input type="password" id="admin_password2" name="admin_password2" placeholder="írd be újra" minlength="8" required>

            <button type="submit" class="submit" id="submitBtn">Mentés és tovább</button>
        </form>
    </div>
    <script>
        const form = document.getElementById('setupForm');
        form.addEventListener('submit', (e) => {
            const p1 = document.getElementById('admin_password').value;
            const p2 = document.getElementById('admin_password2').value;
            if (p1 !== p2) { e.preventDefault(); alert('A jelszavak nem egyeznek.'); return; }
            document.getElementById('submitBtn').disabled = true;
            document.getElementById('submitBtn').textContent = 'Mentés...';
        });
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
