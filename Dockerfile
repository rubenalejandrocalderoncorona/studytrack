FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY server.js ./
COPY routes ./routes
COPY services ./services
COPY public ./public

EXPOSE 3333

CMD ["node", "server.js"]
