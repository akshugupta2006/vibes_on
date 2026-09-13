FROM node:20-bookworm-slim

# Install Python 3, pip, and ffmpeg (required for audio stream conversion by yt-dlp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
 && rm -rf /var/lib/apt/lists/*

# Install yt-dlp globally (using break-system-packages flag for Debian bookworm environments)
# This installs the absolute latest version from pip to bypass YT security.
RUN pip3 install -U yt-dlp --break-system-packages

# Set up app directory
WORKDIR /app

# Install Node dependencies first for better Docker layer caching
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of the application
COPY . .

# Ensure port 3000 is exposed
EXPOSE 3000

# Start the Node server directly
CMD ["npm", "start"]
