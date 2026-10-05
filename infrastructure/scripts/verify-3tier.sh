#!/bin/bash
set -euo pipefail

# Run from an admin machine with AWS CLI configured.
# Replace the values before running.
REGION="REPLACE_WITH_AWS_REGION"
WEB_ALB_DNS="REPLACE_WITH_WEB_ALB_DNS"
APP_ALB_DNS="REPLACE_WITH_APP_ALB_DNS"

printf '\nWeb ALB: %s\n' "$WEB_ALB_DNS"
printf 'App ALB: %s\n\n' "$APP_ALB_DNS"

printf '%s\n' '--- Web ALB health ---'
curl -fsS "http://$WEB_ALB_DNS/healthz"
printf '\n%s\n' '--- Application health (internal; run from a private EC2/SSM shell) ---'
printf 'curl http://%s/api/health\n' "$APP_ALB_DNS"

printf '\nAWS identity:\n'
aws sts get-caller-identity --region "$REGION"
