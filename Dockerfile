FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV VITE_BASE=/
ARG VITE_SITE_URL
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production PORT=3001 DATA_DIR=/app/data
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && mkdir -p /app/data && chown node:node /app/data
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/src/data ./src/data
COPY --from=build /app/server ./server
USER node
VOLUME /app/data
EXPOSE 3001
CMD ["node", "server/index.mjs"]
