const steps = [
  { number: 1, title: 'Créer un modèle', text: 'Donnez un nom au modèle et choisissez l\'équipement concerné.' },
  { number: 2, title: 'Ajouter les champs', text: 'Texte, nombre, liste… choisissez les informations à remplir.' },
  { number: 3, title: 'Enregistrer', text: 'Le modèle est prêt à être rempli par les chercheurs.' },
]

function Fonctions() {
  return (
    <section className="card">
      <h2>Comment ça marche</h2>
      <div className="steps">
        {steps.map((step) => (
          <div key={step.number} className="step">
            <span className="step-number">{step.number}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default Fonctions