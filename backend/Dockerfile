FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --production && npm install -g typescript

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
