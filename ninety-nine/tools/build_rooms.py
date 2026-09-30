"""Writes data/rooms.json: the walkable 3D room for each scene/render.

The rooms are generated, not hand-written, for the same reason the
Earth_Worldbuild museum generates museum-layout.json with build_layout.py:
a cubicle floor is 26 workstations of identical boxes and a garage is a
grid of pillars and bays, and a Python loop is the honest source for that.
The runtime (src/walk/room.js + props.js) only reads the JSON.

Coordinates: metres, origin on the floor at the room's centre, +x right,
+y up, +z toward the entrance (spawn side), -z toward the building's core.
Every room is closed on all sides (canon C3: no windows, no sky) unless
`open` names a side, and then something else closes it (the pool's fog,
the store's glass).

Sizes and dressing are read off blender/renders/*/final.png and Doc 1 §5.

Usage: python tools/build_rooms.py            (writes data/rooms.json)
"""

import json
import math
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "rooms.json")


def prop(type_, pos, rot=0, **kw):
    p = {"type": type_, "pos": [round(v, 3) for v in pos]}
    if rot:
        p["rot"] = rot
    p.update(kw)
    return p


def waiting_room(hostile):
    W, H, D = 14.0, 4.2, 12.0
    props = []
    # Reception counter on the core wall, receptionist behind it, head down.
    props.append(prop("counter", [0, 0, -D / 2 + 0.9], w=4.6, d=0.9))
    props.append(prop("figure", [0, 0.45, -D / 2 + 0.35], seated=True, suit="lp_red"))
    props.append(prop("dispenser", [-3.4, 0, -D / 2 + 1.0]))
    props.append(prop("clock", [-4.6, 2.9, -D / 2 + 0.02]))
    props.append(prop("placard", [4.4, 1.9, -D / 2 + 0.02]))
    props.append(prop("emblem", [0, 0.003, 0.6], r=1.5))
    rnd = random.Random(99)
    for side in (-1, 1):
        for i in range(4):
            x = side * 5.2
            z = -2.8 + i * 1.5
            rot = 90 if side < 0 else -90
            if hostile:
                x += rnd.uniform(-1.4, 1.4)
                z += rnd.uniform(-0.9, 0.9)
                rot += rnd.uniform(-70, 70)
            props.append(prop("chair", [x, 0, z], round(rot, 1)))
    if hostile:
        # The dispenser feeds continuously: slips piling on the floor, all 99.
        for i in range(36):
            r = rnd.uniform(0.2, 2.6)
            a = rnd.uniform(0, 6.28)
            props.append(prop("slip", [-3.4 + r * 0.9 * math.cos(a), 0.004 + i * 0.001, -D / 2 + 1.3 + r * 0.6 * abs(math.sin(a))], round(rnd.uniform(0, 360), 1)))
    lights = [
        {"type": "point", "pos": [-3.5, H - 0.3, -1.5], "color": "#ffe9c8", "intensity": 70 if hostile else 28, "distance": 16},
        {"type": "point", "pos": [3.5, H - 0.3, -1.5], "color": "#ffe9c8", "intensity": 70 if hostile else 28, "distance": 16},
        {"type": "point", "pos": [0, H - 0.3, 3.5], "color": "#ffe9c8", "intensity": 50 if hostile else 18, "distance": 16},
    ]
    return {
        "name": "THE WAITING ROOM",
        "size": [W, H, D],
        "floor": "marble", "wall": "plaster_blown" if hostile else "plaster", "ceiling": "plaster_blown" if hostile else "plaster_dark",
        "tile": {"floor": 2.5, "wall": 2.0, "ceiling": 2.0},
        "ambient": {"color": "#fff4e0", "intensity": 0.9 if hostile else 0.35},
        "sun": {"from": [1.5, 6.5, 7.5], "color": "#fff1dc", "intensity": 1.2 if hostile else 0.9},
        "lights": lights,
        "fog": {"color": "#f2ede2" if hostile else "#1a1714", "near": 6 if hostile else 10, "far": 30 if hostile else 36},
        "spawn": [0, 4.6, 0],
        "props": props,
        "footstep": {"filterHz": 1400, "gain": 0.09},
    }


