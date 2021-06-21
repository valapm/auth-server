FROM node:14

WORKDIR /code

COPY package*.json /code/

RUN npm config set unsafe-perm true && npm install

COPY . /code/

ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]