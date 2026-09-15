from gi.repository import Nautilus, GObject
from typing import List
from urllib.parse import urlparse, unquote
from PIL import Image
import subprocess
import os

class CustomNautilusMenu(GObject.GObject, Nautilus.MenuProvider):

    #________________________ Methods ________________________

    def open_terminal(self, files: List[Nautilus.FileInfo]) -> None:
        if not files: return

        file = files[0]
        if file.is_directory():
            working_dir = file.get_location().get_path()
            if working_dir: subprocess.Popen(["gnome-terminal", f"--working-directory={working_dir}"])

    def open_in_vscode(self, files: List[Nautilus.FileInfo]) -> None:
        if len(files) == 1 and files[0].is_directory():
            # Open folder in VSCode if only one directory is selected
            folder_path = files[0].get_location().get_path()
            subprocess.run(["code", "-n", folder_path])
        else:
            # Open files in VSCode if multiple files are selected, disregarding directories
            file_paths = [file.get_location().get_path() for file in files if not file.is_directory()]
            subprocess.run(["code"] + file_paths)

    def convert_to_webp(self, files: List[Nautilus.FileInfo]) -> None:
        for file in files:
            file_path = unquote(urlparse(file.get_uri()).path)
            image = Image.open(file_path)
            image.save(f"{file_path.rsplit('.', 1)[0]}.webp", format="webp")

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
        f.close()
    
    def copy_paths(self, files: List[Nautilus.FileInfo]) -> None:
        # Extract paths and join them with a newline if multiple are selected
        file_paths = [file.get_location().get_path() for file in files if file.get_location().get_path()]
        full_paths_str = "\n".join(file_paths)
        # Copy to clipboard using xclip
        process = subprocess.Popen(["xclip", "-selection", "clipboard"], stdin=subprocess.PIPE, text=True)
        process.communicate(input=full_paths_str)


    #________________________ Menu Generators ________________________

    def generate_terminal_menu(self, files: List[Nautilus.FileInfo], is_background: bool) -> List[Nautilus.MenuItem]:
        # Only show on files if a single directory is selected
        if not is_background and not (len(files) == 1 and files[0].is_directory()): return []

        menu_item = Nautilus.MenuItem(
            name="CustomMenu::OpenTerminal" + ("Background" if is_background else ""),
            label="Open in Terminal",
        )
        menu_item.connect("activate", lambda menu_item, files=files: self.open_terminal(files))
        return [menu_item]

    def generate_vscode_menu(self, files: List[Nautilus.FileInfo], is_background: bool) -> List[Nautilus.MenuItem]:
        menu_item = Nautilus.MenuItem(
            name="CustomMenu::OpenInVSCode" + ("Background" if is_background else ""),
            label="Open in VSCode",
        )
        menu_item.connect("activate", lambda menu_item, files=files: self.open_in_vscode(files))
        return [menu_item]

    def generate_convert_to_webp_menu(self, files: List[Nautilus.FileInfo]) -> List[Nautilus.MenuItem]:
        SUPPORTED_FORMATS = "image/jpeg", "image/jpg", "image/png"
        for file in files:
            if file.get_mime_type() not in SUPPORTED_FORMATS:
                return []

        menu_item = Nautilus.MenuItem(
            name="CustomMenu::ConvertToWebp",
            label="Convert to webp",
        )

        menu_item.connect("activate", lambda menu_item, files=files: self.convert_to_webp(files))
        return [menu_item]

    def generate_new_file_menu(self, files: List[Nautilus.FileInfo], is_background: bool) -> List[Nautilus.MenuItem]:
        # Only show the new file option in background right-click
        if not is_background: return []

        menu_item = Nautilus.MenuItem(
            name="CustomMenu::CreateNewFile",
            label="New File…",
        )
        # files[0] contains the current_folder when is_background is True
        menu_item.connect("activate", lambda menu_item: self.create_file(files[0]))
        return [menu_item]

    def generate_copy_path_menu(self, files: List[Nautilus.FileInfo], is_background: bool) -> List[Nautilus.MenuItem]:
        menu_item = Nautilus.MenuItem(
            name="CustomMenu::CopyPath" + ("Background" if is_background else ""),
            label="Copy Path",
        )
        menu_item.connect("activate", lambda menu_item, files=files: self.copy_paths(files))
        return [menu_item]


    #________________________ Nautilus Implementation ________________________

    def get_file_items(self, files: List[Nautilus.FileInfo]) -> List[Nautilus.MenuItem]:
        return  self.generate_terminal_menu(files, False) + \
                self.generate_vscode_menu(files, False) + \
                self.generate_convert_to_webp_menu(files) + \
                self.generate_new_file_menu(files, False) + \
                self.generate_copy_path_menu(files, False)

    def get_background_items(self, current_folder: Nautilus.FileInfo) -> List[Nautilus.MenuItem]:
        return  self.generate_terminal_menu([current_folder], True) + \
                self.generate_vscode_menu([current_folder], True) + \
                self.generate_new_file_menu([current_folder], True) + \
                self.generate_copy_path_menu([current_folder], True)
