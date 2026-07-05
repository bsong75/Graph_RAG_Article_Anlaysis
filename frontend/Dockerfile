FROM node:20-alpine

WORKDIR /code

COPY package.json ./
RUN npm install

COPY index.html vite.config.js ./
COPY src ./src

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
