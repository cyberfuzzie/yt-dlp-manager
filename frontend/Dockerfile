FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable pnpm && pnpm config set minimum-release-age 0 && pnpm install --shamefully-hoist
COPY . .
# `lint` runs TypeScript-eslint checks — errors fail the build.
RUN pnpm run lint
# `test:coverage` runs the unit tests and enforces the 80% coverage gate.
RUN pnpm run test:coverage
RUN pnpm exec vite build

FROM nginx:alpine AS runner
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
