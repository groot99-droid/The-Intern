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


# ---------------------------------------------------------------------------
# The continuous building. A room joins the next only through a DOORWAY
# cut out of its shell (door()); a threshold the player can walk to is a
# ZONE (zone()); a room is entered through the doorway named by `entry`.
# src/world/world.js lines rooms up door to door through CONNECTORS (the
# CN_* records below): corridors, stairs and ramps down, the vestibule, the
# chute. scenes.json names which zone is which choice and which door it
# opens; this file only says where things are.
# ---------------------------------------------------------------------------

WALL_T = 0.3  # room.js


def door(rec, name, wall, x=0.0, w=1.2, h=2.2, kind="door", y=None, **kw):
    """A doorway on `wall` ('N','S','E','W'), centred `x` along it (the x
    coordinate on N/S walls, z on E/W), `w` x `h`, sill at `y` (default the
    floor). kind: door | glass | curtain | shutter | slide | open."""
    d = {"name": name, "wall": wall, "x": round(x, 3), "w": w, "h": h, "kind": kind}
    if y is not None:
        d["y"] = round(y, 3)
    d.update(kw)
    rec.setdefault("doors", []).append(d)
    return d


def zone(rec, name, pos, r=0.7, ring=3.0, label_at=None, **kw):
    """A threshold zone: `pos` [x, z] (or [x, y, z] underwater), inner radius
    `r` (stepping in commits), approach `ring` (the label fades in). Or
    box=[[x0, z0], [x1, z1]] for a stretch (the row of chairs)."""
    z = {"name": name, "pos": r3(pos), "r": r, "ring": ring}
    if label_at:
        z["labelAt"] = r3(label_at)
    z.update(kw)
    rec.setdefault("zones", []).append(z)
    return z


def anchor(rec, name, pos, yaw=0, vertical=False):
    a = {"pos": r3(pos), "yaw": yaw}
    if vertical:
        a["vertical"] = True
    rec.setdefault("anchors", {})[name] = a


def drop_props(rec, pred):
    rec["props"] = [p for p in rec["props"] if not pred(p)]


# Connector styles: floor, wall, ceiling, lamp colour, footstep.
CN_STYLE = {
    "office":  {"floor": "carpet", "wall": "plaster_dark", "ceiling": "ceiling_tile", "lamp": "#e6eaf2", "lamp_i": 3.2, "skirt": "plaster_dark"},
    "service": {"floor": "concrete_wet", "wall": "cinderblock", "ceiling": "concrete", "lamp": "#dfe6dc", "lamp_i": 2.6, "skirt": "paint_green"},
    "home":    {"floor": "carpet", "wall": "plaster_dark", "ceiling": "plaster_dark", "lamp": "#ffd9a0", "lamp_i": 2.4, "skirt": "plaster_dark"},
    "marble":  {"floor": "marble", "wall": "plaster_dark", "ceiling": "plaster_dark", "lamp": "#fff1dc", "lamp_i": 4.0, "skirt": "marble"},
    "garage":  {"floor": "garage_floor", "wall": "concrete", "ceiling": "concrete", "lamp": "#ffa040", "lamp_i": 10, "skirt": "paint_green"},
}


def _connector(name, style, size, floor_y=0.0, entry_kind="door", entry_w=1.2, entry_h=2.2, exit_w=1.2, exit_h=2.2, exit_y=None):
    st = CN_STYLE[style]
    W, H, D = size
    rec = {
        "name": name,
        "connector": True,
        "size": [W, H, D],
        "floorY": floor_y,
        "floor": st["floor"], "wall": st["wall"], "ceiling": st["ceiling"],
        "tile": {"floor": 1.5, "wall": 1.6, "ceiling": 1.5},
        "skirt": {"mat": st["skirt"], "h": 0.12, "t": 0.02},
        "ambient": {"color": st["lamp"], "intensity": 0.05},
        "sun": {"intensity": 0},
        "lights": [],
        "fog": {"color": "#050505", "near": 6, "far": 24},
        "props": [],
        "boxes": [],
        "spawn": [0, D / 2 - 0.8, 0],
        "entry": "entry",
    }
    # the seal: a leaf on the way in that stands open until the player is
    # through, then shuts behind him (world.js); the far end is a bare
    # opening -- the next room's own entry leaf closes it
    door(rec, "entry", "S", 0.0, w=entry_w, h=entry_h, kind=entry_kind, y=0.0, open=True, hinge="L", sill=st["floor"])
    door(rec, "exit", "N", 0.0, w=exit_w, h=exit_h, kind="open", y=floor_y if exit_y is None else exit_y, sill=st["floor"])
    rec["shots"] = {"in": pose([0, EYE, D / 2 - 0.8], [0, EYE - 0.2, -D / 2])}
    return rec


def cn_corridor(name, style, length=6.0, width=1.8, height=2.6):
    rec = _connector(name, style, [width, height, length])
    st = CN_STYLE[style]
    for z in (length / 4, -length / 4):
        rec["props"].append(prop("fluoro", [0, height - 0.06, z], w=1.0, d=0.25))
        rec["lights"].append({"type": "point", "pos": [0, height - 0.3, z], "color": st["lamp"], "intensity": st["lamp_i"], "distance": 7})
    return rec


def cn_stairs(name, style, drop=3.0, width=1.6, height=2.6, rise=0.2, tread=0.3, landing=1.2):
    """A straight flight down toward -z: a top landing at y 0, treads, a
    bottom landing at -drop. Treads are floors (controls.js eases over them)."""
    n = int(round(drop / rise))
    run = n * tread
    D = landing * 2 + run
    rec = _connector(name, style, [width, height, D], floor_y=-drop)
    st = CN_STYLE[style]
    top = D / 2
    rec["boxes"].append({"min": [-width / 2, -drop, top - landing], "max": [width / 2, 0, top], "mat": st["floor"], "floor": True, "tile": 1.5})
    for k in range(1, n + 1):
        z1 = top - landing - (k - 1) * tread
        z0 = z1 - tread
        y = -k * rise
        rec["boxes"].append({"min": [-width / 2, -drop, round(z0, 3)], "max": [width / 2, round(y, 3), round(z1, 3)], "mat": "concrete" if style != "home" else "carpet", "floor": True, "tile": 1.0})
    rec["props"].append(prop("fluoro", [0, height - 0.06, top - landing / 2], w=0.8, d=0.2))
    rec["lights"].append({"type": "point", "pos": [0, height - 0.4, top - landing / 2], "color": st["lamp"], "intensity": st["lamp_i"], "distance": 8})
    rec["lights"].append({"type": "point", "pos": [0, height - 0.4, -top + landing / 2], "color": st["lamp"], "intensity": st["lamp_i"], "distance": 9})
    rec["props"].append(prop("fluoro", [0, height - 0.06, -top + landing / 2], w=0.8, d=0.2))
    rec["drop"] = drop
    return rec


def cn_ramp(name, style, drop=2.5, length=12.0, width=6.0, height=3.4):
    rec = _connector(name, style, [width, height, length], floor_y=-drop, entry_kind="shutter", entry_w=4.0, entry_h=2.8, exit_w=4.0, exit_h=2.8)
    st = CN_STYLE[style]
    run = length - 2.0
    slope = math.degrees(math.atan2(drop, run))
    hyp = math.hypot(run, drop)
    # the slab: a box `hyp` long, tilted about its centre
    cy = -drop / 2 - 0.1
    rec["boxes"].append({"min": [-width / 2, cy - 0.1, -hyp / 2], "max": [width / 2, cy + 0.1, hyp / 2], "pitch": round(-slope, 3), "mat": st["floor"], "floor": True, "tile": 3.0})
    rec["boxes"].append({"min": [-width / 2, -drop, -length / 2], "max": [width / 2, -drop + 0.0001, -length / 2 + 1.0], "mat": st["floor"], "floor": True, "tile": 3.0})
    rec["boxes"].append({"min": [-width / 2, -0.2, length / 2 - 1.0], "max": [width / 2, 0, length / 2], "mat": st["floor"], "floor": True, "tile": 3.0})
    for z in (length / 3, 0, -length / 3):
        rec["props"].append(prop("sodium", [0, height - 0.74, z]))
        rec["lights"].append({"type": "point", "pos": [0, height - 1.15, z], "color": st["lamp"], "intensity": st["lamp_i"], "distance": 14, "flicker": 0.2})
    rec["drop"] = drop
    return rec


def cn_vestibule():
    """Between the street and the lobby: a marble airlock, glass at both ends."""
    rec = _connector("THE VESTIBULE", "marble", [3.6, 3.4, 3.2], entry_kind="glass", entry_w=2.6, entry_h=2.9, exit_w=2.6, exit_h=2.9)
    rec["props"].append(prop("pendant", [0, 3.4, 0], drop=0.6))
    rec["lights"].append({"type": "point", "pos": [0, 2.6, 0], "color": "#fff1dc", "intensity": 7, "distance": 7})
    return rec


