import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import FormBuilder from './pages/FormBuilder.jsx'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/modeles/nouveau" element={<FormBuilder />} />
      </Route>
    </Routes>
  )
}

export default App