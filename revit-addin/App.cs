using System;
using System.Linq;
using System.Reflection;
using Autodesk.Revit.UI;

namespace ObjectCentricDrawing
{
    // Adds an "Object-Centric Drawing" panel to the shared "OneMore" ribbon tab.
    // The tab is shared with the OneMore toolkit and Joinery Configurator. Whichever
    // add-in loads first creates it; the others reuse it, so load order does not matter.
    public class App : IExternalApplication
    {
        private const string TabName = "OneMore";
        private const string PanelName = "Object-Centric Drawing";

        public Result OnStartup(UIControlledApplication application)
        {
            try
            {
                application.CreateRibbonTab(TabName);
            }
            catch (Exception)
            {
                // Another add-in on the shared tab already created it.
            }

            RibbonPanel panel =
                application.GetRibbonPanels(TabName).FirstOrDefault(p => p.Name == PanelName)
                ?? application.CreateRibbonPanel(TabName, PanelName);

            var button = new PushButtonData(
                "ObjectCentricDrawing.ExportPdf",
                "Export PDF" + Environment.NewLine + "+ Objects",
                Assembly.GetExecutingAssembly().Location,
                typeof(ExportPdfCommand).FullName!)
            {
                ToolTip = "Export sheets to PDF with an Object-Centric Drawing project file next to it.",
                LongDescription =
                    "Open a sheet, or select sheets in the Project Browser. Doors and windows on "
                    + "those sheets become objects, and each place they appear becomes an occurrence. "
                    + "The PDF is not changed; object data goes in a .objdraw.json file beside it.",
            };
            panel.AddItem(button);

            return Result.Succeeded;
        }

        public Result OnShutdown(UIControlledApplication application) => Result.Succeeded;
    }
}
