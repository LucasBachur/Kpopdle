import './App.css'
import idols from './data/idols.json'
import answers from './data/dailyAnswers.json'
import Header from './components/Header'
import Kpopdle from './components/Kpopdle'
import { useState } from 'react';

function todayArg(withTime = false) {
  const options = {
    timeZone: 'America/Argentina/Buenos_Aires',
    year : 'numeric',
    month : 'numeric',
    day : 'numeric'
  };

  if (withTime) {
    options.hour12 = false,
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.second = '2-digit';
  }

  return new Date().toLocaleString('en-CA', options);
}

function App() {
  const [mode, setMode] = useState('All');
  let idolData = idols;
  const todaysAnswer = answers[mode].filter(entry => entry.date === todayArg());
  const todaysAnswerData = todaysAnswer.map(answerEntry =>
    idolData.find(idol => idol.id === answerEntry.answerId)
  )[0];
  return (
    <>
      <Header setMode = {setMode}/>
      <Kpopdle idolData={idolData} answer={todaysAnswerData} mode={mode}/>
    </>
  )
}

export default App
