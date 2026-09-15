from gi.repository import GObject, Nautilus
from urllib.parse import urlparse, unquote
from typing import List
from PIL import Image

SUPPORTED_FORMATS = "image/jpeg", "image/jpg", "image/png"

class ConvertToWebpMenuProvider(GObject.GObject, Nautilus.MenuProvider):
    def convert(self, files: List[Nautilus.FileInfo]) -> None:
        for file in files:
            file_path = unquote(urlparse(file.get_uri()).path)
            image = Image.open(file_path)
            image.save(f"{file_path.rsplit('.', 1)[0]}.webp", format="webp")

    def get_file_items(self, files: List[Nautilus.FileInfo]) -> List[Nautilus.MenuItem]:
        for file in files:
            if file.get_mime_type() not in SUPPORTED_FORMATS:
                return ()

        menu_item = Nautilus.MenuItem(
            name="ConvertToWebpMenuProvider::ConvertToWebp",
            label="Convert to webp",
        )

        menu_item.connect("activate", lambda menu_item, files=files: self.convert(files))
        return [menu_item,]
