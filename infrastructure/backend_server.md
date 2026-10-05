# Backend Server (Node.js + Express API)

Used to build the **Backend Server AMI** (Amazon Linux 2023, private app subnets).

## 1. Install packages

```bash
sudo dnf update -y
sudo dnf install -y git nodejs20 npm mariadb105   # mariadb105 = MySQL client
node --version
```

## 2. Deploy the API

```bash
sudo mkdir -p /opt/app && sudo chown ec2-user:ec2-user /opt/app
git clone <your-repo-url> /tmp/app
cp -r /tmp/app/backend /opt/app/
cd /opt/app/backend
npm install --omit=dev
cp .env.example .env
nano .env        # set DB_HOST (RDS endpoint), DB_USER, DB_PASSWORD
```

## 3. Create the database tables (run once, from any backend server)

```bash
mysql -h <rds-endpoint> -u <username> -p < /tmp/app/database/database_setup.sql
```

## 4. Run as a service (starts automatically on boot / in the Auto Scaling Group)

```bash
sudo tee /etc/systemd/system/taskapi.service > /dev/null <<'UNIT'
[Unit]
Description=Task and Document API
After=network.target

[Service]
User=ec2-user
WorkingDirectory=/opt/app/backend
ExecStart=/usr/bin/node server.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now taskapi
curl http://localhost:3000/api/health
```

## 5. Security group (Backend Servers)

| Direction | Port | Source / Destination |
|-----------|------|----------------------|
| Inbound   | 3000 | Backend ALB security group |
| Outbound  | 3306 | Database security group |

## 6. Backend ALB target group

- Protocol/port: HTTP **3000**
- Health check path: `/api/health`

## Notes

- Uploaded documents are stored in the MySQL `documents` table (MEDIUMBLOB), so every server in the Auto Scaling Group sees the same files and nothing is lost when an instance is replaced.
- RDS parameter group: set `max_allowed_packet` to at least `16777216` (16 MB). The RDS default can be smaller than the 10 MB upload limit.
- Production improvement: store files in S3 (give the backend launch template an IAM role) and keep only the S3 key in the `documents` table.
