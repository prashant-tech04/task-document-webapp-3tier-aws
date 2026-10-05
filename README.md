# Task Document Management – AWS 3-Tier Architecture

A highly available **3-tier document/task management application** deployed on AWS using **React + NGINX + Node.js/Express + MySQL RDS + Amazon S3**.

The infrastructure is created manually through the **AWS Management Console**. **Terraform is not used**.

---

## 🏗️ Architecture

```text
                                INTERNET
                                   |
                                   v
                         +---------------------+
                         |   Web ALB            |
                         | Internet-facing :80  |
                         +----------+----------+
                                    |
                         +----------+----------+
                         |                     |
                         v                     v
                 +---------------+     +---------------+
                 | Private Web   |     | Private Web   |
                 | EC2 / ASG     |     | EC2 / ASG     |
                 | NGINX + React |     | NGINX + React |
                 +-------+-------+     +-------+-------+
                         \                   /
                          \                 /
                           +-------+-------+
                                   |
                                   v
                         +---------------------+
                         | Internal App ALB    |
                         | Private HTTP :80    |
                         +----------+----------+
                                    |
                         +----------+----------+
                         |                     |
                         v                     v
                 +---------------+     +---------------+
                 | Private App   |     | Private App   |
                 | EC2 / ASG     |     | EC2 / ASG     |
                 | Node.js :3000 |     | Node.js :3000 |
                 +-------+-------+     +-------+-------+
                         | \                 / |
                         |  \               /  |
                         |   +-------------+   |
                         |         |           |
                         v         v           v
                 +-----------+  +------------------+
                 | RDS MySQL |  | Private S3 Bucket|
                 | Database  |  | Documents        |
                 +-----------+  +------------------+

                 CloudWatch -> SNS -> Email Alerts
```

### Request flow

```text
User
  |
  v
Internet-facing Web ALB
  |
  v
Private Web EC2 ASG
  |
  +--> React frontend
  |
  +--> NGINX /api/* proxy
            |
            v
      Internal App ALB
            |
            v
      Private Backend EC2 ASG
            |
       +----+----+
       |         |
       v         v
    RDS MySQL   S3
```

---

## ☁️ AWS Services Used

| Service | Purpose |
|---|---|
| Amazon VPC | Network isolation |
| Internet Gateway | Internet access for public subnets |
| NAT Gateway | Outbound internet access for private application servers |
| EC2 | Web and backend compute |
| Auto Scaling Groups | High availability and instance replacement |
| Application Load Balancer | Public web traffic and internal API traffic |
| Amazon RDS MySQL | Application database |
| Amazon S3 | Document/object storage |
| IAM | EC2 permissions and S3 access |
| AWS Systems Manager | Secure EC2 administration through SSM |
| CloudWatch | Metrics and alarms |
| SNS | Email notifications |
| NGINX | Frontend web server and API reverse proxy |
| Node.js / Express | Backend REST API |
| React | Frontend application |

---

# 🌐 Network Architecture

## VPC

```text
VPC CIDR
10.0.0.0/16
```

The VPC is divided into public and private tiers across multiple Availability Zones.

### Subnet plan

| Tier | AZ 1 | AZ 2 | AZ 3 |
|---|---|---|---|
| Public | 10.0.1.0/24 | 10.0.2.0/24 | 10.0.3.0/24 |
| Private Web | 10.0.11.0/24 | 10.0.12.0/24 | 10.0.13.0/24 |
| Private App | 10.0.21.0/24 | 10.0.22.0/24 | 10.0.23.0/24 |
| Private DB | 10.0.31.0/24 | 10.0.32.0/24 | 10.0.33.0/24 |

> Use the actual subnet IDs and Availability Zone names created in the AWS Console. The CIDRs above are the planned project layout.

---

# 🔐 Security Groups

## Web ALB – `sg-web-alb`

Inbound:

```text
HTTP 80
Source: 0.0.0.0/0
```

Outbound:

```text
All traffic
```

---

## Web EC2 – `sg-web-server`

Inbound:

```text
HTTP 80
Source: sg-web-alb
```

The web instances are not directly exposed to the internet.

---

## Internal App ALB – `sg-app-alb`

Inbound:

```text
HTTP 80
Source: sg-web-server
```

This ALB is internal/private.

---

## Backend EC2 – `sg-app-server`

Inbound:

```text
TCP 3000
Source: sg-app-alb
```

---

## RDS – `sg-rds`

Inbound:

```text
MySQL/Aurora 3306
Source: sg-app-server
```

RDS is private and is not publicly accessible.

---

# 🖥️ Frontend Tier

The frontend uses:

- React
- ReactDOM
- NGINX
- Amazon Linux EC2
- Auto Scaling Group
- Application Load Balancer

The React application is served by NGINX.

NGINX also proxies API requests:

```text
/api/*
     |
     v
Internal App ALB
```

Frontend configuration:

```javascript
window.APP_CONFIG = {
  API_BASE: '/api'
};
```