def cn_chute():
    """Under the dive's grate: a dry concrete chute, steep, into the store."""
    W, H, D = 1.6, 1.8, 10.0
    drop = 6.0
    rec = _connector("THE CHUTE", "service", [W, H, D], floor_y=-drop, entry_kind="open", entry_w=1.2, entry_h=1.4, exit_w=1.2, exit_h=1.2)
    slope = math.degrees(math.atan2(drop, D - 1.0))
    hyp = math.hypot(D - 1.0, drop)
    rec["boxes"].append({"min": [-W / 2, -drop / 2 - 0.2, -hyp / 2], "max": [W / 2, -drop / 2, hyp / 2], "pitch": round(-slope, 3), "mat": "concrete", "floor": True, "tile": 1.0})
    rec["lights"].append({"type": "point", "pos": [0, -drop + 1.2, -D / 2 + 1.0], "color": "#f0f4ff", "intensity": 3, "distance": 5})
    # entered from above: the grate drops the candidate in at the top
    anchor(rec, "top", [0, 0.6, D / 2 - 0.6], 0, vertical=True)
    rec["entry"] = "top"
    rec["drop"] = drop
    return rec


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
    # The lobby's doorways: the glass doors from the street (they close
    # behind the candidate and the drone begins, C7), the inner door beside
    # the counter that buzzes open when he answers the call, and a service
    # door by the entrance that opens when he runs for the locked glass.
    door(rec, "front", "S", 0.0, w=2.6, h=2.9, kind="glass", locked=True)
    door(rec, "inner", "N", 5.6, w=1.1, h=2.2, kind="door", locked=True, mat="lp_beige", hinge="R")
    door(rec, "service", "S", -4.6, w=1.0, h=2.1, kind="door", locked=True, mat="lp_grey")
    rec["entry"] = "front"
    # S1: TAKE A SEAT (either row of chairs) / STAY STANDING (at the counter)
    zone(rec, "seat_w", [-4.3, -0.5], box=[[-4.75, -3.3], [-3.85, 2.3]], ring=2.2, label_at=[-4.6, 1.5, -0.5])
    zone(rec, "seat_e", [4.3, -0.5], box=[[3.85, -3.3], [4.75, 2.3]], ring=2.2, label_at=[4.6, 1.5, -0.5])
    zone(rec, "counter", [-1.3, -3.95], r=0.65, ring=3.0, label_at=[-1.3, 1.75, -4.7])
    # S2: STAND (the inner door) / RUN (back to the glass doors)
    zone(rec, "inner_door", [5.6, -5.15], r=0.6, ring=3.0, label_at=[5.6, 2.55, -5.9])
    zone(rec, "front_doors", [0.0, 4.95], r=0.75, ring=3.2, label_at=[0.0, 3.2, 5.9])
    return rec


def threshold_corridor():
    W, H, D = 4.2, 3.4, 14.0
    props = [
        prop("sign", [0, 3.12, -D / 2 + 0.06], w=1.0, h=0.28, name="enter_sign"),
        prop("badgereader", [W / 2 - 0.04, 1.25, -4.6], rot=-90),
        prop("clock", [-W / 2 + 0.03, 2.4, 2.0], rot=90),
        prop("slip", [0.9, 0.004, -3.2], rot=25),
        glb("lib_camera", [W / 2 - 0.2, 2.9, -3.0], rot=-135, fallback=None),
    ]
    lights = [
        {"type": "point", "pos": [0, H - 0.3, 3.5], "color": "#ffdfb8", "intensity": 14, "distance": 12},
        {"type": "point", "pos": [0, H - 0.3, -1.0], "color": "#ffdfb8", "intensity": 14, "distance": 12},
        # the ENTER sign's green, on its 2.3 s cycle (Doc 1 S3)
        {"type": "point", "pos": [0, 2.9, -D / 2 + 0.6], "color": "#33ff77", "intensity": 9, "distance": 6, "pattern": {"period": 2.3, "duty": 0.86, "low": 0.1}},
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
    # Both thresholds in the one corridor: the curtain under the ENTER sign
    # ahead, the lobby's locked glass doors behind. The candidate comes in
    # by a side door; a service door opposite opens when the glass refuses.
    door(rec, "curtain", "N", 0.0, w=2.4, h=2.9, kind="curtain", locked=True)
    door(rec, "glass", "S", 0.0, w=2.4, h=2.8, kind="glass", locked=True)
    door(rec, "side", "E", 4.6, w=1.2, h=2.2, kind="door", mat="lp_beige", hinge="R")
    door(rec, "service", "W", 4.0, w=1.0, h=2.1, kind="door", locked=True, mat="lp_grey")
    rec["entry"] = "side"
    zone(rec, "curtain", [0.0, -5.95], r=0.7, ring=3.2, label_at=[0.0, 2.55, -6.8])
    zone(rec, "glass", [0.0, 6.0], r=0.7, ring=2.4, label_at=[0.0, 2.45, 6.85])
    return rec


def lobby_doors():
    rec = waiting_room(False)
    rec["name"] = "THE LOBBY DOORS"
    W, H, D = rec["size"]
    rec["props"].append(prop("placard", [2.2, 1.5, D / 2 - 0.02], rot=180))
    # the curtain is here too, at the far end, where the clock was
    for p in rec["props"]:
        if p["type"] == "clock":
            p["pos"] = [-2.9, 2.9, -D / 2 + 0.02]
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
    # TRY THE DOOR is the lobby's own glass (front); PART THE CURTAIN is a
    # curtain doorway in the far corner. In by a side door from the call.
    door(rec, "curtain", "N", -5.6, w=2.0, h=2.9, kind="curtain", locked=True)
    door(rec, "side", "E", 3.0, w=1.2, h=2.2, kind="door", mat="lp_beige", hinge="R")
    rec["entry"] = "side"
    zone(rec, "glass", [0.0, 4.95], r=0.75, ring=3.0, label_at=[0.0, 3.2, 5.9])
    zone(rec, "curtain", [-5.6, -4.95], r=0.7, ring=3.0, label_at=[-5.6, 2.6, -5.85])
    return rec


def cubicle_floor():
    W, H, D = 26.0, 3.0, 36.0
    props = []
    # Two banks either side of a 2.2 m aisle; rows every 2.4 m; each
    # workstation = back partition + side partition + desk + CRT + chair.
    z = -D / 2 + 2.0
    row = 0
    while z < D / 2 - 2.6:
        if abs(z - 3.2) < 0.01:
            # the cross-aisle: one row left out, so the side door can be walked to
            z += 2.4
            row += 1
            continue
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
    props.append(prop("clock", [4.0, 2.4, -D / 2 + 0.02]))
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
        "actors": {"manager": {"path": [[0, -9.0], [0, 6.0]], "carry": ["evidence"]}},
    }
    rec["shots"] = shots_for(rec, out_dist=3.0, leave_dist=13.0, loop_seconds=24.0)
    door(rec, "front", "S", 0.0, w=1.4, h=2.3, kind="door", mat="lp_beige")
    door(rec, "back", "N", 0.0, w=1.4, h=2.3, kind="door", locked=True, mat="lp_beige")
    door(rec, "side", "E", 3.9, w=1.0, h=2.2, kind="door", locked=True, mat="lp_grey")
    rec["entry"] = "front"
    # TAKE THE PAPERS: the zone walks with the manager as he comes up the aisle
    zone(rec, "manager", [0.0, -8.1], r=0.85, ring=3.5, actor="manager", offset=[0.0, 0.9], label_at=[0.0, 2.25, -9.0])
    zone(rec, "side_door", [12.0, 3.9], r=0.6, ring=3.0, label_at=[12.9, 2.5, 3.9])
    return rec


def utility_corridor():
    W, H, D = 3.2, 3.0, 36.0
    props = []
    z = -D / 2 + 3.0
    i = 0
    while z < D / 2 - 2.0:
        if abs(z + 6.0) > 0.01:  # z -6 west is the real, ajar door (below)
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
    door(rec, "front", "S", 0.0, w=1.2, h=2.2, kind="door", mat="lp_grey")
    door(rec, "far", "N", 0.0, w=1.2, h=2.2, kind="door", locked=True, mat="lp_grey")
    # one door ajar among the identical ones (Harlowe's)
    door(rec, "ajar", "W", -6.0, w=0.9, h=2.1, kind="door", locked=True, ajar=0.22, mat="lp_beige", hinge="L")
    rec["entry"] = "front"
    zone(rec, "far_end", [0.0, -15.0], r=0.75, ring=4.0, label_at=[0.0, 2.3, -16.6])
    zone(rec, "ajar", [-0.85, -6.0], r=0.55, ring=2.6, label_at=[-1.4, 2.35, -6.0])
    return rec


