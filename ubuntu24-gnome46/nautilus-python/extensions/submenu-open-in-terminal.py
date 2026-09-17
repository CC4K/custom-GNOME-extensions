from gi.repository import Nautilus, GObject
from typing import List
import subprocess

class OpenTerminalExtension(GObject.GObject, Nautilus.MenuProvider):
    def open_terminal(self, files: List[Nautilus.FileInfo]) -> None:
        if not files: return
        
        file = files[0]
        if file.is_directory():
            working_dir = file.get_location().get_path()
            if working_dir:
                subprocess.Popen(["gnome-terminal", f"--working-directory={working_dir}"])

    def generate_menu(self, files: List[Nautilus.FileInfo], is_background: bool) -> List[Nautilus.MenuItem]:
        menu_item = Nautilus.MenuItem(
            name="OpenTerminalExtension::OpenTerminal" + ("Background" if is_background else ""),
            label="Open in Terminal",
        )
        menu_item.connect("activate", lambda menu_item, files=files: self.open_terminal(files))
        return [menu_item]

    def get_file_items(self, files: List[Nautilus.FileInfo]) -> List[Nautilus.MenuItem]:
        # Only show if a single directory is selected
        if len(files) == 1 and files[0].is_directory():
            return self.generate_menu(files, False)
        return []

    def get_background_items(self, current_folder: Nautilus.FileInfo) -> List[Nautilus.MenuItem]:
        return self.generate_menu([current_folder], True)
