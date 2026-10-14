import { NavLink } from 'react-router-dom'
import Icon from './Icon.jsx'

function Sidebar() {
  return (
    <nav className="sidebar" aria-label="Navigation principale">
      <div className="sidebar-logo">
        <div className="logo-icon">CR</div>
        <div className="logo-text">
          <span className="logo-title">Procédés CROW</span>
          <span className="logo-subtitle">IEMN – CNRS</span>
        </div>
      </div>
      <NavLink to="/" end className="sidebar-link">
        <Icon name="dashboard" /> Tableau de bord
      </NavLink>
      <NavLink to="/modeles/nouveau" className="sidebar-link">
        <Icon name="template" /> Templates
      </NavLink>
    </nav>
  )
}

export default Sidebar
