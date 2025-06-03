const dotenv = require('dotenv');
const process = require('process');

dotenv.config();

const SECRET_KEY = process.env.SECRET_KEY;
const PORT = process.env.PORT;

module.exports = {
  SECRET_KEY,
  PORT
};
