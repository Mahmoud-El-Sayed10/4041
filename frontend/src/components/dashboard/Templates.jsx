import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { lireModeles, supprimerModele } from '../../utils/modeles.js'
import Icon from '../Icon.jsx'

function modelesRecents() {
  return lireModeles()
    .sort((a, b) => b.dateModification.localeCompare(a.dateModification))
    .slice(0, 5)
}

function Templates() {
  const [templates, setTemplates] = useState(modelesRecents)
  const navigate = useNavigate()

  function supprimer(t) {
    if (!window.confirm(`Supprimer le template « ${t.nom} » ?`)) return
    supprimerModele(t.id)
    setTemplates(modelesRecents())
  }

  return (
    <section className="card">
      <h2>Mes templates récents</h2>
      {templates.length === 0 ? (
        <div className="empty">
          <span className="empty-icon"><Icon name="template" size={22} /></span>
          <p>Aucun template pour l'instant.</p>
          <Link to="/modeles/nouveau" className="btn-secondary"><Icon name="plus" /> Créer mon premier template</Link>
        </div>
      ) : (
        <ul className="template-list">
          {templates.map((t) => (
            <li key={t.id}>
              <span className="template-icon"><Icon name="template" /></span>
              <div className="template-info">
                <strong>{t.nom}</strong>
                <span>
                  {t.champs.length} champ{t.champs.length > 1 ? 's' : ''}, modifié le{' '}
                  {new Date(t.dateModification).toLocaleDateString('fr-FR')}
                </span>
              </div>
              <div className="template-actions">
                <button type="button" onClick={() => navigate(`/modeles/${t.id}/modifier`)}><Icon name="edit" size={16} /> Modifier</button>
                <button type="button" onClick={() => navigate(`/modeles/${t.id}/modifier?export=1`)}><Icon name="download" size={16} /> Exporter</button>
                <button type="button" className="danger" onClick={() => supprimer(t)}><Icon name="trash" size={16} /> Supprimer</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default Templates
