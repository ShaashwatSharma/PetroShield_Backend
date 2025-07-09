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



# FROM node:20

# WORKDIR /app

# COPY package*.json ./
# RUN npm install
# COPY prisma ./prisma/
# RUN npx prisma generate

# COPY . .


# EXPOSE 3000

# CMD ["npm", "run", "dev"]

FROM node:20

# Install Puppeteer dependencies
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    xdg-utils \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install
COPY package*.json ./
RUN npm install

# Copy Prisma + generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "dev"]
