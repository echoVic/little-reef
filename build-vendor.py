#!/usr/bin/env python3
"""Vendor the exact upstream ESM files used by this no-build frontend.

No npm install, frontend build or runtime CDN is needed. Archives are verified
against the pinned npm integrity before reading the explicit allowlist.
"""
import base64
import hashlib
import io
import json
from pathlib import Path
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parent
VENDOR = ROOT / "web" / "vendor"
PACKAGES = {
    "lucide-static": {
        "version": "1.65.0",
        "integrity": "sha512-Mbahsp1MHXzBK2qQ+j+OpdwvPwOFYFBOe2pD1O5eI+XLRpbqPY2euz6vemAddXGevRvJ5n8D83ilUCrtxP07RQ==",
        "icons": ["panels-top-left", "minus", "x", "play", "pause", "coffee", "maximize-2", "volume-2", "volume-x", "waves-horizontal", "cloud-rain", "cloud-lightning", "droplets", "bubbles", "soup", "anchor", "wind", "flame", "trees", "sun", "moon", "mountain", "sunrise", "clock", "circle-dot", "list-music", "car", "audio-lines", "fish", "check"],
    },
    "mygo-runtime": {
        "version": "0.7.3",
        "integrity": "sha512-ggttUf9WmBIDMjazN8hBB2/n/ezoqOKx9Uc0tjK3G6ekFg5mqrS+GLIEjwnStfXMGFS6+tmdd0uCGPrsYvgMdQ==",
    },
}


def vendor(package, config):
    version = config["version"]
    url = f"https://registry.npmjs.org/{package}/-/{package}-{version}.tgz"
    with urllib.request.urlopen(url, timeout=60) as response:
        archive = response.read()
    actual = "sha512-" + base64.b64encode(hashlib.sha512(archive).digest()).decode()
    if actual != config["integrity"]:
        raise ValueError(f"{package}: upstream archive integrity mismatch")
    target = VENDOR / package
    target.mkdir(parents=True, exist_ok=True)
    files = {}
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as tar:
        entries = {"LICENSE": "LICENSE"}
        if package == "lucide-static":
            entries.update({f"dist/esm/icons/{name}.mjs": f"{name}.mjs" for name in config["icons"]})
        else:
            entries["dist/index.js"] = "index.js"
        # Validate the whole allowlist before writing any of this package.
        for source in entries:
            tar.getmember(f"package/{source}")
        for source, filename in entries.items():
            data = tar.extractfile(f"package/{source}").read()
            if filename.endswith(".mjs"):
                # npm's maps describe files outside this subset; omit the dead reference.
                data = b"\n".join(line for line in data.split(b"\n") if not line.startswith(b"//# sourceMappingURL="))
            (target / filename).write_bytes(data)
            files[filename] = hashlib.sha256(data).hexdigest()
    print(f"{package}@{version}: {len(files)} files")
    return {"version": version, "url": url, "integrity": actual, "files": files}


if __name__ == "__main__":
    manifest = {package: vendor(package, config) for package, config in PACKAGES.items()}
    (VENDOR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
