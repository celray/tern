# Tern package

This folder builds the Tern browser from the pinned Mozilla Firefox ESR153.6.0esr source. The package/command/desktop ID is `auratern`; the launcher displays Tern. Haul’s signed extension is a removable distribution extension. The native `haul` and `haul-gui` packages are optional and use their existing recipes.

Build this package manually on work2. It is not part of `scripts/build-packages.sh` or the ISO package list. The signed source cache and copied toolchains are currently retained at `/drive/ws/aura-jack-tern-1102`. The original source and SHA512SUMS signatures were checked against the primary key in `source-pin.json`; `mozilla-release-key.asc` is that public key. The complete modified source is published at https://github.com/celray/tern.

```sh
nohup bash pkgbuilds/auratern/build-container.sh /drive/ws/aura-jack-tern-1102 /drive/ws/aura-tern-recipe-build-20261103 > /drive/ws/aura-tern-recipe-build-20261103.log 2>&1 < /dev/null &
```

The output path must be new and under `/drive/ws`. The script checks the upstream source SHA256 and retained image digest, then verifies the compressed manifest SHA256 in source-pin.json before decompression and toolchain-file checks. It copies toolchains into the new workspace, applies the six-file patch, adds the branding directory and runs the full non-PGO build and package step inside a 16-CPU/32-GiB container. Every product input in this folder is copied into that workspace. Build outputs include the compiled engine archive and the pacman package; `rebuild-result.json` records the elapsed time and exit status. Add `--verify-only` as the third argument to run preparation and manifest/toolchain verification without compiling.

`PKGBUILD` packages the compiled archive produced by this script. Its first checksum describes the accepted initial archive; the script updates that checksum for the new local compilation before running makepkg. The recipe’s other inputs are checked by makepkg. The package retains the upstream MPL licence text and source notices. Supply the complete modified source with any binary release.

The retained image digest is required. `Dockerfile.audit` records how that image was made; rebuilding it against a later Arch repository would produce different inputs. Preserve the image and source/toolchain cache together. The inputs and commands are retained. Timestamps and package metadata can make output bytes differ between builds.

Declan owns urgent rebuilds. Critical and high Mozilla ESR advisories require a rebuild within 24 hours of the advisory. Moderate and low advisories go into the next routine build within 7 days. Before changing the pin, check the official [release metadata](https://product-details.mozilla.org/1.0/firefox_versions.json) and [ESR advisories](https://www.mozilla.org/en-US/security/known-vulnerabilities/firefox-esr/), validate the selected source signature/checksum and review patch compatibility.

Account setup, app updates, telemetry uploads, studies and default-browser nagging are disabled through policy. EME is disabled in the build and locked off. Search configuration keeps upstream signature checks and removes partner attribution; DuckDuckGo is the default search engine, set by policy. Upstream public service/support URLs remain. The packaged new-tab wordmark follows the page’s light or dark colour scheme. New-tab/first-run HTML designs are separate work; omit the new-tab tagline when implementing those designs.

Keep each accepted package and a closed-browser profile backup before later upgrades. Close Tern before installing a retained package with `pacman -U`; use the matching profile backup if the newer engine changed its format. The first accepted candidate remains under the retained cache’s `artifacts/baseline/`. Stock Firefox has a separate profile root and remains the interim default.
