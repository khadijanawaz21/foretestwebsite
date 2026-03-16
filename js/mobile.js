/* ═══════════════════════════════════════════════════════
   MOBILE EXPERIENCE — FORE
   Shared JS loaded on all pages.
   Handles: hamburger nav, smart nav, scroll-reveal,
   carousels, tap interactions, video autoplay fix.
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var isMobile = window.matchMedia('(max-width: 768px)');

  // ── Wait for components to be injected ──
  document.addEventListener('fore:ready', initMobile);
  // Fallback if fore:ready already fired
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(function () {
      if (!window.__mobileInited) initMobile();
    }, 1500);
  }

  function initMobile() {
    if (window.__mobileInited) return;
    window.__mobileInited = true;

    initHamburger();
    initSmartNav();
    initScrollReveal();
    initVideoAutoplay();

    if (isMobile.matches) {
      initPropertyCarousel();
      initTestimonialCarousel();
      initTeamTap();
    }

    // Re-init on resize crossing breakpoint
    isMobile.addEventListener('change', function (e) {
      if (e.matches) {
        initPropertyCarousel();
        initTestimonialCarousel();
        initTeamTap();
      }
    });
  }

  // ════════════════════════════════════════════
  // HAMBURGER NAV — works on ALL pages
  // ════════════════════════════════════════════
  function initHamburger() {
    var hamburger = document.getElementById('hamburger');
    var mobileNav = document.getElementById('mobileNav');
    var mobileNavClose = document.getElementById('mobileNavClose');

    if (!hamburger || !mobileNav || !mobileNavClose) return;
    if (hamburger.__mobileBound) return;
    hamburger.__mobileBound = true;

    hamburger.addEventListener('click', function (e) {
      e.stopPropagation();
      mobileNav.classList.add('open');
    });

    mobileNavClose.addEventListener('click', function () {
      mobileNav.classList.remove('open');
    });

    document.querySelectorAll('.mobile-link').forEach(function (link) {
      link.addEventListener('click', function () {
        mobileNav.classList.remove('open');
      });
    });

    // Close on tap outside
    document.addEventListener('click', function (e) {
      if (mobileNav.classList.contains('open') &&
          !mobileNav.contains(e.target) &&
          e.target !== hamburger &&
          !hamburger.contains(e.target)) {
        mobileNav.classList.remove('open');
      }
    });
  }

  // ════════════════════════════════════════════
  // SMART NAV — hide on scroll down, show on scroll up
  // ════════════════════════════════════════════
  function initSmartNav() {
    var nav = document.getElementById('nav');
    if (!nav) return;

    var lastScrollY = window.scrollY;
    var ticking = false;

    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(function () {
          if (!isMobile.matches) {
            nav.classList.remove('nav--hidden');
            ticking = false;
            return;
          }
          var currentY = window.scrollY;
          if (currentY > lastScrollY && currentY > 120) {
            nav.classList.add('nav--hidden');
          } else {
            nav.classList.remove('nav--hidden');
          }
          lastScrollY = currentY;
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  // ════════════════════════════════════════════
  // SCROLL REVEAL — IntersectionObserver system
  // ════════════════════════════════════════════
  function initScrollReveal() {
    // Observe .reveal, .reveal-left, .reveal-right classes
    var revealEls = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');

    // Also observe existing .fade-in elements on pages without main.js
    var fadeEls = document.querySelectorAll('.fade-in');

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    revealEls.forEach(function (el) { observer.observe(el); });
    fadeEls.forEach(function (el) {
      if (!el.classList.contains('visible')) observer.observe(el);
    });

    // Stagger children of [data-stagger] parents
    document.querySelectorAll('[data-stagger]').forEach(function (parent) {
      var delay = parseInt(parent.dataset.stagger) || 100;
      Array.from(parent.children).forEach(function (child, i) {
        child.style.transitionDelay = (i * delay) + 'ms';
        if (!child.classList.contains('reveal') &&
            !child.classList.contains('reveal-left') &&
            !child.classList.contains('reveal-right')) {
          child.classList.add('reveal');
        }
        observer.observe(child);
      });
    });
  }

  // ════════════════════════════════════════════
  // HERO VIDEO AUTOPLAY FIX
  // ════════════════════════════════════════════
  function initVideoAutoplay() {
    var videos = document.querySelectorAll('.hero-slide video');
    if (!videos.length) return;

    // Ensure all videos have correct attributes
    videos.forEach(function (v) {
      v.setAttribute('playsinline', '');
      v.setAttribute('muted', '');
      v.muted = true;
      v.setAttribute('autoplay', '');
    });

    // Try to play the active slide video
    var activeVideo = document.querySelector('.hero-slide.active video');
    if (activeVideo) {
      activeVideo.play().catch(function () {});
    }

    // On first user interaction, try to play all videos
    var played = false;
    function tryPlay() {
      if (played) return;
      played = true;
      videos.forEach(function (v) {
        v.muted = true;
        v.play().catch(function () {});
      });
      document.removeEventListener('touchstart', tryPlay);
      document.removeEventListener('click', tryPlay);
    }
    document.addEventListener('touchstart', tryPlay, { once: true, passive: true });
    document.addEventListener('click', tryPlay, { once: true });
  }

  // ════════════════════════════════════════════
  // PROPERTY CAROUSEL — snap scroll with dots
  // ════════════════════════════════════════════
  function initPropertyCarousel() {
    var grid = document.getElementById('propertyGrid');
    if (!grid || grid.__carouselInited) return;
    grid.__carouselInited = true;

    // Wait for cards to load (they're API-driven)
    var checkCount = 0;
    var checkInterval = setInterval(function () {
      var cards = grid.querySelectorAll('.prop-card, .property-card');
      checkCount++;
      if (cards.length > 0 || checkCount > 40) {
        clearInterval(checkInterval);
        if (cards.length > 0) setupDots(grid, cards);
      }
    }, 500);

    // Also observe DOM changes for when API loads
    var mo = new MutationObserver(function () {
      var cards = grid.querySelectorAll('.prop-card, .property-card');
      if (cards.length > 0) {
        // Remove existing dots first
        var existingDots = grid.parentElement.querySelector('.carousel-dots');
        if (existingDots) existingDots.remove();
        setupDots(grid, cards);
      }
    });
    mo.observe(grid, { childList: true });
  }

  function setupDots(container, cards) {
    if (!isMobile.matches) return;
    // Remove old dots
    var existing = container.parentElement.querySelector('.carousel-dots');
    if (existing) existing.remove();

    var dotsWrap = document.createElement('div');
    dotsWrap.className = 'carousel-dots';

    var maxDots = Math.min(cards.length, 8);
    for (var i = 0; i < maxDots; i++) {
      var dot = document.createElement('button');
      dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', 'Go to card ' + (i + 1));
      dot.dataset.index = i;
      (function (idx) {
        dot.addEventListener('click', function () {
          cards[idx].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        });
      })(i);
      dotsWrap.appendChild(dot);
    }

    container.insertAdjacentElement('afterend', dotsWrap);

    // Update active dot on scroll
    var scrollTimer;
    container.addEventListener('scroll', function () {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () {
        var containerRect = container.getBoundingClientRect();
        var center = containerRect.left + containerRect.width / 2;
        var closest = 0;
        var closestDist = Infinity;

        cards.forEach(function (card, idx) {
          if (idx >= maxDots) return;
          var rect = card.getBoundingClientRect();
          var cardCenter = rect.left + rect.width / 2;
          var dist = Math.abs(cardCenter - center);
          if (dist < closestDist) {
            closestDist = dist;
            closest = idx;
          }
        });

        dotsWrap.querySelectorAll('.carousel-dot').forEach(function (d, idx) {
          d.classList.toggle('active', idx === closest);
        });
      }, 60);
    }, { passive: true });
  }

  // ════════════════════════════════════════════
  // TESTIMONIAL CAROUSEL — auto-advance + swipe
  // ════════════════════════════════════════════
  function initTestimonialCarousel() {
    var grid = document.querySelector('.testimonial-grid');
    if (!grid || grid.__carouselInited) return;
    grid.__carouselInited = true;

    var cards = grid.querySelectorAll('.testimonial-card');
    if (cards.length < 2) return;

    setupDots(grid, cards);

    // Auto-advance
    var currentIdx = 0;
    var autoInterval;

    function advance() {
      currentIdx = (currentIdx + 1) % cards.length;
      cards[currentIdx].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    function startAuto() {
      clearInterval(autoInterval);
      autoInterval = setInterval(advance, 5000);
    }

    function stopAuto() {
      clearInterval(autoInterval);
    }

    startAuto();

    // Pause on touch
    grid.addEventListener('touchstart', stopAuto, { passive: true });
    grid.addEventListener('touchend', function () {
      setTimeout(startAuto, 3000);
    }, { passive: true });

    // Update current index on scroll
    grid.addEventListener('scroll', function () {
      var containerRect = grid.getBoundingClientRect();
      var center = containerRect.left + containerRect.width / 2;
      var closest = 0;
      var closestDist = Infinity;

      cards.forEach(function (card, idx) {
        var rect = card.getBoundingClientRect();
        var cardCenter = rect.left + rect.width / 2;
        var dist = Math.abs(cardCenter - center);
        if (dist < closestDist) {
          closestDist = dist;
          closest = idx;
        }
      });
      currentIdx = closest;
    }, { passive: true });
  }

  // ════════════════════════════════════════════
  // TEAM CARDS — tap to flip (no hover on mobile)
  // ════════════════════════════════════════════
  function initTeamTap() {
    var cards = document.querySelectorAll('.team-flip-card');
    if (!cards.length) return;

    cards.forEach(function (card) {
      if (card.__tapBound) return;
      card.__tapBound = true;

      card.addEventListener('click', function () {
        if (!isMobile.matches) return;
        var wasFlipped = card.classList.contains('flipped');

        // Close all other cards
        cards.forEach(function (c) {
          if (c !== card) c.classList.remove('flipped');
        });

        // Toggle this card
        card.classList.toggle('flipped', !wasFlipped);
      });
    });
  }

})();
