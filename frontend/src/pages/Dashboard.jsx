import Banner from '../components/dashboard/Banner.jsx'
import Fonctions from '../components/dashboard/Fonctions.jsx'
import Templates from '../components/dashboard/Templates.jsx'
import './Dashboard.css'

function Dashboard() {
  return (
    <div className="dashboard">
      <Banner />
      <Fonctions />
      <Templates />
    </div>
  )
}

export default Dashboard