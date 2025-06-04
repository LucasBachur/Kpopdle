const dotenv = require('dotenv');
const process = require('process');

dotenv.config();

const SECRET_KEY = process.env.SECRET_KEY;
const PORT = process.env.PORT;

const origins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [];

module.exports = {
  SECRET_KEY,
  PORT,
  ALLOWED_ORIGINS: origins,
  MONGODB_URI : process.env.MONGODB_URI
};
