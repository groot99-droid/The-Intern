"""Move an MP4's `moov` atom ahead of `mdat` (qt-faststart), in place.

A browser cannot start a clip until it has read `moov` (the index). Ten of
the delivered transition clips were written with `moov` at the END of the
file, so a <video> element has to open the file, find no index, abort that
request and issue a second, ranged request for the tail before a single
frame can decode. Against a host that is slow, mid-revalidation (the
preloader has just fetched the same URL), or without Range support, that
second request is where the clip dies -- a black frame where the room
should be, which reads as a failed connection right after a choice.

This rewrites the container only: `ftyp, moov, free, mdat`, with every
chunk offset (stco/co64) shifted by the bytes now in front of `mdat`. The
encoded frames are byte-identical, so nothing under Doc 2's QC changes.
MANIFEST.csv rows are re-measured with stage_assets.measure().

Usage (from ninety-nine/):
    python tools/faststart.py                 # report which clips need it
    python tools/faststart.py --apply         # rewrite them + MANIFEST rows
    python tools/faststart.py --apply S5_H_TRN_S6.mp4
"""

import argparse
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from stage_assets import measure, read_manifest, write_manifest  # noqa: E402

VID_DIR = os.path.join(HERE, "..", "assets", "vid")
CONTAINERS = {b"moov", b"trak", b"mdia", b"minf", b"stbl"}


def top_level_atoms(data):
    atoms = []
    pos = 0
    while pos + 8 <= len(data):
        size, kind = struct.unpack(">I4s", data[pos:pos + 8])
        header = 8
        if size == 1:
            size = struct.unpack(">Q", data[pos + 8:pos + 16])[0]
            header = 16
        elif size == 0:
            size = len(data) - pos
        atoms.append((kind, pos, size, header))
        pos += size
    return atoms


def needs_faststart(data):
    kinds = [a[0] for a in top_level_atoms(data)]
    return b"moov" in kinds and b"mdat" in kinds and kinds.index(b"moov") > kinds.index(b"mdat")


def shift_offsets(moov, delta):
    """Return a copy of the moov atom bytes with every stco/co64 entry += delta."""
    buf = bytearray(moov)

    def walk(start, end):
        pos = start
        while pos + 8 <= end:
            size, kind = struct.unpack(">I4s", buf[pos:pos + 8])
            header = 8
            if size == 1:
                size = struct.unpack(">Q", buf[pos + 8:pos + 16])[0]
                header = 16
            elif size == 0:
                size = end - pos
            if size < 8:
                return
            if kind in CONTAINERS:
                walk(pos + header, pos + size)
            elif kind in (b"stco", b"co64"):
                count = struct.unpack(">I", buf[pos + header + 4:pos + header + 8])[0]
                base = pos + header + 8
                if kind == b"stco":
                    for i in range(count):
                        o = base + i * 4
                        struct.pack_into(">I", buf, o, struct.unpack(">I", buf[o:o + 4])[0] + delta)
                else:
                    for i in range(count):
                        o = base + i * 8
                        struct.pack_into(">Q", buf, o, struct.unpack(">Q", buf[o:o + 8])[0] + delta)
            pos += size

    walk(0, len(buf))
    return bytes(buf)


def faststart_bytes(data):
    atoms = top_level_atoms(data)
    by_kind = {}
    for kind, pos, size, header in atoms:
        by_kind.setdefault(kind, []).append((pos, size, header))
    if b"moov" not in by_kind or b"mdat" not in by_kind:
        raise ValueError("not an MP4 with moov+mdat")
    mpos, msize, _ = by_kind[b"moov"][0]
    moov = data[mpos:mpos + msize]
    # Everything that is not moov keeps its relative order; moov goes right
    # after ftyp. mdat (and anything else after moov's new slot) shifts by
    # moov's size.
    head = [a for a in atoms if a[0] == b"ftyp"]
    rest = [a for a in atoms if a[0] not in (b"ftyp", b"moov")]
    delta = msize
    out = bytearray()
    for kind, pos, size, _ in head:
        out += data[pos:pos + size]
    out += shift_offsets(moov, delta)
    for kind, pos, size, _ in rest:
        out += data[pos:pos + size]
    return bytes(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("names", nargs="*")
    args = ap.parse_args()
    names = args.names or sorted(n for n in os.listdir(VID_DIR) if n.endswith(".mp4"))
    header, rows = read_manifest()
    col = {name: i for i, name in enumerate(header)}
    changed = []
    for name in names:
        path = os.path.join(VID_DIR, name)
        with open(path, "rb") as fh:
            data = fh.read()
        if not needs_faststart(data):
            continue
        print(("rewriting " if args.apply else "needs faststart: ") + name)
        if not args.apply:
            continue
        out = faststart_bytes(data)
        assert len(out) == len(data), "container rewrite changed the byte count"
        assert not needs_faststart(out)
        with open(path, "wb") as fh:
            fh.write(out)
        m = measure(path, "vid")
        for row in rows:
            if row[col["file"]] == name:
                row[col["bytes"]] = str(m["bytes"])
                row[col["sha256_16"]] = m["sha"]
                note = row[col["note"]]
                row[col["note"]] = (note + "; " if note else "") + "remuxed faststart (moov before mdat), frames byte-identical"
        changed.append(name)
    if args.apply and changed:
        write_manifest(header, rows)
        print("MANIFEST.csv: %d rows re-measured" % len(changed))


if __name__ == "__main__":
    main()
