# Use Node.js 20-slim as Base image
FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgbm-dev \
    libnss3 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libasound2 \
&& rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Copy pem bundle file
COPY global-bundle.pem /app/global-bundle.pem

# Expose the API port
EXPOSE 5000

# Start the application
CMD ["node", "server.js"]
