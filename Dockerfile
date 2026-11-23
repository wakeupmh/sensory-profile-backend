FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

RUN npm prune --production

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

EXPOSE 3000

# Migrations run before the server on every start; an advisory lock keeps
# concurrent instances from racing. exec hands PID 1 to node for signals.
CMD ["sh", "-c", "node dist/migrate.js && exec node dist/index.js"]