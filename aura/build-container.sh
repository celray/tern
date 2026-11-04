#!/bin/bash
set -euo pipefail
start=$(date +%s)
recipe=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
base=${1:?usage: bash build-container.sh retained-input-directory new-output-directory [--verify-only]}
out=${2:?a new output directory is required}
mode=${3:-build}
case "$mode" in
    build|--verify-only) ;;
    *) echo 'The optional third argument is --verify-only.' >&2; exit 2 ;;
esac
image=sha256:413e0d48bb9de07bbfd21032580cbbe5233c92b266a77fc997ca7ffdaebb4ce0
[[ "$out" == /drive/ws/* && ! -e "$out" ]] || { echo 'Use a new path under /drive/ws.' >&2; exit 2; }
(cd "$base/sources"; echo '91cb675ddfc678255f57ecd7aad498501961577686d19c1947a82b14edea7f25  firefox-153.6.0esr.source.tar.xz' | sha256sum -c -)
docker image inspect "$image" >/dev/null
mkdir -p "$out/source" "$out/review" "$out/packaging"
finish() {
    code=$?
    python3 - "$out" "$start" "$code" "$mode" <<'PYRESULT'
from pathlib import Path
import sys,time,json
p=Path(sys.argv[1]);p.joinpath("rebuild-result.json").write_text(json.dumps({"returncode":int(sys.argv[3]),"mode":sys.argv[4],"started":int(sys.argv[2]),"ended":time.time(),"elapsed_seconds":time.time()-int(sys.argv[2])},indent=2))
PYRESULT
}
trap finish EXIT
cp -a --reflink=auto "$base/mozbuild" "$out/mozbuild"
cp "$recipe/tern.patch" "$recipe/tern-branding.tar.gz" "$recipe/mozconfig" "$recipe/toolchain-manifest.json.zst" "$recipe/source-pin.json" "$out/review/"
for f in PKGBUILD policies.json auratern.desktop auratern-launcher haul-0.1.0.xpi LICENSE; do cp "$recipe/$f" "$out/packaging/"; done
name=auratern-rebuild-$(date +%Y%m%d%H%M%S)
docker run --rm --name "$name" --cpus 16 --memory 32g --memory-swap 32g --pids-limit 4096 \
 --user 1000:1000 -e MOZBUILD_STATE_PATH=/work/mozbuild -e TERN_BUILD_MODE="$mode" -v "$out:/work" -v "$base/sources:/inputs:ro" "$image" bash -euc '
python3 - <<"PY"
from pathlib import Path
import json,hashlib,subprocess
root=Path("/work/review")
compressed=root/"toolchain-manifest.json.zst"
pin=json.loads((root/"source-pin.json").read_text())
actual=hashlib.file_digest(compressed.open("rb"),"sha256").hexdigest()
if actual!=pin["toolchain_manifest_sha256"]:
 raise SystemExit("Compressed toolchain manifest checksum mismatch")
manifest=root/"toolchain-manifest.json"
subprocess.run(["zstd","--decompress","--quiet","--force",str(compressed),"-o",str(manifest)],check=True)
items=json.loads(manifest.read_text())
for item in items:
 p=Path("/work/mozbuild")/item["path"]
 if hashlib.file_digest(p.open("rb"),"sha256").hexdigest()!=item["sha256"]:
  raise SystemExit("Toolchain file checksum mismatch: "+str(p))
Path("/work/toolchain-verification.json").write_text(json.dumps({"compressed_sha256":actual,"files_checked":len(items),"status":"passed"},indent=2))
PY
if [[ "$TERN_BUILD_MODE" == --verify-only ]]; then exit 0; fi
cd /work/source
tar -xf /inputs/firefox-153.6.0esr.source.tar.xz
cd firefox-153.6.0
patch -p1 < /work/review/tern.patch
tar -xf /work/review/tern-branding.tar.gz
cp /work/review/mozconfig .mozconfig
./mach build > /work/build.log 2>&1
./mach package > /work/package.log 2>&1
cp /work/obj-tern/dist/auratern-153.6.0.en-US.linux-x86_64.tar.xz /work/packaging/
python3 - <<"PY"
from pathlib import Path
import re,hashlib
r=Path("/work/packaging");p=r/"PKGBUILD"
archive=r/"auratern-153.6.0.en-US.linux-x86_64.tar.xz"
checksum=hashlib.file_digest(archive.open("rb"),"sha256").hexdigest()
p.write_text(re.sub(r"sha256sums=\(\x27[0-9a-f]{64}\x27", "sha256sums=("+chr(39)+checksum+chr(39), p.read_text(), count=1))
PY
cd /work/packaging
makepkg --nodeps --noconfirm > /work/makepkg.log 2>&1
sha256sum auratern-153.6.0-1-x86_64.pkg.tar.zst
'
