# Build stage: dev dependencies are needed only to compile TypeScript.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Runtime stage: production dependencies, compiled output and the SQL
# migrations, run as the unprivileged node user.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
USER node

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

EXPOSE 3000

# Migrations run before the server on every start; an advisory lock keeps
# concurrent instances from racing. exec hands PID 1 to node for signals.
CMD ["sh", "-c", "node dist/migrate.js && exec node dist/index.js"]
