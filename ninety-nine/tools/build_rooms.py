"""Writes data/rooms.json: every 3D set the game plays in, with its camera shots.

The game no longer plays video. Each scene is a live three.js room (src/
stage/) and what used to be a clip is now a SHOT: a camera move through
the room, defined here as data. The rooms are generated, not hand-written,
for the same reason the Earth_Worldbuild museum generates museum-layout.json
with build_layout.py: a cubicle floor is 100 workstations of identical boxes
and a garage is a grid of pillars and bays, and a Python loop is the honest
source for that. The runtime (src/stage/stage.js, src/walk/room.js,
src/walk/props.js) only reads the JSON.

Coordinates: metres, origin on the floor at the room's centre, +x right,
+y up, +z toward the entrance (spawn side), -z toward the building's core.
Every room is closed on all sides (canon C3: no windows, no sky) unless
`open` names a side, and then something else closes it (the pool's fog,
the store's glass). The street (SET_STREET) is the one exception: it is
before the lobby doors, where C3 does not yet apply.

Shots (`shots`): named camera poses (`pos`, `look`, optional `fov`) and
named moves between them. Every room gets a default set from shots_for():
  in      the pose the room is entered on (what IMG_IN used to be)
  out     the pose it is left from (IMG_OUT)
  loop    the scene's idle move, in -> out and back, while the player is here
  leave   out -> into the core, fading to black: the first half of a transition
  arrive  from behind `in` -> `in`, fading up from black: the second half
A transition between two rooms is `leave` of the one being left and
`arrive` of the one being entered, so a render flip (C -> H) is just a
different `arrive`, never a walk into the wrong room. Rooms override or add
shots (the street's push, the dive's descent, the endings' pull-backs).

Props: `type` names a builder in src/walk/props.js. `glb` props come from
the open-source catalog models imported through the Higgsfield 3D scene
builder (tools/higgsfield_scene.py builds the same rooms there), exported
once into assets/glb/library.glb; `node` names the model inside it and
`fallback` names the box builder used when the library is missing.

Usage: python tools/build_rooms.py            (writes data/rooms.json)
"""

import json
import math
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "rooms.json")

EYE = 1.6

# Open-source catalog models (Higgsfield 3D scene builder's shared GLB
# catalog). node = the object name inside assets/glb/library.glb and in
# every scene project; assetId/search = how tools/higgsfield_scene.py
# imports it. yaw = degrees to add so the model faces -z at rot 0.
CATALOG = {
    "lib_chair":         {"name": "Accent Chair",        "assetId": "0e3741a1-e377-4466-9c01-15fe61bc4ac0", "search": "chair"},
    "lib_chair_wood":    {"name": "Int Wooden Chair 01", "assetId": "13af8a58-41b8-4cad-82a1-1e9691d4ec6c", "search": "chair"},
    "lib_reception":     {"name": "Lobby Reception Desk","assetId": "0e7504d3-52b8-4903-bcbf-1f00ecbaf789", "search": "desk"},
    "lib_desk":          {"name": "Field Desk",          "assetId": "3dc14968-83f3-4ea5-bc50-b7c1b725dbb2", "search": "desk"},
    "lib_guarddesk":     {"name": "Guard Desk",          "assetId": "882434bd-2abc-40df-bdbb-316997ebb30c", "search": "desk"},
    "lib_crt":           {"name": "Crt Terminal",        "assetId": "43c600c5-47bc-4875-b2c7-f68dc3bfd64a", "search": "bunker"},
    "lib_car_sedan":     {"name": "Car Sedan 01",        "assetId": "646ee81d-d37f-4137-9484-71a72125715e", "search": "car"},
    "lib_car_suv":       {"name": "SUV Black Car 01",    "assetId": "f24d9a4b-80a6-4120-a5c9-72242963b795", "search": "car"},
    "lib_car_pastel":    {"name": "Pastel Sedan",        "assetId": "0b4cf721-644a-4eed-8ae2-2e6742c1b695", "search": "vice beach"},
    "lib_car_cruiser":   {"name": "Convertible Cruiser", "assetId": "093adb9a-2fe7-476d-ae8e-b79c6fa681ad", "search": "vice beach"},
    "lib_car_sedan2":    {"name": "Sedan 01",            "assetId": "a5d0fde4-3d2b-4180-91fe-cba5366aa1a9", "search": "metropolis"},
    "lib_car_taxi":      {"name": "Taxi 01",             "assetId": "79dcdacb-d86c-4ff1-9613-9fa977773681", "search": "city"},
    "lib_cagelamp":      {"name": "Cage Lamp",           "assetId": "87f1bc50-01eb-468e-b917-314ee9325944", "search": "lamp"},
    "lib_shelf":         {"name": "Shelf Rack",          "assetId": "39538b6d-44cc-4867-b1b7-79b72d89dd50", "search": "shelf"},
    "lib_crate":         {"name": "Supply Crate",        "assetId": "cb2921e5-a06c-4205-933c-74055f7163a4", "search": "crate"},
    "lib_pallets":       {"name": "Pallet Stack",        "assetId": "074862ba-4a74-479a-9d7c-c4aa7b7e4189", "search": "bunker"},
    "lib_locker":        {"name": "Steel Locker",        "assetId": "aafb2c33-2620-49de-8332-6620665c94c7", "search": "bunker"},
    "lib_basin":         {"name": "Wash Basin",          "assetId": "a5d3e07c-95ad-4a3f-885e-9ec534fafbe9", "search": "bunker"},
    "lib_conduit":       {"name": "Conduit Run",         "assetId": "a95b1588-0540-4c46-bea9-7785361eb715", "search": "bunker"},
    "lib_breaker":       {"name": "Breaker Panel",       "assetId": "721d0886-a431-414c-8f1c-40207d941113", "search": "bunker"},
    "lib_tower":         {"name": "Office Tower 01",     "assetId": "b43ead4a-aeaa-40f7-abf5-fd55b8db8252", "search": "office"},
    "lib_brownstone":    {"name": "Brownstone 01",       "assetId": "bf75bc51-a740-4d64-8cda-61d0bb18098c", "search": "city"},
    "lib_aptblock":      {"name": "Apartment Block 01",  "assetId": "2ae77922-2fc4-45fd-8a1e-4c4fb1ef8d76", "search": "city"},
    "lib_streetlamp":    {"name": "Street Lamp 01",      "assetId": "e8547228-0b2d-47ac-9439-0ff36c12735f", "search": "lamp"},
    "lib_trafficlight":  {"name": "Traffic Light 01",    "assetId": "7f46e4c5-4c6b-4398-ba3f-f01de52626c5", "search": "street"},
    "lib_hydrant":       {"name": "Fire Hydrant 01",     "assetId": "a74434c2-f9a7-4f39-b297-8761ff0168ff", "search": "street"},
    "lib_trashbin":      {"name": "Trash Bin 01",        "assetId": "8716aef9-551e-4918-8974-a42abdc1212f", "search": "street"},
    "lib_payphone":      {"name": "Payphone Booth",      "assetId": "35dcecee-1c02-4b45-b7da-26a2fc85e08a", "search": "vice beach"},
    "lib_tablelamp":     {"name": "Table Lamp",          "assetId": "de05eac5-0895-4651-9561-708683a25d42", "search": "lamp"},
    "lib_books":         {"name": "Books Stack",         "assetId": "12947200-e71c-4f6e-817a-61b041548375", "search": "living room"},
    "lib_table":         {"name": "Mess Table",          "assetId": "1f87a829-632d-456c-a6fa-00c8ce925b42", "search": "table"},
    "lib_mailsacks":     {"name": "Mail Sack Pile",      "assetId": "0037d5f7-fb14-47ab-9aee-ba37bc0e0cc7", "search": "railway"},
    "lib_camera":        {"name": "Security Camera",     "assetId": "f337f1c0-070a-4801-ae1f-0ddf90bd9c73", "search": "bunker"},
    "lib_striplight":    {"name": "Ceiling Striplight",  "assetId": "6181dd4c-3d1a-48d7-8814-cdc953b53292", "search": "bunker"},
    "lib_switchboard":   {"name": "Switchboard",         "assetId": "9ee9508c-3fb6-4820-8379-6ad605f1e3a9", "search": "bunker"},
    "lib_lift":          {"name": "Lift Cage",           "assetId": "47f2ee3a-e99f-4adc-934c-42b24d514d69", "search": "bunker"},
}


