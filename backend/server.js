const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { SECRET_KEY, PORT, ALLOWED_ORIGINS } = require('./config');
const { getFromDB, closeClient } = require('./db');
const authRouter = require('./routes/auth');
const cardGameRouter = require('./routes/cardGame');
const authMiddleware = require('./middleware/auth');
const { initScheduler } = require('./scheduler');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use('/api/auth', authRouter);
app.use('/api/card-game', authMiddleware, cardGameRouter);

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/answers', async (req, res) => {
  const data = await getFromDB('dailyAnswers');
  res.json(data);
});

app.get('/idols', async (req, res) => {
  const data = await getFromDB('idols');
  res.json(data);
});

app.get('/songs', async (req, res) => {
  const data = await getFromDB('songs');
  res.json(data);
});

app.get('/answersSongs', async (req, res) => {
  const data = await getFromDB('dailyAnswersSongs');
  res.json(data);
});

app.get('/generate', (req, res) => {
    if (req.query.key !== SECRET_KEY) {
        return res.status(403).send('Forbidden');
    }
    console.log('Received request to generate answers');
    res.send('Started generating answer');
    exec('node answerGenerator.js', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
            return;
        }
        if (stderr) console.error(`stderr: ${stderr}`);
        console.log('Answer generation script finished successfully');
    });
});
console.log('Starting server...');
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  initScheduler();
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing MongoDB connection...');
  await closeClient();
  console.log('MongoDB connection closed. Exiting.');
  process.exit(0);
});
