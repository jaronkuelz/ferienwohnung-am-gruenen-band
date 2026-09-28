// Zugriff auf die Netlify-Blobs-Speicher, die dieses Adminpanel benutzt.
const { getStore, connectLambda } = require('@netlify/blobs');

// Bei der klassischen Function-Schreibweise (exports.handler) muss Blobs
// einmal pro Aufruf mit dem aktuellen Request verbunden werden – ohne das
// bricht jeder Blobs-Zugriff mit einem nicht aussagekräftigen Fehler ab.
function connectBlobs(event) {
  connectLambda(event);
}

function configStore() {
  return getStore('fw-config');
}
function contentStore() {
  return getStore('fw-content');
}
function backupsStore() {
  return getStore('fw-backups');
}
function photosStore() {
  return getStore('fw-photos');
}

module.exports = { connectBlobs, configStore, contentStore, backupsStore, photosStore };
