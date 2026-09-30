"""Track B3: stage Blender renders into the game's asset tree.

The plan called for teaching `copy_assets.py` a new source root and reusing
its byte-size verification. That file no longer exists -- it went with the
duplicate FINAL_NINETY-NINE_* delivery folders when they were consolidated
away, and `ninety-nine/assets/{img,aud,vid}` is now the single source of
truth for generated media (CLAUDE.md). So this replaces it rather than
extending it, and drops the parallel delivery root the plan described:
Blender stages into blender/renders/_game/, and this copies staged files in.

The AI stills and clips are not regenerable -- there is no saved seed or
prompt-to-file mapping for them -- so anything this replaces is moved into
assets/_retired_ai/ first. Nothing is overwritten in place.

Usage (from ninety-nine/):
    python tools/stage_assets.py                  # dry run: what would change
    python tools/stage_assets.py --apply          # do it
    python tools/stage_assets.py --apply S1_C_IMG_IN.png S1_C_VID.mp4
    python tools/stage_assets.py --restore        # put the retired originals back

MANIFEST.csv rows are rewritten for whatever is staged: bytes, dimensions,
duration and hash are re-measured from the new file, never copied from the
old row. qc is set to 'pending' -- the Doc 2 Sec.8 nine-point check is a
human eyeball pass, and this script has not done it.
"""

import argparse
import csv
import hashlib
import os
import shutil
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
GAME_ROOT = os.path.dirname(HERE)
PROJECT_ROOT = os.path.dirname(GAME_ROOT)

STAGING_ROOT = os.path.join(PROJECT_ROOT, "blender", "renders", "_game")
ASSETS_ROOT = os.path.join(GAME_ROOT, "assets")
RETIRED_ROOT = os.path.join(ASSETS_ROOT, "_retired_ai")
MANIFEST = os.path.join(ASSETS_ROOT, "MANIFEST.csv")

KIND_DIRS = {"img": "img", "vid": "vid"}
STAGE_NOTE = "blender re-skin (Track B1, export_game_assets.py)"


