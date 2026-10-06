# Object-Centric Drawing — Revit Add-in

Export Revit sheets to PDF, with the objects already marked.

Status: **first spike. Built and run in Revit 2026 on 2026-10-06: one sheet, 89 objects, rectangles on target.**

## What it does

One button: **OneMore ▸ Object-Centric Drawing ▸ Export PDF + Objects**.

1. Open a sheet, or select sheets in the Project Browser.
2. Choose what to export. The dialog lists each category with how many elements the sheets show.
   Doors and windows are ticked by default. "Only elements with a Mark" skips unmarked ones
   (rooms use their number). The dialog shows the total before you export, and remembers your choice.
3. Pick where to save the PDF.
4. Three files are written side by side:

| File | Contents |
|---|---|
| `name.pdf` | The sheets, one page each, ordered by sheet number. Not modified afterwards. |
| `name.objdraw.json` | The project file. Open the PDF in the app, then import this. |
| `name.objdraw-revit.json` | Revit identity: UniqueId per object, sheet and view per occurrence, skipped views. |

One Revit element is one object. Each sheet view it appears in is one occurrence.

## Why Revit IDs are in a separate file

The app rebuilds every object field by field when it imports a project.
An extra Revit field inside the project file would be lost on the next save.
The project core also stays free of Revit, as `DECISIONS.md` requires.

## v1 scope

- Categories: doors, windows, rooms, walls, stairs, furniture, casework, generic models, specialty equipment, plumbing, structural columns, mechanical and electrical equipment, electrical and lighting fixtures. Doors and windows are the default. Linear systems (pipes, ducts) are left out on purpose.
- Plans, sections and elevations. Other views are skipped and listed.
- Rectangles from the element's view bounding box. Rotated elements get loose boxes.
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
- **Exact shapes.** Rectangles work now. Later: project the element's real outline to a polygon. Riskier, no rush.

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
- the panel leaves the OneMore tab.
