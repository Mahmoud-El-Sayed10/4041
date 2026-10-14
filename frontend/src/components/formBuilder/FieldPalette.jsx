import Icon from '../Icon.jsx'
import { typesChamps } from './typesChamps.js'

function FieldPalette({ onAjouterChamp }) {
  return (
    <aside className="builder-panel">
      <h2>Champs disponibles</h2>
      <p className="panel-hint">Cliquez pour ajouter au formulaire.</p>
      {typesChamps.map(champ => (
        <button
          type="button"
          key={champ.type}
          className="field-item"
          onClick={() => onAjouterChamp(champ.type, champ.nom)}
        >
          <span className="field-icon"><Icon name={champ.icone} size={16} /></span>
          {champ.nom}
          <span className="field-add"><Icon name="plus" size={14} /></span>
        </button>
      ))}
    </aside>
  )
}

export default FieldPalette
