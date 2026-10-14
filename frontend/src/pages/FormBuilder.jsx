
import { useState } from 'react'
import FieldPalette from '../components/formBuilder/FieldPalette.jsx'
import FormEditor from '../components/formBuilder/FormEditor.jsx'
import FieldProperties from '../components/formBuilder/FieldProperties.jsx'
import './FormBuilder.css'

function FormBuilder() {
  const [nomModele, setNomModele] = useState('')
  const [champs, setChamps] = useState([])
  const [champSelectionne, setChampSelectionne] = useState(null)
  const [apercu, setApercu] = useState(false)
  const [message, setMessage] = useState('')

  const champActif = champs.find(champ => champ.id === champSelectionne)

  function ajouterChamp(type, nom) {
    const nouveauChamp = {
      id: crypto.randomUUID(), type, label: nom,
      required: false, unit: '', min: '', max: '', description: '',
      options: ['Option 1', 'Option 2']
    }
    setChamps(anciens => [...anciens, nouveauChamp])
    setChampSelectionne(nouveauChamp.id)
    setMessage('')
  }

  function modifierChamp(propriete, valeur) {
    setChamps(anciens => anciens.map(champ =>
      champ.id === champSelectionne ? { ...champ, [propriete]: valeur } : champ
    ))
  }

  function supprimerChamp(id) {
    setChamps(anciens => anciens.filter(champ => champ.id !== id))
    setChampSelectionne(selection => selection === id ? null : selection)
  }

  function deplacerChamp(id, direction) {
    setChamps(anciens => {
      const liste = [...anciens]
      const index = liste.findIndex(champ => champ.id === id)
      const nouvelIndex = index + direction
      if (index < 0 || nouvelIndex < 0 || nouvelIndex >= liste.length) return anciens
      ;[liste[index], liste[nouvelIndex]] = [liste[nouvelIndex], liste[index]]
      return liste
    })
  }

  function sauvegarder(statut) {
    if (!nomModele.trim()) {
      setMessage('Veuillez renseigner le nom du modèle.')
      return
    }
    if (statut === 'publie' && champs.length === 0) {
      setMessage('Ajoutez au moins un champ avant de publier.')
      return
    }

    const modele = {
      id: crypto.randomUUID(),
      nom: nomModele,
      statut,
      champs
    }

    localStorage.setItem('modele-brouillon', JSON.stringify(modele))
    setMessage(statut === 'publie'
      ? 'Modèle publié localement (démonstration).'
      : 'Brouillon enregistré.')
  }

  return (
    <div className="form-builder">
      <header className="builder-header">
        <div>
          <h1>Créer un modèle</h1>
          <p>Construisez un formulaire pour vos équipements.</p>
        </div>
        <div className="builder-actions">
          <button type="button" className="btn-preview" onClick={() => setApercu(!apercu)}>
            {apercu ? 'Quitter l’aperçu' : 'Aperçu'}
          </button>
          <button type="button" className="btn-publish" onClick={() => sauvegarder('brouillon')}>
            Enregistrer le template
          </button>
        </div>
      </header>

      {message && <div className="builder-message">{message}</div>}

      <section className="builder-info">
        <div>
          <label>Nom du modèle</label>
          <input
            type="text"
            value={nomModele}
            onChange={e => setNomModele(e.target.value)}
          />
        </div>
      </section>

      <div className="builder-workspace">
        {!apercu && <FieldPalette onAjouterChamp={ajouterChamp} />}

        <FormEditor
          champs={champs}
          champSelectionne={champSelectionne}
          apercu={apercu}
          onSelectionner={setChampSelectionne}
          onDeplacer={deplacerChamp}
          onSupprimer={supprimerChamp}
        />

        {!apercu && (
          <FieldProperties
            champ={champActif}
            onModifier={modifierChamp}
            onSupprimer={supprimerChamp}
          />
        )}
      </div>
    </div>
  )
}

export default FormBuilder