This keeps the browser independent of the internal backend ALB DNS name.

---

# ⚙️ Backend Tier

The backend uses:

- Node.js
- Express.js
- MySQL2
- Multer
- AWS SDK for S3
- dotenv
- CORS

Backend port:

```text
3000
```

Health endpoint:

```text
GET /api/health
```

Expected response:

```json
{
  "status": "ok"
}
```

The backend communicates with:

```text
Backend EC2
   |
   +----> RDS MySQL
   |
   +----> Amazon S3
```

---

# 🗄️ Database

Database engine:

```text
MySQL
```

Database:

```text
task manager database
```

Application database user:

```text
appuser
```

RDS is configured as:

```text
Public access: No
Port: 3306
```

The backend EC2 instances connect to RDS using the private network.

---

# 🪣 Amazon S3

S3 is used for document storage.

Recommended configuration:

```text
Block Public Access: ON
Object Ownership: Bucket owner enforced
Encryption: SSE-S3
Versioning: Recommended
```

The bucket should remain private.

The backend accesses S3 using the EC2 IAM role instead of hard-coded AWS access keys.

Required permissions:

```text
s3:ListBucket
s3:GetObject
s3:PutObject
s3:DeleteObject
```

---

# 👤 IAM

The backend EC2 instances use an IAM role such as:

```text
TaskAppBackendRole
```

Required managed permission:

```text
AmazonSSMManagedInstanceCore
```

S3 permissions are added through an inline or dedicated policy restricted to the application's S3 bucket.

No AWS access key or secret key should be stored inside the application `.env`.

---

# ⚖️ Load Balancers

## Public Web ALB

```text
Name:
taskapp-web-alb

Scheme:
Internet-facing

Listener:
HTTP :80

Target:
web-tg
```

Target group:

```text
Protocol: HTTP
Port: 80
Health check: /healthz
```

Expected response:

```text
200 OK
```

---

## Internal App ALB

```text
Name:
taskapp-app-alb

Scheme:
Internal

Listener:
HTTP :80

Target:
app-tg
```

Target group:

```text
Protocol: HTTP
Port: 3000
Health check: /api/health
```

Expected response:

```json
{
  "status": "ok"
}
```

---

# 📈 Auto Scaling

## Frontend ASG

```text
Name:
taskapp-frontend-asg

Minimum:
2

Desired:
2

Maximum:
4
```

Instances run NGINX + React.

---

## Backend ASG

```text
Name:
taskapp-backend-asg

Minimum:
2

Desired:
2

Maximum:
4
```

Instances run Node.js/Express.

Using multiple instances provides high availability and allows failed instances to be replaced automatically.

---

# 📊 CloudWatch Monitoring

Recommended alarms:

| Alarm | Metric | Threshold |
|---|---|---|
| Frontend high CPU | ASG CPUUtilization | > 70% |
| Backend high CPU | ASG CPUUtilization | > 70% |
| RDS high CPU | RDS CPUUtilization | > 80% |
| RDS low storage | FreeStorageSpace | < 2 GB |
| RDS connections | DatabaseConnections | > 80 |
| Web ALB errors | HTTPCode_ELB_5XX_Count | > 5 |
| App ALB errors | HTTPCode_ELB_5XX_Count | > 5 |

Recommended evaluation:

```text
Period: 5 minutes
Datapoints: 2 out of 2
```

---

# 🔔 SNS Notifications

SNS topic:

```text
taskapp-alerts
```

CloudWatch alarms publish notifications to this SNS topic.

Flow:

```text
CloudWatch Alarm
       |
       v
SNS topic
       |
       v
Email
```

The email subscription must be confirmed.

---

# 📁 Project Structure

```text
task-document-management/
│
├── backend/
│   ├── package.json
│   ├── server.js
│   ├── db.js
│   ├── .env.example
│   └── routes/
│       ├── tasks.js
│       └── documents.js
│
│
├──docs/
│   ├── Architecture.png
│   ├── Task_document_Management_Aws.pdf
│
├── database/
│   └── database_setup.sql
│
├── frontend/
│   ├── index.html
│   ├── app.jsx
│   ├── styles.css
│   └── config.js
│
└── infrastructure/
    ├── README.md
    ├── nginx_config
    ├── frontend_server.md
    ├── backend_server.md
    │
    ├── config/
    │   ├── backend.env.example
    │   └── web-replacements.example
    │
    └── scripts/
        ├── backend-user-data.sh
        ├── frontend-user-data.sh
        └── verify-3tier.sh
```

---

# 🚀 Deployment Order

Deploy the project in this order:

### 1. VPC

Create:

```text
VPC
Internet Gateway
Public subnets
Private Web subnets
Private App subnets
Private DB subnets
Route tables
NAT Gateway
```

### 2. Security Groups

Create:

```text
sg-web-alb
sg-web-server
sg-app-alb
sg-app-server
sg-rds
```

### 3. IAM

Create the backend EC2 IAM role with:

