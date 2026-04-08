#!/bin/bash
# MiniCRM MCP Telepito - macOS
# Dupla kattintassal indithato

clear
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   MiniCRM MCP - Telepito (macOS)         ║"
echo "║   Claude Desktop integraciohoz           ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "HIBA: Node.js nincs telepitve!"
    echo ""
    echo "Telepitse a Node.js-t innen: https://nodejs.org"
    echo "Majd futtassa ujra ezt a telepitot."
    echo ""
    read -p "Nyomjon Entert a kilepeshez..."
    exit 1
fi

echo "Node.js talalhato: $(node --version)"
echo ""

# Collect credentials
read -p "Licenckulcs (lic_...): " LICENSE_KEY
if [[ ! "$LICENSE_KEY" == lic_* ]]; then
    echo "HIBA: A licenckulcsnak 'lic_' elotaggal kell kezdodnie."
    read -p "Nyomjon Entert a kilepeshez..."
    exit 1
fi

# Validate license
echo ""
echo "Licenc ellenorzese..."
VALIDATE_RESPONSE=$(curl -s -X POST https://minicrm-license.nexlyhu.workers.dev/validate \
    -H "Content-Type: application/json" \
    -d "{\"key\":\"$LICENSE_KEY\"}")

if echo "$VALIDATE_RESPONSE" | grep -q '"valid":true'; then
    echo "Licenc ervenyes!"
else
    echo "HIBA: Ervenytelen licenckulcs."
    echo "Valasz: $VALIDATE_RESPONSE"
    read -p "Nyomjon Entert a kilepeshez..."
    exit 1
fi

echo ""
echo "A MiniCRM System ID megtalalhato a bongeszo cimsoraban:"
echo "  r3.minicrm.hu/XXXXX/..."
echo ""
read -p "MiniCRM System ID: " SYSTEM_ID

echo ""
echo "Az API kulcsot a MiniCRM Beallitasok > Rendszer oldalon talalja."
echo ""
read -p "MiniCRM API kulcs: " API_KEY

if [ -z "$SYSTEM_ID" ] || [ -z "$API_KEY" ]; then
    echo "HIBA: Minden mezo kitoltese kotelezo."
    read -p "Nyomjon Entert a kilepeshez..."
    exit 1
fi

# Write config
CONFIG_DIR="$HOME/Library/Application Support/Claude"
CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"

mkdir -p "$CONFIG_DIR"

if [ -f "$CONFIG_FILE" ]; then
    # Check if file has content
    if [ -s "$CONFIG_FILE" ]; then
        # Use node to safely merge JSON
        node -e "
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf-8'));
if (!config.mcpServers) config.mcpServers = {};
config.mcpServers.minicrm = {
    command: 'npx',
    args: ['-y', 'minicrm-mcp'],
    env: {
        MINICRM_LICENSE_KEY: '$LICENSE_KEY',
        MINICRM_SYSTEM_ID: '$SYSTEM_ID',
        MINICRM_API_KEY: '$API_KEY'
    }
};
fs.writeFileSync('$CONFIG_FILE', JSON.stringify(config, null, 2));
"
    else
        echo "{\"mcpServers\":{\"minicrm\":{\"command\":\"npx\",\"args\":[\"-y\",\"minicrm-mcp\"],\"env\":{\"MINICRM_LICENSE_KEY\":\"$LICENSE_KEY\",\"MINICRM_SYSTEM_ID\":\"$SYSTEM_ID\",\"MINICRM_API_KEY\":\"$API_KEY\"}}}}" | node -e "process.stdin.on('data',d=>require('fs').writeFileSync('$CONFIG_FILE',JSON.stringify(JSON.parse(d),null,2)))"
    fi
else
    echo "{\"mcpServers\":{\"minicrm\":{\"command\":\"npx\",\"args\":[\"-y\",\"minicrm-mcp\"],\"env\":{\"MINICRM_LICENSE_KEY\":\"$LICENSE_KEY\",\"MINICRM_SYSTEM_ID\":\"$SYSTEM_ID\",\"MINICRM_API_KEY\":\"$API_KEY\"}}}}" | node -e "process.stdin.on('data',d=>require('fs').writeFileSync('$CONFIG_FILE',JSON.stringify(JSON.parse(d),null,2)))"
fi

echo ""
echo "════════════════════════════════════════════"
echo "  Sikeres telepites!"
echo "  Konfiguracio mentve: $CONFIG_FILE"
echo ""
echo "  Kovetkezo lepes:"
echo "  Inditsa ujra a Claude Desktop alkalmazast."
echo "════════════════════════════════════════════"
echo ""
read -p "Nyomjon Entert a kilepeshez..."
