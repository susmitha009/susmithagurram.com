/* ============================================================
   app.js — manifest-driven renderer.
   Reads data/site.json and renders every page as one long,
   scrolling page; the top nav jumps to each part.
   Section types: hero, about, text, news, projects,
   publications, education, experience, skills, awards, contact.
   Adding a new section type = add a renderer to RENDERERS.
   ============================================================ */
"use strict";

const cache = {};

async function loadJSON(path) {
  if (cache[path]) return cache[path];
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error("Failed to load " + path);
  const data = await res.json();
  cache[path] = data;
  return data;
}

/* ---------- helpers ---------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Paragraphs split on blank lines; a bullet line's "Label:" prefix is bolded.
const paras = (s) => String(s ?? "").split(/\n\s*\n/).filter(Boolean)
  .map((p) => `<p>${esc(p).replace(/^• ([^:\n]{2,60}):/gm, "• <strong>$1:</strong>")}</p>`).join("");
const chips = (arr, cls = "chip") => (arr || []).map((t) => `<span class="${cls}">${esc(t)}</span>`).join("");

const ICONS = {
  linkedin: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>',
  github: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>',
  scholar: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 1 9l11 6 9-4.91V17h2V9M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/></svg>',
  orcid: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM8.3 7.1a.94.94 0 1 1 0 1.9.94.94 0 0 1 0-1.9zm-.75 2.8h1.5v7h-1.5v-7zm3.35 0h2.85c2.71 0 3.9 1.94 3.9 3.5 0 1.8-1.4 3.5-3.89 3.5H10.9v-7zm1.5 1.35v4.3h1.36c2.39 0 2.94-1.81 2.94-2.15 0-1.17-.74-2.15-2.99-2.15h-1.31z"/></svg>',
  external: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'
};

const SOCIAL_LABELS = { linkedin: "LinkedIn", github: "GitHub", scholar: "Google Scholar", orcid: "ORCID" };
const LINK_LABELS = { github: "Code", demo: "Demo", paper: "Paper", website: "Website", link: "Link", slides: "Slides", video: "Video", doi: "DOI" };
// Bold the site owner's name wherever it appears in a publication author list.
const OWNER_NAME = /(Susmitha\s+Gurram|Gurram,?\s*S\.?|Susmitha|Gurram)/g;

// Button text for a publication link when none is given.
function linkLabelFor(url) {
  return /doi\.org/.test(String(url)) ? "Read the paper (DOI)" : "View paper";
}

// Map a free-text publication status to a color class (ok / pending / neutral).
function pubStatusClass(s) {
  const t = String(s).toLowerCase();
  if (/condition|revis|await|camera|in press/.test(t)) return "pending";
  if (/publish|accepted/.test(t)) return "ok";
  return "neutral";
}

// Small labels on a publication: role, status, and type.
function pubTags(pub) {
  const tags = [];
  if (pub.role) tags.push(`<span class="pub-tag pub-role">${esc(pub.role)}</span>`);
  if (pub.status) tags.push(`<span class="pub-tag pub-status ${pubStatusClass(pub.status)}">${esc(pub.status)}</span>`);
  if (pub.type) tags.push(`<span class="pub-tag pub-type">${esc(pub.type)}</span>`);
  return tags.join("");
}

/* ---------- section renderers ---------- */
const projectStore = {}; // key -> project, for the modal