def threshold_corridor():
    W, H, D = 4.2, 3.4, 14.0
    props = [
        prop("curtain", [0, 0, -5.9], w=3.8, h=3.1),
        prop("sign", [0, 3.05, -5.6], w=1.0, h=0.32),
        prop("badgereader", [W / 2 - 0.04, 1.25, -4.6], rot=-90),
        prop("clock", [-W / 2 + 0.03, 2.4, 2.0], rot=90),
        prop("slip", [0.9, 0.004, -3.2], rot=25),
    ]
    lights = [
        {"type": "point", "pos": [0, H - 0.3, 3.5], "color": "#ffdfb8", "intensity": 14, "distance": 12},
        {"type": "point", "pos": [0, H - 0.3, -1.0], "color": "#ffdfb8", "intensity": 14, "distance": 12},
        {"type": "point", "pos": [0, 2.9, -5.3], "color": "#33ff77", "intensity": 9, "distance": 6},
    ]
    return {
        "name": "THE THRESHOLD",
        "size": [W, H, D],
        "floor": "carpet_red", "wall": "plaster_dark", "ceiling": "plaster_dark",
        "tile": {"floor": 1.5, "wall": 2.0, "ceiling": 2.0},
        "ambient": {"color": "#ffe6d0", "intensity": 0.3},
        "sun": {"from": [0.5, 5.5, 8.0], "color": "#ffe0c0", "intensity": 0.8},
        "lights": lights,
        "fog": {"color": "#120f0e", "near": 4, "far": 22},
        "spawn": [0, 5.6, 0],
        "props": props,
        "footstep": {"filterHz": 500, "gain": 0.06},
    }


def lobby_doors():
    rec = waiting_room(False)
    rec["name"] = "THE LOBBY DOORS"
    W, H, D = rec["size"]
    rec["props"].append(prop("glassdoors", [0, 0, D / 2 - 0.1], rot=180, w=2.6, h=2.9))
    rec["props"].append(prop("placard", [2.2, 1.5, D / 2 - 0.02], rot=180))
    rec["props"].append(prop("slip", [0.6, 0.004, D / 2 - 1.2], rot=15))  # one 99, at the foot of the locked doors
    rec["spawn"] = [0, 1.5, 180]
    rec["ambient"]["intensity"] = 0.3
    rec["fog"] = {"color": "#0b0a09", "near": 8, "far": 30}
    rec["lights"].append({"type": "point", "pos": [0, 2.2, D / 2 + 1.5], "color": "#3a4652", "intensity": 4, "distance": 6})
    return rec


def cubicle_floor():
    W, H, D = 26.0, 3.0, 36.0
    props = []
    # Two banks either side of a 2.2 m aisle; rows every 2.4 m; each
    # workstation = back partition + side partition + desk + monitor + chair.
    z = -D / 2 + 2.0
    row = 0
    while z < D / 2 - 2.6:
        for side in (-1, 1):
            for k in (0, 1, 2, 3):
                bx = side * (2.1 + k * 4.6)
                if abs(bx) > W / 2 - 1.5:
                    continue
                props.append(prop("partition", [bx, 0, z], len=2.0))
                props.append(prop("partition", [bx + side * 1.0, 0, z + 1.0], rot=90, len=2.0))
                props.append(prop("desk", [bx, 0, z + 0.55], w=1.6, d=0.7, mat="lp_beige"))
                props.append(prop("monitor", [bx, 0.75, z + 0.5]))
                cx, cz, chair_rot = bx, z + 1.35, 0
                if row == 4 and side == -1 and k == 0:
                    cx, cz, chair_rot = bx + 0.9, z + 1.6, 40  # Harlowe's chair, pushed out (Track C motif 3)
                props.append(prop("chair", [cx, 0, cz], rot=180 + chair_rot))
        z += 2.4
        row += 1
    # Fluorescent grid.
    for fx in range(-12, 13, 4):
        for fz in range(-16, 17, 4):
            props.append(prop("fluoro", [fx, H - 0.06, fz], w=1.2, d=0.3))
    props.append(prop("figure", [0, 0, -9.0], face="blur", tie=True))
    props.append(prop("papers", [0.32, 0.86, -8.86], mat="plaster_blown"))
    props.append(prop("clock", [0, 2.4, -D / 2 + 0.02]))
    props.append(prop("slip", [1.1, 0.004, -3.8], rot=12))
    lights = [{"type": "point", "pos": [x, H - 0.4, zz], "color": "#eef2ff", "intensity": 26, "distance": 14}
              for x in (-8, 0, 8) for zz in (-12, -4, 4, 12)]
    return {
        "name": "THE FLOOR",
        "size": [W, H, D],
        "floor": "carpet", "wall": "plaster", "ceiling": "ceiling_tile",
        "tile": {"floor": 1.5, "wall": 2.0, "ceiling": 1.2},
        "ambient": {"color": "#e8ecff", "intensity": 0.45},
        "sun": {"from": [2.0, 5.0, 22.0], "color": "#f4f6ff", "intensity": 0.8},
        "lights": lights,
        "fog": {"color": "#c9ccc6", "near": 10, "far": 40},
        "spawn": [0, 15.5, 0],
        "props": props,
        "footstep": {"filterHz": 380, "gain": 0.05},
    }


