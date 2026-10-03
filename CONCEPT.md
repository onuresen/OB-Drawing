# OB Drawing Concept

## Core idea

Construction teams usually navigate PDF drawing sets by page, sheet number, and markup. OBD adds another route: navigate by the building object represented on those drawings.

The rectangle is not the object. It is one **occurrence** of the object.

```text
Door D-105
├── floor plan occurrence
├── elevation occurrence
├── door schedule occurrence
└── detail occurrence
```

Selecting any occurrence should reveal the shared object and every other linked occurrence.

## Why it may be useful

- Works with issued and legacy PDFs.
- Does not require the original BIM model.
- Connects plans, elevations, schedules, legends, sections, and details.
- Can start with manual linking and become useful before automation.
- Can later cover Windows, Rooms, Equipment, Wall Types, Finishes, and other building elements.

## Language

| Term | Meaning |
|---|---|
| Object | The explicitly identified building element or drawing subject. |
| Occurrence | One bounded visual representation of an object on one PDF page. |
| Object layer | Data that connects objects and occurrences without changing the source PDF. |
| Object atlas | The collection of all known occurrences of one selected object. |

## Product position

“2D BIM” is a useful intuition, but not yet a product claim. The first prototype is better described as an **object-indexed architectural drawing set**.