const RENDERERS = {
  hero(section, data) {
    const p = data;
    const socials = Object.entries(p.socials || {})
      .filter(([, url]) => url)
      .map(([k, url]) => `<a class="social-link" href="${esc(url)}" target="_blank" rel="noopener" aria-label="${esc(SOCIAL_LABELS[k] || k)}" title="${esc(SOCIAL_LABELS[k] || k)}">${ICONS[k] || ICONS.external}</a>`)
      .join("");
    return `
      <div class="hero">
        <div>
          <p class="hero-kicker">${esc(p.headline)}</p>
          <h1 class="hero-name">${esc(p.name)}</h1>
          <p class="hero-tagline">${esc(p.tagline)}</p>
          <div class="hero-ctas">
            <a class="btn btn-primary" href="#research">See my work</a>
          </div>
          <div class="hero-socials">${socials}</div>
        </div>
        <div class="hero-photo-wrap">
          <img class="hero-photo" src="${esc(p.photo)}" alt="Portrait of ${esc(p.name)}" />
        </div>
      </div>`;
  },

  about(section, data) {
    const p = data;
    return `
      <div class="about-grid">
        <div class="about-bio">${paras(p.bio)}</div>
        <aside class="about-facts">
          <h3>At a glance</h3>
          <div class="fact"><span class="fact-icon">◆</span><span>${esc(p.headline)}</span></div>
          ${p.location ? `<div class="fact"><span class="fact-icon">◆</span><span>${esc(p.location)}</span></div>` : ""}
          ${(p.interests || []).length ? `<div class="hero-interests" style="margin-top:1rem">${chips(p.interests)}</div>` : ""}
          ${(p.strengths || []).length ? `<h3 class="facts-subhead">What I bring</h3>${p.strengths.map((g) => `
            <div class="strength"><span class="strength-label">${esc(g.label)}</span><span class="strength-items">${g.items.map(esc).join(" · ")}</span></div>`).join("")}` : ""}
        </aside>
      </div>`;
  },

  text(section) {
    return `<div class="text-block">${paras(section.content)}</div>`;
  },

  news(section, data) {
    let items = (data || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (section.limit) items = items.slice(0, section.limit);
    const fmt = (d) => {
      const [y, m] = String(d).split("-");
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return m ? `${months[+m - 1] || m} ${y}` : y;
    };
    return `
      <div class="news-list">
        ${items.map((n) => `
          <div class="news-item">
            <div class="news-date">${esc(fmt(n.date))}</div>
            <div>
              <div class="news-title">${esc(n.title)}</div>
              ${n.body ? `<div class="news-body">${esc(n.body)}</div>` : ""}
              ${n.link ? `<a href="${esc(n.link)}" target="_blank" rel="noopener">More ${ICONS.external}</a>` : ""}
            </div>
          </div>`).join("")}
      </div>
      ${section.moreLink ? `<div class="news-more"><a href="${esc(section.moreLink)}">All news →</a></div>` : ""}`;
  },

  projects(section, data) {
    return `
      <div class="cards-grid">
        ${(data || []).map((proj, i) => {
          const key = `${section.source}::${i}`;
          projectStore[key] = proj;
          const links = Object.entries(proj.links || {}).filter(([, url]) => url);
          return `
            <article class="card" data-project="${esc(key)}" tabindex="0" role="button" aria-label="Open details for ${esc(proj.title)}">
              ${proj.image ? `<img class="card-image" src="${esc(proj.image)}" alt="" loading="lazy" />` : ""}
              <div class="card-body">
                <div class="card-meta">
                  ${proj.kind ? `<span class="kind-badge kind-${esc(String(proj.kind).toLowerCase())}">${esc(proj.kind)}</span>` : ""}
                  ${proj.status ? `<span class="card-status">${esc(proj.status)}</span>` : ""}
                </div>
                <h3 class="card-title">${esc(proj.title)}</h3>
                <p class="card-hook">${esc(proj.hook)}</p>
                <div class="card-tags">${chips((proj.tags || []).slice(0, 4))}</div>
                <span class="card-more">Read more →</span>
                ${links.length ? `<div class="card-links">${links.map(([k, url]) => `<a class="card-link" href="${esc(url)}" target="_blank" rel="noopener">${ICONS[k] || ICONS.external} ${esc(LINK_LABELS[k] || k)}</a>`).join("")}</div>` : ""}
              </div>
            </article>`;
        }).join("")}
      </div>`;
  },

  publications(section, data) {
    return `
      <div class="pub-grid">
        ${(data || []).map((pub, i) => {
          const key = `${section.source}::${i}`;
          projectStore[key] = { ...pub, isPub: true };
          return `
          <article class="pub-card" data-project="${esc(key)}" tabindex="0" role="button" aria-label="Read about: ${esc(pub.title)}">
            ${pub.award ? `<div class="pub-ribbon"><span aria-hidden="true">★</span> ${esc(pub.award)}</div>` : ""}
            <div class="pub-tags">${pubTags(pub)}</div>
            <h3 class="pub-title">${esc(pub.title)}</h3>
            <div class="pub-venue">${esc(pub.venue)}${pub.year ? ` · ${esc(pub.year)}` : ""}</div>
            ${pub.hook ? `<p class="pub-hook">${esc(pub.hook)}</p>` : ""}
            <div class="pub-actions">
              <span class="card-more">Read more →</span>
              ${pub.link ? `<a class="card-link" href="${esc(pub.link)}" target="_blank" rel="noopener">${esc(pub.linkLabel || linkLabelFor(pub.link))} ${ICONS.external}</a>` : ""}
            </div>
          </article>`;
        }).join("")}
      </div>`;
  },

  highlights(section) {
    return `
      <ul class="highlights">
        ${(section.items || []).map((h, i) => {
          const key = h.more ? `highlight::${section.title}::${i}` : "";
          if (key) projectStore[key] = h.more;
          return `
          <li class="highlight${key ? " highlight-more" : ""}"${key ? ` data-project="${esc(key)}" tabindex="0" role="button" aria-label="Read more about ${esc(h.title)}"` : ""}>
            <span class="highlight-icon" aria-hidden="true">${esc(h.icon || "◆")}</span>
            <div>
              ${h.label ? `<div class="highlight-label">${esc(h.label)}</div>` : ""}
              <div class="highlight-title">${esc(h.title)}</div>
              ${h.meta ? `<div class="highlight-meta">${esc(h.meta)}</div>` : ""}
              ${h.text ? `<p class="highlight-text">${esc(h.text)}</p>` : ""}
              ${key ? `<span class="card-more">Read more →</span>` : ""}
            </div>
          </li>`;
        }).join("")}
      </ul>`;
  },

  education(section, data) {
    return `
      <div class="timeline">
        ${(data || []).map((ed) => `
          <div class="timeline-item">
            <div class="tl-head">
              <span class="tl-role">${esc(ed.degree)} ${esc(ed.field)}</span>
              <span class="tl-org">${esc(ed.institution)}</span>
            </div>
            <div class="tl-meta">${[ed.location, ed.end, ed.gpa].filter(Boolean).map(esc).join(" · ")}</div>
            ${(ed.details || []).length ? `<ul class="tl-bullets">${ed.details.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}
          </div>`).join("")}
      </div>`;
  },

  experience(section, data) {
    return `
      <div class="timeline">
        ${(data || []).map((job) => `
          <div class="timeline-item">
            <div class="tl-head">
              <span class="tl-role">${esc(job.role)}</span>
              <span class="tl-org">${esc(job.org)}</span>
            </div>
            <div class="tl-meta">${[job.location, [job.start, job.end].filter(Boolean).join(" to ")].filter(Boolean).map(esc).join(" · ")}</div>
            ${job.summary ? `<div class="tl-summary">${esc(job.summary)}</div>` : ""}
            ${(job.bullets || []).length ? `<ul class="tl-bullets">${job.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}
            ${(job.groups || []).map((g) => `
              <div class="tl-group">
                <div class="tl-group-title">${esc(g.title)}</div>
                <ul class="tl-bullets">${g.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
              </div>`).join("")}
            ${(job.tags || []).length ? `<div class="tl-tags">${chips(job.tags, "chip chip-outline")}</div>` : ""}
          </div>`).join("")}
      </div>`;
  },

  skills(section, data) {
    return `
      <div class="skills-grid">
        ${(data || []).map((g) => `
          <div>
            <div class="skill-group-name">${esc(g.group)}</div>
            <div class="skill-chips">${chips(g.items)}</div>
          </div>`).join("")}
      </div>`;
  },

  awards(section, data) {
    return `
      <div class="awards-grid">
        ${(data || []).map((a) => `
          <div class="award">
            <div class="award-title">${esc(a.title)}</div>
            <div class="award-meta">${[a.issuer, a.year].filter(Boolean).map(esc).join(" · ")}</div>
            ${a.description ? `<div class="award-desc">${esc(a.description)}</div>` : ""}
          </div>`).join("")}
      </div>`;
  },

  contact() {
    return `
      <div class="contact-simple">
        <p>Whether it's research collaboration, a question about my work, speaking, or industry opportunities, I'd love to hear from you. You can find me on LinkedIn.</p>
        <a class="btn btn-primary linkedin-btn" href="https://www.linkedin.com/in/susmitha009" target="_blank" rel="noopener">${ICONS.linkedin} Message me on LinkedIn</a>
      </div>`;
  }
};

/* ---------- modal ---------- */
let lastFocus = null;

function projectModalHTML(project) {
  const links = Object.entries(project.links || {})
    .filter(([, url]) => url)
    .map(([k, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(LINK_LABELS[k] || k)} ${ICONS.external}</a>`)
    .join("");
  return `
    ${project.image && !(project.gallery || []).length ? `<img class="modal-img" src="${esc(project.image)}" alt="" />` : ""}
    <div class="modal-content${(project.gallery || []).length ? " modal-pub" : ""}">
      <div class="card-meta">
        ${project.kind ? `<span class="kind-badge kind-${esc(String(project.kind).toLowerCase())}">${esc(project.kind)}</span>` : ""}
        ${project.status ? `<span class="card-status">${esc(project.status)}</span>` : ""}
      </div>
      <h2 id="modal-title">${esc(project.title)}</h2>
      <div class="card-tags">${chips(project.tags)}</div>
      ${paras(project.description || project.hook)}
      ${(project.gallery || []).map((g) => `
        <figure class="modal-figure">
          <a href="${esc(g.src)}" target="_blank" rel="noopener" title="Open full size"><img src="${esc(g.src)}" alt="${esc(g.alt || "")}" loading="lazy" /></a>
          ${g.caption ? `<figcaption>${esc(g.caption)} <span class="fig-hint">(select to enlarge)</span></figcaption>` : ""}
        </figure>`).join("")}
      ${links ? `<div class="modal-links">${links}</div>` : ""}
    </div>`;
}

function pubModalHTML(pub) {
  const authors = pub.authors ? esc(pub.authors).replace(OWNER_NAME, "<strong>$1</strong>") : "";
  const link = pub.link
    ? `<div class="modal-links"><a href="${esc(pub.link)}" target="_blank" rel="noopener">${esc(pub.linkLabel || linkLabelFor(pub.link))} ${ICONS.external}</a></div>`
    : "";
  return `
    <div class="modal-content modal-pub">
      ${pub.award ? `<div class="pub-ribbon"><span aria-hidden="true">★</span> ${esc(pub.award)} award</div>` : ""}
      <div class="pub-tags">${pubTags(pub)}</div>
      <h2 id="modal-title">${esc(pub.title)}</h2>
      ${authors ? `<p class="pub-authors">${authors}</p>` : ""}
      <p class="pub-venue">${esc(pub.venue)}${pub.year ? ` · ${esc(pub.year)}` : ""}</p>
      <h3 class="modal-subhead">About the paper</h3>
      ${paras(pub.about || pub.hook)}
      ${(pub.gallery || []).map((g) => `
        <figure class="modal-figure">
          <a href="${esc(g.src)}" target="_blank" rel="noopener" title="Open full size"><img src="${esc(g.src)}" alt="${esc(g.alt || "")}" loading="lazy" /></a>
          ${g.caption ? `<figcaption>${esc(g.caption)} <span class="fig-hint">(select to enlarge)</span></figcaption>` : ""}
        </figure>`).join("")}
      ${pub.contribution ? `<h3 class="modal-subhead">My role</h3>${paras(pub.contribution)}` : ""}
      ${link}
    </div>`;
}

function openModal(item) {
  const backdrop = document.getElementById("modal-backdrop");
  const body = document.getElementById("modal-body");
  lastFocus = document.activeElement;
  body.innerHTML = item.isPub ? pubModalHTML(item) : projectModalHTML(item);
  backdrop.hidden = false;
  document.body.style.overflow = "hidden";
  document.getElementById("modal-close").focus();
}

function closeModal() {
  const backdrop = document.getElementById("modal-backdrop");
  if (backdrop.hidden) return;
  backdrop.hidden = true;
  document.body.style.overflow = "";
  if (lastFocus) lastFocus.focus();
}

/* ---------- one-page render + boot ---------- */
let SITE = null;

const visiblePages = () => SITE.pages.filter((p) => !p.hidden);

async function renderSection(section) {
  let html = "";
  try {
    const renderer = RENDERERS[section.type];
    if (!renderer) throw new Error(`Unknown section type "${section.type}"`);
    const data = section.source ? await loadJSON(section.source) : null;
    html = renderer(section, data);
  } catch (err) {
    console.error(err);
    html = `<p style="color:var(--muted)">Couldn't load this section (${esc(section.type)}).</p>`;
  }
  const showTitle = section.title && section.type !== "hero";
  return `<section class="section reveal">${showTitle ? `<h2 class="section-title">${esc(section.title)}</h2>` : ""}${html}</section>`;
}

async function renderPage() {
  const app = document.getElementById("app");
  const pages = visiblePages();
  if (!pages.length) { app.innerHTML = "<p>No pages configured.</p>"; return; }

  document.title = SITE.meta.title;

  const parts = [];
  for (const page of pages) {
    const sections = [];
    for (const section of page.sections) sections.push(await renderSection(section));
    parts.push(`<div class="page-part" id="${esc(page.id)}" aria-label="${esc(page.label)}">${sections.join("")}</div>`);
  }
  app.innerHTML = parts.join("");

  // reveal-on-scroll
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); observer.unobserve(e.target); } });
  }, { threshold: 0.08 });
  app.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

  // card + publication modals
  app.querySelectorAll("[data-project]").forEach((card) => {
    const open = () => openModal(projectStore[card.dataset.project]);
    card.addEventListener("click", (e) => { if (e.target.closest("a")) return; open(); });
    card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });


  initScrollSpy();
  scrollToHash(false);
}