def utility_corridor():
    W, H, D = 3.2, 3.0, 36.0
    props = []
    z = -D / 2 + 3.0
    i = 0
    while z < D / 2 - 2.0:
        props.append(prop("door", [-W / 2 + 0.06, 0, z], rot=90))
        props.append(prop("door", [W / 2 - 0.06, 0, z + 2.2], rot=-90))
        if i % 2 == 0:
            props.append(prop("mopsink", [W / 2 - 0.45, 0, z - 1.6]))
        if i % 3 == 1:
            props.append(prop("drain", [0, 0.002, z + 1.0]))
        props.append(prop("fluoro", [0, H - 0.06, z], w=1.2, d=0.25))
        z += 4.5
        i += 1
    props.append(prop("figure", [0, 0, -D / 2 + 1.2], rot=180, face="blur", tie=True))  # facing away, never closer
    props.append(prop("door", [-W / 2 + 0.06, 0, -D / 2 + 6.0], rot=110))  # one door ajar (Harlowe)
    props.append(prop("slip", [-0.7, 0.004, 4.0], rot=-30))
    props.append(prop("clock", [W / 2 - 0.03, 2.3, 8.2], rot=-90))  # C8: the same clock, between two doors
    lights = [{"type": "point", "pos": [0, H - 0.3, zz], "color": "#dfe6dc", "intensity": 9, "distance": 9} for zz in range(-15, 16, 5)]
    return {
        "name": "THE FLOOR",
        "size": [W, H, D],
        "floor": "concrete_wet", "wall": "cinderblock", "ceiling": "concrete",
        "tile": {"floor": 2.0, "wall": 1.6, "ceiling": 2.0},
        "ambient": {"color": "#dfe6dc", "intensity": 0.2},
        "sun": {"from": [0.6, 4.5, 20.0], "color": "#dfe6dc", "intensity": 0.7},
        "lights": lights,
        "fog": {"color": "#101211", "near": 6, "far": 30},
        "spawn": [0, 15.5, 0],
        "props": props,
        "footstep": {"filterHz": 900, "gain": 0.1},
    }


def desk_void(monitor_on):
    W, H, D = 40.0, 8.0, 40.0
    props = [
        prop("desk", [0, 0, 0], w=1.7, d=0.85),
        prop("monitor", [0.35, 0.75, -0.15], on=monitor_on),
        prop("chair", [0, 0, 0.85], rot=180),
        prop("stapler", [-0.45, 0.75, 0.05], rot=20),
        prop("papers", [-0.15, 0.75, 0.1], h=0.06),
        prop("clock", [2.6, 2.1, -2.4], rot=35),   # floating at the light pool's edge
        prop("slip", [0.55, 0.004, 1.4], rot=70),
    ]
    lights = [
        {"type": "spot", "pos": [0, 5.5, 0.3], "target": [0, 0, 0], "color": "#ffe7c4", "intensity": 90, "distance": 14, "angle": 32, "penumbra": 0.7},
    ]
    if monitor_on:
        lights.append({"type": "point", "pos": [0.35, 1.2, 0.2], "color": "#7ad9a0", "intensity": 4, "distance": 4})
    return {
        "name": "THE REQUISITION" if monitor_on else "THE DESK",
        "size": [W, H, D],
        "floor": "concrete", "wall": "void", "ceiling": "void",
        "tile": {"floor": 3.0, "wall": 8.0, "ceiling": 8.0},
        "ambient": {"color": "#ffffff", "intensity": 0.06},
        "sun": {"from": [1.0, 6.0, 6.0], "color": "#ffe7c4", "intensity": 0.5},
        "lights": lights,
        "fog": {"color": "#000000", "near": 3, "far": 16},
        "spawn": [0, 3.2, 0],
        "props": props,
        "footstep": {"filterHz": 600, "gain": 0.07},
    }


