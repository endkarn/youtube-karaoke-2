# Use Node.js as base image
FROM node:18-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    curl \
    build-essential \
    python3-dev \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Create and activate virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies in virtual environment
RUN pip install --no-cache-dir demucs

# Set working directory
WORKDIR /app

# Copy source code first
COPY . .

# Clean install dependencies and build sqlite3 from source
RUN npm ci && \
    npm rebuild sqlite3 --build-from-source

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3006

# Expose port
EXPOSE 3006

# Create volumes for persistent data
VOLUME ["/app/output", "/app/db"]

# Start the server
CMD ["npm", "start"]
