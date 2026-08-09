#!/bin/bash

echo "Installing dependencies..."
npm install

chmod +x dev.sh backup.sh

echo "Done. Run ./dev.sh to start the dev server."
