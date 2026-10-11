"""Validate and package the checked-in packs; no Java JAR or npm install needed."""
import io
import json
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def archive_files(paths):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, content in sorted(paths):
            info = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, content, compresslevel=9)
    return output.getvalue()


def main():
    subprocess.run(["python3", "tools/validate.py"], cwd=ROOT, check=True)
    subprocess.run(["node", "--import", "./tests/register-mock.mjs", "--test",
                    *[str(p.relative_to(ROOT)) for p in sorted((ROOT / "tests").glob("*.test.mjs"))]],
                   cwd=ROOT, check=True)
    packs = []
    for directory, suffix in [("behavior_pack", "BP"), ("resource_pack", "RP")]:
        files = [(p.relative_to(ROOT / directory).as_posix(), p.read_bytes())
                 for p in (ROOT / directory).rglob("*") if p.is_file()]
        packs.append((f"Nether_Agriculture_{suffix}.mcpack", archive_files(files)))
    packs.append(("TESTING.txt", (ROOT / "TESTING.txt").read_bytes()))
    version = json.loads((ROOT / "behavior_pack/manifest.json").read_text())["header"]["version"]
    destination = ROOT.parent / "downloads" / f'Nether_Agriculture_v{".".join(map(str, version))}.mcaddon'
    destination.write_bytes(archive_files(packs))
    with zipfile.ZipFile(destination) as archive:
        assert archive.testzip() is None
        for name in archive.namelist():
            if name.endswith(".mcpack"):
                with zipfile.ZipFile(io.BytesIO(archive.read(name))) as pack:
                    assert pack.testzip() is None
                    json.loads(pack.read("manifest.json"))
    print(f"Built {destination} ({destination.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
