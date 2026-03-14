/**
 * FORE Component Loader
 * Fetches each [data-component] placeholder, replaces it with the fetched HTML,
 * then dispatches 'fore:ready' so main.js can safely initialise.
 */
document.addEventListener('DOMContentLoaded', function () {
  const placeholders = Array.from(document.querySelectorAll('[data-component]'));

  if (!placeholders.length) {
    document.dispatchEvent(new CustomEvent('fore:ready'));
    return;
  }

  const loads = placeholders.map(function (el) {
    const name = el.getAttribute('data-component');
    return fetch('components/' + name + '.html')
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load component: ' + name);
        return res.text();
      })
      .then(function (html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        // Replace the placeholder with the fetched nodes
        while (tmp.firstChild) {
          el.parentNode.insertBefore(tmp.firstChild, el);
        }
        el.parentNode.removeChild(el);
      })
      .catch(function (err) {
        console.warn('[FORE] Component load error:', err.message);
        el.parentNode.removeChild(el);
      });
  });

  Promise.all(loads).then(function () {
    document.dispatchEvent(new CustomEvent('fore:ready'));
  });
});
