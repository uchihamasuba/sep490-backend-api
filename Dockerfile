# BNWEMS Backend — image chạy được cả dev (nodemon hot-reload) lẫn prod (dist).
# Base Debian slim thay vì alpine để Prisma engine + bcrypt (native) chạy ổn định.
FROM node:20-slim

# Prisma cần openssl để tải/patch query engine.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1) Cài dependencies trước (tận dụng cache: chỉ chạy lại khi package*.json đổi).
COPY package*.json ./
RUN npm ci

# 2) Copy prisma schema rồi generate client (cache tách khỏi source code).
COPY prisma ./prisma
RUN npx prisma generate

# 3) Copy phần source còn lại (bị bind-mount đè khi chạy dev — xem docker-compose).
COPY . .

# 4) Entrypoint: chờ DB → prisma db push → (tùy chọn) seed → chạy CMD.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["docker-entrypoint.sh"]
# Mặc định chạy dev (hot-reload). Đổi thành ["npm","run","build"] + ["npm","start"] nếu muốn prod.
CMD ["npm", "run", "dev"]
