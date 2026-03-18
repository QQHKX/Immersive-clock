# 预定义各架构的运行时镜像
FROM node:24-alpine AS builder-amd64
FROM node:24-alpine AS builder-arm64
FROM arm32v7/node:22-alpine AS builder-arm
# FROM s390x/node:24-alpine AS builder-s390x
# FROM ppc64le/node:24-slim AS builder-ppc64le

# 根据 TARGETARCH 选择对应的构建时镜像
FROM builder-${TARGETARCH} AS builder

# Set working directory
WORKDIR /app

# ARM架构跳过Windows打包依赖，x86架构正常处理
RUN if [ "${TARGETARCH}" = "arm" ]; then \
        # ARMv7 环境：禁用Windows相关依赖，避免electron-winstaller报错
        echo "BUILD_ARCH=armv7" > .env && \
        npm config set omit=optional && \
        export ELECTRON_BUILDER_TARGETS=linux-armv7l; \
    else \
        # AMD64/ARM64 环境：正常配置
        echo "BUILD_ARCH=${TARGETARCH}" > .env; \
    fi

# Copy package files first for better caching
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci || npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# 预定义各架构的nginx运行镜像
FROM nginx:alpine AS runner-amd64
FROM nginx:alpine AS runner-arm64
FROM arm32v7/nginx:alpine AS runner-arm

# 动态选择运行镜像
FROM runner-${TARGETARCH} AS runner

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
