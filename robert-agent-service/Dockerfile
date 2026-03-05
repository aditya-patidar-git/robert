FROM node:20-slim

# Install System dependencies for Playwright
RUN apt-get update && apt-get install -y \
    libgbm-dev \
    libnss3 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Set Working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

RUN npx playwright install chromium

# Copy application code
COPY . .

COPY global-bundle.pem /app/global-bundle.pem

# Expose the service port (if applicable, based on your app)
# Assuming it might use 3002 based on BASE_URL/AGENT_SERVICE_URL
EXPOSE 3002

# Start the application
CMD ["npm", "run", "start:agent"]
