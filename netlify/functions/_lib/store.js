// Zugriff auf die Netlify-Blobs-Speicher, die dieses Adminpanel benutzt.
const { getStore } = require('@netlify/blobs');

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

module.exports = { configStore, contentStore, backupsStore, photosStore };