def prop(type_, pos, rot=0, **kw):
    p = {"type": type_, "pos": [round(v, 3) for v in pos]}
    if rot:
        p["rot"] = rot
    p.update(kw)
    return p


def glb(node, pos, rot=0, fallback=None, **kw):
    """A catalog model (CATALOG[node]) with a box-builder fallback."""
    assert node in CATALOG, node
    p = prop("glb", pos, rot, node=node, **kw)
    if fallback:
        p["fallback"] = fallback
    return p


def r3(v):
    return [round(x, 3) for x in v]


def pose(pos, look, fov=None):
    p = {"pos": r3(pos), "look": r3(look)}
    if fov:
        p["fov"] = fov
    return p


def shots_for(rec, eye=EYE, out_dist=2.5, leave_dist=None, arrive_dist=1.8, loop_seconds=12.0):
    """Default shots from the spawn and the core (see module docstring)."""
    W, H, D = rec["size"]
    sp = list(rec.get("spawn") or [0, D / 2 - 1.5, 0])
    sx, sz = sp[0], sp[1]
    yaw = sp[2] if len(sp) > 2 else 0
    # controls.js: yaw 0 looks toward -z (the core), 180 toward +z.
    ux, uz = -math.sin(math.radians(yaw)), -math.cos(math.radians(yaw))
    # how far the room extends in the look direction
    reach = (D / 2 + sz if uz < 0 else D / 2 - sz) if abs(uz) > abs(ux) else (W / 2 + sx if ux < 0 else W / 2 - sx)
    reach = max(2.0, reach)
    out_d = min(out_dist, reach * 0.4)
    lv = leave_dist if leave_dist is not None else max(out_d + 1.0, reach - 1.2)
    def at(d, h=eye):
        return [sx + ux * d, h, sz + uz * d]
    def look_from(d, h=eye):
        return [sx + ux * (d + 6), h - 0.25, sz + uz * (d + 6)]
    return {
        "in": pose(at(0), look_from(0)),
        "out": pose(at(out_d), look_from(out_d)),
        "loop": {"from": "in", "to": "out", "seconds": loop_seconds, "pingpong": True, "ease": "inout", "sway": 0.035},
        "leave": {"from": "out", "to": pose(at(lv), look_from(lv)), "seconds": 3.0, "ease": "in", "fadeOut": 1.1},
        "arrive": {"from": pose(at(-arrive_dist), look_from(-arrive_dist)), "to": "in", "seconds": 3.0, "ease": "out", "fadeIn": 1.0},
    }


def waiting_room(hostile):
    W, H, D = 14.0, 4.2, 12.0
    props = []
    # Reception counter on the core wall, receptionist behind it, head down.
    props.append(prop("counter", [0, 0, -D / 2 + 0.9], w=4.6, d=0.9))
    props.append(prop("figure", [0, 0, -D / 2 + 0.35], seated=True, suit="lp_red", name="receptionist"))
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
            # The waiting chairs: the catalog's accent chair, low-poly (C1).
            props.append(glb("lib_chair", [x, 0, z], round(rot, 1), fallback="chair", collide=True))
    if hostile:
        # The dispenser feeds continuously: slips piling on the floor, all 99.
        for i in range(36):
            r = rnd.uniform(0.2, 2.6)
            a = rnd.uniform(0, 6.28)
            props.append(prop("slip", [-3.4 + r * 0.9 * math.cos(a), 0.004 + i * 0.001, -D / 2 + 1.3 + r * 0.6 * abs(math.sin(a))], round(rnd.uniform(0, 360), 1)))
    lights = [
        {"type": "point", "pos": [-3.5, H - 0.3, -1.5], "color": "#ffe9c8", "intensity": 42 if hostile else 22, "distance": 16, "flicker": 0.25 if hostile else 0},
        {"type": "point", "pos": [3.5, H - 0.3, -1.5], "color": "#ffe9c8", "intensity": 42 if hostile else 22, "distance": 16, "flicker": 0.25 if hostile else 0},
        {"type": "point", "pos": [0, H - 0.3, 3.5], "color": "#ffe9c8", "intensity": 34 if hostile else 16, "distance": 16},
    ]
    # Ceiling fixtures to go with the light (the building's, C1).
    for lx, lz in ((-3.5, -1.5), (3.5, -1.5), (0, 3.5)):
        props.append(prop("fluoro", [lx, H - 0.06, lz], w=1.4, d=0.4))
    rec = {
        "name": "THE WAITING ROOM",
        "size": [W, H, D],
        "floor": "marble", "wall": "plaster_blown" if hostile else "plaster", "ceiling": "plaster_blown" if hostile else "plaster_dark",
        "tile": {"floor": 2.5, "wall": 2.0, "ceiling": 2.0},
        "skirt": {"mat": "marble", "h": 0.14, "t": 0.03, "tile": 2.5},
        "cornice": {"mat": "plaster_blown" if hostile else "plaster_dark", "h": 0.28, "t": 0.08},
        "ambient": {"color": "#fff4e0", "intensity": 0.55 if hostile else 0.22},
        "sun": {"from": [1.5, 6.5, 7.5], "color": "#fff1dc", "intensity": 0.9 if hostile else 0.7},
        "lights": lights,
        "fog": {"color": "#e9e3d6" if hostile else "#1a1714", "near": 8 if hostile else 10, "far": 34 if hostile else 36},
        "exposure": 1.05 if hostile else 1.0,
        "vignette": 0.35 if hostile else 0.6,
        "spawn": [0, 4.6, 0],
        "props": props,
        "footstep": {"filterHz": 1400, "gain": 0.09},
    }
    rec["shots"] = shots_for(rec, loop_seconds=14.0)
    # S2 THE CALL plays in this room: a slow push toward the receptionist as
    # the speaker clicks (S2_*_VID was 3 s of exactly this).
    rec["shots"]["call"] = {"from": "out", "to": pose([0, EYE, -D / 2 + 3.2], [0, 1.1, -D / 2 + 0.35]), "seconds": 4.0, "ease": "inout"}
    return rec


def threshold_corridor():
    W, H, D = 4.2, 3.4, 14.0
    props = [
        prop("curtain", [0, 0, -5.9], w=3.8, h=3.1),
        prop("sign", [0, 3.05, -5.6], w=1.0, h=0.32),
        prop("badgereader", [W / 2 - 0.04, 1.25, -4.6], rot=-90),
        prop("clock", [-W / 2 + 0.03, 2.4, 2.0], rot=90),
        prop("slip", [0.9, 0.004, -3.2], rot=25),
        glb("lib_camera", [W / 2 - 0.2, 2.9, -3.0], rot=-135, fallback=None),
    ]
    lights = [
        {"type": "point", "pos": [0, H - 0.3, 3.5], "color": "#ffdfb8", "intensity": 14, "distance": 12},
        {"type": "point", "pos": [0, H - 0.3, -1.0], "color": "#ffdfb8", "intensity": 14, "distance": 12},
        {"type": "point", "pos": [0, 2.9, -5.3], "color": "#33ff77", "intensity": 9, "distance": 6, "flicker": 0.5},
    ]
    rec = {
        "name": "THE THRESHOLD",
        "size": [W, H, D],
        "floor": "carpet_red", "wall": "plaster_dark", "ceiling": "plaster_dark",
        "tile": {"floor": 1.5, "wall": 2.0, "ceiling": 2.0},
        "skirt": {"mat": "marble", "h": 0.12, "t": 0.03, "tile": 2.5},
        "cornice": {"mat": "plaster_dark", "h": 0.22, "t": 0.06},
        "ambient": {"color": "#ffe6d0", "intensity": 0.22},
        "sun": {"from": [0.5, 5.5, 8.0], "color": "#ffe0c0", "intensity": 0.8},
        "lights": lights,
        "fog": {"color": "#120f0e", "near": 4, "far": 22},
        "spawn": [0, 5.6, 0],
        "props": props,
        "footstep": {"filterHz": 500, "gain": 0.06},
    }
    rec["shots"] = shots_for(rec, out_dist=4.0, leave_dist=11.4)
    rec["shots"]["leave"]["seconds"] = 3.4  # through the curtain
    return rec


