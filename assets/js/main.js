/* ==========================================================================
   DropSignal It — Core interactions
   Navbar · Mobile menu · Smooth scroll · Accordion · Filters · Forms
   ========================================================================== */
(function () {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ------------------------------------------------------------------
     Navbar background on scroll + back-to-top visibility
     ------------------------------------------------------------------ */
  const header = $(".site-header");
  const backToTop = $(".back-to-top");

  function onScroll() {
    const y = window.scrollY;
    if (header) header.classList.toggle("is-scrolled", y > 24);
    if (backToTop) backToTop.classList.toggle("is-visible", y > 800);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (backToTop) {
    backToTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
    });
  }

  /* ------------------------------------------------------------------
     Mega menu (desktop): hover or click to open, Escape / outside click
     to close. Hover only applies to devices that can actually hover.
     ------------------------------------------------------------------ */
  const megaItems = $$(".nav__item.has-mega");
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)");
  let megaTimer;

  // Opens `item` (closing any other); pass null to close everything
  function closeMega(item) {
    clearTimeout(megaTimer);
    megaItems.forEach((el) => {
      const active = el === item;
      el.classList.toggle("is-open", active);
      $(".nav__trigger", el).setAttribute("aria-expanded", String(active));
    });
    if (header) header.classList.toggle("mega-open", Boolean(item));
  }

  megaItems.forEach((item) => {
    const trigger = $(".nav__trigger", item);

    trigger.addEventListener("click", () => {
      closeMega(item.classList.contains("is-open") ? null : item);
    });

    item.addEventListener("mouseenter", () => canHover.matches && closeMega(item));

    // Keyboard: leaving the item with Tab closes it (unless the pointer is over it)
    item.addEventListener("focusout", (e) => {
      if (!item.contains(e.relatedTarget) && !item.matches(":hover")) closeMega(null);
    });

    // Placeholder links (no page yet) should not jump to the top of the page
    $$('a[href="#"]', item).forEach((a) => a.addEventListener("click", (e) => e.preventDefault()));
  });

  if (header) {
    header.addEventListener("mouseenter", () => clearTimeout(megaTimer));
    header.addEventListener("mouseleave", () => {
      if (canHover.matches) megaTimer = setTimeout(() => closeMega(null), 150);
    });
    // Hovering plain links (About, Contact) closes any open panel
    $$(".nav__item:not(.has-mega)", header).forEach((el) =>
      el.addEventListener("mouseenter", () => canHover.matches && closeMega(null))
    );
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".nav__item.has-mega")) closeMega(null);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const open = megaItems.find((el) => el.classList.contains("is-open"));
    if (open) {
      closeMega(null);
      $(".nav__trigger", open).focus();
    }
  });

  window.matchMedia("(max-width: 1024px)").addEventListener("change", (e) => e.matches && closeMega(null));

  /* ------------------------------------------------------------------
     Mobile menu
     ------------------------------------------------------------------ */
  const toggle = $(".nav__toggle");
  const menu = $("#mobile-menu");

  function setMenu(open) {
    if (!toggle || !menu) return;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", String(!open));
    menu.inert = !open;
    header.classList.toggle("menu-open", open);
    document.body.classList.toggle("no-scroll", open);
    if (open) {
      closeMega(null);
      const first = $(".mobile-menu__links > li > :is(a, button)", menu);
      if (first) setTimeout(() => first.focus(), 300);
    }
  }

  if (toggle && menu) {
    menu.inert = true;
    toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
    $$("a", menu).forEach((a) => a.addEventListener("click", (e) => {
      if (a.getAttribute("href") === "#") e.preventDefault(); // placeholder: no page yet
      setMenu(false);
    }));

    // Services / Insights accordions
    $$(".mm-trigger", menu).forEach((btn) => {
      btn.addEventListener("click", () => {
        const open = btn.getAttribute("aria-expanded") !== "true";
        $$(".mm-trigger", menu).forEach((other) => other.setAttribute("aria-expanded", String(other === btn && open)));
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menu.classList.contains("is-open")) {
        setMenu(false);
        toggle.focus();
      }
      // Keep focus inside the open menu (toggle + menu links)
      if (e.key === "Tab" && menu.classList.contains("is-open")) {
        const focusables = [toggle, ...$$("a, button", menu)];
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    // Close the panel if the viewport grows past the mobile breakpoint
    window.matchMedia("(min-width: 1025px)").addEventListener("change", (e) => {
      if (e.matches) setMenu(false);
    });
  }

  /* ------------------------------------------------------------------
     Links to pages that don't exist yet: [data-soon] should do nothing
     ------------------------------------------------------------------ */
  $$("a[data-soon]").forEach((a) => a.addEventListener("click", (e) => e.preventDefault()));

  /* ------------------------------------------------------------------
     Smooth scrolling for in-page anchors
     ------------------------------------------------------------------ */
  $$('a[href^="#"]:not([href="#"])').forEach((link) => {
    link.addEventListener("click", (e) => {
      const target = document.getElementById(link.getAttribute("href").slice(1));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    });
  });

  /* ------------------------------------------------------------------
     FAQ accordion
     ------------------------------------------------------------------ */
  $$("[data-accordion]").forEach((accordion) => {
    const single = accordion.hasAttribute("data-single");
    $$(".accordion__trigger", accordion).forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const item = trigger.closest(".accordion__item");
        const isOpen = trigger.getAttribute("aria-expanded") === "true";

        if (single) {
          $$(".accordion__item", accordion).forEach((other) => {
            if (other !== item) {
              other.classList.remove("is-open");
              $(".accordion__trigger", other).setAttribute("aria-expanded", "false");
            }
          });
        }
        item.classList.toggle("is-open", !isOpen);
        trigger.setAttribute("aria-expanded", String(!isOpen));
      });
    });
  });

  /* ------------------------------------------------------------------
     Category filters (blog, books, courses)
     ------------------------------------------------------------------ */
  $$("[data-filters]").forEach((group) => {
    const scope = document.getElementById(group.dataset.filters);
    if (!scope) return;
    const buttons = $$(".filter-btn", group);
    const items = $$("[data-filter-item]", scope);
    const status = $("[data-filter-status]", group.parentElement);

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = btn.dataset.filter;
        buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
        let shown = 0;
        items.forEach((item) => {
          const match = value === "all" || item.dataset.filterItem.split(" ").includes(value);
          item.classList.toggle("is-hidden", !match);
          if (match) {
            shown++;
            item.classList.add("is-visible");
          }
        });
        if (status) status.textContent = `Showing ${shown} item${shown === 1 ? "" : "s"}`;
      });
    });
  });

  /* ------------------------------------------------------------------
     Newsletter forms (demo — no backend)
     ------------------------------------------------------------------ */
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  $$("[data-subscribe]").forEach((form) => {
    const input = $('input[type="email"]', form);
    const msg = form.parentElement.querySelector(".subscribe__msg");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const value = input.value.trim();
      if (!emailPattern.test(value)) {
        if (msg) { msg.textContent = "Please enter a valid email address."; msg.style.color = "#FCA5A5"; }
        input.setAttribute("aria-invalid", "true");
        input.focus();
        return;
      }
      input.removeAttribute("aria-invalid");
      if (msg) { msg.textContent = "You're in. Check your inbox to confirm your subscription."; msg.style.color = ""; }
      form.reset();
    });
  });

  /* ------------------------------------------------------------------
     Contact form validation (demo — no backend)
     ------------------------------------------------------------------ */
  const contactForm = $("#contact-form");
  if (contactForm) {
    const status = $(".form__status", contactForm);

    const validators = {
      name: (v) => (v.length >= 2 ? "" : "Please share your name."),
      email: (v) => (emailPattern.test(v) ? "" : "Please enter a valid email address."),
      topic: (v) => (v ? "" : "Please choose a topic."),
      message: (v) => (v.length >= 20 ? "" : "Your message should be at least 20 characters."),
    };

    function validateField(field) {
      const rule = validators[field.name];
      if (!rule) return true;
      const error = rule(field.value.trim());
      const wrapper = field.closest(".field");
      const errorEl = $(".field__error", wrapper);
      wrapper.classList.toggle("is-invalid", Boolean(error));
      field.setAttribute("aria-invalid", String(Boolean(error)));
      if (errorEl) errorEl.textContent = error;
      return !error;
    }

    $$("input, textarea, select", contactForm).forEach((field) => {
      field.addEventListener("blur", () => validateField(field));
      field.addEventListener("input", () => {
        if (field.closest(".field")?.classList.contains("is-invalid")) validateField(field);
      });
    });

    function showStatus(message, isError) {
      status.textContent = message;
      status.classList.toggle("is-error", isError);
      status.classList.add("is-visible");
      status.focus();
    }

    // Surface server-side field errors next to the matching inputs
    function showServerErrors(errors) {
      let first = null;
      Object.entries(errors || {}).forEach(([name, message]) => {
        const field = contactForm.elements[name];
        if (!field || !field.closest) return;
        const wrapper = field.closest(".field");
        wrapper.classList.add("is-invalid");
        field.setAttribute("aria-invalid", "true");
        $(".field__error", wrapper).textContent = message;
        first = first || field;
      });
      return first;
    }

    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fields = $$("input[name], textarea[name], select[name]", contactForm).filter((f) => validators[f.name]);
      const results = fields.map(validateField);
      const firstInvalid = fields[results.indexOf(false)];
      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      const submit = $('button[type="submit"]', contactForm);
      const label = submit.querySelector("span");
      submit.disabled = true;
      label.textContent = "Sending…";
      status.classList.remove("is-visible");

      try {
        const response = await fetch(contactForm.action, {
          method: "POST",
          body: new FormData(contactForm),
          headers: { Accept: "application/json" },
        });
        const data = await response.json().catch(() => ({ ok: false }));

        if (response.ok && data.ok) {
          contactForm.reset();
          showStatus(data.message || "Thank you! Your message is on its way.", false);
        } else {
          const field = showServerErrors(data.errors);
          showStatus(data.message || "Sorry, something went wrong. Please try again.", true);
          if (field) field.focus();
        }
      } catch (err) {
        showStatus("Network error. Please check your connection and try again.", true);
      } finally {
        submit.disabled = false;
        label.textContent = "Send message";
      }
    });
  }

  /* ------------------------------------------------------------------
     Footer year
     ------------------------------------------------------------------ */
  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
})();