def garage(depth=44.0, open_north=False):
    W, H, D = 32.0, 3.2, depth
    props = []
    lights = []
    for x in range(-12, 13, 8):
        for z in range(int(-D / 2) + 4, int(D / 2), 8):
            props.append(prop("pillar", [x, 0, z], w=0.7, h=H))
    for x in (-8, 8):
        for z in range(int(-D / 2) + 6, int(D / 2), 12):
            props.append(prop("sodium", [x, H - 0.12, z]))
            lights.append({"type": "point", "pos": [x, H - 0.4, z], "color": "#ffa040", "intensity": 30, "distance": 18})
    cars = [("lp_car", [-5.0, 0, 6.0], 0, True), ("lp_car2", [5.5, 0, -2.0], 8, False), ("lp_car3", [-6.0, 0, -9.0], -6, False), ("lp_car4", [9.0, 0, 10.0], 3, False)]
    for mat, pos, rot, hero in cars:
        if pos[2] < -D / 2 + 3:
            pos[2] = -D / 2 + 4
        if pos[2] > D / 2 - 3:
            pos[2] = D / 2 - 4
        props.append(prop("car", pos, rot=rot, mat=mat, hero=hero))
    props.append(prop("slip", [1.4, 0.004, 3.0], rot=100))
    props.append(prop("clock", [-W / 2 + 0.03, 2.4, D / 2 - 6.0], rot=90))  # C8: the same clock, on the west wall
    rec = {
        "name": "THE GARAGE",
        "size": [W, H, D],
        "floor": "garage_floor", "wall": "concrete", "ceiling": "concrete",
        "tile": {"floor": 3.0, "wall": 2.5, "ceiling": 2.5},
        "ambient": {"color": "#ffb060", "intensity": 0.18},
        "sun": {"from": [3.0, 5.0, D * 0.55], "color": "#ffb86a", "intensity": 0.6},
        "lights": lights,
        "fog": {"color": "#120c06", "near": 8, "far": 42},
        "spawn": [0, D / 2 - 3.0, 0],
        "props": props,
        "boxes": [],
        "footstep": {"filterHz": 800, "gain": 0.1},
    }
    if open_north:
        # The run that does not end, ended: the concrete stops one metre
        # ahead and below is the pool room -- water to the horizon, tiled
        # pillars, no ceiling, no far wall (Doc 1 §5 S6-H/S7-H).
        rec["name"] = "THE EDGE"
        rec["open"] = ["N"]
        edge = -D / 2
        rec["boxes"] = [
            {"min": [-60, -4.2, edge - 80], "max": [60, -3.9, edge + 0.0], "mat": "water", "collide": False, "shadow": False, "tile": 4.0},
            {"min": [-W / 2 - 0.3, -0.25, edge - 0.02], "max": [W / 2 + 0.3, 0, edge + 0.5], "mat": "concrete", "collide": False, "tile": 2.0},
            # invisible lip so the player can lean, not fall
            {"min": [-W / 2, 0, edge - 0.4], "max": [W / 2, 1.2, edge - 0.2], "mat": "void", "collide": True, "invisible": True, "shadow": False},
        ]
        for x in range(-24, 25, 8):
            for z in range(-6, -60, -10):
                rec["boxes"].append({"min": [x - 0.6, -4.5, edge + z - 0.6], "max": [x + 0.6, 9.0, edge + z + 0.6], "mat": "pool_tile", "collide": False, "tile": 1.0})
        rec["fog"] = {"color": "#0c2a30", "near": 6, "far": 60}
        rec["lights"].append({"type": "point", "pos": [0, 1.5, edge - 10], "color": "#3ac0d8", "intensity": 40, "distance": 40})
        rec["ambient"] = {"color": "#5fb0c0", "intensity": 0.22}
        rec["spawn"] = [0, edge + 7.0, 0]
    return rec