def sha256_16(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


def png_dimensions(path):
    with open(path, "rb") as fh:
        head = fh.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n" or head[12:16] != b"IHDR":
        return None, None
    return struct.unpack(">II", head[16:24])


def mp4_info(path):
    """Duration (s) and pixel dimensions, read straight from the container.

    ffprobe is not available on this machine (no Node, no ffmpeg on PATH --
    same constraint that put the test harness in a browser), so this walks
    the atom tree for mvhd (duration) and the first video tkhd (dimensions).
    """
    duration = width = height = None

    def walk(fh, end, depth=0):
        nonlocal duration, width, height
        while fh.tell() < end - 8 and depth < 6:
            start = fh.tell()
            header = fh.read(8)
            if len(header) < 8:
                return
            size, kind = struct.unpack(">I4s", header)
            if size == 1:  # 64-bit extended size
                size = struct.unpack(">Q", fh.read(8))[0]
            if size < 8:
                return
            stop = start + size
            if kind in (b"moov", b"trak", b"mdia"):
                walk(fh, stop, depth + 1)
            elif kind == b"mvhd":
                version = struct.unpack(">B", fh.read(1))[0]
                fh.read(3)
                if version == 1:
                    fh.read(16)
                    timescale, dur = struct.unpack(">IQ", fh.read(12))
                else:
                    fh.read(8)
                    timescale, dur = struct.unpack(">II", fh.read(8))
                if timescale:
                    duration = round(dur / timescale, 3)
            elif kind == b"tkhd" and width in (None, 0):
                version = struct.unpack(">B", fh.read(1))[0]
                fh.read(3)
                fh.read(32 if version == 1 else 20)
                # reserved(8) layer(2) alternate_group(2) volume(2)
                # reserved(2) matrix(36) -- then width/height as 16.16 fixed.
                fh.read(8 + 2 + 2 + 2 + 2 + 36)
                w, h = struct.unpack(">II", fh.read(8))
                width, height = w >> 16, h >> 16
            fh.seek(stop)

    with open(path, "rb") as fh:
        walk(fh, os.path.getsize(fh.name))
    return duration, width, height


def discover(names=None):
    """Staged files, as (filename, kind, staged_path)."""
    found = []
    for kind, sub in KIND_DIRS.items():
        folder = os.path.join(STAGING_ROOT, sub)
        if not os.path.isdir(folder):
            continue
        for name in sorted(os.listdir(folder)):
            if name.startswith("."):
                continue
            if names and name not in names:
                continue
            found.append((name, kind, os.path.join(folder, name)))
    return found


def read_manifest():
    with open(MANIFEST, newline="", encoding="utf-8") as fh:
        reader = csv.reader(fh)
        rows = list(reader)
    return rows[0], rows[1:]


def write_manifest(header, rows):
    with open(MANIFEST, "w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh, lineterminator="\n")
        writer.writerow(header)
        writer.writerows(rows)


def measure(path, kind):
    stat = os.path.getsize(path)
    if kind == "img":
        w, h = png_dimensions(path)
        return {"bytes": stat, "width": w, "height": h, "seconds": "", "sha": sha256_16(path)}
    seconds, w, h = mp4_info(path)
    return {
        "bytes": stat,
        "width": w,
        "height": h,
        "seconds": "" if seconds is None else seconds,
        "sha": sha256_16(path),
    }


def stage(names=None, apply=False):
    staged = discover(names)
    if not staged:
        print("nothing staged in %s" % STAGING_ROOT)
        return 0

    header, rows = read_manifest()
    col = {name: i for i, name in enumerate(header)}
    by_file = {row[col["file"]]: row for row in rows if row}

    changed = 0
    for name, kind, src in staged:
        dest = os.path.join(ASSETS_ROOT, KIND_DIRS[kind], name)
        info = measure(src, kind)
        known = by_file.get(name)
        existing = os.path.getsize(dest) if os.path.exists(dest) else None

        action = "replace" if existing is not None else "add"
        print(
            "%-7s %-22s %8s -> %-8s  %sx%s%s"
            % (
                action,
                name,
                existing if existing is not None else "-",
                info["bytes"],
                info["width"],
                info["height"],
                "" if not info["seconds"] else "  %ss" % info["seconds"],
            )
        )
        if known is None:
            print("        (no MANIFEST row yet -- one will be added)")

        if not apply:
            continue

        if existing is not None:
            os.makedirs(RETIRED_ROOT, exist_ok=True)
            retired = os.path.join(RETIRED_ROOT, name)
            if not os.path.exists(retired):  # never clobber an earlier original
                shutil.move(dest, retired)
            else:
                os.remove(dest)
        shutil.copy2(src, dest)

        # Verify the copy landed intact before touching the manifest.
        copied = os.path.getsize(dest)
        if copied != info["bytes"]:
            raise SystemExit("VERIFY FAILED: %s is %s bytes, expected %s" % (dest, copied, info["bytes"]))

        row = known if known is not None else [""] * len(header)
        row[col["file"]] = name
        row[col["class"]] = kind
        row[col["path"]] = "/assets/%s/%s" % (KIND_DIRS[kind], name)
        row[col["seconds"]] = str(info["seconds"])
        row[col["width"]] = str(info["width"])
        row[col["height"]] = str(info["height"])
        row[col["bytes"]] = str(info["bytes"])
        row[col["sha256_16"]] = info["sha"]
        row[col["in_s1_scheme"]] = "True"
        row[col["qc"]] = "pending"
        row[col["note"]] = STAGE_NOTE
        if known is None:
            rows.append(row)
        changed += 1

    if apply and changed:
        write_manifest(header, rows)
        print("\nstaged %d file(s); MANIFEST.csv updated; originals in %s" % (changed, RETIRED_ROOT))
    elif not apply:
        print("\ndry run -- nothing written. Re-run with --apply.")
    return changed


def restore():
    if not os.path.isdir(RETIRED_ROOT):
        print("nothing retired")
        return 0
    n = 0
    for name in sorted(os.listdir(RETIRED_ROOT)):
        kind = "img" if name.lower().endswith(".png") else "vid"
        dest = os.path.join(ASSETS_ROOT, KIND_DIRS[kind], name)
        shutil.move(os.path.join(RETIRED_ROOT, name), dest)
        print("restored %s" % name)
        n += 1
    print("\n%d file(s) restored. MANIFEST.csv rows still describe the Blender "
          "versions -- re-check them." % n)
    return n


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("names", nargs="*", help="specific filenames to stage (default: everything staged)")
    ap.add_argument("--apply", action="store_true", help="actually copy (default is a dry run)")
    ap.add_argument("--restore", action="store_true", help="move retired originals back into assets/")
    args = ap.parse_args()
    if args.restore:
        return restore()
    return stage(args.names or None, apply=args.apply)


if __name__ == "__main__":
    sys.exit(0 if main() is not None else 1)
