# ---- build static bundle ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- serve via nginx (proxies /api to the backend = same origin, no CORS) ----
FROM nginx:1.27-alpine
ENV API_UPSTREAM=http://bilokat-api:3000
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
