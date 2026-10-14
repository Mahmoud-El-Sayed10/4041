// Sauvegarde temporaire des modèles dans le navigateur (localStorage).
// Plus tard, ces deux fonctions appelleront l'API Flask du backend.

const CLE = 'modeles'

export function lireModeles() {
  try {
    return JSON.parse(localStorage.getItem(CLE)) || []
  } catch {
    return []
  }
}

export function enregistrerModele(modele) {
  const modeles = lireModeles()
  const index = modeles.findIndex(m => m.id === modele.id)

  if (index === -1) {
    modeles.push(modele) // nouveau modèle
  } else {
    modeles[index] = modele // modèle déjà enregistré : on le met à jour
  }

  localStorage.setItem(CLE, JSON.stringify(modeles))
}

export function lireModele(id) {
  return lireModeles().find(m => m.id === id)
}

export function supprimerModele(id) {
  const modeles = lireModeles().filter(m => m.id !== id)
  localStorage.setItem(CLE, JSON.stringify(modeles))
}
