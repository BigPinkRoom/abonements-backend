FROM node:22

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 4000

# CMD ["node", "index.js"]

CMD ["sh", "-c", "while ! curl -s http://elasticsearch:9200; do sleep 5; done && node createIndexes.js && node index.js"]