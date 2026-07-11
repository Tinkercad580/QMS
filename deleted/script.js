/* ============================================================
   FLOWDESK — script.js
   Handles: navbar scroll, hamburger, theme toggle,
            stats counter animation, ticker rotation,
            scroll reveals, card hover tilt, bar animation
============================================================ */

'use strict';

// ============================================================
// 1. THEME TOGGLE
// ============================================================
(function initTheme() {
  const root   = document.documentElement;
  const btn    = document.querySelector('[data-theme-toggle]');
  const sunIcon  = btn?.querySelector('.icon-sun');
  const moonIcon = btn?.querySelector('.icon-moon');

  // Resolve initial theme from system preference
  let theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyTheme(theme);

  btn?.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
  });

  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    if (sunIcon && moonIcon) {
      sunIcon.style.display  = t === 'dark'  ? 'block' : 'none';
      moonIcon.style.display = t === 'light' ? 'block' : 'none';
    }
    btn?.setAttribute('aria-label', `Switch to ${t === 'dark' ? 'light' : 'dark'} mode`);
  }
})();


// ============================================================
// 2. NAVBAR — scroll shadow + shrink
// ============================================================
(function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  let ticking = false;

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(() => {
        navbar.classList.toggle('scrolled', window.scrollY > 12);
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // run once on load
})();


// ============================================================
// 3. HAMBURGER MENU
// ============================================================
(function initHamburger() {
  const btn   = document.getElementById('hamburger');
  const links = document.getElementById('nav-links');
  if (!btn || !links) return;

  btn.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    btn.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
  });

  // Close on nav link click
  links.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      links.classList.remove('open');
      btn.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !links.contains(e.target)) {
      links.classList.remove('open');
      btn.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
})();


// ============================================================
// 4. STATS COUNTER ANIMATION
// ============================================================
(function initCounters() {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;

  // Easing function — ease out cubic
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animateCounter(el) {
    const target   = parseInt(el.getAttribute('data-count'), 10);
    const suffix   = el.getAttribute('data-suffix') || '';
    const duration = 1800; // ms
    const start    = performance.now();

    function tick(now) {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = easeOutCubic(progress);
      const current  = Math.round(eased * target);

      el.textContent = current.toLocaleString('en-IN') + suffix;

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = target.toLocaleString('en-IN') + suffix;
      }
    }

    requestAnimationFrame(tick);
  }

  // Use IntersectionObserver — fire once when stat strip enters view
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });

  counters.forEach(el => observer.observe(el));
})();


// ============================================================
// 5. LIVE TICKER ROTATION
// ============================================================
(function initTicker() {
  const el = document.getElementById('ticker-text');
  if (!el) return;

  const messages = [
    '23 patients waiting · Avg wait 28 min · Counter 3 serving A-71',
    'Token B-43 called · Blood Test · Counter 2',
    '87 patients served today · 4 no-shows · Peak: 10:00–11:30 AM',
    'Appointment slot open at 2:30 PM · OPD General',
    'New walk-in added — Token C-24 · Pharmacy · Est. 10 min',
    'Emergency priority issued — Token A-72 · Counter 1',
  ];

  let index = 0;

  function rotateTicker() {
    // Fade out
    el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    el.style.opacity    = '0';
    el.style.transform  = 'translateY(-6px)';

    setTimeout(() => {
      index = (index + 1) % messages.length;
      el.textContent = messages[index];

      // Fade in from below
      el.style.transform = 'translateY(6px)';
      el.style.opacity   = '0';

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.opacity   = '1';
          el.style.transform = 'translateY(0)';
        });
      });
    }, 420);
  }

  setInterval(rotateTicker, 4000);
})();


// ============================================================
// 6. PROGRESS BARS — animate on page load
// ============================================================
(function initBars() {
  const bars = document.querySelectorAll('.pc-bar-fill');
  if (!bars.length) return;

  // Store target widths then reset to 0, animate in
  bars.forEach(bar => {
    const target = bar.style.width;
    bar.style.width = '0%';

    // Short delay so CSS transition fires visibly
    setTimeout(() => {
      bar.style.width = target;
    }, 600);
  });
})();


