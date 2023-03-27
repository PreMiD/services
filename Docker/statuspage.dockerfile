FROM node:lts-alpine

WORKDIR /app

RUN corepack enable

COPY pnpm-lock.yaml ./
RUN pnpm fetch

COPY . ./
RUN pnpm install --offline
RUN pnpm --filter=statuspage build
RUN pnpm --filter=statuspage --prod deploy pruned

FROM node:lts-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY --from=0 /app/pruned/node_modules ./node_modules
COPY --from=0 /app/pruned/dist ./

CMD ["node", "index.js"]
