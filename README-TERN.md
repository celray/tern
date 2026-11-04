# Tern

Tern is the AuraLinux browser, built from Mozilla Firefox ESR **153.6.0esr**. The displayed application name is Tern; its package and command are `auratern`. The internal application name remains `AuraTern` to preserve profile and integration identifiers. DuckDuckGo is the distribution search default. Browser updates come through the package manager.

The upstream source archive is available from [Mozilla’s release archive](https://archive.mozilla.org/pub/firefox/releases/153.6.0esr/source/firefox-153.6.0esr.source.tar.xz). Its SHA256 is `91cb675ddfc678255f57ecd7aad498501961577686d19c1947a82b14edea7f25`. The archive and signed checksum list were checked against Mozilla primary key `14F26682D0916CDD81E37B6D61B7B526D98F0353`, using signing subkey `827E658608679618CD349F93678E455D76767AA3`. Mozilla’s signature covers that upstream archive. This tree includes the Tern patch, branding directory and mozconfig prepared by `aura/build-container.sh`.

The tab strip and address bar auto-hide by default. Move the pointer to the top edge to reveal them, or use the usual navigation shortcuts such as Ctrl+L. Separate controls are available in Settings > Tabs and browsing > Tabs. Revealed bars overlay the page and respect reduced motion. Fullscreen, customisation and vertical-tab layouts use Firefox’s existing behaviour. Touch and pen swipe handling is not included.

Aura uses its compositor’s window controls. Other desktops default to tabs in the title bar with Firefox’s window controls; a saved user choice takes precedence. Window buttons reveal with the tab strip. Visible branding, command-line help/version output and profile-error messages use Tern.

`aura/` contains the package recipe and its build inputs. The source runner uses the pinned build container, verifies the upstream archive and compressed toolchain manifest, prepares a fresh source directory, builds it and creates the local pacman package. With the retained source/toolchain cache available on work2:

```sh
bash aura/build-container.sh /drive/ws/aura-jack-tern-1102 /drive/ws/tern-build-new
```

The output path must be new. See `aura/README.md` and `aura/source-pin.json` for the retained image and input details. Use `--verify-only` as the third argument to check the cache without compiling.

The signed Haul extension is an optional removable integration. Its complete unminified extension source is included in `aura/haul-extension-source/`, matching the signed XPI apart from signature metadata. The native Haul packages remain separate.

Upstream licence notices are retained. Firefox-derived source is covered by its existing MPL notices and `LICENSE`; component notices remain with their source.
