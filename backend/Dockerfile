# Backend — deploy on Railway
# Dockerfile for Node.js backend

FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source
COPY . .

# Expose port
EXPOSE 3000

# Start
CMD ["npm", "start"]
