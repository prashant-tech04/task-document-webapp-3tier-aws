#!/bin/bash
set -euxo pipefail

# ===== REPLACE THESE VALUES =====
APP_DIR="/opt/taskapp"
REPO_URL="REPLACE_WITH_YOUR_REPOSITORY_URL"
AWS_REGION="REPLACE_WITH_AWS_REGION"
DB_HOST="REPLACE_WITH_RDS_ENDPOINT"
DB_USER="REPLACE_WITH_DB_USERNAME"
DB_PASSWORD="REPLACE_WITH_DB_PASSWORD"
DB_NAME="task_manager"
S3_BUCKET="REPLACE_WITH_S3_BUCKET"
# ================================

sudo dnf update -y
sudo dnf install -y git nodejs20 npm mariadb105

sudo mkdir -p "$APP_DIR"
sudo rm -rf "$APP_DIR/backend" "$APP_DIR/database"
sudo git clone "$REPO_URL" /tmp/taskapp-source
sudo cp -r /tmp/taskapp-source/backend "$APP_DIR/"
sudo cp -r /tmp/taskapp-source/database "$APP_DIR/"
sudo chown -R ec2-user:ec2-user "$APP_DIR"

cd "$APP_DIR/backend"
sudo -u ec2-user npm install --omit=dev

sudo tee "$APP_DIR/backend/.env" >/dev/null <<ENV
PORT=3000
DB_HOST=$DB_HOST
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME
AWS_REGION=$AWS_REGION
S3_BUCKET=$S3_BUCKET
ENV
sudo chown ec2-user:ec2-user "$APP_DIR/backend/.env"
sudo chmod 600 "$APP_DIR/backend/.env"

# Initialize tables. The SQL is idempotent; run this from each instance if needed.
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" < "$APP_DIR/database/database_setup.sql"

sudo tee /etc/systemd/system/taskapi.service >/dev/null <<'UNIT'
[Unit]
Description=Task and Document API
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/taskapp/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now taskapi
curl -fsS http://127.0.0.1:3000/api/health
