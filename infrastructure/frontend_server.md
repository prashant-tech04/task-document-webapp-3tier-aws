# Frontend Server (NGINX + React static files)

Used to build the **Frontend Server AMI** (Amazon Linux 2023, private web subnets).

## 1. Install packages

```bash
sudo dnf update -y
sudo dnf install -y nginx git
sudo systemctl enable nginx
```

## 2. Deploy the frontend

```bash
git clone <your-repo-url> /tmp/app
sudo cp /tmp/app/frontend/* /usr/share/nginx/html/
```

## 3. Configure NGINX

```bash
sudo cp /tmp/app/infrastructure/nginx_config /etc/nginx/conf.d/app.conf
# Edit the file and replace INTERNAL-APP-ALB-DNS with your internal App ALB DNS name
sudo nano /etc/nginx/conf.d/app.conf

sudo nginx -t
sudo systemctl restart nginx
```

## 4. Security group (Frontend Servers)

| Direction | Port | Source / Destination |
|-----------|------|----------------------|
| Inbound   | 80   | Frontend ALB security group |
| Outbound  | 80   | Backend ALB security group |
| Outbound  | 443  | Internet through NAT (the page loads React from unpkg.com in the visitor's browser, the server itself only needs updates) |

## Notes

- `frontend/config.js` keeps `API_BASE: '/api'` so the browser calls NGINX, and NGINX forwards to the App ALB.
- The browser loads React from a CDN. For a fully self-hosted setup, download the three scripts into `frontend/` and change the `<script src>` paths in `index.html`.
