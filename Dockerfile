# 预定义各架构的运行时镜像
FROM node:24-alpine AS runtime-amd64
FROM node:24-alpine AS runtime-arm64
# FROM arm32v7/node:22-alpine AS runtime-arm
# FROM s390x/node:24-alpine AS runtime-s390x
# FROM ppc64le/node:24-slim AS runtime-ppc64le

# 根据 TARGETARCH 选择对应的运行时镜像
FROM runtime-${TARGETARCH} AS runtime

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci|| npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
