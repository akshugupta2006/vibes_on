#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  VIBE_ON — Start server + Ngrok Tunnel (Permanent URL)
#  Usage: npm run tunnel
# ═══════════════════════════════════════════════════════════

set -e

PORT=${PORT:-3000}
DOMAIN="pavilion-guise-overarch.ngrok-free.dev"
URL="https://${DOMAIN}"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

echo ""
echo -e "${BOLD}${CYAN}  🎵  VIBE_ON — Starting up...${RESET}"
echo ""

# ── 1. Check deps ─────────────────────────────────────────
if ! command -v ngrok &>/dev/null; then
  echo -e "${YELLOW}  ⚠️  ngrok not found. Installing via brew...${RESET}"
  brew install ngrok
fi

if ! command -v node &>/dev/null; then
  echo "❌  Node.js not found. Install from nodejs.org"; exit 1
fi

# ── 2. Start Node server in background ───────────────────
echo -e "${GREEN}  ▶  Starting Node server on port ${PORT}...${RESET}"
node server/index.js &
NODE_PID=$!

# Wait for server to be ready
sleep 2
if ! kill -0 $NODE_PID 2>/dev/null; then
  echo "❌  Node server failed to start. Check logs above."; exit 1
fi
echo -e "${GREEN}  ✅  Server running (PID: ${NODE_PID})${RESET}"

# ── 3. Start Ngrok tunnel ─────────────────────────────────
echo ""
echo -e "${CYAN}  🌐  Starting Ngrok Tunnel...${RESET}"
echo -e "${BOLD}${GREEN}  ╔══════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${GREEN}  ║  📱  VIBE_ON is permanently live at:             ║${RESET}"
echo -e "${BOLD}${CYAN}  ║  ${URL}  ║${RESET}"
echo -e "${BOLD}${GREEN}  ║                                                  ║${RESET}"
echo -e "${BOLD}${GREEN}  ║  Open on phone → tap Share → Add to Home Screen  ║${RESET}"
echo -e "${BOLD}${GREEN}  ╚══════════════════════════════════════════════════╝${RESET}"
echo ""

# Print QR code if python3 is available
if command -v python3 &>/dev/null; then
  python3 -c "
import urllib.request
url = 'https://api.qrserver.com/v1/create-qr-code/?size=1x1&data=${URL}'
print('  📲  Scan QR at: ${URL}')
" 2>/dev/null || true
fi
echo ""

# Cleanup handler — kill node when tunnel exits
cleanup() {
  echo ""
  echo -e "${CYAN}  🛑  Shutting down VIBE_ON...${RESET}"
  kill $NODE_PID 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

# Run ngrok in background without taking over the terminal screen, routing to log
ngrok http --domain=${DOMAIN} ${PORT} --log=stdout > /dev/null &
NGROK_PID=$!

# Wait for node to finish
wait $NODE_PID
kill $NGROK_PID 2>/dev/null || true
