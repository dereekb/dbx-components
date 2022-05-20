#!/bin/bash
echo "Running the nginx webhook proxy for demo-api-server."
mkdir -p ./tmp/nginx/webhook/nginx
docker compose -f ./docker-compose-nginx-webhook.yml run --rm --service-ports demo-api-webhook-server
