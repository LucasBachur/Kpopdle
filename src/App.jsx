import './App.css'
import idols from './data/idols.json'
import Header from './components/Header'
import Kpopdle from './components/Kpopdle'

const answer = { "id": 4, "name": "Sana", "group": "Twice", "nationality": "Japanese", "birthYear": 1996, "company": "JYP Entertainment", "groupType": "Girl Group" };

function App() {
  return (
    <>
      <Header />
      <Kpopdle idolData={idols} answer={answer} />
    </>
  )
}

export default App
