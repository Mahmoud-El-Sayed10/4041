
const materiaux = ['Or', 'Argent', 'Cuivre', 'Silicium']

function afficherChamp(champ, apercu) {
  const desactive = !apercu

  switch (champ.type) {
    case 'text':
      return (
        <input
          type="text"
          placeholder="Saisir un texte..."
          disabled={desactive}
        />
      )

    case 'textarea':
      return (
        <textarea
          placeholder="Saisir un texte..."
          rows="3"
          disabled={desactive}
        />
      )

    case 'number':
      return (
        <div className="field-with-unit">
          <input
            type="number"
            placeholder="0"
            min={champ.min === '' ? undefined : champ.min}
            max={champ.max === '' ? undefined : champ.max}
            disabled={desactive}
          />
          {champ.unit && <span>{champ.unit}</span>}
        </div>
      )

    case 'select':
      return (
        <select defaultValue="" disabled={desactive}>
          <option value="" disabled>Choisir...</option>
          {champ.options.filter(Boolean).map((option, index) => (
            <option key={`${index}-${option}`} value={option}>
              {option}
            </option>
          ))}
        </select>
      )

    case 'material':
      return (
        <select defaultValue="" disabled={desactive}>
          <option value="" disabled>Choisir un matériau...</option>
          {materiaux.map(materiau => (
            <option key={materiau} value={materiau}>
              {materiau}
            </option>
          ))}
        </select>
      )

    case 'date':
      return <input type="date" disabled={desactive} />

    case 'section':
      return (
        <p className="section-preview">
          {champ.description || 'Section du formulaire'}
        </p>
      )

    default:
      return null
  }
}

function FormEditor({
  champs,
  champSelectionne,
  apercu,
  onSelectionner,
  onDeplacer,
  onSupprimer
}) {
  return (
    <section className={`builder-canvas ${apercu ? 'preview-mode' : ''}`}>
      <div className="canvas-heading">
        <h2>
          {apercu ? 'Aperçu du formulaire' : 'Construction du formulaire'}
        </h2>
        <span>{champs.length} champ(s)</span>
      </div>

      <div className="canvas-fields">
        {champs.length === 0 ? (
          <div className="canvas-empty">
            <p>Votre formulaire est vide.</p>
            <span>
              Ajoutez des champs depuis le panneau de gauche.
            </span>
          </div>
        ) : (
          champs.map((champ, index) => (
            <div
              key={champ.id}
              className={`canvas-field ${
                champSelectionne === champ.id && !apercu
                  ? 'selected'
                  : ''
              }`}
              onClick={() => {
                if (!apercu) onSelectionner(champ.id)
              }}
            >
              {!apercu && (
                <div className="field-toolbar">
                  <span>{champ.type}</span>

                  <div>
                    <button
                      type="button"
                      aria-label={`Monter ${champ.label}`}
                      disabled={index === 0}
                      onClick={e => {
                        e.stopPropagation()
                        onDeplacer(champ.id, -1)
                      }}
                    >
                      ↑
                    </button>

                    <button
                      type="button"
                      aria-label={`Descendre ${champ.label}`}
                      disabled={index === champs.length - 1}
                      onClick={e => {
                        e.stopPropagation()
                        onDeplacer(champ.id, 1)
                      }}
                    >
                      ↓
                    </button>

                    <button
                      type="button"
                      aria-label={`Supprimer ${champ.label}`}
                      onClick={e => {
                        e.stopPropagation()
                        onSupprimer(champ.id)
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}

              <label className="canvas-label">
                {champ.label}
                {champ.required && (
                  <span className="required-mark"> *</span>
                )}
              </label>

              {afficherChamp(champ, apercu)}

              {champ.description && champ.type !== 'section' && (
                <small className="field-help">
                  {champ.description}
                </small>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  )
}

export default FormEditor