def desk_void(monitor_on=False):
    """S5-C / S6-C (Doc 1 §5, Doc 2 S5_C): one unmarked desk alone in the
    middle of a dark open floor, lit by a single overhead troffer whose
    light gives out four metres from it. Carpet tile, a low ceiling, the
    building's columns standing off in the dark. Low-poly: the desk, the
    dark CRT, a heavy stapler, a chair, papers -- and at the pool's edge a
    second desk whose terminal is still logged in as S. HARLOWE.

    S5 STAPLE is the chair (the stapler under the label); WAKE THE TERMINAL
    is Harlowe's desk, which wakes as he comes near. Either way the scene
    carries on as S6 in the same room: the terminal wakes with the
    requisition on it and two lamps come on in the dark -- a green one on
    the pneumatic tube station (ORDER, west: the freight doors behind it
    open onto the way down) and a red one on the call box (FLAG, east: four
    rejections, then the service door behind it unlatches).
    The compliant things stand west of the desk, the resisting ones east."""
    W, H, D = 24.0, 3.0, 24.0
    props = [
        prop("desk", [0, 0, 0], w=1.7, d=0.85),
        # The terminal: its screen quad is what S6 C's requisition is drawn on
        # (screens.js draws into the prop named `terminal`).
        prop("monitor", [0.32, 0.75, -0.17], on=monitor_on, name="terminal"),
        prop("keyboard", [0.3, 0.75, 0.14]),
        glb("lib_chair_wood", [0, 0, 0.85], rot=180, fallback="chair"),
        prop("staplerheavy", [-0.46, 0.75, 0.06], rot=18, name="stapler"),
        prop("papers", [-0.12, 0.75, 0.08], h=0.07),
        prop("papers", [-0.6, 0.75, -0.22], rot=9, h=0.025),
        prop("slip", [0.55, 0.004, 1.4], rot=70),
        # the troffer and the dust standing in its light
        prop("fluoro", [0, H - 0.05, 0.1], w=1.2, d=0.6, name="troffer"),
        prop("troffbeam", [0, 0, 0.1], h=H - 0.12, r0=0.55, r1=3.2, opacity=0.045),
        # the building's columns, standing off in the dark on a 7.2 m grid
        prop("pillar", [-7.2, 0, -7.2], w=0.6, h=H, mat="plaster_dark", cap=False, tile=1.2),
        prop("pillar", [7.2, 0, -7.2], w=0.6, h=H, mat="plaster_dark", cap=False, tile=1.2),
        prop("pillar", [-7.2, 0, 7.2], w=0.6, h=H, mat="plaster_dark", cap=False, tile=1.2),
        prop("pillar", [7.2, 0, 7.2], w=0.6, h=H, mat="plaster_dark", cap=False, tile=1.2),
        prop("clock", [-7.2, 2.15, -7.2 + 0.32]),  # C8: the same clock, on the column off the desk's left shoulder
        # S5: a second terminal at the edge of the light, still logged in (S. HARLOWE);
        # its chair pushed out the way S4's empty chair was (Track C motif 3)
        prop("desk", [3.7, 0, -2.25], w=1.2, d=0.7, mat="lp_grey"),
        prop("monitor", [3.75, 0.75, -2.4], on=False, name="harlowe"),
        prop("lampdot", [3.89, 0.87, -2.21], mat="lp_sodium", r=0.008, name="harlowe_led"),  # standby
        prop("keyboard", [3.7, 0.75, -2.02], rot=-6),
        prop("papers", [3.32, 0.75, -2.15], rot=-14, h=0.012),
        prop("mug", [4.16, 0.75, -2.08]),
        glb("lib_chair_wood", [4.55, 0, -1.35], rot=220, fallback="chair"),
        # S6: where a requisition goes (ORDER) and where it is objected to (FLAG).
        # Both stand dark through S5; their lamps (lampdot) come on with S6.
        prop("tubeorder", [-3.8, 0, -3.0], rot=52, h=H, name="tube"),
        prop("canister", [-3.8, 0, -3.0], rot=52, name="canister"),
        prop("lampdot", [-3.8, 0, -3.0], rot=52, at=[0.21, 1.335, 0.255], mat="lp_sign", r=0.042, hidden=True, name="tube_lamp"),
        prop("callbox", [4.6, 0, 3.0], rot=-123, name="flagbox"),
        prop("lampdot", [4.6, 0, 3.0], rot=-123, at=[-0.1, 1.64, 0.1], mat="lp_taillight", r=0.04, hidden=True, name="flag_lamp"),
    ]
    lights = [
        # the troffer: one pool, steady, soft-edged, gone four metres out
        {"type": "spot", "pos": [0, H - 0.12, 0.1], "target": [0, 0, 0.05], "color": "#fff0d8", "intensity": 40, "distance": 10, "angle": 58, "penumbra": 0.6},
        # the fixture's own spill on the ceiling tiles round it
        {"type": "point", "pos": [0, H - 0.45, 0.1], "color": "#fff0d8", "intensity": 1.1, "distance": 3.0},
        {"type": "point", "pos": [0.32, 1.15, 0.25], "color": "#7ad9a0", "intensity": 3, "distance": 3.5, "id": "terminal_glow", "off": not monitor_on},
        {"type": "point", "pos": [3.75, 1.15, -1.9], "color": "#8fb0d8", "intensity": 2.6, "distance": 3.5, "id": "harlowe_glow", "off": True},
        {"type": "point", "pos": [-3.4, 1.55, -2.85], "color": "#33ff77", "intensity": 1.8, "distance": 4.5, "id": "tube_lamp", "off": True},
        {"type": "point", "pos": [4.35, 1.75, 2.85], "color": "#ff3a2a", "intensity": 1.7, "distance": 5.0, "id": "flag_lamp", "off": True},
    ]
    rec = {
        "name": "THE REQUISITION" if monitor_on else "THE DESK",
        "size": [W, H, D],
        "floor": "carpet", "wall": "void", "ceiling": "ceiling_tile",
        "tile": {"floor": 2.0, "wall": 8.0, "ceiling": 1.2},
        "ambient": {"color": "#d8d4cc", "intensity": 0.05},
        # C2's shadow caster only: barely there, so the troffer is the light
        "sun": {"from": [1.0, 6.0, 6.0], "color": "#ffe7c4", "intensity": 0.12},
        "lights": lights,
        # the darkness comes from the light, not the fog
        "fog": {"color": "#000000", "near": 7, "far": 22},
        "exposure": 1.1,
        "vignette": 0.72,
        "grain": 0.035,
        "spawn": [0, D / 2 - 1.3, 0],
        "props": props,
        "boxes": [],
        "footstep": {"filterHz": 380, "gain": 0.06},
    }
    rec["shots"] = shots_for(rec, out_dist=3.0, leave_dist=9.0, loop_seconds=16.0)
    # Preview poses (test/rooms.html): the desk from the chair, the screen over the shoulder.
    rec["shots"]["desk"] = pose([0, 1.15, 1.0], [0.2, 0.85, -0.6])
    rec["shots"]["screen"] = pose([0.3, 1.3, 0.95], [0.32, 0.98, -0.2])
    rec["shots"]["harlowe"] = pose([3.75, 1.35, -1.15], [3.75, 1.0, -2.4])
    if monitor_on:
        rec["shots"]["in"] = rec["shots"]["screen"]
        rec["shots"]["out"] = pose([0.3, 1.4, 1.2], [0.32, 0.95, -0.2])
        rec["shots"]["loop"]["sway"] = 0.012
    door(rec, "front", "S", 0.0, w=1.2, h=2.2, kind="door", mat="lp_dark")
    # ORDER: freight doors in the north wall, nine metres behind the tube station
    door(rec, "freight", "N", -3.8, w=1.6, h=2.3, kind="slide", locked=True, mat="rust", frame="lp_dark")
    # FLAG: a plain service door in the east wall behind the call box
    door(rec, "service", "E", 3.0, w=1.0, h=2.1, kind="door", locked=True, mat="lp_grey")
    rec["entry"] = "front"
    # S5: STAPLE at the chair (the label over the stapler) / WAKE THE TERMINAL
    # at Harlowe's desk (coming near it wakes the screen: scenes.json `approach`)
    zone(rec, "desk", [0.0, 1.05], r=0.5, ring=2.6, label_at=[-0.46, 1.2, 0.06])
    zone(rec, "terminal", [3.7, -1.25], r=0.5, ring=2.6, label_at=[3.75, 1.5, -2.4])
    # S6: ORDER at the tube station / FLAG at the call box; READ (no label, never
    # commits) sits him back down in front of the requisition
    zone(rec, "tube", [-3.17, -2.5], r=0.5, ring=2.6, label_at=[-3.8, 2.25, -3.0])
    zone(rec, "flagbox", [3.97, 2.59], r=0.5, ring=2.6, label_at=[4.6, 2.05, 3.0])
    zone(rec, "read", [0.0, 1.05], r=0.5, ring=2.0, label_at=[0.32, 1.45, -0.17])
    return rec