def lobby_doors():
    rec = waiting_room(False)
    rec["name"] = "THE LOBBY DOORS"
    W, H, D = rec["size"]
    rec["props"].append(prop("glassdoors", [0, 0, D / 2 - 0.1], rot=180, w=2.6, h=2.9))
    rec["props"].append(prop("placard", [2.2, 1.5, D / 2 - 0.02], rot=180))
    rec["props"].append(prop("slip", [0.6, 0.004, D / 2 - 1.2], rot=15))  # one 99, at the foot of the locked doors
    rec["props"].append(glb("lib_payphone", [-W / 2 + 0.7, 0, D / 2 - 1.0], rot=90, fallback=None, collide=True))
    rec["spawn"] = [0, 1.5, 180]
    rec["ambient"]["intensity"] = 0.3
    rec["fog"] = {"color": "#0b0a09", "near": 8, "far": 30}
    rec["lights"].append({"type": "point", "pos": [0, 2.2, D / 2 + 1.5], "color": "#3a4652", "intensity": 4, "distance": 6})
    rec["shots"] = shots_for(rec, out_dist=2.2, leave_dist=3.6)
    # Locked: the leave shot turns from the doors back toward the room's dark
    # (the receptionist's line lands here), then black.
    rec["shots"]["leave"] = {"from": "out", "to": pose([0, EYE, 2.6], [0, 1.2, -D / 2]), "seconds": 3.4, "ease": "inout", "fadeOut": 1.2}
    rec["shots"].pop("call", None)
    return rec


def cubicle_floor():
    W, H, D = 26.0, 3.0, 36.0
    props = []
    # Two banks either side of a 2.2 m aisle; rows every 2.4 m; each
    # workstation = back partition + side partition + desk + CRT + chair.
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
                props.append(glb("lib_desk", [bx, 0, z + 0.55], fallback="desk", collide=True))
                props.append(glb("lib_crt", [bx, 0.75, z + 0.5], fallback="monitor"))
                cx, cz, chair_rot = bx, z + 1.35, 0
                if row == 4 and side == -1 and k == 0:
                    cx, cz, chair_rot = bx + 0.9, z + 1.6, 40  # Harlowe's chair, pushed out (Track C motif 3)
                props.append(glb("lib_chair_wood", [cx, 0, cz], rot=180 + chair_rot, fallback="chair"))
        z += 2.4
        row += 1
    # Fluorescent grid.
    for fx in range(-12, 13, 4):
        for fz in range(-16, 17, 4):
            props.append(prop("fluoro", [fx, H - 0.06, fz], w=1.2, d=0.3))
    # THE MANAGER: starts at the far end of the aisle and walks toward the
    # camera while the player follows (MG-03 C drives `actors.manager`).
    props.append(prop("figure", [0, 0, -9.0], face="blur", tie=True, name="manager"))
    props.append(prop("papers", [0.32, 0.86, -8.86], mat="plaster_blown", name="evidence"))
    props.append(prop("clock", [0, 2.4, -D / 2 + 0.02]))
    props.append(prop("slip", [1.1, 0.004, -3.8], rot=12))
    lights = [{"type": "point", "pos": [x, H - 0.4, zz], "color": "#eef2ff", "intensity": 11, "distance": 14, "flicker": 0.12 if (x, zz) == (8, 4) else 0}
              for x in (-8, 0, 8) for zz in (-12, -4, 4, 12)]
    rec = {
        "name": "THE FLOOR",
        "size": [W, H, D],
        "floor": "carpet", "wall": "plaster", "ceiling": "ceiling_tile",
        "tile": {"floor": 1.5, "wall": 2.0, "ceiling": 1.2},
        "skirt": {"mat": "plaster_dark", "h": 0.1, "t": 0.02},
        "ambient": {"color": "#e8ecff", "intensity": 0.2},
        "sun": {"from": [2.0, 5.0, 22.0], "color": "#f4f6ff", "intensity": 0.4},
        "lights": lights,
        "fog": {"color": "#b4b7b1", "near": 12, "far": 46},
        "exposure": 1.0,
        "vignette": 0.45,
        "spawn": [0, 15.5, 0],
        "props": props,
        "footstep": {"filterHz": 380, "gain": 0.05},
        # The manager approaches down the aisle: t=0 far, t=1 beside the player.
        "actors": {"manager": {"path": [[0, -9.0], [0, 11.8]], "carry": ["evidence"]}},
    }
    rec["shots"] = shots_for(rec, out_dist=3.0, leave_dist=13.0, loop_seconds=24.0)
    return rec


def utility_corridor():
    W, H, D = 3.2, 3.0, 36.0
    props = []
    z = -D / 2 + 3.0
    i = 0
    while z < D / 2 - 2.0:
        props.append(prop("door", [-W / 2 + 0.06, 0, z], rot=90))
        props.append(prop("door", [W / 2 - 0.06, 0, z + 2.2], rot=-90))
        if i % 2 == 0:
            props.append(glb("lib_basin", [W / 2 - 0.45, 0, z - 1.6], rot=-90, fallback="mopsink", collide=True))
        if i % 3 == 1:
            props.append(prop("drain", [0, 0.002, z + 1.0]))
        props.append(prop("fluoro", [0, H - 0.06, z], w=1.2, d=0.25))
        z += 4.5
        i += 1
    props.append(prop("figure", [0, 0, -D / 2 + 1.2], rot=180, face="blur", tie=True, name="manager"))  # facing away, never closer
    props.append(prop("door", [-W / 2 + 0.06, 0, -D / 2 + 6.0], rot=110))  # one door ajar (Harlowe)
    props.append(prop("slip", [-0.7, 0.004, 4.0], rot=-30))
    props.append(prop("clock", [W / 2 - 0.03, 2.3, 8.2], rot=-90))  # C8: the same clock, between two doors
    props.append(glb("lib_breaker", [-W / 2 + 0.12, 1.1, 10.5], rot=90, fallback=None))
    # Exposed services down the ceiling: two pipe runs and a cable tray.
    for z in range(int(-D / 2) + 3, int(D / 2) - 2, 6):
        props.append(prop("pipe", [0.95, H - 0.22, z], rot=90, len=6.0, r=0.09))
        props.append(prop("pipe", [-0.85, H - 0.3, z], rot=90, len=6.0, r=0.05, mat="lp_dark"))
    lights = [{"type": "point", "pos": [0, H - 0.3, zz], "color": "#dfe6dc", "intensity": 7, "distance": 9, "flicker": 0.3 if zz in (-5, 10) else 0} for zz in range(-15, 16, 5)]
    rec = {
        "name": "THE FLOOR",
        "size": [W, H, D],
        "floor": "concrete_wet", "wall": "cinderblock", "ceiling": "concrete",
        "tile": {"floor": 2.0, "wall": 1.6, "ceiling": 2.0},
        "skirt": {"mat": "paint_green", "h": 1.2, "t": 0.02, "tile": 1.6},
        "ambient": {"color": "#dfe6dc", "intensity": 0.14},
        "sun": {"from": [0.6, 4.5, 20.0], "color": "#dfe6dc", "intensity": 0.7},
        "lights": lights,
        "fog": {"color": "#101211", "near": 6, "far": 30},
        "spawn": [0, 15.5, 0],
        "props": props,
        "footstep": {"filterHz": 900, "gain": 0.1},
    }
    rec["shots"] = shots_for(rec, out_dist=4.0, leave_dist=14.0, loop_seconds=26.0)
    return rec