// Highlight the nav link for the part of the page currently on screen:
// the last part whose top has passed 40% of the window height.
let spyBound = false;
function initScrollSpy() {
  const links = [...document.querySelectorAll(".nav-tab")];
  const parts = [...document.querySelectorAll(".page-part")];
  const update = () => {
    const line = window.innerHeight * 0.4;
    let current = parts[0] && parts[0].id;
    for (const part of parts) if (part.getBoundingClientRect().top <= line) current = part.id;
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) current = parts[parts.length - 1].id;
    links.forEach((l) => {
      const on = l.dataset.page === current;
      l.classList.toggle("active", on);
      if (on) l.setAttribute("aria-current", "true"); else l.removeAttribute("aria-current");
    });
  };
  if (!spyBound) {
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { update(); ticking = false; });
    }, { passive: true });
    spyBound = true;
  }
  update();
}

// Old links used "#/research"; treat them the same as "#research".
function scrollToHash(smooth) {
  const id = location.hash.replace(/^#\/?/, "");
  if (!id || id === "app") return;
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
}

function renderNav() {
  const tabs = document.getElementById("nav-tabs");
  tabs.innerHTML = SITE.pages
    .filter((p) => !p.hidden)
    .map((p) => `<a class="nav-tab" data-page="${esc(p.id)}" href="#${esc(p.id)}">${esc(p.label)}</a>`)
    .join("");
}

// Phone layout: the menu button opens and closes the section list.
function initMenu() {
  const btn = document.getElementById("menu-toggle");
  const tabs = document.getElementById("nav-tabs");
  const setOpen = (open) => {
    tabs.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
    btn.textContent = open ? "Close" : "Menu";
  };
  btn.addEventListener("click", () => setOpen(!tabs.classList.contains("open")));
  tabs.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
}

function initTheme() {
  const saved = localStorage.getItem("sg-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (saved === "dark" || (!saved && prefersDark)) document.documentElement.setAttribute("data-theme", "dark");
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    document.documentElement.setAttribute("data-theme", isDark ? "light" : "dark");
    localStorage.setItem("sg-theme", isDark ? "light" : "dark");
  });
}

async function boot() {
  initTheme();
  const footerYear = document.getElementById("footer-year");
  if (footerYear) footerYear.textContent = new Date().getFullYear();
  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal-backdrop").addEventListener("click", (e) => { if (e.target.id === "modal-backdrop") closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  try {
    SITE = await loadJSON("data/site.json");
  } catch (err) {
    document.getElementById("app").innerHTML = `<p style="padding:3rem;text-align:center;color:var(--muted)">Couldn't load site configuration. If you opened this file directly, serve it instead: <code>python3 -m http.server</code></p>`;
    return;
  }
  renderNav();
  initMenu();
  window.addEventListener("hashchange", () => scrollToHash(true));

  await renderPage();
}

boot();
