# OB Drawing Prototype Acceptance - 2026-09-29

## Result

**Mechanics accepted; product-value claim still pending a real project drawing set.**

The browser prototype completed a five-Door, six-occurrence export/reload/import round-trip. Explicit IDs and links survived exactly. The available source was an architectural modelling guide rather than a coordinated plan/elevation/schedule set, so this run does not prove that object navigation is better than manual search on a live project.

## Source boundary

- Source: `BIM Modelling Guide/source/BIM_Modeling_Guide_with_Structure_ENU_vS3-03.pdf`
- Source type: real 67-page architectural/BIM modelling guide, not a project drawing set.
- PDF fingerprint: `ce887a02203a4ba8b0f1118f4e620e567808b9715c706ad574a6b8f13b6eb299`
- File size: `4,648,339` bytes.
- Pages used: PDF pages 60 and 61, covering Door/Window component, plan-detail, model-view, and curtain-wall imagery.
- Test labels began with `TEST-`. They are workflow placeholders, not asserted building-object identities.
- The cross-page `TEST-D03 Entrance-panel` link tests navigation between related representations. It does not claim that the two guide images depict one verified physical Door.

No source PDF or test sidecar is committed to the repository.

## Runtime record

1. Opened the local PDF through the supplied browser app; all 67 pages were recognized and page 1 rendered.
2. Created five explicit Door identities: `door-001` through `door-005`.
3. Drew and linked five occurrences on page 60.
4. Added a sixth occurrence for `door-003` on page 61 to exercise cross-page navigation.
5. Exported `obd-object-layer-v1` JSON and independently inspected its fingerprint, five objects, six linked occurrences, and pages `60, 61`.
6. Reloaded the application, reopened the same PDF, and confirmed an empty in-memory layer.
7. Imported the saved sidecar and confirmed restoration of five Doors and six occurrences, including the `2x` count for `door-003`.

## Findings and fixes

| Finding | Runtime evidence | Resolution |
|---|---|---|
| Direct page entry did not respond to Enter. | Typing `60` and pressing Enter left page 1 rendered; repeated Next actions were required. | Added Enter handling to the page-number field. |
| Cross-page object selection could leave the selected-Door panel stale. | The canvas navigated to page 60 and the mark target became `door-003`, while the visible panel still showed `door-005`. | Refresh the object UI after every completed page navigation. |
| SVG occurrence rectangles were pointer-only. | Rectangles exposed a button role but could not receive keyboard focus or activation. | Added focusability, visible focus styling, and Enter/Space selection. |

## Acceptance observations

- Explicit identity is understandable when the stable `door-###` value remains visible beside the editable label.
- Object-to-occurrence navigation is useful once one Door has multiple page references; the occurrence list made the page 60/page 61 relationship immediately visible.
- Marking small details at Fit scale is possible but imprecise on dense A4 pages. A future real-project pilot should assess whether a temporary draw-time zoom or magnifier is needed.
- The side panel becomes long with five Doors, but the drawing remains the dominant surface. No additional navigation surface is justified yet.
- Export/import is a credible portable persistence mechanism for the prototype. The explicit file step is acceptable at this scale and avoids hidden browser storage.

## Remaining proof

Run the same workflow on a user-selected project drawing set containing identifiable occurrences of the same five physical Doors across at least two of: floor plan, elevation, schedule, legend, section, or detail. The owner must confirm each cross-page identity. Only that run can answer the product question: whether object navigation is materially better than page search.
