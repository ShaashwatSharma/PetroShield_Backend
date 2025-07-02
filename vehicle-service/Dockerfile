FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .

RUN npm run build         # ✅ Compile TypeScript

EXPOSE 3000

CMD ["npm", "run", "start"]
