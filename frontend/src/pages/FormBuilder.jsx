
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import FieldPalette from '../components/formBuilder/FieldPalette.jsx'
import FormEditor from '../components/formBuilder/FormEditor.jsx'
import FieldProperties from '../components/formBuilder/FieldProperties.jsx'
import { enregistrerModele, lireModele } from '../utils/modeles.js'
import './FormBuilder.css'

// Page affichée pour /modeles/nouveau et /modeles/:id/modifier.
// La « key » remet le formulaire à zéro quand on passe d'un modèle à un autre.
function FormBuilder() {
  const { id } = useParams()
  return <EditeurModele key={id || 'nouveau'} id={id} />
}

function EditeurModele({ id }) {
  // En modification, on recharge le modèle enregistré
  const [modeleExistant] = useState(() => (id ? lireModele(id) : null))
  const [searchParams] = useSearchParams()

  // Identifiant créé une seule fois : enregistrer plusieurs fois met à jour le même modèle
  const [modeleId] = useState(() => modeleExistant?.id || crypto.randomUUID())
  const [nomModele, setNomModele] = useState(modeleExistant?.nom || '')
  const [champs, setChamps] = useState(modeleExistant?.champs || [])
  const [champSelectionne, setChampSelectionne] = useState(null)
  const [apercu, setApercu] = useState(false)
  const [message, setMessage] = useState('')

  const champActif = champs.find(champ => champ.id === champSelectionne)

  // Bouton « Exporter » du tableau de bord : on ouvre directement la fenêtre PDF
  useEffect(() => {
    if (searchParams.get('export') === '1' && modeleExistant) {
      const timer = setTimeout(() => window.print(), 300)
      return () => clearTimeout(timer)
    }
  }, [searchParams, modeleExistant])

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

  function sauvegarder() {
    if (!nomModele.trim()) {
      setMessage('Veuillez renseigner le nom du modèle.')
      return
    }

    enregistrerModele({
      id: modeleId,
      nom: nomModele.trim(),
      champs,
      dateModification: new Date().toISOString()
    })
    setMessage('Modèle enregistré avec succès.')
  }

  function exporterPdf() {
    if (champs.length === 0) {
      setMessage('Ajoutez au moins un champ avant d’exporter en PDF.')
      return
    }
    setMessage('')
    // Ouvre la fenêtre d'impression du navigateur : choisir « Enregistrer au format PDF »
    window.print()
  }

  return (
    <div className="form-builder">
      <header className="builder-header">
        <div>
          <h1>{modeleExistant ? 'Modifier le modèle' : 'Créer un modèle'}</h1>
          <p>Construisez un formulaire pour vos équipements.</p>
        </div>
        <div className="builder-actions">
          <button type="button" className="btn-preview" onClick={() => setApercu(!apercu)}>
            {apercu ? 'Quitter l’aperçu' : 'Aperçu'}
          </button>
          <button type="button" className="btn-preview" onClick={exporterPdf}>
            Exporter en PDF
          </button>
          <button type="button" className="btn-publish" onClick={sauvegarder}>
            Enregistrer
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
