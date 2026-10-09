// Appliqué avant le rendu pour éviter un flash de mauvais thème.
(function () {
  try {
    var saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved);
  } catch (e) { /* stockage indisponible : on suit le système */ }
})();
