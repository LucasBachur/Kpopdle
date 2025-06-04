const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { SECRET_KEY, PORT, ALLOWED_ORIGINS } = require('./config');
const { getFromDB, closeClient } = require('./db');

const app = express();
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.get('/answers', async (req, res) => {
  const idols = await getFromDB('dailyAnswers');
  res.json(idols);
});

app.get('/idols', async (req, res) => {
  const idols = await getFromDB('idols');
  res.json(idols);
});

app.get('/generate', (req, res) => {
    if (req.query.key !== SECRET_KEY) {
        return res.status(403).send('Forbidden');
    }
    exec('node answerGenerator.js', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
            return res.status(500).send('Error running script');
        }
        if (stderr) console.error(`stderr: ${stderr}`);
        res.send('Answer generated!');
    });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing MongoDB connection...');
  await closeClient();
  console.log('MongoDB connection closed. Exiting.');
  process.exit(0);
});
