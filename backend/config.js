const dotenv = require('dotenv');
const process = require('process');

dotenv.config();

const REQUIRED_ENV_VARS = ['DATABASE_URL', 'PORT', 'SECRET_KEY'];
for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}\nSet it in your .env file and restart the server.`);
    process.exit(1);
  }
}

const SECRET_KEY = process.env.SECRET_KEY;
const PORT = process.env.PORT;

const origins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [];

module.exports = {
  SECRET_KEY,
  PORT,
  ALLOWED_ORIGINS: origins,
  DATABASE_URL: process.env.DATABASE_URL,
};
