function FieldProperties({ champ, onModifier, onSupprimer }) {
  return (
    <aside className="builder-panel">
      <h2>Propriétés du champ</h2>
      {champ ? (
        <div className="field-properties">
          <label>Libellé affiché</label>
          <input
            type="text"
            value={champ.label}
            onChange={e => onModifier('label', e.target.value)}
          />

          <label>Type de champ</label>
          <input type="text" value={champ.type} disabled />

          <label>Description / aide</label>
          <textarea
            rows="3"
            value={champ.description}
            onChange={e => onModifier('description', e.target.value)}
            placeholder="Consigne pour le chercheur..."
          />

          {champ.type === 'number' && (
            <>
              <label>Unité</label>
              <input
                type="text"
                placeholder="Ex : °C, min, nm"
                value={champ.unit}
                onChange={e => onModifier('unit', e.target.value)}
              />
              <div className="property-row">
                <div>
                  <label>Minimum</label>
                  <input type="number" value={champ.min} onChange={e => onModifier('min', e.target.value)} />
                </div>
                <div>
                  <label>Maximum</label>
                  <input type="number" value={champ.max} onChange={e => onModifier('max', e.target.value)} />
                </div>
              </div>
            </>
          )}

          {champ.type === 'select' && (
            <>
              <label>Options (une par ligne)</label>
              <textarea
                rows="5"
                value={champ.options.join('\n')}
                onChange={e => onModifier('options', e.target.value.split('\n'))}
              />
            </>
          )}

          {champ.type !== 'section' && (
            <label className="checkbox-property">
              <input
                type="checkbox"
                checked={champ.required}
                onChange={e => onModifier('required', e.target.checked)}
              />
              Champ obligatoire
            </label>
          )}

          <button type="button" className="btn-delete-field" onClick={() => onSupprimer(champ.id)}>
            Supprimer le champ
          </button>
        </div>
      ) : (
        <div className="properties-empty">Sélectionnez un champ pour le configurer.</div>
      )}
    </aside>
  )
}

export default FieldProperties
