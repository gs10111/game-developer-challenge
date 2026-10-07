FROM mcr.microsoft.com/playwright:v1.63.0-noble

RUN npm install -g pnpm@10.34.6 \
    && install -d -m 1777 /app /app/node_modules /home/app /pnpm/store

ENV HOME=/home/app \
    npm_config_store_dir=/pnpm/store \
    E2E_CONTAINER=1

COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/entrypoint

WORKDIR /app
ENTRYPOINT ["entrypoint"]
CMD ["pnpm", "test:e2e"]
