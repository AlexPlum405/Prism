# Prism macOS Window Lifecycle Installed Retest 2026-06-30

- App: `/Applications/Prism.app`
- Bundle id: `com.prism.editor.v1`
- Version: `1.4.1`
- Screenshot directory: `screenshots/25-installed-window-lifecycle-smoke/`
- Computer Use note: `get_app_state("Prism")` timed out in this session and `get_app_state("app")` did not accept the executable name. Retest evidence therefore uses real installed app UI actions through AppleScript accessibility plus full-screen screenshots.

## Results

1. Baseline after explicit activate:
   - `name=app, bundle=com.prism.editor.v1, windows=1`
   - `Prism: minimized=false, size=1100x760`
   - Screenshot: `PRISM-CU-261-window-open-before-minimize.png`

2. `Cmd+M`:
   - `frontmost=true, windows=1`
   - `Prism: minimized=true, size=1100x760`
   - Screenshot: `PRISM-CU-262-window-after-cmd-m.png`

3. Restore after `Cmd+M`:
   - `frontmost=true, windows=1`
   - `Prism: minimized=false`
   - Screenshot: `PRISM-CU-263-window-restored-after-cmd-m.png`

4. `Window > 最小化`:
   - Menu item clicked: `menu item 最小化 of menu Window`
   - `frontmost=true, windows=1`
   - `Prism: minimized=true`
   - Screenshot: `PRISM-CU-264-window-after-menu-minimize.png`

5. `Window > 缩放`:
   - Before: `1100x760, minimized=false`
   - After: `1496x852, minimized=false`
   - Screenshot: `PRISM-CU-265-window-after-menu-zoom.png`

6. Red close button:
   - Clicked `button 1 of window Prism`
   - `frontmost=true, windows=0`
   - Screenshot: `PRISM-CU-266-window-after-red-close.png`

7. Reopen after close:
   - `frontmost=true, windows=1`
   - `Prism: minimized=false, size=1496x852`
   - Screenshot: `PRISM-CU-267-window-restored-after-close-reopen.png`

## Conclusion

- `P1-WINDOW-001`: Pass after installed-app retest for `Cmd+M`, native `Window > 最小化`, and native `Window > 缩放`.
- `P1-WINDOW-002`: Pass after installed-app retest for red close button hide and `open -a /Applications/Prism.app` reopen.
