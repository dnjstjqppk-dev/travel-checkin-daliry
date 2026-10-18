FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
ENV NITRO_PRESET=node-server NODE_ENV=production
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production NITRO_HOST=0.0.0.0 PORT=3000
COPY --from=build /app/.output ./.output

# Run as non-root user for container security
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", ".output/server/index.mjs"]