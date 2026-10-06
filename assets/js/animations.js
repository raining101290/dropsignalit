/* ==========================================================================
   DropSignal It — Motion
   Fade-up reveal · Headline split · Counters · Parallax · Timeline progress
   All effects are skipped or simplified under prefers-reduced-motion.
   ========================================================================== */
(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ------------------------------------------------------------------
     Split headlines into words for a staggered reveal
     ------------------------------------------------------------------ */
  function splitWords(el) {
    let index = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(" "));
              return;
            }
            const outer = document.createElement("span");
            outer.className = "word";
            const inner = document.createElement("span");
            inner.style.setProperty("--i", index++);
            inner.textContent = part;
            outer.appendChild(inner);
            frag.appendChild(outer);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
        }
      });
    };
    // Keep the accessible name intact for screen readers
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    walk(el);
    $$(".word", el).forEach((w) => w.setAttribute("aria-hidden", "true"));
  }

  if (!reduceMotion) $$(".split-reveal").forEach(splitWords);

  /* ------------------------------------------------------------------
     Reveal on scroll (fade up, etc.)
     ------------------------------------------------------------------ */
  const revealTargets = $$("[data-animate], .split-reveal, .skills");

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealTargets.forEach((el) => el.classList.add("is-visible"));
  } else {
    // Auto-stagger siblings inside [data-stagger] containers
    $$("[data-stagger]").forEach((group) => {
      const step = parseFloat(group.dataset.stagger) || 0.08;
      $$(":scope > [data-animate]", group).forEach((child, i) => {
        child.style.setProperty("--delay", `${(i * step).toFixed(2)}s`);
      });
    });

    const revealObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    revealTargets.forEach((el) => revealObserver.observe(el));
  }

  /* ------------------------------------------------------------------
     Counter animation — <span data-count="250000" data-suffix="+">
     ------------------------------------------------------------------ */
  const formatNumber = (value, decimals) =>
    value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  function runCounter(el) {
    const target = parseFloat(el.dataset.count);
    const decimals = (el.dataset.count.split(".")[1] || "").length;
    const duration = parseInt(el.dataset.duration, 10) || 2000;
    const start = performance.now();
    const easeOut = (t) => 1 - Math.pow(1 - t, 4);

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      el.textContent = formatNumber(target * easeOut(progress), decimals);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  const counters = $$("[data-count]");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    counters.forEach((el) => {
      const decimals = (el.dataset.count.split(".")[1] || "").length;
      el.textContent = formatNumber(parseFloat(el.dataset.count), decimals);
    });
  } else {
    const counterObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          runCounter(entry.target);
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach((el) => counterObserver.observe(el));
  }

  /* ------------------------------------------------------------------
     Subtle parallax — <img data-parallax="0.08">
     ------------------------------------------------------------------ */
  const parallaxEls = $$("[data-parallax]");
  const timelineWrap = document.querySelector(".timeline-wrap");
  const timelineBar = document.querySelector(".timeline__progress");

  if (!reduceMotion && (parallaxEls.length || timelineBar)) {
    let ticking = false;

    const update = () => {
      const vh = window.innerHeight;

      parallaxEls.forEach((el) => {
        const rect = el.parentElement.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > vh) return;
        const speed = parseFloat(el.dataset.parallax) || 0.08;
        const offset = (rect.top + rect.height / 2 - vh / 2) * -speed;
        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
      });

      if (timelineWrap && timelineBar) {
        const rect = timelineWrap.getBoundingClientRect();
        const progress = Math.min(Math.max((vh * 0.6 - rect.top) / rect.height, 0), 1);
        timelineBar.style.height = `${(progress * 100).toFixed(2)}%`;
      }

      ticking = false;
    };

    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          requestAnimationFrame(update);
          ticking = true;
        }
      },
      { passive: true }
    );
    window.addEventListener("resize", update, { passive: true });
    update();
  } else if (timelineBar) {
    timelineBar.style.height = "100%";
  }
})();
