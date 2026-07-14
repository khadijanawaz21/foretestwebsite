// Shared submission helper for every lead-capture form (contact, homepage,
// academy, golden-visa, property enquiry). Each page keeps its own field
// collection and its own success/loading UI — this only owns the network
// call, automatic metadata capture, and a small shared inline-error helper,
// so that isn't duplicated five times.
(function () {
  function readUtmParams() {
    var params = new URLSearchParams(window.location.search);
    return {
      utmSource: params.get('utm_source') || undefined,
      utmMedium: params.get('utm_medium') || undefined,
      utmCampaign: params.get('utm_campaign') || undefined
    };
  }

  // Resolves with the parsed API response body (not just a boolean), so
  // future phases can read richer response data without every form's
  // handler needing to change.
  function submit(payload) {
    var body = Object.assign(
      {
        sourceUrl: window.location.href,
        referrer: document.referrer || undefined
      },
      readUtmParams(),
      payload
    );

    return fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          if (!res.ok) {
            var err = new Error((data && data.error) || 'Request failed with status ' + res.status);
            err.status = res.status;
            err.data = data;
            throw err;
          }
          return data;
        });
    });
  }

  function clearError(anchorEl) {
    var next = anchorEl.nextElementSibling;
    if (next && next.getAttribute && next.getAttribute('data-fore-lead-error') === '1') {
      next.remove();
    }
  }

  function showError(anchorEl, message) {
    clearError(anchorEl);
    var el = document.createElement('p');
    el.setAttribute('data-fore-lead-error', '1');
    el.style.cssText = 'color:#F44336;font-size:12px;line-height:1.6;margin-top:8px;';
    el.textContent = message;
    anchorEl.insertAdjacentElement('afterend', el);
  }

  window.FORELead = {
    submit: submit,
    showError: showError,
    clearError: clearError,
    DEFAULT_ERROR_MESSAGE: 'Something went wrong — please try again or email us at info@fairopportunityrealestate.com.'
  };
})();
