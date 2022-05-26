#!/bin/bash
docker network create -d bridge demo-api-network
npx nx affected --target=test --all
