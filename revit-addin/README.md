# Object-Centric Drawing — Revit Add-in

Export Revit sheets to PDF, with the objects already marked.

Status: **first spike. Built and run in Revit 2026 on 2026-10-06: one sheet, 89 objects, rectangles on target.**

## What it does

One button: **OneMore ▸ Object-Centric Drawing ▸ Export PDF + Objects**.

1. Open a sheet, or select sheets in the Project Browser.
2. Choose what to export. The dialog lists each category with how many elements the sheets show.
   Doors and windows are ticked by default. "Only elements with a Mark" skips unmarked ones
   (rooms use their number). The dialog shows the total before you export, and remembers your choice.
   **Shape:** Rectangle (default) or Outline. Outline gives rooms their boundary and everything else
   a convex outline of what the view draws, so rotated elements fit. Inside corners are not followed.
   Any element whose outline fails keeps its rectangle.
   **Parameters:** "Include populated instance and type parameters" is off by default. When enabled,
   every populated readable parameter is added to the separate Revit companion file.
   **Relations:** "Add relations Revit knows" is off by default. When on, the project file gets:
   - door / window → its host wall: *hosted on*;
   - door → its From Room and To Room: *opens to*, labelled "from room" / "to room";
   - any other family instance → its room: *inside*.

   Only between objects in the same export. A face-based door hosted on a level gets no host relation.
   Each relation carries `origin: "revit"`. The app marks them "from Revit" and can remove them all at once.
   A Revit error on one element skips that relation only.
3. Pick where to save the PDF.
4. Three files are written side by side:

| File | Contents |
|---|---|
| `name.pdf` | The sheets, one page each, ordered by sheet number. Not modified afterwards. |
| `name.objdraw.json` | The project file. Open the PDF in the app, then import this. |
| `name.objdraw-revit.json` | Revit identity, optional instance/type parameter snapshots, sheet/view references, and skipped views. |

One Revit element is one object. Each sheet view it appears in is one occurrence.

## Why Revit IDs are in a separate file

Import `name.objdraw.json` first, then use the same **Import JSON** action for
`name.objdraw-revit.json`. The selected object's Revit identity and parameters appear read-only
in Properties. The project core stays free of Revit, as `DECISIONS.md` requires.

## v1 scope

- Categories: doors, windows, rooms, walls, stairs, furniture, casework, generic models, specialty equipment, plumbing, structural columns, mechanical and electrical equipment, electrical and lighting fixtures. Doors and windows are the default. Linear systems (pipes, ducts) are left out on purpose.
- Plans, sections and elevations. Other views are skipped and listed.
- Rectangles from the element's view bounding box by default. Rotated elements get loose boxes; choose Outline for those.
- Clipped to the viewport box and the page.
- Split views are skipped.
- Schedules are not read. There is no clean API from a schedule row to an element.

## Check first in Revit

These are assumptions. Each one moves every rectangle if it is wrong.

- [x] The title block bounding box matches the PDF page. *(one sheet, 2026-10-06)*
- [x] `ExportPaperFormat.Default` + 100% + centred gives no offset. *(one sheet, 2026-10-06)*
- [ ] A combined PDF keeps the order the sheets were passed in.
- [ ] One sheet is always one page.

Test: export one sheet with a few doors. Open both files in the app. Check the rectangles sit on the doors.

## Next

From Onur's first real run (2026-10-06):

- **Choose what to export.** Done: categories and a Mark filter. Levels are not offered yet.
- **Relations from Revit.** Done as an option, off by default. Not built or run in Revit yet.
- **Exact shapes.** Done as the Outline option: convex outlines, room boundaries. Not built or run in Revit yet. Inside corners are left out on purpose.

## Build

Same setup as the Joinery Configurator add-in: Revit 2026.5, .NET 10 SDK.
Open `ObjectCentricDrawing.slnx` in Visual Studio 2022 (17.13+) or later.
`dotnet build` copies the DLL and `.addin` to `%ProgramData%\Autodesk\REVIT\Addins\2026\`.
No NuGet packages; JSON uses `System.Text.Json`.
The ribbon icon comes from `Resources/build-icons.py` (standard-library Python). Edit that, then re-run it.

## Shared ribbon tab

The **OneMore** tab is shared with the OneMore toolkit and Joinery Configurator.
Each add-in creates the tab or reuses it, so load order does not matter.
Each add-in keeps its own panel name and prefixes its button IDs.

## Drift checks

`tests/revit-addin.test.mjs` reads this folder's C# and fails if:

- the project format string differs from `sidecar.mjs`;
- an exported category is not a `category-catalog.mjs` key, or the defaults stop being doors and windows;
- the dialog counts and the export stop sharing one walk over the sheets;
- the ID shapes change;
- the panel leaves the OneMore tab;
- the relations option stops being off by default, or writes a type, ID, or origin the app rejects.
