FROM node:20-slim

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/web/package*.json ./packages/web/

RUN npm install

COPY packages/shared ./packages/shared
COPY packages/web ./packages/web

WORKDIR /app/packages/web
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
