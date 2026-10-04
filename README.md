# susmithagurram.com

Personal website of Susmitha Gurram. A static site (HTML, CSS, JavaScript) whose content lives in JSON files under `data/`.

## Updating content

| File | What it holds |
|------|---------------|
| `data/profile.json` | Name, headline, about text, skills summary |
| `data/projects.json` | Research and project cards |
| `data/publications.json` | Publications |
| `data/experience.json`, `education.json`, `awards.json`, `skills.json` | Experience section |
| `data/mentoring.json` | Mentoring cards |
| `data/news.json` | News |
| `data/site.json` | Section order and navigation |

Edit a file, commit, and push to `main`; GitHub Pages republishes the site within a minute or two.

## Running locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.
