// ── FORM HANDLER — global so inline onsubmit="handleForm(event)" can reach it ──
function handleForm(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const original = btn.textContent;
  btn.textContent = 'Message Sent';
  btn.style.background = '#4CAF50';
  btn.style.cursor = 'default';
  setTimeout(() => {
    btn.textContent = original;
    btn.style.background = '';
    btn.style.cursor = '';
    e.target.reset();
  }, 4000);
}

// ── All other init runs after components are injected ──
document.addEventListener('fore:ready', function () {

  // ── HERO (static — no slideshow) ──

  // ── HERO TEXT REVEAL — trigger immediately, don't wait for window.load ──
  requestAnimationFrame(() => {
    document.querySelectorAll('.hero-line-inner').forEach((el, i) => {
      el.style.animationDelay = (i * 0.1) + 's';
      el.classList.add('revealed');
    });
  });

  // ── HERO VIDEO FADE-IN (hide YouTube UI flash) ──
  setTimeout(() => {
    const vfade = document.querySelector('.hero-video-fadein');
    if (vfade) vfade.classList.add('visible');
  }, 2000);

  // ── HERO PARALLAX ──
  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    const heroBg = document.querySelector('.hero-video-bg');
    if (heroBg && scrolled < window.innerHeight) {
      heroBg.style.transform = `translateY(${scrolled * 0.3}px)`;
    }
  }, { passive: true });

  // ── MOBILE NAV ──
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobileNav');
  const mobileNavClose = document.getElementById('mobileNavClose');

  if (hamburger && mobileNav && mobileNavClose) {
    hamburger.addEventListener('click', () => mobileNav.classList.add('open'));
    mobileNavClose.addEventListener('click', () => mobileNav.classList.remove('open'));
    document.querySelectorAll('.mobile-link').forEach(link => {
      link.addEventListener('click', () => mobileNav.classList.remove('open'));
    });
  }

  // ── NAV SCROLL SHRINK ──
  const nav = document.getElementById('nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 80) {
        nav.style.top = '12px';
        nav.style.height = '54px';
      } else {
        nav.style.top = '24px';
        nav.style.height = '62px';
      }
    }, { passive: true });
  }

  // ── STATS COUNTING ANIMATION ──
  let statsCounted = false;
  function animateStats() {
    if (statsCounted) return;
    statsCounted = true;
    document.querySelectorAll('.stat-number[data-target]').forEach(el => {
      const target = parseInt(el.dataset.target, 10);
      const prefix = el.dataset.prefix || '';
      const suffix = el.dataset.suffix || '';
      if (target === 0) { el.textContent = prefix + '0' + suffix; return; }
      const duration = 1600;
      const start = performance.now();
      function step(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(eased * target);
        el.textContent = prefix + current + suffix;
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  const statsObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      animateStats();
      statsObserver.disconnect();
    }
  }, { threshold: 0.5 });
  const statsBar = document.getElementById('statsBar');
  if (statsBar) statsObserver.observe(statsBar);

  // ── STAGGERED PROPERTY CARDS ──
  const cardObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('card-visible');
        cardObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.prop-card, .property-card').forEach(card => cardObserver.observe(card));

  // ── INTERSECTION FADE-IN ──
  const fadeEls = document.querySelectorAll('.fade-in');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  fadeEls.forEach(el => observer.observe(el));

  // ── SMOOTH ANCHOR OFFSET ──
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const offset = 100;
        window.scrollTo({ top: target.offsetTop - offset, behavior: 'smooth' });
      }
    });
  });

  // ════════════════════════════════════════════
  // ── PROPERTY LISTINGS API ──
  // ════════════════════════════════════════════

  const LISTINGS_API = '/api/listings';

  // Secondary listings — Supabase config
  const SUPA_URL = 'https://famknekdbtrmxopywgsj.supabase.co';
  const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbWtuZWtkYnRybXhvcHl3Z3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NjMxOTksImV4cCI6MjA4OTAzOTE5OX0.HCmQ_4cyuImr3S1wQ-V6oW2G2U4a1rzMUlLPqHC-OeA';

  // Fallback hardcoded data (shown if API fails or returns empty)
  const FALLBACK_OFFPLAN = [
    {
      _fallback: true,
      name: 'Beachfront Residences',
      location: 'Dubai Marina',
      price_from: 1200000,
      image: null,
      completion_date: '2027',
      payment_plan: '60/40 Payment Plan',
    },
    {
      _fallback: true,
      name: 'The Address Residences',
      location: 'Downtown Dubai',
      price_from: 2100000,
      image: null,
      completion_date: '2026',
      payment_plan: null,
      badge_override: 'Ready to Move',
    },
    {
      _fallback: true,
      name: 'Park Lane by Ellington',
      location: 'Jumeirah Village Circle',
      price_from: 750000,
      image: null,
      completion_date: '2026',
      payment_plan: '70/30 Payment Plan',
    },
  ];
  const FALLBACK_SECONDARY = [];

  // ── State ──
  let cachedOffPlan   = null;
  let cachedSecondary = null;
  let activeTab       = 'offplan';

  const propertyGrid = document.getElementById('propertyGrid');
  const propTabs     = document.querySelectorAll('.prop-tab');

  // ── Helpers ──

  function formatPrice(raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    // If already a formatted string (contains letters), return as-is
    const stripped = String(raw).replace(/[^0-9.]/g, '');
    const num = parseFloat(stripped);
    if (isNaN(num) || num === 0) return String(raw);
    if (num >= 1_000_000) {
      const m = num / 1_000_000;
      return 'AED\u00a0' + (m === Math.floor(m) ? m.toFixed(0) : m.toFixed(1)) + 'M';
    }
    if (num >= 1000) return 'AED\u00a0' + Math.round(num / 1000) + 'K';
    return 'AED\u00a0' + num.toLocaleString();
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getImageHtml(src, alt) {
    if (!src) {
      return `<div class="property-img-placeholder" style="min-height:220px;"></div>`;
    }
    return `
      <div class="property-img-placeholder">
        <img
          src="${escHtml(src)}"
          alt="${escHtml(alt)}"
          loading="lazy"
          style="width:100%;height:100%;object-fit:cover;display:block;"
          onerror="this.parentElement.innerHTML=''"
        />
      </div>`;
  }

  // ── Card builders ──

  function buildOffPlanCard(p, index) {
    const delay     = (index * 0.12).toFixed(2) + 's';
    const name      = escHtml(p.ShortName || 'Dubai Property');
    const developer = escHtml((p.Organisation && p.Organisation.organizationName) || '');
    const district  = (p.Location && p.Location.district) ? escHtml(p.Location.district) : '';
    const city      = (p.Location && p.Location.city && p.Location.city.name) ? escHtml(p.Location.city.name) : '';
    const location  = district && city ? `${district}, ${city}` : district || city;
    const type      = escHtml((p.Type && p.Type.name) || '');
    const badge     = escHtml(p.OffplanOrSecondary || 'Off-Plan');
    const imgSrc    = p.Avatar ? escHtml(p.Avatar) : '';
    const rawPrice  = p.LayoutPriceMin;
    const price     = rawPrice ? 'AED ' + Number(rawPrice).toLocaleString() : '—';
    const year      = p.DeliveryDate ? new Date(p.DeliveryDate).getFullYear() : null;
    const link      = `property-detail.html?id=${p.project_id || ''}`;

    const imgHtml = imgSrc
      ? `<img src="${imgSrc}" alt="${name}" loading="lazy" onerror="this.style.display='none'" />`
      : '';

    return `
      <a href="${link}" class="prop-card" style="--card-delay:${delay}">
        <div class="prop-card-img">
          ${imgHtml}
          <span class="prop-badge">${badge}</span>
        </div>
        <div class="prop-card-body">
          <h3 class="prop-name">${name}</h3>
          ${developer ? `<p class="prop-developer">${developer}</p>` : ''}
          ${location  ? `<p class="prop-location">${location}</p>`   : ''}
          <div class="prop-meta">
            ${type ? `<span>${type}</span>` : '<span></span>'}
            ${year ? `<span>Handover ${year}</span>` : ''}
          </div>
          <p class="prop-price">${price}</p>
        </div>
      </a>`;
  }

  // ── Secondary card builder — Supabase data ──
  function buildSecondaryCard(s, index) {
    const delay     = (index * 0.12).toFixed(2) + 's';
    const name      = escHtml(s.name || 'Dubai Property');
    const loc       = [s.location, s.city].filter(Boolean).join(', ');
    const imgSrc    = s.image_main ? escHtml(s.image_main) : '';
    const rawPrice  = s.price;
    const price     = rawPrice ? 'AED ' + Number(rawPrice).toLocaleString() : '—';
    const beds      = s.bedrooms || '';
    const area      = s.area_sqft ? Number(s.area_sqft).toLocaleString() + ' sq ft' : '';

    const imgHtml   = imgSrc
      ? `<img src="${imgSrc}" alt="${name}" loading="lazy" onerror="this.style.display='none'" />`
      : '';

    return `
      <a href="property-detail.html?id=${escHtml(s.id || '')}&type=secondary" class="prop-card" style="--card-delay:${delay}">
        <div class="prop-card-img">
          ${imgHtml}
          <span class="prop-badge">Secondary</span>
        </div>
        <div class="prop-card-body">
          <h3 class="prop-name">${name}</h3>
          ${loc ? `<p class="prop-location">${escHtml(loc)}</p>` : ''}
          <div class="prop-meta">
            <span>${escHtml(beds)}</span>
            ${area ? `<span>${area}</span>` : ''}
          </div>
          <p class="prop-price">${price}</p>
        </div>
      </a>`;
  }

  // ── Skeleton ──

  function showSkeletons(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
      const delay = (i * 0.08).toFixed(2) + 's';
      html += `
        <div class="property-card skeleton" style="--card-delay:${delay}; opacity:1; transform:none;">
          <div class="skeleton-img skeleton-block"></div>
          <div class="skeleton-body">
            <div class="skeleton-block" style="height:8px;width:40%;margin-bottom:8px;"></div>
            <div class="skeleton-block" style="height:14px;width:80%;margin-bottom:14px;"></div>
            <div class="skeleton-block" style="height:8px;width:55%;margin-bottom:6px;"></div>
            <div class="skeleton-block" style="height:8px;width:35%;"></div>
          </div>
        </div>`;
    }
    propertyGrid.innerHTML = html;
  }

  // ── Render ──

  function renderCards(listings, type) {
    const items = listings.slice(0, 6);
    if (!items.length) {
      propertyGrid.innerHTML = '<p style="color:var(--white-35);font-size:12px;text-align:center;padding:40px 0;">No listings available right now.</p>';
      return;
    }
    propertyGrid.innerHTML = items
      .map((item, i) => type === 'offplan' ? buildOffPlanCard(item, i) : buildSecondaryCard(item, i))
      .join('');

    // Re-attach stagger observer to freshly rendered cards
    propertyGrid.querySelectorAll('.prop-card, .property-card').forEach(card => cardObserver.observe(card));
  }

  // ── Extract array from unknown API shape ──

  function extractArray(data) {
    if (!data) return [];
    if (Array.isArray(data.response))       return data.response;
    if (Array.isArray(data))                return data;
    if (Array.isArray(data.objects))        return data.objects;
    if (Array.isArray(data.data))           return data.data;
    if (Array.isArray(data.results))        return data.results;
    if (Array.isArray(data.items))          return data.items;
    if (Array.isArray(data.listings))       return data.listings;
    // Try first array-valued key
    const arrKey = Object.keys(data).find(k => Array.isArray(data[k]));
    return arrKey ? data[arrKey] : [];
  }

  // ── Fetch ──

  async function loadProperties() {
    showSkeletons(6);
    try {
      const supaSecondary = window.supabase
        ? window.supabase.createClient(SUPA_URL, SUPA_KEY)
            .from('secondary_listings').select('*')
            .then(function(res) { return (res.data || []); })
            .catch(function() { return []; })
        : Promise.resolve([]);

      const [apiRes, secArr] = await Promise.all([
        fetch(LISTINGS_API).then(r => r.json()).catch(() => ({ listings: [] })),
        supaSecondary,
      ]);

      const opArr = apiRes.listings || [];

      console.log('[FORE] Off-Plan API — ' + opArr.length + ' listings (via /api/listings)');
      console.log('[FORE] Secondary Supabase — ' + secArr.length + ' listings');

      cachedOffPlan   = opArr.length  ? opArr  : FALLBACK_OFFPLAN;
      cachedSecondary = secArr.length ? secArr : FALLBACK_SECONDARY;
    } catch (err) {
      cachedOffPlan   = FALLBACK_OFFPLAN;
      cachedSecondary = FALLBACK_SECONDARY;
    }

    renderCards(activeTab === 'offplan' ? cachedOffPlan : cachedSecondary, activeTab);
  }

  // ── Tab switching ──

  propTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.tab === activeTab) return;
      activeTab = tab.dataset.tab;

      propTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      // Use cached data — no re-fetch
      if (activeTab === 'offplan' && cachedOffPlan) {
        renderCards(cachedOffPlan, 'offplan');
      } else if (activeTab === 'secondary' && cachedSecondary) {
        renderCards(cachedSecondary, 'secondary');
      } else {
        // Data not yet ready (shouldn't happen but guard anyway)
        showSkeletons(6);
      }
    });
  });

  loadProperties();

}); // end fore:ready
