#!/bin/bash
set -euxo pipefail

# ===== REPLACE THESE VALUES =====
REPO_URL="REPLACE_WITH_YOUR_REPOSITORY_URL"
APP_ALB_DNS="REPLACE_WITH_APP_ALB_DNS"
# ================================

sudo dnf update -y
sudo dnf install -y nginx git
sudo rm -rf /tmp/taskapp-source
sudo git clone "$REPO_URL" /tmp/taskapp-source

sudo rm -rf /usr/share/nginx/html/*
sudo cp /tmp/taskapp-source/frontend/* /usr/share/nginx/html/

sudo sed "s/INTERNAL-APP-ALB-DNS/$APP_ALB_DNS/g" \
  /tmp/taskapp-source/infrastructure/nginx_config \
  | sudo tee /etc/nginx/conf.d/app.conf >/dev/null

sudo nginx -t
sudo systemctl enable --now nginx
