from gi.repository import GObject, Nautilus
from urllib.parse import unquote, urlparse
from typing import List
import os

class OctalPermissionsInfoProvider(GObject.GObject, Nautilus.ColumnProvider, Nautilus.InfoProvider):
    def get_columns(self) -> List[Nautilus.Column]:
        column = Nautilus.Column(
            name="NautilusPython::file_permissions_octal_column",
            attribute="file_permissions_octal",
            label="Permissions (octal)",
            description="The file permissions in octal"
        )

        return [column,]

    def update_file_info(self, file: Nautilus.FileInfo):
        if file.get_uri_scheme() != "file":
            return

        file_path = unquote(urlparse(file.get_uri()).path)
        octal_permissions = oct(os.stat(file_path).st_mode)[-3:]
        file.add_string_attribute("file_permissions_octal", str(octal_permissions))
