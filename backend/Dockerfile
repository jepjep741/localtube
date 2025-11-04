FROM node:20-alpine

# Install ffmpeg and imagemagick for video processing and preview generation
RUN apk add --no-cache ffmpeg imagemagick

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy application files
COPY . .

# Create directories for data persistence
RUN mkdir -p /app/thumbnails /app/data

# Expose port
EXPOSE 3001

# Run the application
CMD ["node", "server.js"]