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
    "home":    {"floor": "carpet", "wall": "plaster_dark", "ceiling": "plaster_dark", "lamp": "#ffd9a0", "lamp_i": 4.5, "skirt": "plaster_dark"},
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
    # and one over the middle of the flight, so the treads read from the top
    rec["props"].append(prop("fluoro", [0, height - 0.06, 0], w=0.8, d=0.2))
    rec["lights"].append({"type": "point", "pos": [0, height - 0.4, 0], "color": st["lamp"], "intensity": round(st["lamp_i"] * 0.8, 2), "distance": 8})
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


def waiting_room(hostile, dark_front=None):
    """S1 THE WAITING ROOM and S2 THE CALL (Doc 1 §5, Doc 2 S1/S2): one
    lobby, entered from the street through the front glass doors.

    C is sterile and ordered: eight maroon chairs in two perfect rows facing
    the aisle, the brass V&A monogram in the wet marble between them, the
    receptionist head-down behind photoreal glass at the end, cool even light
    that never moves. H is the same room scattered and over-lit: the chairs
    at wrong angles, two overturned, the dispenser feeding slips onto the
    floor (every one 99), the lights pulsing on no rhythm, and the marble
    reflecting a coffered ceiling that is not there.

    Thresholds: S1 TAKE A SEAT is any upright chair (`seat0..7`, one zone
    just off each seat's front edge) and STAY STANDING is the head of the
    queue lane at the counter (`counter`); S2 STAND is the inner door beside
    the counter (`inner_door`, its lamp turns green after the call) and RUN
    is back to the front glass doors (`front_doors`; they hold, the service
    door by the entrance opens instead). lobby_doors() (S3 H) and
    pending_room() (SE PEND) are built from this room: the doorway names and
    places stay put.
    """
    W, H, D = 14.0, 4.2, 12.0
    wall = "plaster_blown" if hostile else "plaster"
    # One plaster tile the height of the room: the roller streaks don't jump at
    # a seam half way up, and the scuffs stay low on the wall.
    WALL_TILE = 4.4
    props = []
    boxes = []
    # -- reception: a booth on the core wall --------------------------------
    # The counter with its photoreal glass (fingerprints on it, a speaking
    # grille at her face), the receptionist on a dais behind it so her bowed
    # head clears the ledge, a bulkhead over the booth carrying the placard
    # and the small ceiling speaker grille (Doc 2 S2).
    props.append(prop("reception", [0, 0, -4.7], w=4.6, d=0.8, h=1.05, smudges=True))
    props.append(prop("receptionist", [0, 0, -5.62], name="receptionist", tilt=36, dais=0.25, daisZ=0.07, daisD=0.9, daisW=4.5))
    props.append(prop("receptionist_jaw", [0, 0, -5.62], name="receptionist_jaw", tilt=36, dais=0.25, hidden=True))
    boxes.append({"min": [-2.45, 2.95, -D / 2], "max": [2.45, H, -4.25], "mat": wall, "collide": False, "tile": WALL_TILE})
    for sx in (-1, 1):  # the booth's side walls back to the glass, the counter between them
        boxes.append({"min": [min(sx * 2.3, sx * 2.45), 0, -D / 2], "max": [max(sx * 2.3, sx * 2.45), 2.95, -4.8], "mat": wall, "tile": WALL_TILE})
    # a thin spine inside the counter body: changes nothing for the player, but
    # the dev autopilot's navgrid (rays cast from inside a box miss its faces)
    # otherwise reads the counter as a walkable corridor into the booth
    boxes.append({"min": [-2.28, 0, -4.71], "max": [2.28, 1.0, -4.69], "mat": "plaster_dark", "invisible": True, "shadow": False})
    # its back wall, darker than the room's, so the glass reads clear and she reads against it
    boxes.append({"min": [-2.3, 0, -D / 2], "max": [2.3, 2.95, -D / 2 + 0.03], "mat": "plaster_dark", "collide": False, "tile": WALL_TILE})
    with open(os.path.join(HERE, "..", "text", "system.json"), encoding="utf-8") as fh:
        placard = json.load(fh)["wait.placard"]
    # (H: a deeper plate and ink, or the blown light bleaches the words off it)
    props.append(prop("notice", [0, 3.43, -4.245], w=2.3, h=0.3, text=placard,
                      **({"plate": "#7a5f2a", "ink": "#140f06"} if hostile else {})))
    props.append(prop("speaker", [1.15, 2.95, -4.7]))
    props.append(prop("fluoro", [0, 2.88, -5.45], w=1.6, d=0.22))
    props.append(prop("clock", [-4.6, 2.9, -D / 2 + 0.02]))
    # -- the queue: a stanchion lane to the counter's left, the dispenser at
    # its mouth. Standing in it is STAY STANDING.
    props.append(prop("queue", [-1.3, 0, -3.47], w=1.4, len=1.56))
    props.append(prop("ticketpost", [-2.35, 0, -2.45], rot=25, feed=hostile, name="dispenser"))
    # -- the floor: wet marble, the monogram at the centre -------------------
    grid = [(-3.8, -1.4), (0.0, -1.4), (3.8, -1.4), (-3.8, 2.6), (0.0, 2.6), (3.8, 2.6)]
    props.append(prop("floorsheen", [0, 0, 0], w=W, d=D, coffers=hostile, ceiling=round(H - 0.06, 2),
                      lamps=[[lx, lz, 1.4, 0.4] for lx, lz in grid], fog=[5, 28] if hostile else [10, 36],
                      tone="#9ba4ae" if hostile else "#aab1ba", gain=0.4 if hostile else 0.8))
    props.append(prop("monogram", [0, 0, 0.6], r=1.5, name="mosaic"))
    props.append(prop("dust", [0, 0, 0.5], n=90, w=12, h=2.6, d=9.5, y=1.2, opacity=0.2))
    # -- the chairs -------------------------------------------------------------
    # Accent chairs from the catalog, one flat maroon (Doc 2: `paint` deeper
    # than the curtain slot, which reads fire-engine red here), low-poly (C1);
    # each seat's zone is just off its front edge. (They stay `glb` props:
    # pending_room() clears the rows by that type.) H's two overturned ones
    # are `tipchair`s: the same model on its back / its side.
    MAROON = "#45101a"
    chairs = []
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
            chairs.append([x, z, rot, None])
    if hostile:
        # vacated at speed: two turned further off true, two knocked over
        chairs[2][2] = 128.0
        chairs[7][2] = -125.0
        chairs[3][3] = "back"
        chairs[6][3] = "side"
    seats = []
    for k, (x, z, rot, tip) in enumerate(chairs):
        if tip:
            props.append(prop("tipchair", [x, 0, z], round(rot, 1), node="lib_chair", mat="lp_curtain", paint=MAROON, tip=tip, name="chair%d" % k))
            continue
        props.append(glb("lib_chair", [x, 0, z], round(rot, 1), fallback="chair", mat="lp_curtain", paint=MAROON, collide=True, name="chair%d" % k))
        # chairs face +z at rot 0 (the backrest is at the model's -z)
        fx, fz = math.sin(math.radians(rot)), math.cos(math.radians(rot))
        seats.append(("seat%d" % k, [x + 0.72 * fx, z + 0.72 * fz], [x, 1.45, z], {"pos": r3([x + 0.06 * fx, z + 0.06 * fz]), "face": r3([fx, fz])}))
    props.append(prop("palette", [0, 0, 0]))  # the maroon, all the way (props.js palette)
    if hostile:
        # The dispenser feeds continuously (Doc 2 S1_H): a mound of slips
        # under it, several drifted toward the foreground. Every one 99.
        props.append(prop("slippile", [-2.35, 0, -2.45], n=110, r=0.7, seed=99,
                          drift=[[0.6, 1.1], [1.3, 1.9], [-0.5, 1.7], [2.1, 2.7], [0.9, 3.4], [2.7, 4.2], [1.7, 5.1], [-0.9, 3.1], [3.3, 5.9]]))
    # -- the building's light ------------------------------------------------
    # C: cool, even, perfectly still. H: two stops too hot, each fixture
    # pulsing on its own period so the room never finds a rhythm (Doc 2 KLING H).
    lights = []
    for i, (lx, lz) in enumerate(grid):
        props.append(prop("fluoro", [lx, H - 0.06, lz], w=1.4, d=0.4))
        l = {"type": "point", "pos": [lx, H - 0.35, lz], "color": "#fff3e2" if hostile else "#eaf0f6",
             "intensity": 30 if hostile else 11, "distance": 13, "decay": 1.4}
        if hostile:
            l["flicker"] = 0.18
            l["pattern"] = {"period": round(2.1 + 0.37 * i, 2), "duty": 0.9, "low": 0.42, "offset": round(0.61 * i, 2)}
        lights.append(l)
    # the booth's own downlight on her and the glass
    lights.append({"type": "point", "pos": [0, 2.75, -4.85], "color": "#fff1de" if hostile else "#e8eef4", "intensity": 7 if hostile else 4.5, "distance": 4.5})
    # the door lamps: dark until they mean something (S2)
    lights.append({"type": "point", "id": "inner_lamp", "off": True, "pos": [5.6, 2.3, -5.55], "color": "#3dff7a", "intensity": 2.4, "distance": 3.2})
    lights.append({"type": "point", "id": "service_lamp", "off": True, "pos": [-4.6, 2.3, 5.55], "color": "#3dff7a", "intensity": 2.4, "distance": 3.2})
    rec = {
        "name": "THE WAITING ROOM",
        "size": [W, H, D],
        "floor": "marble", "wall": wall, "ceiling": "plaster_blown" if hostile else "plaster_dark",
        "tile": {"floor": 2.5, "wall": WALL_TILE, "ceiling": 2.0},
        "skirt": {"mat": "marble", "h": 0.14, "t": 0.03, "tile": 2.5},
        "cornice": {"mat": "plaster_blown" if hostile else "plaster_dark", "h": 0.28, "t": 0.08},
        "ambient": {"color": "#fff6ea" if hostile else "#dfe6ee", "intensity": 0.7 if hostile else 0.24},
        "sun": {"from": [1.5, 6.5, 7.5], "color": "#fff4e4" if hostile else "#eef2f6", "intensity": 0.95 if hostile else 0.6},
        "lights": lights,
        "fog": {"color": "#efe9dc" if hostile else "#121518", "near": 5 if hostile else 10, "far": 28 if hostile else 36},
        "exposure": 1.5 if hostile else 1.0,
        "vignette": 0.2 if hostile else 0.55,
        "spawn": [0, 4.6, 0],
        "props": props,
        "boxes": boxes,
        "footstep": {"filterHz": 1400, "gain": 0.09},
    }
    rec["shots"] = shots_for(rec, loop_seconds=14.0)
    # S2 THE CALL: tight on the reception glass (Doc 2 S2), for previews.
    rec["shots"]["call"] = {"from": "out", "to": pose([-0.9, EYE, -3.0], [0.1, 1.45, -5.6], fov=44), "seconds": 4.0, "ease": "inout"}
    # The lobby's doorways: the glass doors from the street (they close
    # behind the candidate and the drone begins, C7; past them it is dark,
    # C3), the inner door beside the counter that buzzes open when he answers
    # the call, and a service door by the entrance that opens when he runs
    # for the locked glass. Inner and service match their connectors' 1.2 m.
    # (H: tinted glass. The shared clear glass goes milky in the blown light
    # and stops reading as the dark behind it.)
    # the lobby's own front doors read dark from inside (C3: nothing of the
    # street once they close); S3 H's lobby_doors() keeps them clear, since
    # its dead street is seen through them
    dark = hostile if dark_front is None else dark_front
    door(rec, "front", "S", 0.0, w=2.6, h=2.9, kind="glass", locked=True, **({"glass": "glass_dark"} if dark else {}))
    door(rec, "inner", "N", 5.6, w=1.2, h=2.2, kind="door", locked=True, mat="lp_beige", hinge="R", panel="lp_grey")
    door(rec, "service", "S", -4.6, w=1.2, h=2.2, kind="door", locked=True, mat="lp_grey")
    rec["entry"] = "front"
    # Once the vestibule behind the front doors is gone, the doors show the
    # dark (S1 onEnter shows this): no street, no sky after they close (C3).
    props.append(prop("backing", [0, 0, D / 2 + WALL_T + 0.07], w=2.9, h=3.1, name="front_dark", hidden=True))
    # The door lamps (red until they mean something) and the inner door's reader.
    for nm, pos, rot in (("inner", [5.6, 2.46, -D / 2 + 0.02], 0), ("service", [-4.6, 2.46, D / 2 - 0.02], 180)):
        props.append(prop("doorlamp", pos, rot, lens="red", name="%s_lamp_red" % nm))
        props.append(prop("doorlamp", pos, rot, lens="green", name="%s_lamp_green" % nm, hidden=True))
    props.append(prop("badgereader", [6.45, 1.25, -D / 2 + 0.03]))
    # S1: TAKE A SEAT (any upright chair) / STAY STANDING (the head of the queue)
    for name, pos, label, seat in seats:
        zone(rec, name, pos, r=0.35, ring=1.7, label_at=label, seat=seat)
    zone(rec, "counter", [-1.3, -3.72], r=0.5, ring=2.2, label_at=[-1.3, 2.05, -4.2])
    # S2: STAND (the inner door) / RUN (back to the glass doors). The words
    # stand on the door, on its window / the dark glass, low enough to stay
    # in view as he walks up to it (over the lintel they left the top of the
    # screen a step before the commit, and read white on white in H).
    zone(rec, "inner_door", [5.6, -5.1], r=0.6, ring=3.0, label_at=[5.6, 1.55, -5.85])
    zone(rec, "front_doors", [0.0, 4.95], r=0.75, ring=3.2, label_at=[0.0, 2.05, 5.85])
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
    W, H, D = 24.0, 8.0, 24.0
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
        # S5: a second terminal at the edge of the light, dark until he comes near (S. HARLOWE)
        prop("desk", [6.0, 0, -4.2], w=1.1, d=0.7, mat="lp_grey"),
        prop("monitor", [6.0, 0.75, -4.35], on=False, name="harlowe"),
        # S6: where a requisition goes (ORDER) and where it is objected to (FLAG)
        prop("tubestation", [-6.0, 0, -4.4], name="tube"),
        prop("flagbox", [6.4, 0, 3.6], rot=-90, name="flagbox"),
    ]
    lights = [
        {"type": "spot", "pos": [0, 5.5, 0.3], "target": [0, 0, 0], "color": "#ffe7c4", "intensity": 90, "distance": 14, "angle": 32, "penumbra": 0.7},
    ]
    lights.append({"type": "point", "pos": [0.35, 1.2, 0.2], "color": "#7ad9a0", "intensity": 4, "distance": 4, "id": "terminal_glow", "off": not monitor_on})
    lights.append({"type": "point", "pos": [6.0, 1.3, -3.7], "color": "#7ad9a0", "intensity": 3, "distance": 4, "id": "harlowe_glow", "off": True})
    lights.append({"type": "point", "pos": [-6.0, 2.2, -3.8], "color": "#33ff77", "intensity": 3, "distance": 4})
    lights.append({"type": "point", "pos": [6.0, 1.9, 3.6], "color": "#ff4433", "intensity": 2.5, "distance": 4})
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
    door(rec, "front", "S", 0.0, w=1.2, h=2.2, kind="door", mat="lp_dark")
    door(rec, "freight", "N", 0.0, w=1.4, h=2.3, kind="door", locked=True, mat="lp_dark")
    rec["entry"] = "front"
    # S5: STAPLE at the desk / WAKE THE TERMINAL (approaching it sets SAW_HARLOWE)
    zone(rec, "desk", [0.0, 1.05], r=0.5, ring=2.6, label_at=[-0.45, 1.25, 0.05])
    zone(rec, "terminal", [6.0, -3.25], r=0.55, ring=2.6, label_at=[6.0, 1.6, -4.3])
    # S6: ORDER at the tube station / FLAG at the red box
    zone(rec, "tube", [-6.0, -3.35], r=0.55, ring=2.8, label_at=[-6.0, 2.5, -4.4])
    zone(rec, "flagbox", [5.45, 3.6], r=0.55, ring=2.8, label_at=[6.3, 2.1, 3.6])
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
    door(rec, "front", "S", 0.0, w=1.4, h=2.3, kind="door", mat="lp_grey")
    rec["entry"] = "front"
    if not open_north:
        # S5 H: the curb to rest on, the stairwell door, the ramp shutter
        rec["boxes"].append({"min": [-W / 2, 0, -6.0], "max": [-W / 2 + 0.75, 0.16, 6.0], "mat": "concrete", "floor": True, "tile": 1.5})
        door(rec, "stairs", "E", -8.0, w=1.1, h=2.2, kind="door", locked=True, mat="lp_grey")
        door(rec, "ramp", "N", 0.0, w=4.0, h=2.8, kind="shutter", locked=True, mat="lp_grey")
        zone(rec, "curb", [-W / 2 + 1.1, 0.0], r=0.7, ring=3.0, label_at=[-W / 2 + 0.4, 1.4, 0.0])
        zone(rec, "stairs", [W / 2 - 1.0, -8.0], r=0.6, ring=3.0, label_at=[W / 2 - 0.1, 2.5, -8.0])
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
            # the barrier at the lip, broken where the guard rail is gone
            {"min": [-W / 2, 0, edge - 0.4], "max": [-1.2, 1.2, edge - 0.2], "mat": "void", "collide": True, "invisible": True, "shadow": False},
            {"min": [1.2, 0, edge - 0.4], "max": [W / 2, 1.2, edge - 0.2], "mat": "void", "collide": True, "invisible": True, "shadow": False},
            {"min": [-6, -4.05, edge - 36], "max": [6, -4.0, edge - 30], "mat": "glow_water", "collide": False, "shadow": False},
        ]
        prnd = random.Random(7)
        for x in range(-28, 29, 7):
            for zz in range(-8, -90, -9):
                jx = prnd.uniform(-0.8, 0.8)
                rec["boxes"].append({"min": [x + jx - 0.7, -4.28, edge + zz - 0.7], "max": [x + jx + 0.7, 12.0, edge + zz + 0.7], "mat": "plaster", "collide": False, "tile": 2.0})
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
        # THE FALL: off the lip, down into the water (to the dive, joined below)
        s["fall"] = {"from": pose([0, EYE, edge + 0.4], [0, 0.4, edge - 4]), "to": pose([0, -4.0, edge - 5.5], [0, -9, edge - 6.5]), "seconds": 1.6, "ease": "in"}
        rec["shots"] = s
        # S6 H: PUSH ON down the bay / STOP at the line, on the bench
        rec["boxes"].append({"min": [-W / 2 + 0.6, 0, 1.4], "max": [-0.6, 0.004, 1.55], "mat": "plaster_blown", "collide": False, "shadow": False})
        rec["props"].append(prop("bench", [-5.0, 0, 2.4], name="bench"))
        zone(rec, "push", [0.0, -8.4], r=0.9, ring=3.6, label_at=[0.0, 2.2, -9.6])
        zone(rec, "stopline", [-5.0, 1.55], r=0.65, ring=2.8, label_at=[-5.0, 1.6, 2.4])
        # S7 H: JUMP through the gap in the rail / TURN BACK (only once he has
        # stood at the edge: walking up to it must not read as turning back)
        zone(rec, "edge_approach", [0.0, edge + 2.0], r=3.0, ring=3.0, silent=True)
        zone(rec, "gap", [0.0, edge + 0.55], r=0.6, ring=2.6, label_at=[0.0, 1.5, edge - 0.6])
        zone(rec, "turnback", [0.0, edge + 7.0], r=1.2, ring=2.6, armAfter="edge_approach", label_at=[0.0, 2.3, edge + 8.5])
        door(rec, "freight", "W", 4.0, w=1.2, h=2.2, kind="door", locked=True, mat="lp_grey")
        anchor(rec, "drop", [0.0, -4.3, edge - 6.0], 0, vertical=True)
    return rec


