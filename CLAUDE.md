# Project Rules (value-architect-agent)

## Mission
Generate consulting-grade PowerPoint decks tailored to each client by:
- understanding the client's brief and constraints,
- producing structured research and insights,
- building an executive storyline (MECE, pyramid principle),
- converting it into a validated Deck Spec,
- rendering PPTX using the company template and design tokens,
- preserving client-specific artifacts and lessons learned for continuous improvement.

## Non-Negotiables (Always)
1) **Two-stage workflow**
   - Always produce/update: `deck_outline.md` → `deck_spec.yaml` → PPT render.
   - Never jump directly to PPT without a Deck Spec.

2) **Single Source of Truth**
   - `clients/<client>/deck_spec.yaml` is the only truth for PPT rendering.

3) **Template + Tokens Enforcement**
   - Always render using `templates/company/base-template.pptx` (if present).
   - Enforce design tokens from `templates/company/tokens.yaml`:
     - Title: MS고딕네오 Bold 24pt
     - Governing message: MS고딕네오 Bold 16pt
     - Body: MS고딕네오 Regular 12–14pt (default 12pt)
   - Background should be white, and use company-approved blue tones only.

4) **Density Rules (Executive-friendly)**
   - One slide should contain:
     - 1 title + 1 governing message
     - 3–6 bullets (prefer 1 line each; max 2 lines if unavoidable)
   - Avoid long paragraphs. Use MECE bullets and crisp wording.

5) **Sources & Credibility**
   - Store research sources in `clients/<client>/sources.md`.
   - When deriving insights, cite where the claim comes from (source list item IDs or section).

6) **Per-client Traceability**
   - For every client, maintain:
     - `brief.md`, `constraints.md`, `sources.md`,
     - `deck_outline.md`, `deck_spec.yaml`,
     - outputs in `outputs/`,
     - lessons learned in `lessons.md`.
   - Extract reusable learnings into `library/lessons/`.

## Work Mode (How to operate)
- Prefer file-based outputs over chat-only content.
- When context becomes large:
  - Summarize into files, then reference those files.
- If something is missing, propose assumptions explicitly and record them in the client's folder.

## Quality Bar
A deck is acceptable only if:
- Storyline is coherent and executive-ready.
- Each slide has one governing message and MECE bullets.
- Font sizes and template conventions are followed.
- Deck Spec passes schema validation.
