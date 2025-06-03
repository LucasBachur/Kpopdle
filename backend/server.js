const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { SECRET_KEY, PORT, ALLOWED_ORIGIN } = require('./config');

const app = express();
app.use(cors(
    {origin: ALLOWED_ORIGIN || '*'}
));

app.get('/answers', (req, res) => {
  const data = fs.readFileSync(path.join(__dirname, 'data', 'dailyAnswers.json'), 'utf-8');
  res.json(JSON.parse(data));
});

app.get('/idols', (req, res) => {
  const data = fs.readFileSync(path.join(__dirname, 'data', 'idols.json'), 'utf-8');
  res.json(JSON.parse(data));
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
