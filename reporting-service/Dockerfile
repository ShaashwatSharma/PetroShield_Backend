# FROM node:20

# WORKDIR /app

# COPY package*.json ./
# RUN npm install

# COPY prisma ./prisma/
# RUN npx prisma generate

# COPY . .

# # Compile TypeScript
# RUN npm run build

# EXPOSE 3000

# CMD ["node", "dist/main.js"]



FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install
COPY prisma ./prisma/
RUN npx prisma generate

COPY . .


EXPOSE 3000

CMD ["npm", "run", "dev"]
