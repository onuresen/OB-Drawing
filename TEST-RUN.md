# Test Run — Object vs Page Navigation

One question:

> Is finding one object across a drawing set clearly faster by object than by page?

Plan about one hour.

## Rules

- Use a drawing set you are allowed to discuss in public.
- Keep the PDFs local. Do not commit them or the exported project.
- Write down friction as it happens, not afterwards.

## 1. Get a drawing set

Good options:

- **Revit sample project** (for example Snowdon Towers). Export to PDF: one floor plan, the elevations, the door schedule, and one detail sheet.
- **A public bid set** from a city or university project.

Need: the same doors appear on at least 3 sheet types.

## 2. Pick 5 doors

Each door should appear on at least 3 sheets. Mix easy and hard ones.

## 3. Time two tasks per door

**A — By page.** Use a normal PDF viewer. Find the door on every sheet where it appears. Stop the clock when you have seen all of them.

**B — By object.** Use Object-Centric Drawing.

1. Mark and link the door once on every sheet. Time this as **setup**.
2. Clear the selection. Start on any sheet.
3. Jump to every representation with Object Lens. Time this as **revisit**.

Do task A first for each door.
This makes B setup a little easier, since you already know the sheets. Keep that in mind when reading the setup times.

## 4. Results

| Door | Sheets it appears on | A: by page | B: setup | B: revisit | Notes |
|---|---|---|---|---|---|
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |

Times in seconds.

## 5. Friction log

One line per problem. Slow, fiddly, confusing, or missing.

| # | Where | What happened | How bad (1–3) |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |

Known from the 2026-09-29 run: marking small details at Fit zoom is imprecise. Note it if it happens again.

## 6. Verdict

Answer in one line each.

- Was revisit by object clearly faster than by page?
- Was the setup cost worth it for doors you would check again?
- What is the one fix that would help most?

## After the run

- Save the filled file as `TEST-RUN-YYYY-MM-DD.md`.
- Pick the next feature from the friction log, highest "how bad" first.
- Record the decision in [DECISIONS.md](DECISIONS.md).
