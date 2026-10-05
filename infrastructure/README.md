# AWS 3-Tier Infrastructure — No Terraform

This folder contains the infrastructure/deployment material for the project using the **AWS Console + EC2 User Data + AWS CLI where useful**. There is **no Terraform**.

## 3 tiers

**Tier 1 — Presentation:** Public Web ALB -> private NGINX EC2 Auto Scaling Group

**Tier 2 — Application:** Internal App ALB -> private Node.js EC2 Auto Scaling Group

**Tier 3 — Data:** private RDS MySQL + private S3 document storage

Supporting services: VPC, IGW, NAT Gateway, IAM, Security Groups, CloudWatch, SNS, Target Groups, Launch Templates and Auto Scaling.

## Start here

1. Read `console/01-architecture.md`.
2. Follow `console/02-prerequisites.md` through `console/10-deployment-order.md` in order.
3. Before launching EC2, copy and edit `scripts/backend-user-data.sh` and `scripts/frontend-user-data.sh`.
4. Search for `REPLACE_` using `console/11-replacement-checklist.md`.
5. Use `console/09-cloudwatch-sns.md` for monitoring/alerts.

## Important configuration replacements

- AWS region
- Repository URL
- RDS endpoint
- RDS username/password
- S3 bucket name
- Internal App ALB DNS name in NGINX
- EC2 key pair if SSH is used

## Packages installed by the scripts

Backend EC2:
- git
- nodejs20
- npm
- mariadb105 (MySQL-compatible client)

Frontend EC2:
- nginx
- git

The Node.js application also installs its npm dependencies from `backend/package.json`, including the AWS SDK S3 client.

## Database and S3 change

The original project stored uploaded document bytes in MySQL. This AWS version stores **new document files in S3** and keeps metadata/S3 keys in RDS. Existing DB-stored documents remain downloadable for backward compatibility.

## Production improvements

For production, add HTTPS with ACM on the Web ALB, Secrets Manager for DB credentials, WAF, tighter egress rules, S3 lifecycle policies, CloudTrail, VPC endpoints where appropriate, and a multi-AZ NAT strategy.
