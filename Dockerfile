FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies needed for node-gyp or canvas if required
RUN apk add --no-cache python3 make g++ git

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