def desk_void(monitor_on):
    W, H, D = 40.0, 8.0, 40.0
    props = [
        prop("desk", [0, 0, 0], w=1.7, d=0.85),
        # The terminal: its screen quad is what MG-05 C's requisition sheet is
        # projected onto (stage.screenRect reads the prop named `terminal`).
        prop("monitor", [0.35, 0.75, -0.15], on=monitor_on, name="terminal"),
        glb("lib_chair_wood", [0, 0, 0.85], rot=180, fallback="chair"),
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
    rec = {
        "name": "THE REQUISITION" if monitor_on else "THE DESK",
        "size": [W, H, D],
        "floor": "concrete", "wall": "void", "ceiling": "void",
        "tile": {"floor": 3.0, "wall": 8.0, "ceiling": 8.0},
        "ambient": {"color": "#ffffff", "intensity": 0.06},
        "sun": {"from": [1.0, 6.0, 6.0], "color": "#ffe7c4", "intensity": 0.5},
        "lights": lights,
        "fog": {"color": "#000000", "near": 3, "far": 16},
        "vignette": 0.75,
        "spawn": [0, 3.2, 0],
        "props": props,
        "footstep": {"filterHz": 600, "gain": 0.07},
    }
    rec["shots"] = shots_for(rec, out_dist=1.4, leave_dist=9.0, loop_seconds=16.0)
    if monitor_on:
        # Over the shoulder at the terminal: the screen fills the middle of frame.
        rec["shots"]["in"] = pose([0.35, 1.45, 1.35], [0.35, 0.95, -0.2])
        rec["shots"]["out"] = pose([0.35, 1.4, 1.1], [0.35, 0.95, -0.2])
        rec["shots"]["loop"]["sway"] = 0.012
    return rec


def garage(depth=44.0, open_north=False):
    """S5-H's parking level (Doc 1 §5: photoreal concrete, photoreal sodium
    light, photoreal oil stains; rusted low-poly vehicles, no two the same).
    A coffered slab on 8 m beam rows, square columns with a painted band, a
    green band round the walls, one sodium tube per beam bay, bays marked by
    wall plates. The cars are the catalog's low-poly vehicles, no two the
    same model."""
    W, H, D = 32.0, 3.4, depth
    props = []
    lights = []
    rnd = random.Random(55)
    beam_every = 8.0
    z0 = -D / 2 + 4.0
    zs = []
    z = z0
    while z < D / 2:
        zs.append(z)
        z += beam_every
    for x in range(-12, 13, 8):
        for zz in zs:
            props.append(prop("pillar", [x, 0, zz], w=0.7, h=H, band="paint_green", bandH=1.1, tile=1.5))
    bay_z = [zz + beam_every / 2 for zz in zs if zz + beam_every / 2 < D / 2 - 1.0]
    for x in (-8, 8):
        for i, bz in enumerate(bay_z):
            props.append(prop("sodium", [x, H - 0.74, bz]))
            lights.append({"type": "point", "pos": [x, H - 1.15, bz], "color": "#ffa040", "intensity": 42, "distance": 22, "flicker": 0.35 if i % 2 else 0.12})
    for i, bz in enumerate(bay_z):
        if i % 2 == 0:
            props.append(prop("sodium", [0, H - 0.74, bz]))
            lights.append({"type": "point", "pos": [0, H - 1.15, bz], "color": "#ffb060", "intensity": 24, "distance": 18, "flicker": 0.2})
    for x in (-12, 12):
        for zz in zs[::2]:
            props.append(prop("wallplate", [x + (0.36 if x < 0 else -0.36), 1.9, zz], rot=90 if x < 0 else -90, w=1.1, h=0.5))
    cars = ["lib_car_sedan", "lib_car_suv", "lib_car_pastel", "lib_car_cruiser", "lib_car_sedan2", "lib_car_taxi"]
    car_mats = ["lp_car", "lp_car2", "lp_car3", "lp_car4", "lp_car5", "lp_car6"]
    bays = []
    for lane in (-1, 1):
        for zz in zs:
            for k in (-1, 1):
                bays.append((lane * 10.0 + k * 2.6, zz + beam_every / 2))
    rnd.shuffle(bays)
    n_cars = 9 if depth > 30 else 4
    for i, (bx, bz) in enumerate(bays[:n_cars]):
        if abs(bz) > D / 2 - 3.0:
            continue
        rot = rnd.choice((0, 180)) + rnd.uniform(-7, 7)
        props.append(glb(cars[i % len(cars)], [bx, 0, bz], rot=round(rot, 1), fallback="car", collide=True,
                         mat=car_mats[i % len(car_mats)], len=round(rnd.uniform(3.9, 4.9), 2), w=round(rnd.uniform(1.65, 1.9), 2), hero=(i == 0), rust=0.6))
    props.append(prop("slip", [1.4, 0.004, 3.0], rot=100))
    props.append(prop("clock", [-W / 2 + 0.03, 2.4, D / 2 - 6.0], rot=90))  # C8: the same clock, on the west wall
    rec = {
        "name": "THE GARAGE",
        "size": [W, H, D],
        "floor": "garage_floor", "wall": "concrete", "ceiling": "concrete",
        "tile": {"floor": 3.0, "wall": 2.5, "ceiling": 2.5},
        "skirt": {"mat": "paint_green", "h": 1.1, "t": 0.02, "tile": 2.5},
        "beams": {"axis": "x", "every": beam_every, "offset": 4.0, "w": 0.7, "h": 0.7, "mat": "concrete", "tile": 2.5},
        "ambient": {"color": "#ffb060", "intensity": 0.24},
        "sun": {"from": [3.0, 5.0, D * 0.55], "color": "#ffb86a", "intensity": 0.6},
        "lights": lights,
        "fog": {"color": "#160f08", "near": 8, "far": 48},
        "exposure": 1.25,
        "vignette": 0.55,
        "grain": 0.025,
        "spawn": [0, D / 2 - 3.0, 0],
        "props": props,
        "boxes": [],
        "footstep": {"filterHz": 800, "gain": 0.1},
    }
    rec["shots"] = shots_for(rec, out_dist=4.0, leave_dist=D - 6.0, loop_seconds=30.0)
    if open_north:
        # The run that does not end, ended: the concrete stops one metre
        # ahead and below is the pool room -- water to the horizon, pale
        # square pillars standing in it, no ceiling, no far wall (Doc 1 §5
        # S6-H/S7-H). The fog closes it (C3).
        rec["name"] = "THE EDGE"
        rec["open"] = ["N"]
        edge = -D / 2
        rec["boxes"] = [
            {"min": [-90, -4.3, edge - 120], "max": [90, -3.9, edge + 0.0], "mat": "water", "collide": False, "shadow": False, "tile": 5.0},
            {"min": [-W / 2 - 0.3, -0.35, edge - 0.15], "max": [W / 2 + 0.3, 0, edge + 0.6], "mat": "concrete", "collide": False, "tile": 2.0},
            {"min": [-W / 2 - 0.3, -0.9, edge - 0.02], "max": [W / 2 + 0.3, -0.35, edge + 0.3], "mat": "concrete_wet", "collide": False, "tile": 2.0},
            {"min": [-W / 2, 0, edge - 0.4], "max": [W / 2, 1.2, edge - 0.2], "mat": "void", "collide": True, "invisible": True, "shadow": False},
            {"min": [-6, -4.05, edge - 36], "max": [6, -4.0, edge - 30], "mat": "glow_water", "collide": False, "shadow": False},
        ]
        prnd = random.Random(7)
        for x in range(-28, 29, 7):
            for zz in range(-8, -90, -9):
                jx = prnd.uniform(-0.8, 0.8)
                rec["boxes"].append({"min": [x + jx - 0.7, -4.5, edge + zz - 0.7], "max": [x + jx + 0.7, 12.0, edge + zz + 0.7], "mat": "plaster", "collide": False, "tile": 2.0})
        rec["fog"] = {"color": "#0b1e24", "near": 10, "far": 85}
        rec["background"] = "#07171c"
        kept = []
        for l in rec["lights"]:
            if l["pos"][2] > edge + 5:
                l = dict(l)
                l["intensity"] = round(l["intensity"] * (0.45 if l["pos"][2] < edge + 10 else 0.8), 1)
                kept.append(l)
        rec["lights"] = kept
        rec["lights"].append({"type": "point", "pos": [0, 3.0, edge - 14], "color": "#4f9aa8", "intensity": 26, "distance": 70, "decay": 1.1})
        rec["lights"].append({"type": "point", "pos": [-16, 5.0, edge - 34], "color": "#3f8a9c", "intensity": 22, "distance": 70, "decay": 1.1})
        rec["lights"].append({"type": "point", "pos": [16, 5.0, edge - 34], "color": "#3f8a9c", "intensity": 22, "distance": 70, "decay": 1.1})
        rec["lights"].append({"type": "point", "pos": [0, -3.2, edge - 33], "color": "#3ab8d0", "intensity": 40, "distance": 50, "decay": 1.2})
        rec["ambient"] = {"color": "#5f9aa8", "intensity": 0.14}
        rec["hemisphere"] = {"sky": "#2c5c68", "ground": "#06121a", "intensity": 0.22}
        rec["sun"] = {"from": [2.0, 6.0, D * 0.55], "color": "#ffb86a", "intensity": 0.25}
        rec["exposure"] = 1.0
        rec["grain"] = 0.025
        rec["spawn"] = [0, edge + 7.0, 0]
        # THE RUN (MG-05 H): the camera runs down the bay toward the edge for
        # as long as the player holds; the shot only moves while the room is
        # "resumed", so stamina decides where it stops (never pingpong).
        s = shots_for(rec, out_dist=5.5, leave_dist=6.2, loop_seconds=40.0)
        s["in"] = pose([0, EYE, D / 2 - 3.0], [0, 1.3, edge])
        s["loop"] = {"from": "in", "to": pose([0, EYE, edge + 1.1], [0, 1.1, edge - 4]), "seconds": 40.0, "pingpong": False, "ease": "linear", "sway": 0.05, "holdEnd": True}
        s["out"] = pose([0, EYE, edge + 1.1], [0, 0.2, edge - 3.5])
        # THE EDGE (S7 H): leaning out over the pool, and back.
        s["lean"] = {"from": pose([0, EYE, edge + 1.1], [0, 1.0, edge - 6]), "to": pose([0, EYE - 0.25, edge + 0.6], [0, -2.5, edge - 2.5]), "seconds": 9.0, "pingpong": True, "ease": "inout", "sway": 0.02}
        s["leave"] = {"from": "out", "to": pose([0, -1.0, edge - 1.2], [0, -6, edge - 3]), "seconds": 2.6, "ease": "in", "fadeOut": 0.9}
        s["arrive"] = {"from": pose([0, EYE, D / 2 - 1.5], [0, 1.3, edge]), "to": "in", "seconds": 3.0, "ease": "out", "fadeIn": 1.0}
        rec["shots"] = s
    return rec


def freight_elevator():
    W, H, D = 3.0, 2.6, 3.4
    rec = {
        "name": "THE DESCENT",
        "size": [W, H, D],
        "floor": "grate", "wall": "rust", "ceiling": "grate",
        "tile": {"floor": 1.0, "wall": 1.5, "ceiling": 1.0},
        "ambient": {"color": "#ffd9a8", "intensity": 0.25},
        "sun": {"from": [0.4, 3.0, 2.5], "color": "#ffd9a8", "intensity": 0.7},
        "lights": [{"type": "point", "pos": [0, H - 0.25, 0.2], "color": "#ffcf9a", "intensity": 6, "distance": 6, "flicker": 0.2}],
        "fog": {"color": "#0a0705", "near": 2, "far": 9},
        "spawn": [0, 1.0, 0],
        "props": [
            prop("panel", [W / 2 - 0.05, 0.7, 0.5], rot=-90),
            prop("clock", [0, 1.9, -D / 2 + 0.03]),
            prop("slip", [-0.6, 0.004, -0.9], rot=200),
            glb("lib_cagelamp", [0, H - 0.3, 0.2], fallback=None),
        ],
        "footstep": {"filterHz": 1800, "gain": 0.12},
    }
    s = shots_for(rec, out_dist=0.6, leave_dist=1.0, loop_seconds=10.0)
    # The cab descends: the camera stays, the cab shakes (sway), and the
    # leave shot drops the camera through the grate floor into black (C3).
    s["loop"]["sway"] = 0.05
    s["leave"] = {"from": "out", "to": pose([0, -1.4, 0.4], [0, -6.0, -1.5]), "seconds": 3.2, "ease": "in", "fadeOut": 1.4}
    rec["shots"] = s
    return rec


def mailroom():
    W, H, D = 40.0, 10.0, 50.0
    props = []
    rnd = random.Random(8)
    for x in range(-16, 17, 4):
        for z in range(-20, 21, 4):
            if abs(x) < 5 and z > -12:
                continue  # keep the whole approach lane, spawn to counter, clear
            if (x + z) % 3 == 0:
                props.append(glb("lib_pallets", [x + rnd.uniform(-0.6, 0.6), 0, z + rnd.uniform(-0.6, 0.6)], rot=rnd.randint(0, 90), fallback="boxtower", collide=True, n=rnd.randint(4, 12)))
            else:
                props.append(prop("boxtower", [x + rnd.uniform(-0.6, 0.6), 0, z + rnd.uniform(-0.6, 0.6)], rot=rnd.randint(0, 90), n=rnd.randint(4, 12)))
    props.append(glb("lib_guarddesk", [0, 0, -9.0], fallback="counter", collide=True, w=6.0, d=1.0, glass=False, mat="lp_dark"))
    props.append(prop("figure", [0.0, 0, -9.9], face="blur", suit="lp_blue", name="clerk"))
    props.append(prop("package", [0.4, 1.16, -8.9], rot=15, name="package"))
    props.append(glb("lib_mailsacks", [3.2, 0, -8.6], rot=20, fallback=None))
    props.append(prop("clock", [3.6, 4.2, -14.0], rot=20))
    props.append(prop("slip", [-1.2, 0.004, -6.0], rot=45))
    for fx in (-12, 0, 12):
        for fz in (-14, 0, 14):
            props.append(prop("fluoro", [fx, 7.5, fz], w=2.4, d=0.4))
    lights = [{"type": "point", "pos": [fx, 7.0, fz], "color": "#e6ecff", "intensity": 30, "distance": 22, "flicker": 0.15 if (fx, fz) == (12, -14) else 0} for fx in (-12, 0, 12) for fz in (-14, 0, 14)]
    rec = {
        "name": "THE DELIVERY",
        "size": [W, H, D],
        "floor": "concrete", "wall": "plaster_dark", "ceiling": "void",
        "noCeiling": True,
        "tile": {"floor": 3.0, "wall": 3.0},
        "skirt": {"mat": "paint_green", "h": 1.0, "t": 0.02, "tile": 3.0},
        "ambient": {"color": "#dfe6f0", "intensity": 0.12},
        "sun": {"from": [4.0, 9.0, 26.0], "color": "#e6ecff", "intensity": 0.45},
        "lights": lights,
        "fog": {"color": "#70747b", "near": 9, "far": 52},
        "spawn": [0, 16.0, 0],
        "props": props,
        "footstep": {"filterHz": 700, "gain": 0.09},
    }
    s = shots_for(rec, out_dist=6.0, leave_dist=23.0, loop_seconds=20.0)
    # The walk to the counter (S8_C_VID): spawn to the clerk, 8 s.
    s["push"] = {"from": "in", "to": pose([0, EYE, -7.2], [0.3, 1.15, -9.6]), "seconds": 8.0, "ease": "inout"}
    s["out"] = pose([0, EYE, -7.2], [0.3, 1.15, -9.6])
    rec["shots"] = s
    return rec


def convenience_store():
    W, H, D = 12.0, 3.2, 16.0
    props = []
    for x in (-3.2, 0.0, 3.2):
        for z in (-2.5, 1.5):
            props.append(glb("lib_shelf", [x, 0, z], fallback="shelf", collide=True, w=2.4, d=0.7, tiers=4, h=1.8))
    props.append(prop("cooler", [0, 0, -D / 2 + 0.42], w=8.0))
    props.append(prop("counter", [-4.2, 0, 5.2], w=2.6, d=0.9, glass=False, mat="lp_grey"))
    props.append(prop("monitor", [-4.6, 1.16, 5.2], on=False))
    props.append(prop("clock", [W / 2 - 0.03, 2.4, 0.0], rot=-90))
    props.append(prop("slip", [1.6, 0.004, 4.0], rot=140))
    for fx in (-3, 3):
        for fz in (-5, -1, 3, 7):
            props.append(prop("fluoro", [fx, H - 0.06, fz], w=1.2, d=0.3))
    lights = [{"type": "point", "pos": [fx, H - 0.4, fz], "color": "#f0f4ff", "intensity": 8, "distance": 10, "flicker": 0.3 if (fx, fz) == (-3, 3) else 0} for fx in (-3, 3) for fz in (-5, -1, 3, 7)]
    rec = {
        "name": "THE STORE",
        "size": [W, H, D],
        "floor": "linoleum", "wall": "plaster", "ceiling": "ceiling_tile",
        "tile": {"floor": 1.0, "wall": 2.0, "ceiling": 1.2},
        "skirt": {"mat": "plaster_dark", "h": 0.1, "t": 0.02},
        "open": ["S"],
        "boxes": [
            # Storefront glass: the street outside is photoreal and empty and he cannot render out there -- it stays black.
            {"min": [-W / 2 - 0.3, 0, D / 2], "max": [W / 2 + 0.3, H, D / 2 + 0.06], "mat": "glass_dark", "collide": True, "shadow": False, "tile": 3.0},
            {"min": [-W / 2 - 0.3, H - 0.3, D / 2], "max": [W / 2 + 0.3, H + 0.2, D / 2 + 0.3], "mat": "plaster", "collide": False},
            {"min": [-0.06, 0, D / 2 - 0.02], "max": [0.06, H, D / 2 + 0.1], "mat": "concrete", "collide": False, "tile": 1.0},
        ],
        "ambient": {"color": "#f0f4ff", "intensity": 0.22},
        "sun": {"from": [1.0, 5.0, 12.0], "color": "#f4f6ff", "intensity": 0.4},
        "lights": lights,
        "fog": {"color": "#05070a", "near": 14, "far": 30},
        "exposure": 1.0,
        "vignette": 0.45,
        "background": "#000000",
        "spawn": [0, 6.0, 0],
        "props": props,
        "footstep": {"filterHz": 1100, "gain": 0.08},
    }
    s = shots_for(rec, out_dist=3.0, leave_dist=5.5, loop_seconds=14.0)
    # Expelled onto the linoleum (S8_H_VID_STORE): static on the storefront
    # glass, the fluorescent above flickering.
    s["in"] = pose([0, EYE, -1.0], [0, 1.3, D / 2])
    s["out"] = pose([0, EYE, 1.0], [0, 1.3, D / 2])
    s["arrive"] = {"from": pose([0, 0.6, -2.0], [0, 1.3, D / 2]), "to": "in", "seconds": 3.0, "ease": "out", "fadeIn": 1.2}
    # EXPULSION: pushing toward the glass, the door open outward, nothing
    # rendering in the doorway -- the push ends inside the black beyond it.
    s["ending"] = {"from": "out", "to": pose([0, EYE, D / 2 + 1.6], [0, 1.2, D / 2 + 12]), "seconds": 7.0, "ease": "inout", "fadeOut": 1.4}
    s["leave"] = {"from": "out", "to": pose([0, EYE, D / 2 - 0.5], [0, 1.2, D / 2 + 12]), "seconds": 3.0, "ease": "in", "fadeOut": 1.1}
    rec["shots"] = s
    return rec


def apartment():
    """S0 THE UPLOAD, beat 1: a dim apartment at night, one monitor. The
    desk, wall, carpet and the monitor glow are the building's (photoreal);
    the keyboard, mug, hands and the chair are his (low-poly, C6)."""
    W, H, D = 4.6, 2.6, 5.0
    props = [
        prop("desk", [0.2, 0, -D / 2 + 0.75], w=1.5, d=0.7, mat="lp_wood"),
        prop("monitor", [0.3, 0.75, -D / 2 + 0.62], on=True, name="terminal"),
        prop("keyboard", [0.3, 0.75, -D / 2 + 1.02]),
        prop("hands", [0.3, 0.76, -D / 2 + 1.1], name="hands"),
        prop("mug", [-0.35, 0.75, -D / 2 + 0.95]),
        glb("lib_tablelamp", [-0.45, 0.75, -D / 2 + 0.55], fallback="lamp"),
        glb("lib_books", [0.85, 0.75, -D / 2 + 0.6], rot=15, fallback=None),
        glb("lib_chair_wood", [0.3, 0, -D / 2 + 1.65], rot=180, fallback="chair"),
        prop("clock", [-W / 2 + 0.03, 1.9, 0.6], rot=90),
    ]
    rec = {
        "name": "THE UPLOAD",
        "size": [W, H, D],
        "floor": "carpet", "wall": "plaster_dark", "ceiling": "plaster_dark",
        "tile": {"floor": 1.2, "wall": 2.0, "ceiling": 2.0},
        "skirt": {"mat": "plaster_dark", "h": 0.1, "t": 0.02},
        "ambient": {"color": "#8fd0b0", "intensity": 0.08},
        "sun": {"from": [0.3, 2.4, 2.2], "color": "#9ad8b8", "intensity": 0.25},
        "lights": [
            {"type": "point", "pos": [0.3, 1.1, -D / 2 + 0.9], "color": "#8fe0b8", "intensity": 5, "distance": 5, "flicker": 0.08},
            {"type": "point", "pos": [-0.45, 1.3, -D / 2 + 0.6], "color": "#ffc27a", "intensity": 2.2, "distance": 4},
        ],
        "fog": {"color": "#050706", "near": 2, "far": 9},
        "vignette": 0.7,
        "grain": 0.045,
        "spawn": [0.3, 1.2, 0],
        "props": props,
        "footstep": {"filterHz": 380, "gain": 0.04},
    }
    s = shots_for(rec, out_dist=0.4, leave_dist=1.2, loop_seconds=14.0)
    # Over the shoulder, the monitor in the middle of frame (S0_X_IMG_IN).
    s["in"] = pose([0.3, 1.5, -D / 2 + 2.15], [0.3, 0.98, -D / 2 + 0.62], fov=48)
    s["out"] = pose([0.3, 1.45, -D / 2 + 1.95], [0.3, 0.98, -D / 2 + 0.62], fov=48)
    s["loop"]["sway"] = 0.01
    # ACCEPTED. The window cannot be closed: the camera pushes into the screen's glow and the room goes.
    s["leave"] = {"from": "out", "to": pose([0.3, 1.1, -D / 2 + 0.9], [0.3, 0.98, -D / 2 + 0.62], fov=40), "seconds": 2.6, "ease": "in", "fadeOut": 1.0}
    rec["shots"] = s
    return rec


def street():
    """S0 beat 2, the commute: dawn, an empty street from the base of the
    tower. Asphalt, brick and the low sun are photoreal; parked cars, signs
    and lamps are low-poly. The tower ahead has no visible top (the fog
    takes it). The one set before the lobby doors, so C3 does not apply:
    there is a sky colour, and it is the only one in the game."""
    W, H, D = 18.0, 90.0, 64.0
    props = []
    rnd = random.Random(0)
    # Facades either side: catalog blocks, box fallbacks.
    for i, z in enumerate(range(-20, 31, 10)):
        node = "lib_brownstone" if i % 2 == 0 else "lib_aptblock"
        props.append(glb(node, [-W / 2 - 3.5, 0, z], rot=90, fallback="building", w=10, h=16 + (i % 3) * 4, d=9))
        props.append(glb("lib_aptblock" if i % 2 == 0 else "lib_brownstone", [W / 2 + 3.5, 0, z + 5], rot=-90, fallback="building", w=10, h=14 + ((i + 1) % 3) * 5, d=9))
    # The tower: the whole core end of the street, no top.
    props.append(glb("lib_tower", [0, 0, -D / 2 - 14], fallback="building", w=26, h=88, d=28, scale=2.2, name="tower"))
    props.append(prop("glassdoors", [0, 0, -D / 2 + 0.3], w=3.2, h=3.2, name="doors"))
    for z in (-22, -6, 10, 26):
        props.append(glb("lib_streetlamp", [-W / 2 + 1.2, 0, z], fallback="lamppost"))
        props.append(glb("lib_streetlamp", [W / 2 - 1.2, 0, z + 8], rot=180, fallback="lamppost"))
    props.append(glb("lib_trafficlight", [W / 2 - 1.4, 0, -D / 2 + 9], rot=180, fallback="lamppost"))
    props.append(glb("lib_hydrant", [-W / 2 + 1.6, 0, 4.0], fallback=None))
    props.append(glb("lib_trashbin", [W / 2 - 1.8, 0, -3.0], fallback=None))
    cars = ["lib_car_sedan", "lib_car_taxi", "lib_car_sedan2", "lib_car_pastel"]
    for i, z in enumerate((-16, -2, 12, 24)):
        side = -1 if i % 2 else 1
        props.append(glb(cars[i], [side * (W / 2 - 3.0), 0, z], rot=0 if side > 0 else 180, fallback="car", collide=True, mat="lp_car%d" % (2 + i), len=4.4, w=1.8))
    props.append(prop("clock", [-W / 2 - 0.1, 3.2, -D / 2 + 6], rot=90))
    props.append(prop("slip", [0.4, 0.004, -D / 2 + 3.0], rot=30))
    rec = {
        "name": "THE COMMUTE",
        "size": [W, H, D],
        "floor": "asphalt", "wall": "void", "ceiling": "void",
        "noCeiling": True,
        "noWalls": True,
        "tile": {"floor": 3.0},
        "boxes": [
            # pavements
            {"min": [-W / 2 - 3.0, 0, -D / 2], "max": [-W / 2 + 2.6, 0.14, D / 2], "mat": "concrete", "collide": False, "tile": 2.0},
            {"min": [W / 2 - 2.6, 0, -D / 2], "max": [W / 2 + 3.0, 0.14, D / 2], "mat": "concrete", "collide": False, "tile": 2.0},
            # the tower's plinth and entrance step
            {"min": [-14, 0, -D / 2 - 30], "max": [14, 0.3, -D / 2 + 0.6], "mat": "marble_light", "collide": True, "tile": 2.5},
        ],
        "ambient": {"color": "#f0c8a0", "intensity": 0.3},
        "hemisphere": {"sky": "#e8b07a", "ground": "#3a3028", "intensity": 0.5},
        "sun": {"from": [-6.0, 7.0, 40.0], "color": "#ffb070", "intensity": 1.6},
        "lights": [],
        "fog": {"color": "#d9a878", "near": 18, "far": 95},
        "background": "#d9a878",
        "exposure": 1.1,
        "vignette": 0.4,
        "grain": 0.03,
        "spawn": [0, 26.0, 0],
        "props": props,
        "footstep": {"filterHz": 1600, "gain": 0.1},
    }
    s = shots_for(rec, out_dist=6.0, leave_dist=D - 4.5, loop_seconds=16.0)
    # The push-in to the tower (S0_X_VID, 8 s) and through the doors.
    s["push"] = {"from": pose([0, EYE, 26.0], [0, 6.0, -D / 2 - 14]), "to": pose([0, EYE, -D / 2 + 6.0], [0, 1.4, -D / 2 - 2]), "seconds": 9.0, "ease": "inout", "fadeIn": 1.2}
    s["arrive"] = s["push"]  # entering the street from the apartment IS the push
    s["out"] = pose([0, EYE, -D / 2 + 6.0], [0, 1.4, -D / 2 - 2])
    s["leave"] = {"from": "out", "to": pose([0, EYE, -D / 2 - 0.6], [0, 1.4, -D / 2 - 6]), "seconds": 3.0, "ease": "in", "fadeOut": 1.2}
    rec["shots"] = s
    return rec


def dive():
    """S8 H, the dive: underwater, jagged low-poly hands against the
    caustics, below a rusted grate with sick blue light behind it."""
    W, H, D = 12.0, 14.0, 12.0
    rec = {
        "name": "THE DIVE",
        "size": [W, H, D],
        "floor": "grate", "wall": "pool_tile", "ceiling": "water",
        "tile": {"floor": 1.0, "wall": 1.5, "ceiling": 4.0},
        "boxes": [
            {"min": [-4, -3.0, -4], "max": [4, -0.2, 4], "mat": "glow_water", "collide": False, "shadow": False},
            {"min": [-W / 2, -0.25, -D / 2], "max": [W / 2, -0.2, D / 2], "mat": "rust", "collide": False, "tile": 2.0},
        ],
        "ambient": {"color": "#3a8aa0", "intensity": 0.35},
        "hemisphere": {"sky": "#2b6a7c", "ground": "#061a22", "intensity": 0.6},
        "sun": {"from": [1.0, 13.0, 3.0], "color": "#8fd8ea", "intensity": 0.9},
        "lights": [
            {"type": "point", "pos": [0, 0.6, 0], "color": "#3ab8d0", "intensity": 30, "distance": 20, "flicker": 0.4},
            {"type": "point", "pos": [3, 9.0, -3], "color": "#5fc8dc", "intensity": 18, "distance": 24, "flicker": 0.25},
            {"type": "point", "pos": [-3, 9.0, 3], "color": "#5fc8dc", "intensity": 18, "distance": 24, "flicker": 0.3},
        ],
        "fog": {"color": "#0a2a38", "near": 2, "far": 20},
        "background": "#061c26",
        "exposure": 1.0,
        "vignette": 0.6,
        "grain": 0.04,
        "spawn": [0, 2.0, 0],
        "props": [
            prop("hands", [0, 1.2, 1.4], rot=0, name="hands", reach=True),
            prop("clock", [-W / 2 + 0.03, 4.0, -2.0], rot=90),
            prop("slip", [1.2, 0.004, -1.0], rot=60),
            glb("lib_lift", [-4.0, 0, -4.0], rot=45, fallback=None, collide=True),
        ],
        "footstep": {"filterHz": 300, "gain": 0.03},
    }
    s = shots_for(rec, out_dist=0.5, leave_dist=1.0, loop_seconds=10.0)
    s["in"] = pose([0, 9.0, 2.0], [0, 0, 0])
    s["out"] = pose([0, 2.2, 1.6], [0, -0.2, 0])
    # Descending motion toward the grate (S8_H_VID, 8 s), then the hold
    # above it while THE BREATH (MG-07 H) runs.
    s["descend"] = {"from": "in", "to": "out", "seconds": 8.0, "ease": "inout", "sway": 0.06}
    s["loop"] = {"from": "out", "to": pose([0.2, 2.0, 1.4], [0, -0.2, 0]), "seconds": 6.0, "pingpong": True, "ease": "inout", "sway": 0.06}
    # Through the grate into the dry concrete chute (black), then the store.
    s["leave"] = {"from": "out", "to": pose([0, -1.5, 0.2], [0, -6, -0.5]), "seconds": 2.8, "ease": "in", "fadeOut": 1.0}
    s["arrive"] = {"from": pose([0, 12.0, 3.0], [0, 0, 0]), "to": "in", "seconds": 2.4, "ease": "out", "fadeIn": 1.4}
    rec["shots"] = s
    return rec


def boardroom():
    """SE_ASSIM: the boardroom. A long glass table, twelve seated figures who
    do not breathe, one empty chair at the head with the hundredth slip in
    front of it (Track C motif 2)."""
    W, H, D = 9.0, 3.4, 18.0
    props = [prop("table", [0, 0, -1.0], w=2.2, d=12.0, name="table")]
    for i in range(6):
        z = -6.0 + i * 2.0
        for side in (-1, 1):
            props.append(glb("lib_chair", [side * 1.7, 0, z], rot=90 if side > 0 else -90, fallback="chair"))
            props.append(prop("figure", [side * 1.65, 0, z], rot=90 if side > 0 else -90, seated=True, face="blur", suit="lp_suit", name="board%d" % (i * 2 + (side > 0))))
    props.append(glb("lib_chair", [0.0, 0, -8.0], rot=0, fallback="chair", name="emptychair"))   # the head of the table, facing back down it
    props.append(prop("slip", [0.45, 0.76, -6.6], rot=12, name="hundredth"))
    props.append(prop("package", [0.0, 0.76, -1.6], rot=4, name="package"))
    props.append(prop("clock", [-W / 2 + 0.03, 2.5, -4.0], rot=90))
    for z in (-6, -2, 2):
        props.append(prop("pendant", [0, H, z], drop=0.8))
    rec = {
        "name": "ONBOARDING",
        "size": [W, H, D],
        "floor": "carpet", "wall": "plaster_dark", "ceiling": "plaster_dark",
        "tile": {"floor": 1.5, "wall": 2.0, "ceiling": 2.0},
        "skirt": {"mat": "marble", "h": 0.12, "t": 0.03, "tile": 2.5},
        "cornice": {"mat": "plaster_dark", "h": 0.3, "t": 0.08},
        "ambient": {"color": "#ffe9c8", "intensity": 0.12},
        "sun": {"from": [1.0, 5.0, 10.0], "color": "#ffe9c8", "intensity": 0.5},
        "lights": [{"type": "point", "pos": [0, H - 1.1, z], "color": "#ffe2b8", "intensity": 14, "distance": 12} for z in (-6, -2, 2)],
        "fog": {"color": "#0d0b09", "near": 6, "far": 30},
        "vignette": 0.6,
        "spawn": [0, 7.0, 0],
        "props": props,
        "footstep": {"filterHz": 380, "gain": 0.04},
    }
    s = shots_for(rec, out_dist=2.0, leave_dist=12.0, loop_seconds=18.0)
    s["in"] = pose([0, EYE, 6.4], [0, 1.0, -8.0], fov=50)
    s["out"] = pose([0, EYE, 4.8], [0, 1.0, -8.0], fov=50)
    # ASSIMILATION: pulling back down the table, resolving on the twelve
    # faces and the empty chair at the head.
    s["ending"] = {"from": pose([0, 1.4, -2.5], [0, 0.95, -8.0], fov=44), "to": pose([0, 1.7, 7.4], [0, 0.9, -8.0], fov=56), "seconds": 9.0, "ease": "inout"}
    # RETAINED: the same pull-back, shorter, the package still on the table.
    s["retained"] = {"from": pose([0, 1.3, -0.4], [0, 0.78, -6.6], fov=40), "to": pose([0, 1.7, 7.4], [0, 0.9, -8.0], fov=56), "seconds": 7.0, "ease": "inout"}
    rec["shots"] = s
    return rec


def pending_room():
    """SE_PEND: the waiting room from a seated position, the slip reading 99
    in low-poly hands; an empty chair opposite, recently vacated, and the
    curtain at the far end still swinging."""
    rec = waiting_room(False)
    rec["name"] = "PENDING REVIEW"
    W, H, D = rec["size"]
    rec["props"] = [p for p in rec["props"] if p["type"] != "glb"]  # the rows go; two chairs face each other
    rec["props"].append(glb("lib_chair", [-0.9, 0, 1.2], rot=-90, fallback="chair"))
    rec["props"].append(glb("lib_chair", [0.9, 0, 1.2], rot=90, fallback="chair", name="vacated"))
    rec["props"].append(prop("hands", [-0.6, 0.95, 1.2], rot=-90, name="hands", slip=True))
    rec["props"].append(prop("curtain", [0, 0, -D / 2 + 0.05], w=2.2, h=3.0, name="farcurtain", swing=True))
    rec["props"].append(prop("slip", [0.9, 0.45, 1.2], rot=10))  # the hundredth? no: the one he holds is drawn by the hands; this one on the vacated seat
    rec["spawn"] = [-0.9, 1.2, -90]
    s = shots_for(rec, eye=1.15, out_dist=0.3, leave_dist=1.0, loop_seconds=10.0)
    s["in"] = pose([-0.75, 1.15, 1.2], [0.9, 0.7, 1.2], fov=52)
    s["out"] = pose([-0.75, 1.15, 1.2], [0.9, 0.7, 1.2], fov=52)
    s["ending"] = {"from": pose([-0.75, 1.15, 1.2], [-0.2, 0.9, 1.2], fov=52), "to": pose([-0.75, 1.15, 1.2], [1.6, 0.8, 0.6], fov=52), "seconds": 7.0, "ease": "inout", "sway": 0.015}
    s.pop("call", None)
    rec["shots"] = s
    return rec


KEY_RE = r"^(S\d_[CHX]|SE_(ASSIM|EXPUL|PEND|RETAINED)|SET_[A-Z]+)$"


def build():
    import re
    edge_room = garage(depth=24.0, open_north=True)
    rooms = {
        "S0_X": apartment(),
        "SET_STREET": street(),
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
        "S7_H": {"alias": "S6_H", "spawn": [0, -9.5, 0], "_note": "The same edge, one step closer: S7 H plays the `lean` shot here."},
        "S8_C": mailroom(),
        "SET_DIVE": dive(),
        "S8_H": convenience_store(),
        "SE_ASSIM": boardroom(),
        "SE_RETAINED": {"alias": "SE_ASSIM", "_note": "The same boardroom; the ending plays the `retained` shot."},
        "SE_EXPUL": {"alias": "S8_H", "_note": "The same store; the ending pushes through the open door."},
        "SE_PEND": pending_room(),
    }
    for k, r in rooms.items():
        r["id"] = k
        assert re.match(KEY_RE, k), k
        if "alias" in r:
            assert "alias" not in rooms[r["alias"]], "%s: alias of an alias" % k
            continue
        clocks = sum(1 for p in r["props"] if p["type"] == "clock")
        assert clocks == 1, "%s: %d clocks (C8: exactly one handless clock per room)" % (k, clocks)
        slips = sum(1 for p in r["props"] if p["type"] == "slip")
        assert k in ("S0_X", "S1_C", "S1_H", "SE_PEND") or slips == 1, "%s: %d slips (Track C motif 2: one 99 per room after S1)" % (k, slips)
        for name in ("in", "out", "loop", "leave", "arrive"):
            assert name in r["shots"], "%s: no %s shot" % (k, name)
        for p in r["props"]:
            if p["type"] == "glb":
                assert p["node"] in CATALOG, "%s: unknown catalog node %s" % (k, p["node"])
    doc = {
        "_comment": "Generated by tools/build_rooms.py -- edit that, not this. One 3D set per scene+render (S{n}_{C|H|X}), per ending (SE_*) and per extra set (SET_*); `alias` reuses another record (own keys override). Read by src/stage/stage.js and src/walk/room.js; scenes.json's sequence entries name a room and a shot from here.",
        "catalog": CATALOG,
        "rooms": rooms,
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=1)
        fh.write("\n")
    n = sum(1 for r in rooms.values() if "alias" not in r)
    print("wrote %s: %d rooms (%d built, %d aliases), %d props, %d catalog placements" % (
        os.path.relpath(OUT), len(rooms), n, len(rooms) - n, sum(len(r.get("props", [])) for r in rooms.values()),
        sum(1 for r in rooms.values() for p in r.get("props", []) if p["type"] == "glb")))


if __name__ == "__main__":
    build()
