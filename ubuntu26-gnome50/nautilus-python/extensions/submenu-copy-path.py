from gi.repository import Nautilus, GObject
from typing import List
import subprocess

class CopyPathExtension(GObject.GObject, Nautilus.MenuProvider):
    def copy_paths(self, files: List[Nautilus.FileInfo]) -> None:
        # Extract paths and join them with a newline if multiple are selected
        file_paths = [file.get_location().get_path() for file in files if file.get_location().get_path()]
        full_paths_str = "\n".join(file_paths)
        
        # Copy to clipboard using xclip
        process = subprocess.Popen(["xclip", "-selection", "clipboard"], stdin=subprocess.PIPE, text=True)
        process.communicate(input=full_paths_str)

    def generate_menu(self, files: List[Nautilus.FileInfo], is_background: bool) -> List[Nautilus.MenuItem]:
        menu_item = Nautilus.MenuItem(
            name="CopyPathExtension::CopyPath" + ("Background" if is_background else ""),
            label="Copy Path",
        )
        menu_item.connect("activate", lambda menu_item, files=files: self.copy_paths(files))
        return [menu_item,]

    def get_file_items(self, files: List[Nautilus.FileInfo]) -> List[Nautilus.MenuItem]:
        return self.generate_menu(files, False)

    def get_background_items(self, current_folder: Nautilus.FileInfo) -> List[Nautilus.MenuItem]:
        return self.generate_menu([current_folder], True)
