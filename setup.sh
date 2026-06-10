#!/bin/bash
# First-time setup script for the AppEngg platform (Ubuntu/Debian)

set -e

echo "=== AppEngg Setup ==="

# ── System packages ────────────────────────────────────────────
echo "[1/4] Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y sshpass

# ── Python backend ─────────────────────────────────────────────
echo "[2/4] Installing Python dependencies..."
cd backend
python3 -m venv venv 2>/dev/null || true
source venv/bin/activate
pip install -q -r requirements.txt
deactivate
cd ..

# ── Node frontend ──────────────────────────────────────────────
echo "[3/4] Installing Node dependencies..."
cd frontend
npm install
cd ..

# ── Done ───────────────────────────────────────────────────────
echo ""
echo "[4/4] Setup complete."
echo ""
echo "To start the app:"
echo "  Backend : cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000"
echo "  Frontend: cd frontend && npm run dev"
