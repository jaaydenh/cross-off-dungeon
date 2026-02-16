FROM node:20-alpine AS deps

WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci

FROM node:20-alpine AS build

WORKDIR /app/server

COPY --from=deps /app/server/node_modules ./node_modules
COPY server/ ./

RUN npm run build
RUN npm prune --omit=dev

FROM node:20-alpine AS runner

WORKDIR /app/server
ENV NODE_ENV=production

COPY --from=build /app/server/package*.json ./
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/build ./build

EXPOSE 2567

CMD ["npm", "start"]
