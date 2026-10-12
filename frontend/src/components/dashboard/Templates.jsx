import { Link } from 'react-router-dom'

// Pour l'instant la liste est vide.
// Plus tard, elle sera remplie par les modèles venant du backend (API Flask).
const templates = []

function Templates() {
  return (
    <section className="card">
      <h2>Mes modèles récents</h2>

      {templates.length === 0 ? (
        <div className="empty">
          <p>Aucun modèle pour l'instant. Créez votre premier modèle !</p>
          <Link to="/modeles/nouveau" className="btn-secondary">+ Créer un modèle</Link>
        </div>
      ) : (
        <ul className="template-list">
          {templates.map((t) => (
            <li key={t.id}>
              <strong>{t.name}</strong>
              <span>{t.equipment}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default Templates