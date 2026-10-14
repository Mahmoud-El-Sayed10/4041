import { Link } from 'react-router-dom'
import Icon from '../Icon.jsx'

function Banner() {
  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <section className="welcome graph-paper">
      <div className="welcome-body">
        <p className="welcome-date">{today}</p>
        <h1>Bonjour</h1>
        <p className="welcome-text">
          Créez des templates de formulaires pour vos équipements, sans programmer.
          Les chercheurs n'auront plus qu'à les remplir.
        </p>
      </div>
      <Link to="/modeles/nouveau" className="btn-primary">
        <Icon name="plus" /> Nouveau template
      </Link>
    </section>
  )
}

export default Banner
