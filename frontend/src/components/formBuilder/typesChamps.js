// Liste des types de champs proposés dans le constructeur.
// Sert aussi à afficher le nom en français et l'icône de chaque champ.
export const typesChamps = [
  { type: 'text', nom: 'Texte court', icone: 'text' },
  { type: 'textarea', nom: 'Texte long', icone: 'paragraph' },
  { type: 'number', nom: 'Nombre', icone: 'number' },
  { type: 'select', nom: 'Liste déroulante', icone: 'list' },
  { type: 'material', nom: 'Matériau', icone: 'material' },
  { type: 'date', nom: 'Date', icone: 'date' },
  { type: 'section', nom: 'Section', icone: 'section' }
]

export function infoType(type) {
  return typesChamps.find(t => t.type === type) || { nom: type, icone: 'text' }
}
