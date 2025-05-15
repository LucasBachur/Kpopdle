import './App.css'
import idols from './data/idols.json'
import Header from './components/Header'
import Kpopdle from './components/Kpopdle'
import { useState } from 'react';

const answers = {
  "Girl Group":{ "id": 4, "name": "Sana", "group": "Twice", "nationality": "Japanese", "birthYear": 1996, "company": "JYP", "groupType": "Girl Group" },
  "Boy Group":{ "id": 52, "name": "Hyunjin", "group": "Stray Kids", "nationality": "Korean", "birthYear": 2000, "company": "JYP", "groupType": "Boy Group" },
  "All":{ "id": 39, "name": "Seeun", "group": "STAYC", "nationality": "Korean", "birthYear": 2003, "company": "High Up", "groupType": "Girl Group" }
};

function App() {
  const [mode, setMode] = useState('All');
  let idolData = idols;

  return (
    <>
      <Header setMode = {setMode}/>
      <Kpopdle idolData={idolData} answers={answers} mode={mode}/>
    </>
  )
}

export default App
