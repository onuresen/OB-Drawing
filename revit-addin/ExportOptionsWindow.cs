using System.Collections.Generic;
using System.Linq;
using System.Windows;
using System.Windows.Controls;

namespace ObjectCentricDrawing
{
    // One row per category: how many elements the chosen sheets show,
    // and how many of those carry a mark (or a room number).
    internal sealed record CategoryCount(ExportCategory Category, int Total, int WithMark);

    // Chooses what one export includes. Built in code, not XAML: it is a short list of checkboxes.
    internal sealed class ExportOptionsWindow : Window
    {
        private readonly List<(CategoryCount Count, CheckBox Box)> _rows = new();
        private readonly CheckBox _requireMark;
        private readonly TextBlock _summary;
        private readonly Button _export;

        public ExportOptions? Choice { get; private set; }

        public ExportOptionsWindow(int sheetCount, IReadOnlyList<CategoryCount> counts, ExportOptions previous)
        {
            Title = "Export PDF + Objects";
            Width = 380;
            SizeToContent = SizeToContent.Height;
            ResizeMode = ResizeMode.NoResize;
            WindowStartupLocation = WindowStartupLocation.CenterOwner;

            var root = new StackPanel { Margin = new Thickness(16) };
            root.Children.Add(new TextBlock
            {
                Text = $"{sheetCount} sheet{(sheetCount == 1 ? "" : "s")} selected. Choose what becomes objects.",
                TextWrapping = TextWrapping.Wrap,
                Margin = new Thickness(0, 0, 0, 10),
            });

            var list = new StackPanel();
            foreach (CategoryCount count in counts)
            {
                var box = new CheckBox
                {
                    Content = count.Total == 0 ? $"{count.Category.Label}  (none on these sheets)" : $"{count.Category.Label}  ({count.Total})",
                    IsEnabled = count.Total > 0,
                    IsChecked = count.Total > 0 && previous.Categories.Contains(count.Category.Category),
                    Margin = new Thickness(0, 2, 0, 2),
                };
                box.Checked += (_, _) => Update();
                box.Unchecked += (_, _) => Update();
                _rows.Add((count, box));
                list.Children.Add(box);
            }
            root.Children.Add(new ScrollViewer
            {
                Content = list,
                MaxHeight = 320,
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            });

            _requireMark = new CheckBox
            {
                Content = "Only elements with a Mark (room number for rooms)",
                IsChecked = previous.RequireMark,
                Margin = new Thickness(0, 12, 0, 0),
            };
            _requireMark.Checked += (_, _) => Update();
            _requireMark.Unchecked += (_, _) => Update();
            root.Children.Add(_requireMark);

            _summary = new TextBlock { Margin = new Thickness(0, 12, 0, 0), FontWeight = FontWeights.SemiBold };
            root.Children.Add(_summary);

            var buttons = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                HorizontalAlignment = HorizontalAlignment.Right,
                Margin = new Thickness(0, 14, 0, 0),
            };
            _export = new Button { Content = "Export…", MinWidth = 84, IsDefault = true, Margin = new Thickness(0, 0, 8, 0) };
            _export.Click += (_, _) =>
            {
                Choice = new ExportOptions
                {
                    Categories = _rows.Where(r => r.Box.IsChecked == true).Select(r => r.Count.Category.Category).ToHashSet(),
                    RequireMark = _requireMark.IsChecked == true,
                };
                DialogResult = true;
            };
            buttons.Children.Add(_export);
            buttons.Children.Add(new Button { Content = "Cancel", MinWidth = 84, IsCancel = true });
            root.Children.Add(buttons);

            Content = root;
            Update();
        }

        private void Update()
        {
            bool requireMark = _requireMark.IsChecked == true;
            int objects = _rows
                .Where(r => r.Box.IsChecked == true)
                .Sum(r => requireMark ? r.Count.WithMark : r.Count.Total);
            _summary.Text = $"{objects} object{(objects == 1 ? "" : "s")} will be exported.";
            _export.IsEnabled = objects > 0;
        }
    }
}