def garage(depth=44.0, open_north=False):
    """S5-H's parking level and, one level down, S6-H's run and its edge
    (Doc 1 §5, Doc 2 S5_H / S6_H / S7_H). Photoreal: raw concrete, the
    sodium light's orange, oil stains, worn bay paint, haze. Low-poly:
    rusted cars, the boom, the bench, the rail.

    S5 H (open_north False): four rusted cars, no two the same model, none
    from the same decade, two with a door hanging open; a fifth -- the
    nearest one's model again -- parked in the far bay, hidden until he
    rests. REST is the kerb island mid-left under the centre sodium; TAKE
    THE SIDE DOOR is the unmarked steel door in the far right corner under
    the only caged lamp. The ramp shutter at the north end (behind the boom)
    is the way on after REST; the side door's stairwell after the door.

    S6 H / S7 H (open_north True): the garage that does not end -- the same
    pillar, the same four cars, the same stain in every bay -- and at its
    end the concrete stops: below is the pool, water to the horizon, white
    tiled pillars, no ceiling, no far wall. The room is BUILT LIT (the edge,
    for S7 H however it is entered); S6 H's onEnter turns the pool lights
    off (id `pool`), so the run ends in black, and either S6 threshold turns
    them back on: that is the reveal. PUSH ON is the aisle running on into
    the dark; STOP is the lit bench at the stop line, one metre short of the
    lip. S7 H: JUMP is the gap in the guard rail, TURN BACK arms once he has
    stood at the lip (edge_approach) and is the strip back by the pillars."""
    W, H = 32.0, 3.4
    if open_north:
        # The run needs its length: 45 m of identical bays (17 s at a walk)
        # before the end. build() still asks for 24 m; the run overrides it.
        depth = max(depth, 48.0)
    D = depth
    props = []
    lights = []
    boxes = []
    beam_every = 8.0
    z0 = -D / 2 + 4.0
    zs = []
    z = z0
    while z < D / 2:
        zs.append(z)
        z += beam_every
    bay_z = [zz + beam_every / 2 for zz in zs if zz + beam_every / 2 < D / 2 - 1.0]
    for x in (-12, -4, 4, 12):
        for zz in zs:
            props.append(prop("pillar", [x, 0, zz], w=0.7, h=H, band="paint_green", bandH=1.1, tile=1.5))
            if abs(x) == 4:
                # the same wordless plate on the aisle face of every column (Doc 2: "columns' painted numbers")
                props.append(prop("wallplate", [x - math.copysign(0.366, x), 1.75, zz], rot=90, w=0.42, h=0.3, mat="lp_red"))
    for zz in zs[::2]:
        for x in (-12, 12):
            props.append(prop("wallplate", [x + (0.366 if x < 0 else -0.366), 1.9, zz], rot=90, w=0.6, h=0.4))
    # Low-poly cars from the catalog, brought up to size (the models are
    # ~3 m long); the box fallback is sized so it scales to the same car.
    CAR_SCALE = 1.45

    def car(node, x, zc, rot, mat, ajar=None, **kw):
        kw.setdefault("collide", True)
        props.append(glb(node, [x, 0, zc], rot=rot, fallback="car", mat=mat, scale=CAR_SCALE,
                         len=round(4.4 / CAR_SCALE, 2), w=round(1.8 / CAR_SCALE, 2), rust=0.6, **kw))
        if ajar:
            # a door hanging open (the catalog model is one mesh; its nose is +z at
            # rot 0): hinged at the front of the flank facing the aisle (-x for a car
            # east of it), swung out; `ajar` is the door's colour
            fwd = math.radians(rot)
            side = -1.0 if x > 0 else 1.0
            hx = x + side * 0.82 * math.cos(fwd) + 0.42 * math.sin(fwd)
            hz = zc - side * 0.82 * math.sin(fwd) + 0.42 * math.cos(fwd)
            # `tint`: the panel takes the colour the catalog car's body gets from `mat`
            props.append(prop("cardoor", [hx, 0, hz], rot=rot + 180, mat=ajar, tint=mat, len=1.1, h=0.46, y=0.3, angle=-42 * side, window=node != "lib_car_cruiser"))

    def stain(x0, z0_, x1, z1):
        # a soft wet blotch (props.js oilstain), not a rectangle
        n = len([p for p in props if p["type"] == "oilstain"])
        props.append(prop("oilstain", [(x0 + x1) / 2, 0, (z0_ + z1) / 2], rot=(n * 67) % 180, w=round((x1 - x0) * 1.5, 2), d=round((z1 - z0_) * 1.5, 2), seed=n))

    rec = {
        "name": "THE GARAGE",
        "size": [W, H, D],
        "floor": "garage_floor", "wall": "concrete", "ceiling": "concrete",
        "tile": {"floor": 3.0, "wall": 2.5, "ceiling": 2.5},
        "skirt": {"mat": "paint_green", "h": 1.1, "t": 0.02, "tile": 2.5},
        "beams": {"axis": "x", "every": beam_every, "offset": 4.0, "w": 0.7, "h": 0.7, "mat": "concrete", "tile": 2.5},
        "ambient": {"color": "#ffb060", "intensity": 0.15},
        "sun": {"from": [3.0, 5.0, D * 0.55], "color": "#ffb86a", "intensity": 0.35},
        "lights": lights,
        # a real haze of exhaust that has nowhere to go
        "fog": {"color": "#1d1209", "near": 5, "far": 44},
        "exposure": 1.05,
        "vignette": 0.6,
        "grain": 0.03,
        "spawn": [0, D / 2 - 3.0, 0],
        "props": props,
        "boxes": boxes,
        "footstep": {"filterHz": 800, "gain": 0.1},
    }

    if not open_north:
        # ---- S5 H: the parking level -------------------------------------
        for i, bz in enumerate(bay_z):
            for x in (-8, 8):
                props.append(prop("sodium", [x, H - 0.74, bz]))
                lights.append({"type": "point", "pos": [x, H - 1.15, bz], "color": "#ffa040", "intensity": 40, "distance": 22, "flicker": 0.12 if (i + (x > 0)) % 2 else 0.06})
        for bz in bay_z[::2]:
            props.append(prop("sodium", [0, H - 0.74, bz]))
            far = bz == bay_z[0]
            # one at the far end strobes irregularly (Doc 2 S5_H)
            l = {"type": "point", "pos": [0, H - 1.15, bz], "color": "#ffb060", "intensity": 24, "distance": 18, "flicker": 0.9 if far else 0.08}
            if far:
                l["pattern"] = {"period": 2.9, "duty": 0.7, "low": 0.08}
            lights.append(l)
        # four cars, no two the same model, four decades; two doors ajar
        car("lib_car_cruiser", 7.4, 10.0, 2.0, "lp_car4", ajar="lp_beige")    # the fifties
        car("lib_car_pastel", -7.4, -6.0, 178.0, "lp_car3")             # the eighties: nearest the kerb
        car("lib_car_sedan", 7.4, -14.0, -4.0, "lp_car", ajar="lp_dark")     # the two-thousands
        car("lib_car_suv", -12.6, 10.0, 181.0, "lp_car2")               # the twenty-tens
        # the fifth: the nearest one's model again, in the far bay, there when he looks up from the kerb
        # (no collider: hidden, it must not stand invisible in the way to the side door)
        car("lib_car_pastel", 12.6, -14.2, 4.0, "lp_car3", hidden=True, name="fifth_car", collide=False)
        for (x0, z0_, x1, z1) in ((6.9, 9.3, 7.9, 10.4), (-7.9, -6.6, -6.9, -5.5), (6.9, -14.6, 7.8, -13.6), (-11.8, -0.6, -11.1, 0.1), (10.6, 1.8, 11.5, 2.6), (12.1, -14.9, 12.9, -13.9)):
            stain(x0, z0_, x1, z1)
        # REST: a kerb island along the pillar line, its aisle edge worn white
        boxes.append({"min": [-4.55, 0, -1.4], "max": [-3.45, 0.15, 5.4], "mat": "concrete", "floor": True, "tile": 1.5})
        boxes.append({"min": [-3.53, 0.15, -1.4], "max": [-3.45, 0.152, 5.4], "mat": "plaster_blown", "collide": False, "shadow": False})
        props.append(prop("slip", [-2.55, 0.004, 1.35], rot=100))
        props.append(prop("clock", [-W / 2 + 0.03, 2.4, D / 2 - 6.0], rot=90))  # C8: the same clock, on the west wall
        # THE SIDE DOOR: far right corner, a kerb landing, the only caged lamp, no signage
        boxes.append({"min": [14.7, 0, -21.2], "max": [16.0, 0.15, -17.8], "mat": "paint_green", "floor": True, "tile": 1.5})
        props.append(glb("lib_cagelamp", [15.78, 2.5, -19.5], rot=90, fallback=None))
        lights.append({"type": "point", "pos": [15.3, 2.35, -19.5], "color": "#ffd9a8", "intensity": 6, "distance": 7})
        # THE RAMP: a shutter in the north wall behind a boom barrier; arrows worn into the floor
        props.append(prop("boom", [-2.75, 0, -20.4], len=5.2, name="boom_down"))
        props.append(prop("boom", [-2.75, 0, -20.4], len=5.2, up=True, hidden=True, name="boom_up"))
        for zz in (-12.6, -4.6):
            boxes.append({"min": [-0.12, 0.001, zz], "max": [0.12, 0.004, zz + 1.6], "mat": "plaster_blown", "collide": False, "shadow": False})
            boxes.append({"min": [-0.45, 0.001, zz - 0.3], "max": [0.45, 0.004, zz], "mat": "plaster_blown", "collide": False, "shadow": False})
            boxes.append({"min": [-0.25, 0.001, zz - 0.55], "max": [0.25, 0.004, zz - 0.3], "mat": "plaster_blown", "collide": False, "shadow": False})
        rec["shots"] = shots_for(rec, out_dist=4.0, leave_dist=D - 6.0, loop_seconds=30.0)
        rec["shots"]["kerb"] = pose([-3.15, 0.95, 2.0], [-8.0, 0.7, -12.0])
        rec["shots"]["side"] = pose([10.5, 1.6, -13.0], [16.0, 1.4, -19.5])
        rec["shots"]["cruiser"] = pose([4.6, 1.5, 13.8], [7.4, 0.6, 10.0])
        door(rec, "front", "S", 0.0, w=1.4, h=2.3, kind="door", mat="lp_grey")
        door(rec, "stairs", "E", -19.5, w=1.1, h=2.2, kind="door", locked=True, mat="lp_grey")
        door(rec, "ramp", "N", 0.0, w=4.0, h=2.8, kind="shutter", locked=True, mat="lp_grey")
        rec["entry"] = "front"
        zone(rec, "curb", [-3.1, 2.0], r=0.55, ring=2.6, label_at=[-3.7, 1.2, 2.0])
        zone(rec, "stairs", [15.1, -19.5], r=0.55, ring=2.8, label_at=[15.75, 2.45, -19.5])
        return rec

    # ---- S6 H / S7 H: the run, and the edge -----------------------------------
    edge = -D / 2
    rec["name"] = "THE EDGE"
    rec["open"] = ["N"]
    for i, bz in enumerate(bay_z):
        last = bz == bay_z[0]
        for x in (-8, 8):
            props.append(prop("sodium", [x, H - 0.74, bz]))
            # the last row reaches no further than the lip: past it the pool is
            # pale and blue, and its pillars must not catch the garage's orange
            lights.append({"type": "point", "pos": [x, H - 1.15, bz], "color": "#ffa040", "intensity": 36, "distance": 12 if last else 20, "flicker": 0.6 if last else 0.08})
    # the same four cars, at the same offsets, in every bay; the same stain
    for bz in bay_z:
        car("lib_car_suv", -12.6, bz, 181.0, "lp_car2")
        car("lib_car_pastel", -7.4, bz, 178.0, "lp_car3")
        car("lib_car_cruiser", 7.4, bz, 2.0, "lp_car4", ajar="lp_beige")
        car("lib_car_sedan", 12.6, bz, -4.0, "lp_car", ajar="lp_dark")
        stain(4.75, bz - 1.3, 5.95, bz - 0.3)  # in the aisle's edge, where it is seen
    # an arrow worn into the aisle in the last bay, pointing on into the dark
    zz = bay_z[0] + 1.2
    boxes.append({"min": [-0.12, 0.001, zz], "max": [0.12, 0.004, zz + 1.8], "mat": "plaster_blown", "collide": False, "shadow": False})
    boxes.append({"min": [-0.45, 0.001, zz - 0.3], "max": [0.45, 0.004, zz], "mat": "plaster_blown", "collide": False, "shadow": False})
    boxes.append({"min": [-0.25, 0.001, zz - 0.55], "max": [0.25, 0.004, zz - 0.3], "mat": "plaster_blown", "collide": False, "shadow": False})
    props.append(prop("slip", [-5.6, 0.004, edge + 2.4], rot=40))
    props.append(prop("clock", [-W / 2 + 0.03, 2.4, D / 2 - 6.0], rot=90))  # C8
    gap = (-11.4, -4.6)  # THE GAP: where the rail is gone, in front of the bench
    # THE LIP: a raw broken slab edge with rebar (the floor itself stops at
    # `edge`; these hang off it), the pool's tiled wall dropping beneath it
    lip = [(-16.3, -13.9, 0.22, 0.46), (-13.9, -11.2, 0.08, 0.38), (-11.2, -8.6, 0.3, 0.52), (-8.6, -6.1, 0.14, 0.41), (-6.1, -3.0, 0.26, 0.47),
           (-3.0, -1.4, 0.1, 0.36), (-1.4, 1.4, 0.04, 0.3), (1.4, 3.6, 0.18, 0.44), (3.6, 6.8, 0.3, 0.5), (6.8, 9.1, 0.12, 0.4), (9.1, 12.2, 0.24, 0.47), (12.2, 16.3, 0.1, 0.39)]
    for (x0, x1, over, thick) in lip:
        boxes.append({"min": [x0, -thick, edge - over], "max": [x1, -0.004, edge + 0.4], "mat": "concrete", "collide": False, "tile": 2.0})
        boxes.append({"min": [x0, -thick - 0.5, edge - over * 0.6], "max": [x1, -thick, edge + 0.4], "mat": "concrete_wet", "collide": False, "tile": 2.0})
    for i, x in enumerate((-14.6, -10.6, -9.0, -7.4, -5.6, -1.0, 4.5, 9.8, 14.2)):
        props.append(prop("rebar", [x, 0, edge - 0.02], n=5 if gap[0] < x < gap[1] else 3, len=1.6, seed=i))
    # the barrier at the lip is invisible (the fall is always carried); the
    # guard rail stands along it except across THE GAP in front of the bench,
    # where the edge is raw and both torn ends of the rail are bent down
    boxes.append({"min": [-W / 2, 0, edge - 0.4], "max": [W / 2, 1.2, edge - 0.2], "mat": "void", "collide": True, "invisible": True, "shadow": False})
    props.append(prop("guardrail", [-W / 2 + 0.15, 0, edge + 0.22], len=gap[0] - (-W / 2 + 0.15), bend=1.4, h=0.7))
    props.append(prop("guardrail", [W / 2 - 0.15, 0, edge + 0.22], rot=180, len=W / 2 - 0.15 - gap[1], bend=1.4, h=0.7))
    # STOP: the bench at the stop line, one metre short of the lip, under the
    # one steady lamp at the end of the run (light means stop; dark, push on)
    props.append(prop("stopbench", [-8.0, 0, edge + 2.1], rot=180, w=1.8, name="bench"))
    props.append(prop("paintline", [-8.0, 0.001, edge + 1.25], w=7.2, d=0.14, name="stop_line"))
    props.append(prop("sodium", [-8.0, H - 0.74, edge + 2.2]))
    lights.append({"type": "point", "pos": [-8.0, H - 1.15, edge + 2.2], "color": "#ffa040", "intensity": 22, "distance": 9})
    # THE POOL: still water to the horizon, white tiled pillars rising out of
    # it with no ceiling and no far wall; the fog closes it (C3). The surface
    # is clear: the tiled floor three metres down shows through it. One kit
    # (boxkit `poolkit`), so S6 H can hide it for the run and show it again.
    kit = []
    kit.append(["pool_tile", [-W / 2 - 0.3, -7.0, edge - 0.02], [W / 2 + 0.3, -0.9, edge + 0.5], 1.0])  # the pool's wall under the lip
    # the tiled floor (dulled: polished tile threw every lamp back as a hot
    # spot), with a deep well under the gap where the dive is joined when he
    # goes in (the dive room fills it: 12 x 12 below the surface)
    well = (-14.4, -1.6, edge - 12.4)
    dull = {"rough": 0.6}
    for (fx0, fx1, fz0, fz1) in ((-90, well[0], edge - 120, edge - 0.02), (well[1], 90, edge - 120, edge - 0.02), (well[0], well[1], edge - 120, well[2])):
        kit.append(["pool_tile", [fx0, -7.2, fz0], [fx1, -7.0, fz1], 1.0, dull])
    for (wx0, wz0, wx1, wz1) in ((well[0] - 0.2, well[2], well[0], edge), (well[1], well[2], well[1] + 0.2, edge), (well[0], well[2] - 0.2, well[1], well[2])):
        kit.append(["pool_tile", [wx0, -18.9, wz0], [wx1, -7.0, wz1], 1.0, dull])
    # THE WELL'S FLOOR, deep below the gap and seen only from the lip: a
    # rusted grate glowing sick blue (Doc 2 S7_H_IMG_OUT), the one he will
    # go through. Just under where the dive's own grate lands when it is joined.
    kit.append(["pool_tile", [well[0], -18.9, well[2]], [well[1], -18.75, edge], 1.0, dull])
    gx_ = (gap[0] + gap[1]) / 2
    kit.append(["grate", [gx_ - 2.2, -18.76, edge - 8.2], [gx_ + 2.2, -18.7, edge - 3.8], 1.0])
    kit.append(["glow_water", [gx_ - 2.6, -18.69, edge - 8.6], [gx_ + 2.6, -18.66, edge - 3.4], 1.0])
    prnd = random.Random(7)
    for x in range(-30, 31, 12):
        for zz in range(-8, -93, -12):
            jx = prnd.uniform(-0.4, 0.4)
            if well[0] - 1 < x + jx < well[1] + 1 and edge + zz > well[2] - 1:
                continue  # nothing stands in the well
            kit.append(["pool_tile", [round(x + jx - 0.75, 3), -7.0, edge + zz - 0.75], [round(x + jx + 0.75, 3), 40.0, edge + zz + 0.75], 1.0])
    # still, clear water to the horizon (props.js poolwater: clear looking
    # down from the lip, a pale sheet toward the fog), part of the kit
    water = {"y": -3.92, "from": [-90, edge - 120], "to": [90, edge - 0.02]}
    props.append(prop("boxkit", [0, 0, 0], boxes=kit, water=water, name="poolkit"))
    # sourceless pale light over the water (id `pool`: S6 H turns it off for
    # the run); the last one is down the well, on the grate
    for (px, py, pz, col, inten, dist) in ((-6.0, 2.5, edge - 4.5, "#d8eef0", 7, 16), (0, 4.0, edge - 16, "#cfe6ea", 30, 70), (-18, 6.0, edge - 38, "#b9dce2", 26, 70),
                                            (18, 6.0, edge - 38, "#b9dce2", 26, 70), (gx_, -15.5, edge - 6.0, "#5fd0e4", 14, 9)):
        lights.append({"type": "point", "pos": [px, py, pz], "color": col, "intensity": inten, "distance": dist, "decay": 1.1, "id": "pool"})
    rec["fog"] = {"color": "#0a1618", "near": 12, "far": 85}
    rec["background"] = "#0a1618"
    rec["ambient"] = {"color": "#8fb4bc", "intensity": 0.035}
    rec["sun"] = {"from": [2.0, 6.0, D * 0.55], "color": "#d2e4e8", "intensity": 0.1}
    rec["exposure"] = 1.1
    rec["grain"] = 0.03
    rec["spawn"] = [0, D / 2 - 3.0, 0]
    s = shots_for(rec, out_dist=5.5, leave_dist=D - 8.0, loop_seconds=40.0)
    # previews: down the run, the stop line from the bench, the gap
    s["in"] = pose([0, EYE, D / 2 - 3.0], [0, 1.3, edge])
    s["bench"] = pose([-8.0, 1.08, edge + 2.05], [-8.0, 0.25, edge - 3.0])
    gx = (gap[0] + gap[1]) / 2
    s["gap"] = pose([gx, EYE, edge + 1.3], [gx, 0.2, edge - 3.5])
    s["edge"] = pose([1.5, EYE, edge + 2.8], [gx, 0.2, edge - 1.0])
    # THE EDGE (S7 H): leaning out over the pool through the gap, and back
    s["lean"] = {"from": pose([gx, EYE, edge + 1.3], [gx, 1.0, edge - 6]), "to": pose([gx, EYE - 0.25, edge + 0.55], [gx, -2.5, edge - 2.5]), "seconds": 9.0, "pingpong": True, "ease": "inout", "sway": 0.02}
    # THE FALL: off the lip at the gap, down into the water (to the dive, joined below)
    s["fall"] = {"from": pose([gx, EYE, edge + 0.3], [gx, 0.4, edge - 4]), "to": pose([gx, -4.0, edge - 5.5], [gx, -9, edge - 6.5]), "seconds": 1.6, "ease": "in"}
    rec["shots"] = s
    door(rec, "front", "S", 0.0, w=4.0, h=2.8, kind="shutter", mat="lp_grey")
    # the lift, for a run that comes out compliant (PUSH ON at +2): steel doors in the east wall at the end
    door(rec, "freight", "E", edge + 2.0, w=1.6, h=2.3, kind="slide", locked=True, mat="rust", frame="lp_dark")
    rec["entry"] = "front"
    # S6 H: PUSH ON is the aisle and the east end running on into the dark (the
    # whole strip short of the lip east of the bench); STOP is the bench
    zone(rec, "push", [6.0, edge + 1.6], r=0.5, ring=3.2, box=[[-3.6, edge + 0.05], [W / 2 - 0.3, edge + 3.0]], label_at=[0.0, 2.15, edge + 1.4])
    zone(rec, "stopline", [-8.0, edge + 2.1], r=0.6, ring=2.6, box=[[gap[0], edge + 0.05], [gap[1], edge + 2.55]], label_at=[-8.0, 1.55, edge + 2.1])
    # S7 H: JUMP through the gap in the rail / TURN BACK (only once he has
    # stood at the lip: walking up to it must not read as turning back)
    # (the strip runs 1.45 m back from the edge: up against the rail he
    # stands ~0.75 m from it, and a low frame rate can stop him a step short)
    zone(rec, "edge_approach", [0.0, edge + 0.85], r=0.5, ring=0.5, box=[[-W / 2 + 0.3, edge + 0.25], [W / 2 - 0.3, edge + 1.45]], silent=True)
    zone(rec, "gap", [gx, edge + 0.4], r=0.5, ring=2.6, box=[[gap[0], edge + 0.02], [gap[1], edge + 0.65]], label_at=[gx, 1.45, edge - 0.6])
    zone(rec, "turnback", [0.0, edge + 5.0], r=0.5, ring=2.4, box=[[-W / 2 + 0.3, edge + 4.55], [W / 2 - 0.3, edge + 5.5]], armAfter="edge_approach", label_at=[0.0, 2.3, edge + 5.0])
    anchor(rec, "drop", [gx, -4.3, edge - 6.0], 0, vertical=True)
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
        "holdEntry": True,  # the cab doors stay open behind him until he chooses
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
    door(rec, "cab", "S", 0.0, w=1.6, h=2.2, kind="slide", mat="lp_rust")
    rec["entry"] = "cab"
    zone(rec, "cab_center", [0.0, -0.6], r=0.9, ring=0.9, silent=True)
    zone(rec, "panel", [0.95, 0.5], r=0.45, ring=1.6, label_at=[1.3, 1.55, 0.5])
    zone(rec, "doorway", [0.0, 2.05], r=0.5, ring=1.2, armAfter="cab_center", label_at=[0.0, 2.35, 1.75])
    return rec


