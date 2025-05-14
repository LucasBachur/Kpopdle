import './App.css'
import Header from './components/Header'
import Kpopdle from './components/Kpopdle'

const idols = [
  { id: 1, name: 'Nayeon', group: 'Twice', nationality: 'Korean', age: 27 },
  { id: 2, name: 'Jeongyeon', group: 'Twice', nationality: 'Korean', age: 26 },
  { id: 3, name: 'Momo', group: 'Twice', nationality: 'Japanese', age: 26 },
  { id: 4, name: 'Sana', group: 'Twice', nationality: 'Japanese', age: 26 },
  { id: 5, name: 'Jihyo', group: 'Twice', nationality: 'Korean', age: 26 },
  { id: 6, name: 'Mina', group: 'Twice', nationality: 'Japanese', age: 26 },
  { id: 7, name: 'Dahyun', group: 'Twice', nationality: 'Korean', age: 25 },
  { id: 8, name: 'Chaeyoung', group: 'Twice', nationality: 'Korean', age: 24 },
  { id: 9, name: 'Tzuyu', group: 'Twice', nationality: 'Taiwanese', age: 24 },
  { id: 10, name: 'Karina', group: 'Aespa', nationality: 'Korean', age: 23 },
  { id: 11, name: 'Giselle', group: 'Aespa', nationality: 'Japanese', age: 23 },
  { id: 12, name: 'Winter', group: 'Aespa', nationality: 'Korean', age: 22 },
  { id: 13, name: 'Ningning', group: 'Aespa', nationality: 'Chinese', age: 21 }
]

const answer = { id: 4, name: 'Sana', group: 'Twice', nationality: 'Japanese', age: 26 };

function App() {
  return (
    <>
      <Header />
      <Kpopdle idolData={idols} answer={answer} />
    </>
  )
}

export default App
