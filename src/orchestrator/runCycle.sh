#!/bin/bash
cd /root/turingvault
source .env
node src/orchestrator/multiAgentLoop.js 2>&1
