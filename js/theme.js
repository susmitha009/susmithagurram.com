/* theme.js — subtle 3D tilt on project cards (Bold direction).
   Additive and guarded: respects reduced-motion, never blocks clicks,
   and rebinds when the router re-renders #app. */
(function () {
  "use strict";
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const MAX = 5; // max tilt in degrees

  function bind() {
    document.querySelectorAll(".card").forEach((card) => {
      if (card.dataset.tilt) return;
      card.dataset.tilt = "1";
      card.addEventListener("mousemove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `translateY(-6px) perspective(820px) rotateX(${(-py * MAX).toFixed(2)}deg) rotateY(${(px * MAX).toFixed(2)}deg)`;
      });
      card.addEventListener("mouseleave", () => { card.style.transform = ""; });
    });
  }

  const app = document.getElementById("app");
  if (app) new MutationObserver(bind).observe(app, { childList: true, subtree: true });
  bind();
})();
