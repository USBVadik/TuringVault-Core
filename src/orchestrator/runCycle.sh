#!/bin/bash
# TuringVault Trading Loop — runs integrated orchestrator with real execution
cd /root/TuringVault-Core
source .env
export ORCHESTRATOR_MODE=autonomous
node src/orchestrator/integratedOrchestrator.js autonomous 2>&1
