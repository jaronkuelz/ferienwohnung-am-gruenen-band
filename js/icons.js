// Feste Symbol-Auswahl für die Ausstattungs-Kästchen. Wird sowohl von der
// Website (site.js) als auch vom Adminpanel (admin/app.js) benutzt, damit
// beide exakt dieselben Symbole zeigen.
window.FW_ICONS = {
  wifi: '<path d="M2 8.5a15 15 0 0 1 20 0"/><path d="M5.5 12.2a10 10 0 0 1 13 0"/><path d="M9 15.8a5 5 0 0 1 6 0"/><circle cx="12" cy="19" r="1.1" fill="currentColor" stroke="none"/>',
  kueche: '<path d="M4 12h14a2 2 0 0 1 2 2v1a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-3Z"/><path d="M4 12a2 2 0 1 1 0-4"/><path d="M9 8V4M12 8V4M15 8V5"/>',
  bad: '<path d="M4 12h16a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-1a1 1 0 0 1 1-1Z"/><path d="M6 12V7.5A2 2 0 0 1 8 5.5c1 0 1.6.5 1.9 1.1"/><path d="M4 20v1M18 20v1"/>',
  heizung: '<path d="M3 19h18"/><path d="M6.5 15c1-1 1-2 0-3s-1-2 0-3"/><path d="M11.5 15c1-1 1-2 0-3s-1-2 0-3"/><path d="M16.5 15c1-1 1-2 0-3s-1-2 0-3"/>',
  tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
  ebike: '<circle cx="12" cy="12" r="9"/><path d="M13 7l-4 6h3l-1 4 4-6h-3l1-4Z"/>',
  klima: '<path d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11"/><path d="M12 5 10 3M12 5l2-2M12 19l-2 2M12 19l2 2M6 9 4 8.5M6 9l-.5-2M18 9l2-.5M18 9l.5-2M6 15l-2 .5M6 15l-.5 2M18 15l2 .5M18 15l.5 2"/>',
  parken: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 16V7h3.5a2.75 2.75 0 0 1 0 5.5H9"/>',
  haustier: '<circle cx="7" cy="8" r="1.6"/><circle cx="11.5" cy="5.5" r="1.6"/><circle cx="16" cy="8" r="1.6"/><circle cx="18" cy="12.5" r="1.6"/><path d="M12 12c-3 0-5.5 1.8-5.5 4.2 0 1.7 1.5 2.8 3.2 2.4.9-.2 1.5-.6 2.3-.6s1.4.4 2.3.6c1.7.4 3.2-.7 3.2-2.4 0-2.4-2.5-4.2-5.5-4.2Z"/>',
  stern: '<path d="M12 3l2.6 5.8 6.2.6-4.7 4.2 1.4 6.1L12 16.9 6.5 19.7l1.4-6.1-4.7-4.2 6.2-.6Z"/>',
};

window.FW_ICON_LABELS = {
  wifi: 'WLAN',
  kueche: 'Küche/Herd',
  bad: 'Bad/Dusche',
  heizung: 'Heizung',
  tv: 'Fernseher',
  ebike: 'E-Bike/Rad',
  klima: 'Klimaanlage',
  parken: 'Parkplatz',
  haustier: 'Haustiere',
  stern: 'Sonstiges',
};

function fwIconSvg(name) {
  var inner = window.FW_ICONS[name] || window.FW_ICONS.stern;
  return (
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    inner +
    '</svg>'
  );
}
