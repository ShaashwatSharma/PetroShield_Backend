FROM node:20

WORKDIR /app

COPY package*.json ./
ENV NPM_CONFIG_NETWORK_CONCURRENCY=1

RUN npm install
COPY prisma ./prisma/
RUN npx prisma generate

COPY . .


EXPOSE 3000

CMD ["npm", "run", "dev"]
