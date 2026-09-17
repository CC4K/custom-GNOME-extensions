from gi.repository import Nautilus, GObject
from typing import List
import os

class CreateNewFileExtension(GObject.GObject, Nautilus.MenuProvider):
    def create_file(self, current_folder: Nautilus.FileInfo) -> None:
        folder_path = current_folder.get_location().get_path()
        if not folder_path: return

        base_name = "file"
        extension = ""
        file_path = os.path.join(folder_path, f"{base_name}{extension}")
        counter = 1

        # Ensure we do not overwrite existing files
        while os.path.exists(file_path):
            file_path = os.path.join(folder_path, f"{base_name}_{counter}{extension}")
            counter += 1

        # Create the empty file
        with open(file_path, 'w') as f: pass

    def get_background_items(self, current_folder: Nautilus.FileInfo) -> List[Nautilus.MenuItem]:
        menu_item = Nautilus.MenuItem(
            name="CreateNewFileExtension::CreateNewFile",
            label="New File…",
        )
        menu_item.connect("activate", lambda menu_item: self.create_file(current_folder))
        return [menu_item,]