def mailroom():
    W, H, D = 40.0, 10.0, 50.0
    props = []
    rnd = random.Random(8)
    for x in range(-16, 17, 4):
        for z in range(-20, 21, 4):
            if (abs(x) < 5 and z > -12) or abs(x) < 4:
                continue  # keep the approach lane clear, spawn to counter to the deliveries door
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
    # OPEN THE BOX: a sorting table with a box cutter, off the lane
    props.append(prop("table", [-3.5, 0, -3.5], w=1.2, d=2.0, name="sorting"))
    props.append(prop("boxcutter", [-3.3, 0.76, -3.2], rot=30))
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
    door(rec, "front", "S", 0.0, w=2.0, h=3.0, kind="door", mat="lp_dark")
    door(rec, "deliveries", "N", 0.0, w=1.6, h=2.6, kind="door", locked=True, mat="lp_dark")
    rec["entry"] = "front"
    zone(rec, "counter", [0.4, -7.85], r=0.6, ring=3.0, label_at=[0.4, 1.7, -8.9])
    zone(rec, "deliver", [0.0, -22.6], r=0.8, ring=4.0, armAfter="counter", label_at=[0.0, 3.0, -24.6])
    zone(rec, "sorting", [-2.45, -3.5], r=0.6, ring=2.6, armAfter="counter", label_at=[-3.5, 1.5, -3.5])
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
    # expelled from the chute onto the linoleum
    s["land"] = {"from": pose([-W / 2 + 0.2, 0.5, -4.0], [0, 0.3, -4.0]), "to": pose([-W / 2 + 1.6, EYE, -4.0], [0, 1.3, D / 2]), "seconds": 1.8, "ease": "out"}
    rec["shots"] = s
    door(rec, "hatch", "W", -4.0, w=1.0, h=1.1, kind="open")
    door(rec, "staff", "E", -5.0, w=1.0, h=2.1, kind="door", locked=True, mat="lp_grey")
    rec["entry"] = "hatch"
    rec["holdEntry"] = True
    zone(rec, "storefront", [0.0, 6.7], r=0.8, ring=3.5, label_at=[0.0, 2.6, 7.9])
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
        prop("hands", [0.3, 0.76, -D / 2 + 1.1], name="hands", hidden=True),  # shown when he sits (C6)
        prop("mug", [-0.35, 0.75, -D / 2 + 0.95]),
        glb("lib_tablelamp", [-0.45, 0.75, -D / 2 + 0.55], fallback="lamp"),
        glb("lib_books", [0.85, 0.75, -D / 2 + 0.6], rot=15, fallback=None),
        glb("lib_chair_wood", [0.3, 0, -D / 2 + 1.65], rot=180, fallback="chair", collide=True),
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
        "spawn": [0.3, 1.5, 0],
        "props": props,
        "footstep": {"filterHz": 380, "gain": 0.04},
    }
    # The way out: the apartment door, locked until ACCEPTED; stairs down to the street.
    door(rec, "door", "S", -1.3, w=1.2, h=2.2, kind="door", locked=True, mat="lp_beige", hinge="R")
    # The start: walking up to the lit screen sits him down at it.
    zone(rec, "desk", [0.3, -0.35], r=0.45, ring=1.4, label_at=[0.3, 1.45, -1.9])
    s = shots_for(rec, out_dist=0.4, leave_dist=1.2, loop_seconds=14.0)
    # Over the shoulder, the monitor in the middle of frame (S0_X_IMG_IN).
    s["in"] = pose([0.3, 1.5, -D / 2 + 2.15], [0.3, 0.98, -D / 2 + 0.62], fov=48)
    s["out"] = pose([0.3, 1.45, -D / 2 + 1.95], [0.3, 0.98, -D / 2 + 0.62], fov=48)
    s["loop"]["sway"] = 0.01
    # ACCEPTED. The window cannot be closed: the camera pushes into the screen's glow and the room goes.
    s["leave"] = {"from": "out", "to": pose([0.3, 1.1, -D / 2 + 0.9], [0.3, 0.98, -D / 2 + 0.62], fov=40), "seconds": 2.6, "ease": "in", "fadeOut": 1.0}
    # Carried: sitting down at the computer, leaning in to the form, standing up to go.
    s["sit"] = pose([0.3, 1.17, -1.0], [0.3, 0.88, -1.7], fov=54)
    s["lean"] = pose([0.3, 1.10, -1.25], [0.3, 1.02, -1.70], fov=46)
    s["stand"] = pose([0.3, 1.60, -0.35], [-1.3, 1.3, 2.5], fov=68)
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
        if z + 5 < D / 2 - 3:
            props.append(glb("lib_aptblock" if i % 2 == 0 else "lib_brownstone", [W / 2 + 3.5, 0, z + 5], rot=-90, fallback="building", w=10, h=14 + ((i + 1) % 3) * 5, d=9))
    for z in (-22, -6, 10, 26):
        props.append(glb("lib_streetlamp", [-W / 2 + 1.2, 0.14, z], fallback="lamppost"))
        if z + 8 < D / 2 - 2:
            props.append(glb("lib_streetlamp", [W / 2 - 1.2, 0.14, z + 8], rot=180, fallback="lamppost"))
    props.append(glb("lib_trafficlight", [W / 2 - 1.4, 0.14, -D / 2 + 9], rot=180, fallback="lamppost"))
    props.append(glb("lib_hydrant", [-W / 2 + 1.6, 0.14, 4.0], fallback=None, collide=True))
    props.append(glb("lib_trashbin", [W / 2 - 1.8, 0.14, -3.0], fallback=None, collide=True))
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
            # pavements (walkable: kerbs are climbed, controls.js eases over them)
            {"min": [-W / 2 - 3.0, 0, -D / 2 + 3.8], "max": [-W / 2 + 2.6, 0.14, D / 2 - 2.4], "mat": "concrete", "floor": True, "tile": 2.0},
            {"min": [W / 2 - 2.6, 0, -D / 2 + 3.8], "max": [W / 2 + 3.0, 0.14, D / 2 - 2.4], "mat": "concrete", "floor": True, "tile": 2.0},
            # the dead end he comes out into: a kerb across it and a brick end wall
            # with his building's door in it (the stairs from the apartment behind)
            {"min": [-W / 2 - 3.0, 0, D / 2 - 2.4], "max": [W / 2 + 3.0, 0.14, D / 2], "mat": "concrete", "floor": True, "tile": 2.0},
            {"min": [-24, 0, D / 2], "max": [-0.6, 18, D / 2 + WALL_T], "mat": "plaster_dark", "shadow": False, "tile": 2.0},
            {"min": [0.6, 0, D / 2], "max": [24, 18, D / 2 + WALL_T], "mat": "plaster_dark", "shadow": False, "tile": 2.0},
            {"min": [-0.6, 2.34, D / 2], "max": [0.6, 18, D / 2 + WALL_T], "mat": "plaster_dark", "shadow": False, "tile": 2.0},
            # the tower: a forecourt and step (the last ascent in the game), the
            # facade with the doors in it, and the rest of it, which has no top
            {"min": [-16, 0, -D / 2], "max": [16, 0.3, -D / 2 + 3.2], "mat": "marble_light", "floor": True, "tile": 2.5},
            {"min": [-12, 0, -D / 2 + 3.2], "max": [12, 0.15, -D / 2 + 3.8], "mat": "marble_light", "floor": True, "tile": 2.5},
            {"min": [-16, 0, -D / 2 - WALL_T], "max": [-1.3, 9.0, -D / 2], "mat": "marble_light", "shadow": False, "tile": 2.5},
            {"min": [1.3, 0, -D / 2 - WALL_T], "max": [16, 9.0, -D / 2], "mat": "marble_light", "shadow": False, "tile": 2.5},
            {"min": [-1.3, 3.2, -D / 2 - WALL_T], "max": [1.3, 9.0, -D / 2], "mat": "marble_light", "shadow": False, "tile": 2.5},
            {"min": [-16, 0, -D / 2 - 40], "max": [-8.2, 9.0, -D / 2 - WALL_T], "mat": "concrete", "collide": False, "shadow": False, "tile": 3.0},
            {"min": [8.2, 0, -D / 2 - 40], "max": [16, 9.0, -D / 2 - WALL_T], "mat": "concrete", "collide": False, "shadow": False, "tile": 3.0},
            {"min": [-8.2, 0, -D / 2 - 40], "max": [8.2, 9.0, -D / 2 - 19.0], "mat": "concrete", "collide": False, "shadow": False, "tile": 3.0},
            {"min": [-16, 9.0, -D / 2 - 40], "max": [16, 220.0, -D / 2], "mat": "concrete", "collide": False, "shadow": False, "tile": 4.0},
            # invisible kerb-side bounds: the street is the only way
            {"min": [-W / 2 + 0.7, 0, -D / 2], "max": [-W / 2 + 1.0, 3.0, D / 2], "mat": "void", "invisible": True, "shadow": False},
            {"min": [W / 2 - 1.0, 0, -D / 2], "max": [W / 2 - 0.7, 3.0, D / 2], "mat": "void", "invisible": True, "shadow": False},
        ],
        "ambient": {"color": "#f0c8a0", "intensity": 0.3},
        "hemisphere": {"sky": "#e8b07a", "ground": "#3a3028", "intensity": 0.5},
        "sun": {"from": [-6.0, 9.0, 60.0], "color": "#ffb070", "intensity": 1.6},
        "lights": [],
        "fog": {"color": "#d9a878", "near": 18, "far": 95},
        "background": "#d9a878",
        "exposure": 1.1,
        "vignette": 0.4,
        "grain": 0.03,
        "spawn": [0, 30.0, 0],
        "props": props,
        "footstep": {"filterHz": 1600, "gain": 0.1},
    }
    # window bands on the tower face, glass that shows nothing
    for y in range(10, 200, 4):
        rec["boxes"].append({"min": [-15, y, -D / 2 + 0.02], "max": [15, y + 1.4, -D / 2 + 0.06], "mat": "glass_dark", "collide": False, "shadow": False, "tile": 4.0})
    door(rec, "stoop", "S", 0.0, w=1.2, h=2.2, kind="door", y=0.14, locked=True, mat="lp_dark", panel="glass", hinge="L")
    door(rec, "tower", "N", 0.0, w=2.6, h=2.9, kind="glass", y=0.3, locked=True)
    rec["entry"] = "stoop"
    zone(rec, "report", [0.0, -D / 2 + 1.6], r=1.2, ring=5.0, label_at=[0.0, 3.6, -D / 2 - 0.1])
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
            prop("clock", [-W / 2 + 0.03, 4.0, -2.0], rot=90),
            prop("slip", [1.2, 0.004, -1.0], rot=60),
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
    # the splash: from the surface down into the water, before he swims
    s["sink"] = {"from": pose([0, H - 0.2, 0.0], [0, 6, -2.0]), "to": pose([0, H - 3.5, 0.6], [0, 4, -2.5]), "seconds": 2.2, "ease": "out"}
    # through the grate, dragged by the current
    s["grate"] = {"from": "out", "to": pose([0, 0.3, 0.1], [0, -4, -0.3]), "seconds": 2.0, "ease": "in"}
    rec["shots"] = s
    # the tiled pillars at the corners (SWIM FOR THE PILLARS)
    for px, pz in ((-4.3, -4.3), (4.3, -4.3), (-4.3, 4.3), (4.3, 4.3)):
        rec["boxes"].append({"min": [px - 0.45, 0, pz - 0.45], "max": [px + 0.45, H, pz + 0.45], "mat": "pool_tile", "collide": True, "tile": 1.5})
    anchor(rec, "surface", [0.0, H, 0.0], 0, vertical=True)
    anchor(rec, "grate", [0.0, -0.3, 0.0], 0, vertical=True)
    rec["entry"] = "surface"
    rec["swim"] = {"floorY": 0.9, "ceilingY": H - 0.7}
    zone(rec, "grate", [0.0, 1.0, 0.0], r=1.3, ring=4.0, label_at=[0.0, 2.6, 0.0])
    zone(rec, "pillars", [-3.3, 6.0, -3.3], r=1.1, ring=3.5, label_at=[-4.3, 7.6, -4.3])
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
    door(rec, "front", "S", 0.0, w=1.4, h=2.4, kind="door", mat="lp_wood")
    rec["entry"] = "front"
    zone(rec, "head", [0.0, -7.6], r=0.6, ring=3.0, label_at=[0.0, 1.9, -8.0])
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
    rec["props"].append(prop("hands", [-0.6, 0.95, 1.2], rot=-90, name="hands", slip=True, hidden=True))
    rec["props"].append(prop("curtain", [0, 0, -D / 2 + 0.05], w=2.2, h=3.0, name="farcurtain", swing=True))
    rec["props"].append(prop("slip", [0.9, 0.45, 1.2], rot=10))  # the hundredth? no: the one he holds is drawn by the hands; this one on the vacated seat
    rec["spawn"] = [-0.9, 1.2, -90]
    s = shots_for(rec, eye=1.15, out_dist=0.3, leave_dist=1.0, loop_seconds=10.0)
    s["in"] = pose([-0.75, 1.15, 1.2], [0.9, 0.7, 1.2], fov=52)
    s["out"] = pose([-0.75, 1.15, 1.2], [0.9, 0.7, 1.2], fov=52)
    s["ending"] = {"from": pose([-0.75, 1.15, 1.2], [-0.2, 0.9, 1.2], fov=52), "to": pose([-0.75, 1.15, 1.2], [1.6, 0.8, 0.6], fov=52), "seconds": 7.0, "ease": "inout", "sway": 0.015}
    s.pop("call", None)
    # sitting down to wait, before the pull-back
    s["sit"] = {"from": pose([-1.6, EYE, 1.2], [0.9, 1.0, 1.2]), "to": pose([-0.75, 1.15, 1.2], [-0.2, 0.9, 1.2], fov=52), "seconds": 1.8, "ease": "inout"}
    rec["shots"] = s
    rec["entry"] = "inner"
    rec["zones"] = [z for z in rec.get("zones", []) if False]
    zone(rec, "seat", [-1.55, 1.2], r=0.55, ring=2.6, label_at=[-0.9, 1.3, 1.2])
    return rec


