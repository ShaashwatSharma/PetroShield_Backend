# # Use official Node image
# FROM node:20-alpine

# # Set working directory
# WORKDIR /app

# # Copy package.json and package-lock.json first (for caching layers)
# COPY package*.json ./

# # Install dependencies
# RUN npm install

# # Copy the rest of your source code
# COPY . .

# # Generate Prisma client
# RUN npx prisma generate

# # Build TypeScript (if needed)
# RUN npx tsc

# # Expose the port
# EXPOSE 3000

# # Command to run app using ts-node (for development) or built dist (for production)
# CMD ["npx", "ts-node", "src/main.ts"]











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