def freight_elevator():
    W, H, D = 3.0, 2.6, 3.4
    return {
        "name": "THE DESCENT",
        "size": [W, H, D],
        "floor": "grate", "wall": "rust", "ceiling": "grate",
        "tile": {"floor": 1.0, "wall": 1.5, "ceiling": 1.0},
        "ambient": {"color": "#ffd9a8", "intensity": 0.25},
        "sun": {"from": [0.4, 3.0, 2.5], "color": "#ffd9a8", "intensity": 0.7},
        "lights": [{"type": "point", "pos": [0, H - 0.25, 0.2], "color": "#ffcf9a", "intensity": 6, "distance": 6}],
        "fog": {"color": "#0a0705", "near": 2, "far": 9},
        "spawn": [0, 1.0, 0],
        "props": [
            prop("panel", [W / 2 - 0.05, 0.7, 0.5], rot=-90),
            prop("clock", [0, 1.9, -D / 2 + 0.03]),
            prop("slip", [-0.6, 0.004, -0.9], rot=200),
        ],
        "footstep": {"filterHz": 1800, "gain": 0.12},
    }


def mailroom():
    W, H, D = 40.0, 10.0, 50.0
    props = []
    rnd = random.Random(8)
    for x in range(-16, 17, 4):
        for z in range(-20, 21, 4):
            if abs(x) < 5 and z > -12:
                continue  # keep the whole approach lane, spawn to counter, clear
            props.append(prop("boxtower", [x + rnd.uniform(-0.6, 0.6), 0, z + rnd.uniform(-0.6, 0.6)], rot=rnd.randint(0, 90), n=rnd.randint(4, 12)))
    props.append(prop("counter", [0, 0, -9.0], w=6.0, d=1.0, glass=False, mat="lp_dark"))
    props.append(prop("figure", [0.0, 0, -9.9], face="blur", suit="lp_blue"))
    props.append(prop("package", [0.4, 1.16, -8.9], rot=15))
    props.append(prop("clock", [3.6, 4.2, -14.0], rot=20))
    props.append(prop("slip", [-1.2, 0.004, -6.0], rot=45))
    for fx in (-12, 0, 12):
        for fz in (-14, 0, 14):
            props.append(prop("fluoro", [fx, 7.5, fz], w=2.4, d=0.4))
    lights = [{"type": "point", "pos": [fx, 7.0, fz], "color": "#e6ecff", "intensity": 50, "distance": 22} for fx in (-12, 0, 12) for fz in (-14, 0, 14)]
    return {
        "name": "THE DELIVERY",
        "size": [W, H, D],
        "floor": "concrete", "wall": "plaster_dark", "ceiling": "void",
        "noCeiling": True,
        "tile": {"floor": 3.0, "wall": 3.0},
        "ambient": {"color": "#dfe6f0", "intensity": 0.2},
        "sun": {"from": [4.0, 9.0, 26.0], "color": "#e6ecff", "intensity": 0.7},
        "lights": lights,
        "fog": {"color": "#8e9299", "near": 4, "far": 34},
        "spawn": [0, 16.0, 0],
        "props": props,
        "footstep": {"filterHz": 700, "gain": 0.09},
    }


