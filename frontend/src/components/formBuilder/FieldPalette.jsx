const typesChamps = [
  { type: 'text', nom: 'Texte court' },
  { type: 'textarea', nom: 'Texte long' },
  { type: 'number', nom: 'Nombre' },
  { type: 'select', nom: 'Liste déroulante' },
  { type: 'material', nom: 'Matériau' },
  { type: 'date', nom: 'Date' },
  { type: 'section', nom: 'Section' }
]

function FieldPalette({ onAjouterChamp }) {
  return (
    <aside className="builder-panel">
      <h2>Champs disponibles</h2>
      {typesChamps.map(champ => (
        <button
          type="button"
          key={champ.type}
          className="field-item"
          onClick={() => onAjouterChamp(champ.type, champ.nom)}
        >
          <span className="field-icon">+</span>
          {champ.nom}
        </button>
      ))}
    </aside>
  )
}

export default FieldPalette
