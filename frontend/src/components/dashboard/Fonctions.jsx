const steps = [
  { number: 1, title: 'Créer un template', text: 'Donnez un nom au template de votre équipement.' },
  { number: 2, title: 'Ajouter les champs', text: 'Texte, nombre, liste, date : choisissez ce que le chercheur devra renseigner.' },
  { number: 3, title: 'Enregistrer', text: 'Le template est prêt à être rempli et exporté en PDF.' },
]

function Fonctions() {
  return (
    <section className="card">
      <h2>Comment ça marche</h2>
      <ol className="steps">
        {steps.map((step) => (
          <li key={step.number} className="step">
            <span className="step-number">{step.number}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default Fonctions
