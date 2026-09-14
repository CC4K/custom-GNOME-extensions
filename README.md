# GNOME Custom Extensions
A collection of customised GNOME extensions for GNOME Shell and GNOME Nautilus.

## Feature Showcase
### Eclipse DVD Screensaver
This version supports showing the screensaver on multiple monitors instead of only the main monitors. It additionally hides the cursor when the screensaver is active.

<!-- TODO: insert video via GitHub here -->

GNOME panels (e.g. notification panel) still appear on top of the screensaver since the screensaver is only a black overlay but this is still much less annoying than the cursor being visible.

### Desktop Icons NG (DING)
A simple customisation of the context menu to fit my use + a new entry to open in VSCode directly from the desktop.

<figure align="center">
	<div>
    <div style="display: flex; justify-content: center; align-items: flex-start; gap: 10px; padding: 5px;">
      <img src="media/ding_extension_background_showcase.png" alt="background context menu" style="margin-right: 67px;"/>
      <img src="media/ding_extension_folder_showcase.png" alt="folder context menu"/>
    </div>
	</div>
  <div>
    <div style="display: flex; justify-content: center; align-items: flex-start; gap: 10px; padding: 5px;">
      <img src="media/ding_extension_file_showcase.png" alt="file context menu"/>
      <img src="media/ding_extension_multiple_showcase.png" alt="multiple selection context menu"/>
    </div>
  </div>
</figure>

### Nautilus Python
A custom Nautilus context menu using nautilus-python. It contains :

- "Open in Terminal" : obosolete in Ubuntu 26.04 but still useful for Ubuntu 24.04
- "Open in VSCode" : open folder or file in VSCode
- "Convert to webp" : only appears on image files
- "New File" : creates "file" then "file_1" then "file_2"...
- "Copy Path" : copies the absolute path of all selected items (or current location if background was cliked) to clipboard

<figure align="center">
  <div style="display: flex; justify-content: center; align-items: flex-start; gap: 10px; padding: 5px;">
    <img src="media/nautilus_background_custom_menu.png" alt="background context menu"/>
    <img src="media/nautilus_image_custom_menu.png" alt="image context menu"/>
  </div>
</figure>

Unfortunately, the menu cannot be moved outside of the space before last item in the context menu but I can live with it.

## Installation
### Eclipse DVD Screensaver
1. Download the extension from [GNOME Extensions](https://extensions.gnome.org/extension/8755/eclipse-dvd-screensaver/)
2. Overwrite `extension.js` in extension root (`~/.local/share/gnome-shell/extensions/eclipse-dvd-screensaver@sudoyasir.github.com`)
3. Restart GNOME Shell (Alt+F2, then type `r` on X11, logout and log back in on Wayland)

### Desktop Icons NG (DING)
1. Download the extension from [GNOME Extensions](https://extensions.gnome.org/extension/2087/desktop-icons-ng-ding/)
2. Overwrite `app/desktopManager.js` and `app/fileItemMenu.js` in extension 'app' folder (`/usr/share/gnome-shell/extensions/ding@rastersoft.com/app` if you are on Ubuntu as it is a default extension)
3. Restart GNOME Shell (Alt+F2, then type `r` on X11, logout and log back in on Wayland)

### Nautilus Python
1. Install `nautilus-python` :
    ```bash
    sudo apt install -y python3-nautilus
    ```
2. Create a `~/.local/share/nautilus_python/extension/` folder and move `menu-custom.py` in it (the other files are here for reference if you wish to implement them yourself + I don't really need addtional columns in Nautilus but you might)