def freight_elevator():
    """S7 C, THE DESCENT (Doc 1 §5 S7, Doc 2 S7_C): a damaged freight cab,
    3.0 x 3.4 m, entered through its front doors (S), which stay open
    behind him until he chooses (holdEntry).

    The building's, photoreal (C1): the rust shell, the diamond-plate floor
    and kick band, the quilted steel padding (one pad peeling), the dented
    bumper rails, the caged bulb's light. The company's, low-poly: the
    panel of 66 buttons with one lit, the scissor gate, the segmented floor
    indicator over the doors, the door leaves.

    DESCEND is the one lit button, on the right-hand wall in the rear third
    (ahead and to the right on the way in, its green spilling on the rust).
    REFUSE is back at the open doors, armed only once he has been inside,
    so walking in never refuses. Either way the cab goes down: the beats in
    scenes.json draw the gate, close the doors (DESCEND only -- REFUSE rides
    with them open), step the indicator B1, B2, B7, B12 and the glyph at
    uneven intervals and move the cab, and the same doors open below."""
    W, H, D = 3.0, 2.6, 3.4
    hx, hz = W / 2, D / 2
    rnd = random.Random(77)
    boxes = []
    PAD = 0.05   # quilt thickness
    GAP = 0.025  # the seam between pads
    rows = [(0.34, 1.29), (1.33, 2.28)]

    def pads_x(z_face, inward, x0, x1, n, peel=None):
        """A run of pads on a wall facing +z/-z, between x0 and x1."""
        w = (x1 - x0 - (n - 1) * GAP) / n
        for i in range(n):
            a = x0 + i * (w + GAP)
            for j, (y0, y1) in enumerate(rows):
                t = PAD + rnd.uniform(-0.008, 0.01)
                zz = sorted([z_face, z_face + inward * t])
                b = {"min": [round(a, 3), y0, round(zz[0], 3)], "max": [round(a + w, 3), y1, round(zz[1], 3)],
                     "mat": "grate", "tile": 0.5, "collide": False}
                if peel == (i, j):
                    b["pitch"] = 5.0  # its top has come away from the wall
                boxes.append(b)

    def pads_z(x_face, inward, z0, z1, n, skip=()):
        """A run of pads on a wall facing +x/-x, between z0 and z1."""
        w = (z1 - z0 - (n - 1) * GAP) / n
        centres = []
        for i in range(n):
            a = z0 + i * (w + GAP)
            centres.append(a + w / 2)
            if i in skip:
                continue
            for (y0, y1) in rows:
                t = PAD + rnd.uniform(-0.008, 0.01)
                xx = sorted([x_face, x_face + inward * t])
                boxes.append({"min": [round(xx[0], 3), y0, round(a, 3)], "max": [round(xx[1], 3), y1, round(a + w, 3)],
                              "mat": "grate", "tile": 0.5, "collide": False})
        return centres

    # the quilt: the rear wall (one pad peeling), both side walls, the two
    # returns beside the doors; the right-hand wall leaves a bay bare for
    # the panel
    pads_x(-hz, 1, -hx + GAP, hx - GAP, 4, peel=(2, 1))
    z0, z1 = -hz + PAD + GAP, hz - GAP
    pads_z(-hx, 1, z0, z1, 5)
    centres = pads_z(hx, -1, z0, z1, 5, skip=(1,))
    pz = round(centres[1], 3)  # the panel's bay
    for sx in (-1, 1):
        a, b = sorted([sx * (hx - PAD - GAP), sx * 0.94])
        for (y0, y1) in rows:
            boxes.append({"min": [round(a, 3), y0, hz - PAD], "max": [round(b, 3), y1, hz], "mat": "grate", "tile": 0.5, "collide": False})
    # dented bumper rails over the quilt (low enough to stay out of the
    # collision rays' way: none of this collides; the shell does)
    R0, R1 = 0.95, 1.07
    boxes.append({"min": [-hx + PAD, R0, -hz + PAD + 0.07], "max": [-hx + PAD + 0.06, R1, -0.2], "mat": "rust", "tile": 1.0, "collide": False})
    boxes.append({"min": [-hx + PAD, R0 - 0.03, -0.18], "max": [-hx + PAD + 0.06, R1 - 0.03, hz - 0.05], "mat": "rust", "tile": 1.0, "collide": False, "pitch": 1.6})
    boxes.append({"min": [-hx + PAD, R0, -hz + PAD], "max": [hx - PAD, R1, -hz + PAD + 0.06], "mat": "rust", "tile": 1.0, "collide": False})
    boxes.append({"min": [hx - PAD - 0.06, R0, -hz + PAD + 0.07], "max": [hx - PAD, R1, pz - 0.3], "mat": "rust", "tile": 1.0, "collide": False})
    boxes.append({"min": [hx - PAD - 0.06, R0, pz + 0.3], "max": [hx - PAD, R1, hz - 0.05], "mat": "rust", "tile": 1.0, "collide": False})
    # the panel's steel surround, the sill plate inside the doors (REFUSE's
    # line), two ceiling ribs (a solid lid: no hatch, no way up -- C3)
    boxes.append({"min": [hx - 0.02, 0.6, pz - 0.29], "max": [hx, 2.0, pz + 0.29], "mat": "grate", "tile": 0.9, "collide": False})
    boxes.append({"min": [-0.86, 0, hz - 0.16], "max": [0.86, 0.012, hz], "mat": "rust", "tile": 0.8, "collide": False, "shadow": False})
    for z in (-0.85, 0.85):
        boxes.append({"min": [-hx, H - 0.09, z - 0.07], "max": [hx, H, z + 0.07], "mat": "rust", "tile": 1.2, "collide": False, "shadow": False})

    lit = 41  # the one lit button (props.js panel: column 5, row 6)
    bx, by = -0.15 + (lit % 6) * 0.06, 0.7 + 0.1 + (lit // 6) * 0.095 + 0.02
    button = [hx - 0.06, round(by, 3), round(pz + bx, 3)]
    ind = [0.0, 2.33, hz]  # the indicator, over the doors, facing in
    rec = {
        "name": "THE DESCENT",
        "size": [W, H, D],
        "floor": "grate", "wall": "rust", "ceiling": "rust",
        "tile": {"floor": 0.9, "wall": 2.0, "ceiling": 2.0},
        "skirt": {"mat": "grate", "h": 0.3, "t": 0.02, "tile": 0.9},  # diamond-plate kick band
        "ambient": {"color": "#ffd9a8", "intensity": 0.16},
        # C2: from the doors' side, aimed at the core
        "sun": {"from": [0.4, 3.0, 3.6], "color": "#ffd9a8", "intensity": 0.45},
        "lights": [
            # the caged bulb
            {"type": "point", "pos": [0, H - 0.42, 0.0], "color": "#ffcf9a", "intensity": 7.5, "distance": 6.5, "flicker": 0.2},
            # the lit button's real light on the real metal
            {"type": "point", "pos": [button[0] - 0.12, button[1], button[2]], "color": "#33ff77", "intensity": 1.1, "distance": 1.4, "id": "button_glow"},
            # the indicator's amber on the lintel
            {"type": "point", "pos": [0.0, 2.25, hz - 0.2], "color": "#ff9a3a", "intensity": 0.5, "distance": 1.1},
        ],
        "fog": {"color": "#0a0705", "near": 2.5, "far": 10},
        "exposure": 1.1,
        "vignette": 0.62,
        "spawn": [0, 0.6, 0],
        "holdEntry": True,  # the cab doors stay open behind him until he chooses
        "props": [
            prop("panel", [hx - 0.025, 0.7, pz], rot=-90, name="panel"),
            prop("clock", [-hx + PAD + 0.04, 1.92, 0.05], rot=90),
            prop("slip", [-0.55, 0.004, 0.75], rot=200),
            glb("lib_cagelamp", [0, H - 0.3, 0.0], fallback="cagebulb"),
            # the floor indicator: a housing with its dark segments, and one
            # lit layer per reading; the beats show one and hide the last
            prop("floorind", ind, rot=180, ghost=True, name="ind_face"),
            prop("floorind", ind, rot=180, text=" --", name="ind_dash"),
            prop("floorind", ind, rot=180, text=" b1", name="ind_b1", hidden=True),
            prop("floorind", ind, rot=180, text=" b2", name="ind_b2", hidden=True),
            prop("floorind", ind, rot=180, text=" b7", name="ind_b7", hidden=True),
            prop("floorind", ind, rot=180, text="b12", name="ind_b12", hidden=True),
            prop("floorind", ind, rot=180, text=" = ", name="ind_glyph", hidden=True),
            # the scissor gate just inside the doors, folded against the
            # jamb on arrival; three frames of its close
            prop("scissorgate", [0.0, 0, hz - 0.01], rot=180, w=1.6, h=2.1, ext=0.1, link="lp_brass", name="gate_0"),
            prop("scissorgate", [0.0, 0, hz - 0.01], rot=180, w=1.6, h=2.1, ext=0.55, link="lp_brass", name="gate_1", hidden=True),
            prop("scissorgate", [0.0, 0, hz - 0.01], rot=180, w=1.6, h=2.1, ext=1.0, link="lp_brass", name="gate_2", hidden=True),
        ],
        "boxes": boxes,
        "footstep": {"filterHz": 1800, "gain": 0.12},
    }
    s = shots_for(rec, out_dist=0.6, leave_dist=1.0, loop_seconds=10.0)
    # IMG_IN: from the back of the cab, the doors open onto the dark;
    # IMG_OUT: at the panel, the gate and the doors shut, the indicator.
    # Doc 2 KLING C: the camera does not move, the cab does not shake --
    # the ride itself is the cab moving (scenes.json `ride`), never a shot.
    s["in"] = pose([-0.35, EYE, -1.15], [0.1, 1.45, hz + 2.0])
    s["out"] = pose([0.55, EYE, -0.6], [0.0, 1.95, hz])
    s["loop"] = {"from": "in", "to": "out", "seconds": 10.0, "pingpong": True, "ease": "inout", "sway": 0.0}
    s["leave"] = {"from": "out", "to": pose([0.2, EYE, 0.9], [0.0, 1.5, hz + 3.0]), "seconds": 3.0, "ease": "in", "fadeOut": 1.1}
    s["arrive"] = {"from": pose([0.0, EYE, hz + 1.6], [0.0, 1.5, -hz]), "to": pose([0.0, EYE, 0.4], [0.0, 1.45, -hz]), "seconds": 3.0, "ease": "out", "fadeIn": 1.0}
    rec["shots"] = s
    door(rec, "cab", "S", 0.0, w=1.6, h=2.2, kind="slide", mat="lp_dark", sill="rust", open=True)
    rec["entry"] = "cab"
    # REFUSE arms once he has been inside the cab: walking in through the
    # doorway must never read as refusing it
    zone(rec, "cab_inside", [0.0, -0.6], r=0.5, ring=0.5, box=[[-hx, -hz], [hx, 0.3]], silent=True)
    zone(rec, "panel", [0.95, button[2]], r=0.42, ring=1.8, label_at=[hx - 0.12, 2.0, pz])
    # the whole doorway, jamb to jamb, from just inside the gate line out
    # into the landing: there is no slipping out past it once armed
    zone(rec, "doorway", [0.0, 1.95], r=0.45, ring=1.0, box=[[-0.8, 1.55], [0.8, 2.5]], armAfter="cab_inside", label_at=[0.0, 2.0, 1.95])
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
        "S1_C": waiting_room(False, dark_front=True),
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
