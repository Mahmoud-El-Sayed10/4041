import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { lireModeles, supprimerModele } from '../../utils/modeles.js'

// Les 5 derniers modèles enregistrés, du plus récent au plus ancien
function modelesRecents() {
  return lireModeles()
    .sort((a, b) => b.dateModification.localeCompare(a.dateModification))
    .slice(0, 5)
}

function Templates() {
  const [templates, setTemplates] = useState(modelesRecents)
  const navigate = useNavigate()

  function supprimer(t) {
    if (!window.confirm(`Supprimer le modèle « ${t.nom} » ?`)) return
    supprimerModele(t.id)
    setTemplates(modelesRecents()) // on rafraîchit la liste affichée
  }

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
              <div className="template-info">
                <strong>{t.nom}</strong>
                <span>
                  {t.champs.length} champ(s) · modifié le{' '}
                  {new Date(t.dateModification).toLocaleDateString('fr-FR')}
                </span>
              </div>
              <div className="template-actions">
                <button type="button" onClick={() => navigate(`/modeles/${t.id}/modifier`)}>
                  Modifier
                </button>
                <button type="button" onClick={() => navigate(`/modeles/${t.id}/modifier?export=1`)}>
                  Exporter
                </button>
                <button type="button" className="danger" onClick={() => supprimer(t)}>
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default Templates
