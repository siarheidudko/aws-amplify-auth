FROM node:21-alpine as aws-amplify-auth
COPY . ./
RUN npm ci
EXPOSE 10000
CMD ./node_modules/.bin/pm2-docker ./lib/index.js
