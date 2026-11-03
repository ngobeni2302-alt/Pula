FROM node:20-alpine AS frontend-build

WORKDIR /app
COPY frontend/package*.json ./frontend/
RUN npm ci --prefix frontend
COPY frontend ./frontend
COPY teacher ./teacher
RUN npm run build --prefix frontend

FROM node:20-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

WORKDIR /app
COPY backend/src ./backend/src
COPY backend/migrations ./backend/migrations
COPY LesediAiAgent/src ./LesediAiAgent/src
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
RUN mkdir -p /app/backend/data \
    && chown -R node:node /app/backend

ENV DATA_FILE=/app/backend/data/data.json
USER node

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "backend/src/server.js"]
