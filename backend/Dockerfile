FROM node:22-alpine
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && addgroup -S faithhaven && adduser -S faithhaven -G faithhaven
COPY backend/src ./src
COPY backend/migrations ./migrations
RUN chown -R faithhaven:faithhaven /app
USER faithhaven
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "node src/db/migrate.js && exec node src/server.js"]