// ============================================================
// 7. FEATURE CARD — subtle 3D tilt on hover
// ============================================================
(function initCardTilt() {
  const cards = document.querySelectorAll('.feature-card');
  if (!cards.length) return;

  // Disable on touch devices
  if (matchMedia('(hover: none)').matches) return;

  const MAX_TILT = 4; // degrees

  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect   = card.getBoundingClientRect();
      const cx     = rect.left + rect.width  / 2;
      const cy     = rect.top  + rect.height / 2;
      const dx     = (e.clientX - cx) / (rect.width  / 2);
      const dy     = (e.clientY - cy) / (rect.height / 2);
      const tiltX  =  dy * MAX_TILT;
      const tiltY  = -dx * MAX_TILT;

      card.style.transform  = `translateY(-4px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
      card.style.transition = 'transform 80ms linear';
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform  = '';
      card.style.transition = 'transform 400ms var(--ease-out, cubic-bezier(0.16,1,0.3,1))';
    });
  });
})();


// ============================================================
// 8. HERO PREVIEW CARDS — staggered entrance
// ============================================================
(function initHeroCards() {
  const cards = document.querySelectorAll('.preview-card');
  if (!cards.length) return;

  cards.forEach((card, i) => {
    card.style.opacity   = '0';
    card.style.transform = 'translateY(32px) scale(0.96)';
    card.style.transition = `opacity 0.6s var(--ease-out), transform 0.6s var(--ease-out)`;
    card.style.transitionDelay = `${300 + i * 120}ms`;

    // Trigger after a short paint frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        card.style.opacity   = '1';
        card.style.transform = 'translateY(0) scale(1)';
      });
    });
  });
})();


// ============================================================
// 9. SCROLL REVEAL — feature cards + stat items
// ============================================================
(function initScrollReveal() {
  // Only run if CSS scroll-driven animations are NOT supported
  if (CSS.supports('animation-timeline', 'scroll()')) return;

  const targets = document.querySelectorAll(
    '.feature-card, .stat-item, .section-header'
  );
  if (!targets.length) return;

  targets.forEach(el => {
    el.style.opacity   = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s var(--ease-out), transform 0.6s var(--ease-out)';
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // Stagger siblings that appear together
        const delay = Array.from(targets).indexOf(entry.target) % 3 * 80;
        setTimeout(() => {
          entry.target.style.opacity   = '1';
          entry.target.style.transform = 'translateY(0)';
        }, delay);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  targets.forEach(el => observer.observe(el));
})();


// ============================================================
// 10. ACTIVE NAV LINK — highlight based on current page
// ============================================================
(function initActiveNav() {
  const links    = document.querySelectorAll('.nav-link');
  const current  = window.location.pathname.split('/').pop() || 'index.html';

  links.forEach(link => {
    const href = link.getAttribute('href') || '';
    const page = href.split('/').pop();
    link.classList.toggle('active', page === current);
  });
})();


// ============================================================
// 11. SMOOTH PAGE TRANSITIONS — fade out on nav click
// ============================================================
(function initPageTransition() {
  // Inject fade-out style
  const style = document.createElement('style');
  style.textContent = `
    body.page-exit {
      opacity: 0;
      transform: translateY(-6px);
      transition: opacity 0.25s ease, transform 0.25s ease;
      pointer-events: none;
    }
    body {
      transition: opacity 0.25s ease, transform 0.25s ease;
    }
  `;
  document.head.appendChild(style);

  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    // Only internal .html links, not hash links
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto')) return;

    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.body.classList.add('page-exit');
      setTimeout(() => {
        window.location.href = href;
      }, 260);
    });
  });

  // Fade in on arrival
  document.body.style.opacity = '0';
  document.body.style.transform = 'translateY(6px)';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.style.opacity   = '1';
      document.body.style.transform = 'translateY(0)';
    });
  });
})();