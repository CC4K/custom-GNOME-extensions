import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default class EclipseDVDExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        // Items for each monitor :
        // [overlay, actor, label, monitorIndex, x, y, velocityX, velocityY, colorIndex]
        this._items = [];

        this._timeout = null;
        this._clockTimeout = null;
        this._idleMonitor = null;
        this._idleWatchId = null;
        this._settings = null;
        this._isActive = false;

        this._colors = [];
        this._cornerHits = 0;

        // Input tracking (to stop screensaver)
        this._capturedEventId = null;

        // Cursor tracking (to show/hide cursor)
        this._cursorTracker = null;
        this._cursorWasHidden = false;
    }

    enable() {
        this._settings = this.getSettings();
        this._loadColors();
        this._setupIdleMonitor();
        this._connectSettings();
    }

    disable() {
        this._hideScreensaver();

        if (this._idleWatchId && this._idleMonitor) {
            this._idleMonitor.remove_watch(this._idleWatchId);
            this._idleWatchId = null;
        }

        if (this._timeout) {
            GLib.Source.remove(this._timeout);
            this._timeout = null;
        }

        // Clean up clock timeout
        if (this._clockTimeout) {
            GLib.source_remove(this._clockTimeout);
            this._clockTimeout = null;
        }

        this._settings = null;
        this._idleMonitor = null;
    }

    _setupIdleMonitor() {
        try {
            this._idleMonitor = global.backend.get_core_idle_monitor();
        } catch (e) {
            try {
                this._idleMonitor = Meta.IdleMonitor.get_core();
            } catch (e2) {
                console.error('Eclipse: Failed to get idle monitor');
                return;
            }
        }
        this._updateIdleWatch();
    }

    _updateIdleWatch() {
        if (this._idleWatchId && this._idleMonitor) {
            try {
                this._idleMonitor.remove_watch(this._idleWatchId);
            } catch (e) {
                // Silently fail
            }
            this._idleWatchId = null;
        }

        if (!this._idleMonitor) {
            return;
        }

        const idleTimeSeconds = this._settings.get_int('idle-time');
        const idleTimeMs = idleTimeSeconds * 1000;

        try {
            this._idleWatchId = this._idleMonitor.add_idle_watch(idleTimeMs, () => {
                this._showScreensaver();
            });
        } catch (e) {
            console.error('Eclipse: Failed to add idle watch');
        }
    }

    _showScreensaver() {
        if (this._isActive) {
            return;
        }

        this._isActive = true;

        // Create fullscreen overlay for each monitor
        this._createOverlays();

        // Create the bouncing label for each monitor
        this._createLabels();

        // Start animation for each monitor
        this._startAnimation();

        // Capture all input to detect user activity
        this._captureInput();

        // Hide cursor when screensaver active
        this._hideCursor();

        // Fade in smoothly for each monitor
        for (const item of this._items) {
            item.overlay.opacity = 0;
            item.actor.opacity = 0;

            item.overlay.ease({
                opacity: 255,
                duration: 500,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });

            item.actor.ease({
                opacity: 255,
                duration: 800,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        }
    }

    _hideScreensaver() {
        if (!this._isActive) {
            return;
        }

        this._isActive = false;

        // Remove input capture immediately
        if (this._capturedEventId) {
            global.stage.disconnect(this._capturedEventId);
            this._capturedEventId = null;
        }

        // Restore the system cursor
        this._showCursor();

        if (this._items.length > 0) {
            // Fade out smoothly for each monitor then clean up
            let remaining = this._items.length;
            const onOverlayFadeDone = () => {
                remaining -= 1;
                if (remaining <= 0) {
                    this._cleanupScreensaver();
                }
            };

            for (const item of this._items) {
                item.overlay.ease({
                    opacity: 0,
                    duration: 400,
                    mode: Clutter.AnimationMode.EASE_IN_QUAD,
                    onComplete: onOverlayFadeDone,
                });

                item.actor.ease({
                    opacity: 0,
                    duration: 300,
                    mode: Clutter.AnimationMode.EASE_IN_QUAD,
                });
            }
        } else {
            this._cleanupScreensaver();
        }
    }

    _cleanupScreensaver() {
        // Stop animation
        if (this._timeout) {
            GLib.Source.remove(this._timeout);
            this._timeout = null;
        }

        // Stop clock update
        this._stopClockUpdate();

        // Destroy UI for each monitor
        for (const item of this._items) {
            if (item.actor) {
                item.actor.destroy();
            }
            if (item.overlay) {
                item.overlay.destroy();
            }
        }
        this._items = [];

        // Reset idle monitor
        this._updateIdleWatch();
    }

    _createOverlays() {
        // Create black fullscreen overlay for each monitor
        const monitors = Main.layoutManager.monitors;

        for (const monitor of monitors) {
            const overlay = new St.Widget({
                style_class: 'eclipse-dvd-overlay',
                style: 'background-color: black;',
                reactive: true,
                can_focus: true,
                track_hover: true,
            });

            overlay.set_position(monitor.x, monitor.y);
            overlay.set_size(monitor.width, monitor.height);

            Main.layoutManager.addChrome(overlay, {
                affectsStruts: false,
                trackFullscreen: false,
            });

            overlay.show();

            this._items.push({
                overlay,
                actor: null,
                label: null,
                monitorIndex: monitor.index,
                x: 0,
                y: 0,
                velocityX: 0,
                velocityY: 0,
                colorIndex: Math.floor(Math.random() * Math.max(this._colors.length, 1)),
            });
        }
    }

    _captureInput() {
        // Capture any keyboard or mouse event to hide screensaver
        this._capturedEventId = global.stage.connect('captured-event', (actor, event) => {
            const type = event.type();
            if (type === Clutter.EventType.KEY_PRESS ||
                type === Clutter.EventType.BUTTON_PRESS ||
                type === Clutter.EventType.MOTION) {
                this._hideScreensaver();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    _hideCursor() {
        try {
            this._cursorTracker = global.backend.get_cursor_tracker();
        } catch (e) {
            try {
                this._cursorTracker = Meta.CursorTracker.get_for_display(global.display);
            } catch (e2) {
                console.error('Eclipse: Failed to track cursor');
                // if we can't track the cursor => don't even try
                this._cursorTracker = null;
                return;
            }
        }

        try {
            // this._cursorTracker.set_pointer_visible(false);
            // REMOVED in GNOME 49 : https://gjs.guide/extensions/upgrading/gnome-shell-49.html#meta-cursortracker
            this._cursorTracker.inhibit_cursor_visibility();
            this._cursorWasHidden = true;
        } catch (e) {
            console.error('Eclipse: Failed to hide cursor');
        }
    }

    _showCursor() {
        if (this._cursorTracker && this._cursorWasHidden) {
            try {
                // this._cursorTracker.set_pointer_visible(true);
                // REMOVED in GNOME 49 : https://gjs.guide/extensions/upgrading/gnome-shell-49.html#meta-cursortracker
                this._cursorTracker.uninhibit_cursor_visibility();
            } catch (e) {
                // Silently fail
            }
        }
        this._cursorWasHidden = false;
        this._cursorTracker = null;
    }

    _loadColors() {
        const colorScheme = this._settings.get_string('color-scheme');

        if (colorScheme === 'classic') {
            this._colors = [
                [255, 51, 76],    // Red rgb(255, 51, 76)
                [51, 255, 76],    // Green rgb(51, 255, 76)
                [76, 127, 255],   // Blue rgb(76, 127, 255)
                [255, 204, 51],   // Yellow rgb(255, 204, 51)
                [255, 102, 204],  // Pink rgb(255, 102, 204)
                [102, 255, 229],  // Cyan rgb(102, 255, 229)
                [204, 102, 255],  // Purple rgb(204, 102, 255)
                [255, 153, 51],   // Orange rgb(255, 153, 51)
            ];
        } else if (colorScheme === 'pastel') {
            this._colors = [
                [255, 179, 186],  // Pastel Red rgb(255, 179, 186)
                [186, 255, 201],  // Pastel Green rgb(186, 255, 201)
                [186, 225, 255],  // Pastel Blue rgb(186, 225, 255)
                [255, 243, 186],  // Pastel Yellow rgb(255, 243, 186)
                [255, 209, 229],  // Pastel Pink rgb(255, 209, 229)
                [209, 255, 243],  // Pastel Cyan rgb(209, 255, 243)
                [229, 209, 255],  // Pastel Purple rgb(229, 209, 255)
                [255, 223, 186],  // Pastel Orange rgb(255, 223, 186)
            ];
        } else if (colorScheme === 'neon') {
            this._colors = [
                [255, 0, 102],    // Neon Pink rgb(255, 0, 102)
                [0, 255, 102],    // Neon Green rgb(0, 255, 102)
                [0, 102, 255],    // Neon Blue rgb(0, 102, 255)
                [255, 255, 0],    // Neon Yellow rgb(255, 255, 0)
                [255, 0, 255],    // Neon Magenta rgb(255, 0, 255)
                [0, 255, 255],    // Neon Cyan rgb(0, 255, 255)
                [255, 102, 0],    // Neon Orange rgb(255, 102, 0)
                [204, 0, 255],    // Neon Purple rgb(204, 0, 255)
            ];
        } else if (colorScheme === 'monochrome') {
            this._colors = [
                [255, 255, 255],  // White rgb(255, 255, 255)
                [220, 220, 220],  // Light Gray rgb(220, 220, 220)
                [180, 180, 180],  // Gray rgb(180, 180, 180)
                [140, 140, 140],  // Dark Gray rgb(140, 140, 140)
            ];
        }
    }

    _createLabels() {
        // Create bouncing label for each monitor
        const displayMode = this._settings.get_string('display-mode');
        const text = displayMode === 'clock' ? this._getCurrentTime() : this._settings.get_string('display-text');
        const fontSize = this._settings.get_int('font-size');
        const showGlow = this._settings.get_boolean('show-glow');

        for (const item of this._items) {
            // Create container
            const actor = new St.Widget({
                style_class: 'eclipse-dvd-container',
                reactive: false,
                can_focus: false,
                track_hover: false,
            });

            const label = new St.Label({
                text: text,
                style: this._getLabelStyle(fontSize, showGlow, item.colorIndex),
            });

            actor.add_child(label);

            Main.layoutManager.addChrome(actor, {
                affectsStruts: false,
                trackFullscreen: false,
            });

            item.actor = actor;
            item.label = label;
        }

        // Start clock update timer if in clock mode
        if (displayMode === 'clock') {
            this._startClockUpdate();
        }

        // Wait for layout to get actual dimensions then initialize with random positions and velocities
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            const monitors = Main.layoutManager.monitors;

            for (const item of this._items) {
                const monitor = monitors.find(m => m.index === item.monitorIndex);
                if (!monitor || !item.label) {
                    continue;
                }

                const width = item.label.width || 200;
                const height = item.label.height || 80;

                item.x = Math.random() * Math.max(0, monitor.width - width);
                item.y = Math.random() * Math.max(0, monitor.height - height);

                const speed = this._settings.get_int('bounce-speed');
                item.velocityX = (speed + Math.random() * 50) * (Math.random() > 0.5 ? 1 : -1);
                item.velocityY = (speed + Math.random() * 50) * (Math.random() > 0.5 ? 1 : -1);

                this._updatePosition(item);
                this._updateItemColor(item);
            }

            return GLib.SOURCE_REMOVE;
        });
    }

    _getLabelStyle(fontSize, showGlow, colorIndex) {
        // Fallback to first color or white
        const color = this._colors[colorIndex] || this._colors[0] || [255, 255, 255];
        const colorStr = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;

        let style = `
            color: ${colorStr};
            font-size: ${fontSize}px;
            font-weight: bold;
            font-family: sans-serif;
        `;

        if (showGlow) {
            style += `
                text-shadow: 
                    0 0 10px ${colorStr},
                    0 0 20px ${colorStr},
                    0 0 30px ${colorStr};
            `;
        }

        return style;
    }

    _getCurrentTime() {
        const now = new Date();
        const clockFormat = this._settings.get_string('clock-format');
        const showSeconds = this._settings.get_boolean('show-seconds');

        let hours = now.getHours();
        let ampm = '';

        // Handle 12-hour format
        if (clockFormat === '12h') {
            ampm = hours >= 12 ? ' PM' : ' AM';
            hours = hours % 12;
            hours = hours ? hours : 12; // 0 should be 12
        }

        const hoursStr = String(hours).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');

        let timeStr = `${hoursStr}:${minutes}`;

        if (showSeconds) {
            const seconds = String(now.getSeconds()).padStart(2, '0');
            timeStr += `:${seconds}`;
        }

        return timeStr + ampm;
    }

    _startClockUpdate() {
        // Clear existing clock timeout if any
        if (this._clockTimeout) {
            GLib.source_remove(this._clockTimeout);
            this._clockTimeout = null;
        }

        // Update clock every second for each label for each monitor
        this._clockTimeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            if (this._settings.get_string('display-mode') === 'clock') {
                const timeStr = this._getCurrentTime();
                for (const item of this._items) {
                    if (item.label) {
                        item.label.text = timeStr;
                    }
                }
            }
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopClockUpdate() {
        if (this._clockTimeout) {
            GLib.source_remove(this._clockTimeout);
            this._clockTimeout = null;
        }
    }

    _updatePosition(item) {
        if (!item.actor || !item.label) {
            return;
        }
        const monitor = Main.layoutManager.monitors.find(m => m.index === item.monitorIndex);
        if (!monitor) {
            return;
        }
        item.actor.set_position(monitor.x + Math.floor(item.x), monitor.y + Math.floor(item.y));
    }

    _updateItemColor(item) {
        if (item.label) {
            const fontSize = this._settings.get_int('font-size');
            const showGlow = this._settings.get_boolean('show-glow');
            item.label.style = this._getLabelStyle(fontSize, showGlow, item.colorIndex);
        }
    }

    _updateAllColors() {
        for (const item of this._items) {
            this._updateItemColor(item);
        }
    }

    _startAnimation() {
        // Update at ~60 FPS
        const fps = 60;
        const interval = 1000 / fps;

        // Clear existing timeout if any
        if (this._timeout) {
            GLib.source_remove(this._timeout);
            this._timeout = null;
        }

        this._timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => {
            this._update(1 / fps);
            return GLib.SOURCE_CONTINUE;
        });
    }

    _update(dt) {
        const monitors = Main.layoutManager.monitors;

        for (const item of this._items) {
            if (!item.label || !item.actor) {
                continue;
            }

            const monitor = monitors.find(m => m.index === item.monitorIndex);
            if (!monitor) {
                // Monitor was lost (i.e. potentially unplugged) => stop touching it
                continue;
            }

            // Update position
            item.x += item.velocityX * dt;
            item.y += item.velocityY * dt;

            const width = item.label.width;
            const height = item.label.height;

            let hitEdge = false;
            let hitCorner = false;

            // Bounce off edges for current monitor
            if (item.x <= 0) {
                item.x = 0;
                item.velocityX = Math.abs(item.velocityX);
                hitEdge = true;
            } else if (item.x + width >= monitor.width) {
                item.x = monitor.width - width;
                item.velocityX = -Math.abs(item.velocityX);
                hitEdge = true;
            }

            if (item.y <= 0) {
                item.y = 0;
                item.velocityY = Math.abs(item.velocityY);
                if (hitEdge) hitCorner = true;
                hitEdge = true;
            } else if (item.y + height >= monitor.height) {
                item.y = monitor.height - height;
                item.velocityY = -Math.abs(item.velocityY);
                if (hitEdge) hitCorner = true;
                hitEdge = true;
            }

            // Change color on edge hit
            if (hitEdge) {
                item.colorIndex = (item.colorIndex + 1) % this._colors.length;
                this._updateItemColor(item);
            }

            if (hitCorner) {
                this._cornerHits++;
            }

            this._updatePosition(item);
        }
    }

    _connectSettings() {
        // This method was adapted using AI asistance as I don't understand in which scenario would the settings be changed with the screensaver live unless there is somehow a cron job to change it via gsettings (though I don't see any options for it so it may be a future development ?) or via an SSH connection (why though ?)
        this._settings.connect('changed::display-mode', () => {
            if (this._isActive) {
                this._recreateLabels();
            }
        });

        this._settings.connect('changed::display-text', () => {
            if (this._isActive) {
                this._recreateLabels();
            }
        });

        this._settings.connect('changed::font-size', () => {
            if (this._isActive) {
                this._updateAllColors();
            }
        });

        this._settings.connect('changed::show-glow', () => {
            if (this._isActive) {
                this._updateAllColors();
            }
        });

        this._settings.connect('changed::bounce-speed', () => {
            if (this._isActive) {
                const speed = this._settings.get_int('bounce-speed');
                // Untested
                for (const item of this._items) {
                    if (!item.velocityX || !item.velocityY) {
                        continue;
                    }
                    const currentSpeed = Math.sqrt(item.velocityX ** 2 + item.velocityY ** 2);
                    const ratio = speed / currentSpeed;
                    item.velocityX *= ratio;
                    item.velocityY *= ratio;
                }
            }
        });

        this._settings.connect('changed::color-scheme', () => {
            this._loadColors();
            if (this._isActive) {
                this._updateAllColors();
            }
        });

        this._settings.connect('changed::clock-format', () => {
            if (this._isActive && this._settings.get_string('display-mode') === 'clock') {
                // Update clock display immediately with new format
                // Untested
                const timeStr = this._getCurrentTime();
                for (const item of this._items) {
                    if (item.label) {
                        item.label.text = timeStr;
                    }
                }
            }
        });

        this._settings.connect('changed::show-seconds', () => {
            if (this._isActive && this._settings.get_string('display-mode') === 'clock') {
                // Update clock display immediately with/without seconds
                // Untested
                const timeStr = this._getCurrentTime();
                for (const item of this._items) {
                    if (item.label) {
                        item.label.text = timeStr;
                    }
                }
            }
        });

        this._settings.connect('changed::idle-time', () => {
            this._updateIdleWatch();
        });
    }

    _recreateLabels() {
        if (!this._isActive) {
            return;
        }

        // Store {monitorIndex: {x, y, velocityX, velocityY, colorIndex}} for each monitor
        const oldStateByMonitor = new Map();
        for (const item of this._items) {
            oldStateByMonitor.set(item.monitorIndex, {
                x: item.x,
                y: item.y,
                velocityX: item.velocityX,
                velocityY: item.velocityY,
                colorIndex: item.colorIndex,
            });
            if (item.actor) {
                item.actor.destroy();
            }
            item.actor = null;
            item.label = null;
        }

        this._createLabels();

        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            for (const item of this._items) {
                const old = oldStateByMonitor.get(item.monitorIndex);
                // Restore old state for the monitor
                if (old) {
                    item.x = old.x;
                    item.y = old.y;
                    item.velocityX = old.velocityX;
                    item.velocityY = old.velocityY;
                    item.colorIndex = old.colorIndex;
                    this._updatePosition(item);
                    this._updateItemColor(item);
                }
            }
            return GLib.SOURCE_REMOVE;
        });
    }
}
