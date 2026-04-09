export function getLoginPageHtml(
  clientId: string,
  redirectUri: string,
  state: string,
  codeChallenge: string,
  codeChallengeMethod: string,
  error?: string
): string {
  const errorHtml = error
    ? `<div class="error">${error}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="hu">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MiniCRM MCP - Bejelentkezés</title>
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
            padding: 40px;
            width: 100%;
            max-width: 420px;
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
            margin-bottom: 28px;
        }
        label {
            display: block;
            font-size: 13px;
            font-weight: 500;
            color: #8890a4;
            margin-bottom: 6px;
        }
        input {
            width: 100%;
            padding: 12px 14px;
            background: #0a0c10;
            border: 1px solid #1e2330;
            border-radius: 8px;
            color: #e8eaf0;
            font-family: 'DM Sans', sans-serif;
            font-size: 14px;
            margin-bottom: 16px;
            outline: none;
            transition: border-color 0.2s;
        }
        input:focus { border-color: #4f7df5; }
        input::placeholder { color: #555d74; }
        .hint {
            font-size: 12px;
            color: #555d74;
            margin-top: -12px;
            margin-bottom: 16px;
        }
        button {
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
        button:hover { background: #6b93ff; }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        .error {
            background: #f0606015;
            border: 1px solid #f0606040;
            color: #f06060;
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 13px;
            margin-bottom: 16px;
        }
        .footer {
            text-align: center;
            font-size: 12px;
            color: #555d74;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="card">
        <h1>Mini<span>CRM</span> MCP</h1>
        <div class="subtitle">Claude AI integráció bejelentkezés</div>
        ${errorHtml}
        <form method="POST" action="/authorize" id="loginForm">
            <input type="hidden" name="client_id" value="${clientId}">
            <input type="hidden" name="redirect_uri" value="${redirectUri}">
            <input type="hidden" name="state" value="${state}">
            <input type="hidden" name="code_challenge" value="${codeChallenge}">
            <input type="hidden" name="code_challenge_method" value="${codeChallengeMethod}">

            <label for="license_key">Licenckulcs</label>
            <input type="text" id="license_key" name="license_key" placeholder="lic_..." required>

            <label for="system_id">MiniCRM System ID</label>
            <input type="text" id="system_id" name="system_id" placeholder="pl. 53832" required>
            <div class="hint">A böngésző címsorában: r3.minicrm.hu/<strong>XXXXX</strong>/...</div>

            <label for="api_key">MiniCRM API kulcs</label>
            <input type="password" id="api_key" name="api_key" placeholder="API kulcs" required>
            <div class="hint">Beállítások &rarr; Rendszer &rarr; API kulcs</div>

            <button type="submit" id="submitBtn">Csatlakozás</button>
        </form>
        <div class="footer">Nexly AI &middot; MiniCRM MCP</div>
    </div>
    <script>
        document.getElementById('loginForm').addEventListener('submit', function() {
            document.getElementById('submitBtn').disabled = true;
            document.getElementById('submitBtn').textContent = 'Ellenőrzés...';
        });
    </script>
</body>
</html>`;
}
