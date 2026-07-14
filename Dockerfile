FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY app/package.json app/package-lock.json* ./app/
COPY server/package.json server/package-lock.json* ./server/
RUN npm install

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace=app
RUN npm run build --workspace=server

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/app/dist ./app/dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
RUN npm ci --only=production --workspace=server
EXPOSE 3001
CMD ["node", "server/index.js"]
