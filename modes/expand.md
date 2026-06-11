# Mode: expand — Profile Enrichment from Documents & Online Presence

Discovers hidden competencies from the candidate's documents and public profiles, then enriches the profile **additively** — it never overwrites or removes existing content. The system can only match you to roles using what it knows; most candidates under-document themselves, and this surfaces what they left out.

Adapted for career-ops: existing profile lives in `cv.md`, `article-digest.md`, and `config/profile.yml`. New findings are written to `article-digest.md` (proof points) and `config/profile.yml` (skills, narrative) — **never silently into `cv.md`** (that is the canonical CV; changes to it are proposed and confirmed line by line).

## Step 0 — Load existing profile

Read in parallel before scanning anything (so you don't propose duplicates):
- `cv.md`
- `article-digest.md` (if present)
- `config/profile.yml`

## Step 1 — Discover: scan all sources

Process whichever sources exist:
- **`documents/` folder** (if present) — CVs, diplomas, references, past applications. Extract courses, certifications, responsibilities, projects, volunteer roles, and the competency language referees used.
- **GitHub** — from `config/profile.yml → candidate.github`. Fetch the public profile and repositories (pinned and unpinned). Extract languages, frameworks, project domains from READMEs.
- **LinkedIn** — from `candidate.linkedin`. Licenses & certifications, skills, volunteer experience, projects. (Note: LinkedIn often blocks fetching — if so, ask the user to paste their profile export or About section.)
- **Portfolio / other URLs** — any portfolio, Kaggle, Google Scholar, ResearchGate links in `config/profile.yml → narrative.proof_points` or `candidate`.

## Step 2 — Web enrichment

For each discovered item, apply both:
- **Approach A — direct lookup:** search for the official syllabus, exam guide, or documentation that names the specific tools and frameworks a course/cert/repo covers.
- **Approach B — inference:** reason from the description's context about problem domains, methods, and standard toolchains.

Prioritize web lookup for named courses, certifications, and repos with READMEs. Infer for generic bullets and reference language. Include the current year in search queries.

## Step 3 — Build competency map

Deduplicate findings into categories, recording each with its **source** and **approach (A/B/both)**:
- Technical Skills (Primary / Secondary)
- Domain Knowledge
- Methods & Practices
- Soft / Behavioral Signals

## Step 4 — Present grouped summary (confirmation gate)

Show all new competencies grouped by source **before writing anything**. Ask the user to choose: add all, review one-by-one, skip, or name groups to exclude. Inferred (Approach B) items are labeled as "inferred — review."

Do not write any file until the user confirms.

## Step 5 — Write confirmed additions

Write only confirmed items, additively:
- **Proof points with metrics** → append to `article-digest.md` with a source annotation comment (e.g. `<!-- source: github.com/user/repo, approach B -->`).
- **Skills** → add to the relevant `config/profile.yml` skills/narrative fields without removing existing entries.
- **Anything that belongs on the CV itself** → propose the exact line and the target section in `cv.md`, and ask for explicit per-line confirmation before editing. Never auto-edit `cv.md`.

Label inferred behavioral items for the user's later review.

## Step 6 — Summary report

Report: all additions made, sources processed, sources skipped (and why), and any items flagged for manual review.

## Design principles

- **Additive only** — extends, never modifies or deletes existing content.
- **Source-traceable** — every addition records its origin, so re-running is idempotent (skip what's already annotated).
- **Dual enrichment** — web lookup and inference applied together.
- **User confirmation** — the full map is shown before any file change.
- **Inferred signals labeled** — indirect competencies marked for critical review.
- **Comprehensive GitHub scan** — all repositories, not just pinned.
- **Never fabricate** — if a source doesn't support a competency, don't invent it.
