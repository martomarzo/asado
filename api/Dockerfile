FROM node:22-alpine

WORKDIR /app

# Install deps first for better layer caching. Use the lockfile for reproducible builds.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV PORT=8787
EXPOSE 8787

CMD ["node", "server.js"]
