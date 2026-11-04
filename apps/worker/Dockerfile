FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/worker/package.json ./apps/worker/package.json
RUN npm install --workspace @smartderivbot/worker
COPY apps/worker/tsconfig.json ./apps/worker/tsconfig.json
COPY apps/worker/src ./apps/worker/src
WORKDIR /app/apps/worker
RUN npx tsc -p tsconfig.json
ENV NODE_ENV=production
EXPOSE 4001
CMD ["node", "dist/index.js"]