```text
AmazonSSMManagedInstanceCore
S3 access
```

### 4. RDS

Create:

```text
RDS MySQL
Private DB subnet group
Private access
sg-rds
```

Run the database setup SQL.

### 5. S3

Create the private document bucket.

Configure the backend IAM policy for the bucket.

### 6. Backend

Create:

```text
Backend Launch Template
Backend Target Group
Backend ASG
```

Verify:

```bash
curl http://localhost:3000/api/health
```

Expected:

```json
{"status":"ok"}
```

### 7. Internal App ALB

Create:

```text
Internal App ALB
Listener :80
Target: app-tg
```

Verify backend targets are healthy.

### 8. Frontend

Create:

```text
Frontend Launch Template
Frontend Target Group
Frontend ASG
```

Verify:

```bash
curl http://localhost/healthz
```

Expected:

```text
ok
```

### 9. Public Web ALB

Create:

```text
Internet-facing Web ALB
Listener HTTP :80
Target: web-tg
```

Verify web targets are healthy.

### 10. NGINX → Internal App ALB

Configure NGINX so:

```text
/api/*
```

is forwarded to the internal App ALB.

### 11. Application Test

Open:

```text
http://<WEB-ALB-DNS>
```

Test:

```text
Login/application pages
Task creation
Task update
Task deletion
Document upload
Document retrieval
Document deletion
```

### 12. Monitoring

Create:

```text
CloudWatch alarms
SNS topic
Email subscription
```

### 13. High Availability Test

Terminate one frontend or backend EC2 instance.

Verify that Auto Scaling launches a replacement and the target becomes healthy.

---

# 🧪 Health Checks

## Backend

From backend EC2:

```bash
curl -i http://localhost:3000/api/health
```

Expected:

```text
HTTP/1.1 200 OK
```

---

## Frontend

From frontend EC2:

```bash
curl -i http://localhost/healthz
```

Expected:

```text
HTTP/1.1 200 OK
```

---

## Frontend → Internal App ALB

From frontend EC2:

```bash
curl -i http://<APP-ALB-DNS>/api/health
```

Expected:

```json
{"status":"ok"}
```

---

## Public application

From a browser:

```text
http://<WEB-ALB-DNS>
```

---

# 🔒 Security Principles

This project follows a layered security model:

```text
Internet
   |
   v
Public Web ALB
   |
   v
Private Web EC2
   |
   v
Internal App ALB
   |
   v
Private Backend EC2
   |
   +----> Private RDS
   |
   +----> Private S3
```

Important rules:

- RDS is not publicly accessible.
- Backend instances are not directly internet-facing.
- Web EC2 instances are private.
- Internal App ALB is private.
- S3 bucket is private.
- Security groups reference other security groups wherever possible.
- AWS credentials are not hard-coded in application files.
- SSM is used for administration instead of exposing SSH publicly.

---

# 🎯 Project Objectives

This project demonstrates:

- AWS VPC design
- Public/private subnet architecture
- 3-tier application architecture
- React frontend deployment
- NGINX reverse proxy
- Node.js REST API
- MySQL RDS
- Amazon S3 document storage
- IAM role-based AWS access
- Application Load Balancers
- Auto Scaling Groups
- High availability
- CloudWatch monitoring
- SNS alerting
- AWS Systems Manager
- Secure network communication

---

# 💼 Resume Description

**AWS 3-Tier Task & Document Management Application**

Designed and deployed a highly available 3-tier web application on AWS using React, NGINX, Node.js/Express, Amazon EC2, Application Load Balancers, Auto Scaling Groups, Amazon RDS MySQL, Amazon S3, IAM, CloudWatch, SNS, and VPC. Implemented private application/database tiers, security-group-based communication, S3 document storage, health checks, monitoring alarms, and Auto Scaling for improved availability.

---

# 🏆 Final Architecture

```text
                 ┌─────────────────────┐
                 │       INTERNET      │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │  PUBLIC WEB ALB     │
                 │      HTTP :80       │
                 └──────────┬──────────┘
                            │
                            ▼
              ┌────────────────────────────┐
              │     PRIVATE WEB TIER       │
              │                            │
              │  EC2 + NGINX + React       │
              │       Auto Scaling         │
              └────────────┬───────────────┘
                           │
                           ▼
                 ┌─────────────────────┐
                 │ INTERNAL APP ALB    │
                 │      HTTP :80       │
                 └──────────┬──────────┘
                            │
                            ▼
              ┌────────────────────────────┐
              │     PRIVATE APP TIER       │
              │                            │
              │   Node.js + Express       │
              │       Auto Scaling         │
              └───────────┬───────┬────────┘
                          │       │
                          ▼       ▼
                   ┌──────────┐ ┌──────────┐
                   │ RDS      │ │ S3       │
                   │ MySQL    │ │ Documents│
                   └──────────┘ └──────────┘

                  CloudWatch → SNS → Email
```

---

## Author

**Prashant Suryawanshi**

AWS / Cloud / DevOps Project

