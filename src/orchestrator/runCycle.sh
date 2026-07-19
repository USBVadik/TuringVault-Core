#!/bin/bash
# TuringVault Trading Loop — runs integrated orchestrator with real execution
cd /root/TuringVault-Core
source .env
export ORCHESTRATOR_MODE=autonomous
# Legacy VPS runs must never fill Pinata simply because .env contains a JWT.
# Explicit values in .env still win for a deliberate one-off pinning run.
export PINATA_UPLOAD_MODE="${PINATA_UPLOAD_MODE:-anchor-only}"
export AGENT_CARD_AUTO_UPDATE_ENABLED="${AGENT_CARD_AUTO_UPDATE_ENABLED:-false}"
node src/orchestrator/integratedOrchestrator.js autonomous 2>&1
