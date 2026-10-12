import { NavLink } from 'react-router-dom'

function Sidebar() {
  return (
    <nav className="sidebar">
      <div className="sidebar-logo">Procédés CROW</div>
      <NavLink to="/" end className="sidebar-link">Tableau de bord</NavLink>
      <NavLink to="/modeles/nouveau" className="sidebar-link">Modèles</NavLink>
    </nav>
  )
}

export default Sidebar