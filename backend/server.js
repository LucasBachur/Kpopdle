const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { SECRET_KEY, PORT, ALLOWED_ORIGIN } = require('./config');
const { getFromDB } = require('./db');

const app = express();
app.use(cors(
    {origin: ALLOWED_ORIGIN}
));

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
