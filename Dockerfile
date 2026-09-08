# ---------- Etapa base (compartida) ----------
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# ---------- Etapa DESARROLLO ----------
FROM base AS development
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---------- Etapa PRODUCCIÓN (para más adelante) ----------
FROM base AS production
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["npm", "start"]