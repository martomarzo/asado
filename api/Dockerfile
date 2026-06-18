FROM node:22-alpine

WORKDIR /app

# Install deps first for better layer caching (no lockfile → use npm install)
COPY package.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=8787
EXPOSE 8787

CMD ["node", "server.js"]
