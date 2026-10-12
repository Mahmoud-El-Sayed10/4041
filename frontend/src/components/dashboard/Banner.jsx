import { Link } from 'react-router-dom'

function Banner() {
  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <section className="welcome">
      <div>
        <p className="welcome-date">{today}</p>
        <h1>Bonjour</h1>
        <p className="welcome-text">
          Créez des modèles de formulaires pour vos équipements.
        </p>
      </div>
      <Link to="/modeles/nouveau" className="btn-primary">+ Nouveau modèle</Link>
    </section>
  )
}

export default Banner