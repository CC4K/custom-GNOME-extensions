from gi.repository import GObject, Nautilus
from urllib.parse import unquote, urlparse
from typing import List
import os

class ColumnExtension(GObject.GObject, Nautilus.ColumnProvider, Nautilus.InfoProvider):
    def get_columns(self) -> List[Nautilus.Column]:
        column = Nautilus.Column(
            name="NautilusPython::block_size_column",
            attribute="block_size",
            label="Block size",
            description="Get the block size",
        )

        return [column,]

    def update_file_info(self, file: Nautilus.FileInfo):
        if file.get_uri_scheme() != "file":
            return

        file_path = unquote(urlparse(file.get_uri()).path)
        file.add_string_attribute("block_size", str(os.stat(file_path).st_blksize))