def convenience_store():
    W, H, D = 12.0, 3.2, 16.0
    props = []
    for x in (-3.2, 0.0, 3.2):
        for z in (-2.5, 1.5):
            props.append(prop("shelf", [x, 0, z], w=2.4, d=0.7, tiers=4, h=1.8))
    props.append(prop("cooler", [0, 0, -D / 2 + 0.42], w=8.0))
    props.append(prop("counter", [-4.2, 0, 5.2], w=2.6, d=0.9, glass=False, mat="lp_grey"))
    props.append(prop("monitor", [-4.6, 1.16, 5.2], on=False))
    props.append(prop("clock", [W / 2 - 0.03, 2.4, 0.0], rot=-90))
    props.append(prop("slip", [1.6, 0.004, 4.0], rot=140))
    for fx in (-3, 3):
        for fz in (-5, -1, 3, 7):
            props.append(prop("fluoro", [fx, H - 0.06, fz], w=1.2, d=0.3))
    lights = [{"type": "point", "pos": [fx, H - 0.4, fz], "color": "#f0f4ff", "intensity": 18, "distance": 10} for fx in (-3, 3) for fz in (-5, -1, 3, 7)]
    return {
        "name": "THE STORE",
        "size": [W, H, D],
        "floor": "linoleum", "wall": "plaster", "ceiling": "ceiling_tile",
        "tile": {"floor": 1.0, "wall": 2.0, "ceiling": 1.2},
        "open": ["S"],
        "boxes": [
            # Storefront glass: the street outside is photoreal and empty and he cannot render out there -- it stays black.
            {"min": [-W / 2 - 0.3, 0, D / 2], "max": [W / 2 + 0.3, H, D / 2 + 0.06], "mat": "glass_dark", "collide": True, "shadow": False, "tile": 3.0},
            {"min": [-W / 2 - 0.3, H - 0.3, D / 2], "max": [W / 2 + 0.3, H + 0.2, D / 2 + 0.3], "mat": "plaster", "collide": False},
            {"min": [-0.06, 0, D / 2 - 0.02], "max": [0.06, H, D / 2 + 0.1], "mat": "concrete", "collide": False, "tile": 1.0},
        ],
        "ambient": {"color": "#f0f4ff", "intensity": 0.5},
        "sun": {"from": [1.0, 5.0, 12.0], "color": "#f4f6ff", "intensity": 0.8},
        "lights": lights,
        "fog": {"color": "#05070a", "near": 14, "far": 30},
        "background": "#000000",
        "spawn": [0, 6.0, 0],
        "props": props,
        "footstep": {"filterHz": 1100, "gain": 0.08},
    }


def build():
    edge_room = garage(depth=24.0, open_north=True)
    rooms = {
        "S1_C": waiting_room(False),
        "S1_H": waiting_room(True),
        "S2_C": {"alias": "S1_C", "_note": "The call comes in the same room."},
        "S2_H": {"alias": "S1_H", "_note": "The call comes in the same room."},
        "S3_C": threshold_corridor(),
        "S3_H": lobby_doors(),
        "S4_C": cubicle_floor(),
        "S4_H": utility_corridor(),
        "S5_C": desk_void(False),
        "S5_H": garage(),
        "S6_C": desk_void(True),
        "S6_H": edge_room,
        "S7_C": freight_elevator(),
        "S7_H": {"alias": "S6_H", "spawn": [0, -9.0, 0], "_note": "The same edge, one step closer."},
        "S8_C": mailroom(),
        "S8_H": convenience_store(),
    }
    for k, r in rooms.items():
        r["id"] = k
        if "alias" in r:
            continue
        clocks = sum(1 for p in r["props"] if p["type"] == "clock")
        assert clocks == 1, "%s: %d clocks (C8: exactly one handless clock per room)" % (k, clocks)
        slips = sum(1 for p in r["props"] if p["type"] == "slip")
        assert k.startswith("S1_") or slips == 1, "%s: %d slips (Track C motif 2: one 99 per room after S1)" % (k, slips)
    doc = {
        "_comment": "Generated by tools/build_rooms.py -- edit that, not this. One walkable room per scene+render (S{n}_{C|H}); `alias` reuses another record (own keys override). Read by src/walk/room.js; router.js offers WALK THE ROOM wherever a key exists.",
        "rooms": rooms,
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=1)
        fh.write("\n")
    n = sum(1 for r in rooms.values() if "alias" not in r)
    print("wrote %s: %d rooms (%d built, %d aliases), %d props" % (
        os.path.relpath(OUT), len(rooms), n, len(rooms) - n, sum(len(r.get("props", [])) for r in rooms.values())))


if __name__ == "__main__":
    build()
