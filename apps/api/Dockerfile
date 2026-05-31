FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/mobile/package*.json apps/mobile/
RUN npm install

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run prisma:generate --workspace @malta-marketplace/api
RUN npm run build --workspace @malta-marketplace/api

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api ./apps/api
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
