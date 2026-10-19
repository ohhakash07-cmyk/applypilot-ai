FROM node:22-alpine

ENV NODE_ENV=production PORT=3000
WORKDIR /app

COPY package.json README.md index.html server.js ./

RUN mkdir -p /app/data && chown -R node:node /app

USER node
EXPOSE 3000

CMD ["node", "server.js"]