KEY_RE = r"^(S\d_[CHX]|SE_(ASSIM|EXPUL|PEND|RETAINED)|SET_[A-Z]+|CN_[A-Z_]+)$"

# What an alias may change: anything that is not the room itself (the
# world builds one room per base set and reuses it for every alias).
ALIAS_KEYS = {"alias", "spawn", "_note", "name", "id", "shots"}


def _point_in_box(x, z, b, pad=0.0):
    return b["min"][0] - pad <= x <= b["max"][0] + pad and b["min"][2] - pad <= z <= b["max"][2] + pad


def check_room(k, r):
    """The continuous building's rules for one built room (see door()/zone())."""
    W, H, D = r["size"]
    names = set()
    spans = {}
    for d in r.get("doors", []):
        assert d["name"] not in names, "%s: two doors named %s" % (k, d["name"])
        names.add(d["name"])
        assert d["wall"] in "NSEW", "%s: door %s on wall %s" % (k, d["name"], d["wall"])
        assert d["wall"] not in r.get("open", []), "%s: door %s on an open side" % (k, d["name"])
        length = W if d["wall"] in "NS" else D
        assert abs(d["x"]) + d["w"] / 2 <= length / 2 - 0.05 + (WALL_T if d["wall"] in "NS" else 0), "%s: door %s runs off its wall" % (k, d["name"])
        y = d.get("y", r.get("floorY", 0))
        assert y + d["h"] < H + 1e-6 or r.get("noWalls") or r.get("noCeiling"), "%s: door %s taller than the room" % (k, d["name"])
        for (s0, s1) in spans.get(d["wall"], []):
            assert d["x"] + d["w"] / 2 <= s0 or d["x"] - d["w"] / 2 >= s1, "%s: door %s overlaps another on wall %s" % (k, d["name"], d["wall"])
        spans.setdefault(d["wall"], []).append((d["x"] - d["w"] / 2, d["x"] + d["w"] / 2))
    if r.get("entry"):
        assert r["entry"] in names or r["entry"] in r.get("anchors", {}), "%s: entry %s is no door" % (k, r["entry"])
    else:
        assert k == "S0_X", "%s: no entry doorway" % k
    collide_boxes = [b for b in r.get("boxes", []) if b.get("collide", True) and not b.get("floor")]
    for z in r.get("zones", []):
        x, zz = (z["pos"][0], z["pos"][-1])
        assert -W / 2 <= x <= W / 2 and -D / 2 - 0.4 <= zz <= D / 2 + 0.4, "%s: zone %s outside the room" % (k, z["name"])
        if z.get("actor"):
            continue
        for b in collide_boxes:
            assert not _point_in_box(x, zz, b, -0.05) or (len(z["pos"]) == 3 and not (b["min"][1] <= z["pos"][1] <= b["max"][1])), "%s: zone %s inside a solid box" % (k, z["name"])
        assert z["ring"] >= z["r"] or z.get("silent"), "%s: zone %s ring inside its radius" % (k, z["name"])
        if z.get("armAfter"):
            assert any(o["name"] == z["armAfter"] for o in r["zones"]), "%s: zone %s arms after a missing zone" % (k, z["name"])
    for p in r.get("props", []):
        assert not p.get("reach"), "%s: hands that reach (removed from the pool scenes)" % k
    hands = sum(1 for p in r.get("props", []) if p["type"] == "hands")
    assert hands == 0 or k in ("S0_X", "SE_PEND"), "%s: hands outside the apartment and the pending room" % k



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
        "S6_C": {"alias": "S5_C", "_note": "The same desk: the terminal wakes with the requisition on it."},
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
        # connectors: what the continuous building joins rooms with
        "CN_STAIRS_APT": cn_stairs("THE STAIRS", "home", drop=2.8, width=1.4),
        "CN_VESTIBULE": cn_vestibule(),
        "CN_CORRIDOR_OFFICE": cn_corridor("A CORRIDOR", "office", length=6.0),
        "CN_CORRIDOR_SERVICE": cn_corridor("A SERVICE CORRIDOR", "service", length=6.0, width=1.6),
        "CN_STAIRS_CONCRETE": cn_stairs("A STAIRWELL", "service", drop=3.0),
        "CN_CORRIDOR_DOWN": cn_stairs("A CORRIDOR DOWN", "service", drop=1.2, rise=0.15, tread=0.6, landing=2.0, width=1.8),
        "CN_RAMP_DOWN": cn_ramp("THE RAMP", "garage", drop=2.5),
        "CN_CHUTE": cn_chute(),
    }
    for k, r in rooms.items():
        r["id"] = k
        assert re.match(KEY_RE, k), k
        if "alias" in r:
            assert "alias" not in rooms[r["alias"]], "%s: alias of an alias" % k
            assert set(r) <= ALIAS_KEYS, "%s: an alias may not change the room (%s)" % (k, sorted(set(r) - ALIAS_KEYS))
            continue
        check_room(k, r)
        if r.get("connector"):
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
