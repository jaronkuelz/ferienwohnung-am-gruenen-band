// Zugriff auf die Netlify-Blobs-Speicher, die dieses Adminpanel benutzt.
const { getStore, connectLambda } = require('@netlify/blobs');

// Bei der klassischen Function-Schreibweise (exports.handler) muss Blobs
// einmal pro Aufruf mit dem aktuellen Request verbunden werden – ohne das
// bricht jeder Blobs-Zugriff mit einem nicht aussagekräftigen Fehler ab.
function connectBlobs(event) {
  connectLambda(event);
}

// "strong" statt des Standards "eventual": ein gespeicherter Wert muss sofort
// beim nächsten Laden sichtbar sein (wichtig fürs Adminpanel – sonst wirkt
// das Speichern manchmal wirkungslos, weil kurz danach noch der alte Stand
// ausgeliefert wird).
function configStore() {
  return getStore({ name: 'fw-config', consistency: 'strong' });
}
function contentStore() {
  return getStore({ name: 'fw-content', consistency: 'strong' });
}
function backupsStore() {
  return getStore({ name: 'fw-backups', consistency: 'strong' });
}
function photosStore() {
  return getStore({ name: 'fw-photos', consistency: 'strong' });
}

module.exports = { connectBlobs, configStore, contentStore, backupsStore, photosStore };
