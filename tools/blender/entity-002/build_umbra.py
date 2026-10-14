"""Builds ENTITY 002 — UMBRA: a floating shadow wraith, and exports the web asset.

Run:  blender -b --factory-startup --python tools/blender/entity-002/build_umbra.py -- [cinematic|optimized|all] [--no-export]

Blender space: +Z up, -Y is the creature's front. The figure is ~1.6 m tall and
floats; nothing touches the ground. Every number is an art decision:
- a hooded, chin-pointed skull, not a round head, so the grin sits in a face;
- an asymmetric crown of backswept blades (the tallest leans to its right);
- a ruff of spikes around the neck that frames a single crimson gem;
- long, thin arms ending in five curved claws, built as a joint chain;
- a body that never ends: it frays into cloth-like tatters and two torn
  wing-capes. Tatters carry vertex colours (R = flutter weight from root to tip,
  G = torn-edge glow) that the web shader animates and lights.
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SOURCE_DIR = os.path.join(REPO, "assets", "source", "entity-002")
PUBLIC_DIR = os.path.join(REPO, "public", "3d", "entity-002")

QUALITY = {
    "cinematic": {"head": (112, 80), "sides": 12, "ribbon": 18},
    "optimized": {"head": (64, 44), "sides": 7, "ribbon": 10},
}

P = {
    "body": Vector((0, 0, 0.95)),
    "torso": Vector((0, 0.02, 0.86)),
    "neck": Vector((0, 0.03, 1.1)),
    "head": Vector((0, 0.0, 1.32)),
    "shoulder_l": Vector((0.25, 0.02, 1.03)),
    "shoulder_r": Vector((-0.25, 0.02, 1.03)),
}
HEAD_R = Vector((0.235, 0.23, 0.27))


# --------------------------------------------------------------------------- scene helpers

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 30


def collection():
    col = bpy.data.collections.get("UMBRA") or bpy.data.collections.new("UMBRA")
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    return col


def world_of(node):
    total = Vector()
    while node is not None:
        total += node.location
        node = node.parent
    return total


def empty(name, location, parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_size = 0.04
    collection().objects.link(obj)
    if parent is not None:
        obj.parent = parent
        obj.location = Vector(location) - world_of(parent)
    else:
        obj.location = location
    obj["ovra_role"] = "control"
    return obj


def mesh_object(name, bm, material, parent, smooth=True, role="static"):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    if parent is not None:
        mesh.transform(Matrix.Translation(-world_of(parent)))
    for poly in mesh.polygons:
        poly.use_smooth = smooth
    if mesh.color_attributes:
        # The exporter writes only the active colour layer (COLOR_0).
        mesh.color_attributes.active_color = mesh.color_attributes[0]
        mesh.color_attributes.render_color_index = 0
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    collection().objects.link(obj)
    obj.parent = parent
    obj["ovra_role"] = role
    return obj


def principled(name, base, roughness, metallic=0.0, emission=None, strength=0.0, coat=0.0, sheen=0.0, sheen_tint=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = srgb(base)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if coat:
        bsdf.inputs["Coat Weight"].default_value = coat
        bsdf.inputs["Coat Roughness"].default_value = 0.3
    if sheen:
        bsdf.inputs["Sheen Weight"].default_value = sheen
        bsdf.inputs["Sheen Tint"].default_value = srgb(sheen_tint or base)
    if emission:
        bsdf.inputs["Emission Color"].default_value = srgb(emission)
        bsdf.inputs["Emission Strength"].default_value = strength
    mat.use_backface_culling = False
    return mat


def srgb(hex_color):
    h = hex_color.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c) + (1.0,)


def materials():
    return {
        # Living shadow: near-black violet with a purple sheen at grazing angles.
        "shadow": principled("M_Shadow", "#120b17", 0.5, sheen=0.7, sheen_tint="#6b3a8c", coat=0.25),
        # Tatters: matte, slightly translucent-looking cloth of the same shadow.
        "tatter": principled("M_Tatter", "#140a1a", 0.72, sheen=0.5, sheen_tint="#7a2a55"),
        # Horn blades and claws: glossy obsidian.
        "horn": principled("M_Horn", "#16101c", 0.24, coat=0.6),
        "bone": principled("M_Bone", "#d9d0c4", 0.42),
        "eye": principled("M_EyeGlow", "#2a0008", 0.3, emission="#ff2448", strength=9.0),
        "gem": principled("M_Gem", "#3a0010", 0.08, emission="#ff1a3a", strength=5.0, coat=1.0),
        "maw": principled("M_MawGlow", "#1a0006", 0.6, emission="#b0102c", strength=2.5),
    }


# --------------------------------------------------------------------------- geometry helpers

def bezier(p0, p1, p2, p3, n):
    out = []
    for i in range(n + 1):
        t = i / n
        a = (1 - t) ** 3
        b = 3 * (1 - t) ** 2 * t
        c = 3 * (1 - t) * t * t
        d = t ** 3
        out.append(p0 * a + p1 * b + p2 * c + p3 * d)
    return out


def sweep(points, radii, sides, flat=1.0, twist_up=Vector((0, 0, 1))):
    """Tube along a polyline. flat < 1 squashes the section into a blade."""
    bm = bmesh.new()
    rings = []
    normal = None
    for i, p in enumerate(points):
        t = (points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]).normalized()
        if normal is None:
            normal = t.cross(twist_up)
            if normal.length < 1e-4:
                normal = t.orthogonal()
            normal.normalize()
        else:
            normal = (normal - t * normal.dot(t)).normalized()
        binormal = t.cross(normal)
        ring = []
        for k in range(sides):
            a = 2 * math.pi * k / sides
            offset = normal * math.cos(a) * radii[i] + binormal * math.sin(a) * radii[i] * flat
            ring.append(bm.verts.new(p + offset))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(sides):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % sides], rings[i + 1][(k + 1) % sides], rings[i + 1][k]))
    bm.faces.new(list(reversed(rings[0])))
    tip = bm.verts.new(points[-1] + (points[-1] - points[-2]).normalized() * radii[-1] * 0.5)
    for k in range(sides):
        bm.faces.new((rings[-1][k], rings[-1][(k + 1) % sides], tip))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


def flame(n, peak):
    """Width profile of a torn flame: narrow root, full belly, needle tip."""
    return [peak * (0.35 + 0.65 * math.sin(math.pi * min(1.0, i / n * 1.15)) ** 0.8) * (1 - (i / n) ** 3) + 0.002 for i in range(n + 1)]


def taper(n, r0, r1, power=1.0):
    return [r0 + (r1 - r0) * (i / n) ** power for i in range(n + 1)]


def merge(target, source):
    """Append bmesh `source` into `target` (both world space)."""
    mesh = bpy.data.meshes.new("tmp")
    source.to_mesh(mesh)
    source.free()
    target.from_mesh(mesh)
    bpy.data.meshes.remove(mesh)


def ribbon(points, widths, sideways, rng, tear=0.35, segments_across=2):
    """A torn cloth strip. Vertex colour R = flutter (root 0 → tip 1), G = edge glow."""
    bm = bmesh.new()
    color = bm.loops.layers.color.new("Col")
    n = len(points) - 1
    rows = []
    for i, p in enumerate(points):
        t = i / n
        # Tears: random notches eat into the width along the strip.
        notch = 1.0 - tear * max(0.0, rng.random() - 0.55) * 2.2 * t
        w = widths[i] * notch
        row = []
        for j in range(segments_across + 1):
            s = j / segments_across * 2 - 1
            jag = (rng.random() - 0.5) * 0.012 * t
            row.append(bm.verts.new(p + sideways * (s * w + jag)))
        rows.append(row)
    flutter, edge = {}, {}
    for i, row in enumerate(rows):
        t = i / n
        for j, v in enumerate(row):
            border = 1.0 if j in (0, segments_across) else 0.0
            flutter[v] = t ** 1.3
            edge[v] = min(1.0, border * (0.25 + 0.75 * t) + max(0.0, t - 0.82) * 4.0)
    for i in range(n):
        for j in range(segments_across):
            bm.faces.new((rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]))
    # A ragged tip: uneven teeth instead of a straight cut.
    last = rows[-1]
    for j, v in enumerate(last):
        v.co += (points[-1] - points[-2]).normalized() * rng.uniform(0.0, 0.07)
    for face in bm.faces:
        for loop in face.loops:
            loop[color] = (flutter[loop.vert], edge[loop.vert], 0.0, 1.0)
    return bm


# --------------------------------------------------------------------------- parts

def brow_line(u):
    """The brow drops toward the midline: an angry V over the eyes."""
    return 0.2 + 0.24 * min(1.0, abs(u) / 0.75)


def grin_line(u):
    return -0.24 + 0.52 * u * u


def grin_half(u):
    return 0.075 * (1 - 0.6 * min(1.0, abs(u) / 0.86))


def head_geometry(q):
    """Broad hooded skull: heavy V brow, sunken slanted eyes, a grin from cheek to cheek."""
    bm = bmesh.new()
    u_seg, v_seg = q["head"]
    bmesh.ops.create_uvsphere(bm, u_segments=u_seg, v_segments=v_seg, radius=1.0)
    for v in bm.verts:
        x, y, z = v.co
        X, Y, Z = x * HEAD_R.x, y * HEAD_R.y, z * HEAD_R.z
        # Cheeks widen at eye level; the jaw narrows to a blunt chin.
        X *= 1 + 0.12 * math.exp(-((z + 0.05) / 0.35) ** 2)
        if z < 0:
            k = (-z) ** 1.6
            X *= 1 - 0.2 * k
            Y *= 1 - 0.18 * k
            Z *= 1 + 0.18 * (-z) ** 2
        front = max(0.0, -y)
        # Overhanging brow ridge following the V line.
        b = math.exp(-((z - brow_line(x)) / 0.1) ** 2) * front ** 1.5 * (1 - 0.3 * abs(x))
        Y -= b * 0.07
        Z -= b * 0.012
        # The crown sweeps back into a hood.
        back = max(0.0, y) * max(0.0, z + 0.3)
        Y += back ** 2 * 0.32
        Z += back ** 2 * 0.09
        if y < -0.1:
            u, w = x, z
            depth = 0.0
            for side in (-1, 1):
                cu, cw, ang = side * 0.38, 0.07, side * math.radians(22)
                du, dw = u - cu, w - cw
                a = du * math.cos(ang) + dw * math.sin(ang)
                bb = -du * math.sin(ang) + dw * math.cos(ang)
                e = (a / 0.24) ** 2 + (bb / 0.1) ** 2
                if e < 1.8:
                    depth = max(depth, 0.04 * max(0.0, 1 - e / 1.8) ** 0.6)
            if abs(u) < 0.9:
                half = grin_half(u)
                e = abs(w - grin_line(u)) / max(half, 1e-3)
                if e < 1.4:
                    depth = max(depth, 0.035 * max(0.0, 1 - e / 1.4) ** 0.5 * (1 - (abs(u) / 0.9) ** 4))
            Y += depth * front
        v.co = (X, Y, Z)
    bm.normal_update()
    bmesh.ops.translate(bm, verts=bm.verts, vec=P["head"])
    return bm


def face_point(u, w, inset=0.0):
    """Approximate point on the deformed face for face coordinates (u, w)."""
    x, z = u, w
    y = -math.sqrt(max(0.0, 1 - x * x - z * z))
    X, Y, Z = x * HEAD_R.x, y * HEAD_R.y, z * HEAD_R.z
    X *= 1 + 0.12 * math.exp(-((z + 0.05) / 0.35) ** 2)
    if z < 0:
        k = (-z) ** 1.6
        X *= 1 - 0.38 * k
        Y *= 1 - 0.18 * k
        Z *= 1 + 0.18 * (-z) ** 2
    return P["head"] + Vector((X, Y + inset, Z))


def teeth(rng):
    """Few, large, uneven fangs; the rows interlock like a trap."""
    bm = bmesh.new()
    for sign, count, offset in ((-1, 10, 0.0), (1, 9, 0.5)):
        for i in range(count):
            u = -0.74 + 1.48 * (i + offset) / (count - 1 + offset)
            half = grin_half(u)
            base = face_point(u, grin_line(u) - sign * half * 0.85, inset=0.012)
            size = (0.05 - 0.028 * abs(u)) * rng.uniform(0.7, 1.25)
            tip = base + Vector((0, -0.006, sign * size))
            merge(bm, sweep([base, base.lerp(tip, 0.45), tip], [size * 0.36, size * 0.2, 0.0006], 4, flat=0.5))
    return bm


def maw():
    """The dark cavity behind the grin; it glows faintly crimson when amused."""
    bm = bmesh.new()
    pts, widths = [], []
    for i in range(25):
        u = -0.8 + 1.6 * i / 24
        pts.append(face_point(u * 0.97, grin_line(u), inset=0.03))
        widths.append(0.016 * (1 - (abs(u) / 0.84) ** 2) + 0.002)
    return sweep(pts, widths, 6, flat=0.45)


def hood(q, rng):
    """A ragged cowl around the skull, open at the face and pierced by the horns.
    It falls over the shoulders; R = flutter (crown fixed, hem free), G = torn edge."""
    bm = bmesh.new()
    color = bm.loops.layers.color.new("Col")
    nu, nv = (40, 16) if q["sides"] > 8 else (24, 10)
    rows, data = [], {}
    for i in range(nv + 1):
        v = i / nv
        phi = math.radians(8 + 122 * v)
        gap = math.radians(70 - 32 * (1 - v))
        row = []
        for j in range(nu + 1):
            u = j / nu
            th = gap + u * (2 * math.pi - 2 * gap)
            rx = HEAD_R.x * 1.3 + 0.1 * v ** 1.5
            ry = HEAD_R.y * 1.35 + 0.08 * v ** 1.5
            rz = HEAD_R.z * 1.22
            x = math.sin(th) * math.sin(phi) * rx
            y = -math.cos(th) * math.sin(phi) * ry + 0.04 + 0.1 * v
            z = math.cos(phi) * rz + 0.05 - max(0.0, v - 0.55) * 0.55
            if i == nv:
                z -= rng.uniform(0.0, 0.14)
            vert = bm.verts.new(P["head"] + Vector((x, y, z)))
            edge_u = 1.0 - min(u, 1 - u) / 0.08
            data[vert] = (v ** 1.6, min(1.0, max(0.0, edge_u) * 0.8 + max(0.0, v - 0.8) * 4.0))
            row.append(vert)
        rows.append(row)
    for i in range(nv):
        for j in range(nu):
            face = bm.faces.new((rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]))
            for loop in face.loops:
                f, e = data[loop.vert]
                loop[color] = (f, e, 0.0, 1.0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


def eye_geometry(side):
    """Slanted almond lens set in the socket; the web shader draws a slit pupil."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=14, radius=1.0)
    bmesh.ops.scale(bm, vec=(0.075, 0.02, 0.026), verts=bm.verts)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(side * math.radians(-22), 3, "Y"))
    centre = face_point(side * 0.38, 0.07, inset=0.03)
    bmesh.ops.translate(bm, verts=bm.verts, vec=centre)
    return bm, centre


def blade(base, direction, length, width, curl, sides, rng, flat=0.45, face=Vector((0, -1, 0))):
    """A curved, flattened spike whose broad side faces `face` (the viewer by default)."""
    d = Vector(direction).normalized()
    side = d.cross(Vector((0, 0, 1)))
    if side.length < 1e-3:
        side = Vector((1, 0, 0))
    side.normalize()
    bend = d.cross(side).normalized()
    p0 = Vector(base)
    p3 = p0 + d * length + Vector((0, curl * length, -abs(curl) * 0.2 * length))
    p1 = p0 + d * length * 0.35
    p2 = p0 + d * length * 0.75 + Vector((0, curl * length * 0.5, 0)) + bend * length * 0.04
    pts = bezier(p0, p1, p2, p3, 9)
    radii = [width * (1 - (i / 9) ** 1.6) + 0.0015 for i in range(10)]
    return sweep(pts, radii, sides, flat=flat, twist_up=face)


def crown(q, rng):
    """Five broad flame blades, asymmetric, plus a mane of smaller spikes."""
    h = P["head"]
    specs = [
        # base offset, direction, length, width, curl back
        # Scythe horns from the temples, sweeping back; the left one is longer.
        ((0.14, -0.01, 0.13), (0.5, 0.85, 0.75), 0.62, 0.06, 0.55),
        ((-0.14, -0.01, 0.13), (-0.5, 0.85, 0.65), 0.52, 0.055, 0.6),
        # A crest of blades along the midline, rising from the brow into a hood.
        ((0.0, -0.02, 0.25), (0.0, 0.45, 1.0), 0.44, 0.07, 0.3),
        ((0.0, 0.13, 0.22), (0.0, 1.0, 0.65), 0.38, 0.065, 0.2),
        ((0.0, 0.24, 0.08), (0.0, 1.0, 0.15), 0.3, 0.055, 0.1),
    ]
    bm = bmesh.new()
    for off, d, length, width, curl in specs:
        merge(bm, blade(h + Vector(off), d, length, width, curl, q["sides"], rng, flat=0.28))
    # Mane: a shaggy ring of jagged spikes around the back and sides of the skull.
    for i in range(22):
        # The mane only frames the back of the skull and the nape.
        a = math.radians(-70 + 140 * i / 21) + rng.uniform(-0.05, 0.05)
        el = rng.uniform(-0.7, 0.15)
        d = Vector((math.sin(a) * math.cos(el), math.cos(a) * math.cos(el) * 0.9 + 0.35, math.sin(el)))
        base = h + Vector((d.x * HEAD_R.x * 0.85, d.y * HEAD_R.y * 0.85, d.z * HEAD_R.z * 0.85))
        out = d + Vector((0, 0.5, -0.2))
        merge(bm, blade(base, out, rng.uniform(0.09, 0.2), rng.uniform(0.025, 0.04), 0.1, max(4, q["sides"] // 2), rng, flat=0.3))
    return bm


def ruff(q, rng):
    """A chest of layered blades, like scorched feathers, framing the gem."""
    bm = bmesh.new()
    centre = P["neck"] + Vector((0, 0.0, -0.05))
    for layer in range(3):
        n = 12 + layer * 3
        z = centre.z + 0.02 - layer * 0.1
        radius = 0.12 + layer * 0.05
        for i in range(n):
            a = 2 * math.pi * (i + 0.5 * layer) / n + rng.uniform(-0.08, 0.08)
            out = Vector((math.sin(a), -math.cos(a) * 0.85, 0))
            base = Vector((0, centre.y, z)) + out * radius
            front = max(0.0, math.cos(a))
            length = rng.uniform(0.12, 0.22) * (1 + 0.25 * layer) * (0.85 + 0.3 * front)
            d = out * (0.75 - 0.15 * layer) + Vector((0, 0, -1.0))
            tangent = Vector((math.cos(a), math.sin(a) * 0.85, 0))
            merge(bm, blade(base, d, length, rng.uniform(0.06, 0.085), rng.uniform(-0.1, 0.1), max(4, q["sides"] // 2), rng,
                            flat=0.2, face=out.cross(tangent).normalized() if out.cross(tangent).length > 1e-3 else Vector((0, -1, 0))))
    return bm


def gem():
    bm = bmesh.new()
    c = P["neck"] + Vector((0, -0.165, -0.1))
    top, bottom = c + Vector((0, -0.005, 0.06)), c + Vector((0, -0.005, -0.075))
    ring = [bm.verts.new(c + Vector((math.cos(a) * 0.04, -0.02 + math.sin(a) * 0.022, 0))) for a in
            [2 * math.pi * k / 6 for k in range(6)]]
    t, b = bm.verts.new(top), bm.verts.new(bottom)
    for k in range(6):
        bm.faces.new((ring[k], ring[(k + 1) % 6], t))
        bm.faces.new((ring[(k + 1) % 6], ring[k], b))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


def torso(q):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=q["head"][0] // 2, v_segments=q["head"][1] // 2, radius=1.0)
    for v in bm.verts:
        x, y, z = v.co
        k = 1.0 if z > 0 else 1 - 0.35 * (-z)
        v.co = Vector((x * 0.17 * k, y * 0.14 * k, z * 0.26)) + P["torso"]
        if z > 0.6:
            v.co.x *= 0.75
    # The neck: a short tapered column into the skull.
    merge(bm, sweep([P["torso"] + Vector((0, 0, 0.2)), P["neck"], P["head"] + Vector((0, 0.02, -0.12))],
                    [0.075, 0.06, 0.05], q["sides"]))
    return bm


def tatters(q, rng):
    """The body frays into hanging strips that flare outward and trail back."""
    bm = bmesh.new()
    n = 24
    for i in range(n):
        a = 2 * math.pi * (i + rng.uniform(-0.3, 0.3)) / n
        out = Vector((math.sin(a), -math.cos(a) * 0.85, 0))
        back = max(0.0, -math.cos(a + math.pi))  # 1 at the back
        root = P["torso"] + out * 0.15 + Vector((0, 0, -0.12))
        length = rng.uniform(0.45, 0.75) * (1.0 + 0.4 * back)
        tip = root + out * length * 0.45 + Vector((0, 0.18 * back, -length))
        sway = Vector((rng.uniform(-0.06, 0.06), 0, 0))
        pts = bezier(root, root + Vector((0, 0, -length * 0.35)) + out * 0.03, tip + Vector((0, 0, length * 0.25)) + sway, tip, q["ribbon"])
        widths = flame(q["ribbon"], rng.uniform(0.045, 0.07))
        sideways = Vector((math.cos(a), math.sin(a) * 0.85, 0)).normalized()
        merge(bm, ribbon(pts, widths, sideways, rng))
    return bm


def wing(side, q, rng):
    """Torn wing-capes: three long strips per shoulder, sweeping out and back."""
    bm = bmesh.new()
    s = P["shoulder_l"] if side > 0 else P["shoulder_r"]
    for k in range(3):
        root = s + Vector((side * -0.03 * k, 0.07 + 0.03 * k, 0.03 - 0.06 * k))
        reach = 0.6 + 0.16 * (2 - k) + rng.uniform(-0.05, 0.05)
        tip = root + Vector((side * reach * 0.95, 0.3 + 0.12 * k, -0.2 - 0.28 * k))
        c1 = root + Vector((side * reach * 0.45, 0.05, 0.3 - 0.08 * k))
        c2 = tip + Vector((-side * 0.05, -0.05, 0.25))
        pts = bezier(root, c1, c2, tip, q["ribbon"])
        widths = flame(q["ribbon"], 0.07 + 0.02 * (2 - k))
        sideways = Vector((0, 0.35, 1.0)).normalized()
        merge(bm, ribbon(pts, widths, sideways, rng, tear=0.5))
    return bm


def arm(side, q, rng, root):
    """Shoulder → elbow → wrist → hand chain; each joint is a control node."""
    shoulder = P["shoulder_l"] if side > 0 else P["shoulder_r"]
    elbow = shoulder + Vector((side * 0.22, -0.08, -0.22))
    wrist = elbow + Vector((side * 0.07, -0.25, 0.05))
    name = "L" if side > 0 else "R"
    c_sh = empty(f"CTRL_SHOULDER_{name}", shoulder, root)
    c_el = empty(f"CTRL_ELBOW_{name}", elbow, c_sh)
    c_wr = empty(f"CTRL_WRIST_{name}", wrist, c_el)
    upper = sweep(bezier(shoulder, shoulder.lerp(elbow, 0.33) + Vector((0, 0, 0.03)), shoulder.lerp(elbow, 0.7), elbow, 8),
                  taper(8, 0.07, 0.048), q["sides"])
    fore = sweep(bezier(elbow, elbow.lerp(wrist, 0.35), elbow.lerp(wrist, 0.7), wrist, 8), [0.048, 0.056, 0.055, 0.05, 0.045, 0.04, 0.036, 0.033, 0.032], q["sides"])
    hand = bmesh.new()
    bmesh.ops.create_uvsphere(hand, u_segments=12, v_segments=8, radius=1.0)
    bmesh.ops.scale(hand, vec=(0.06, 0.055, 0.03), verts=hand.verts)
    bmesh.ops.translate(hand, verts=hand.verts, vec=wrist + Vector((side * 0.03, -0.025, -0.005)))
    claws = bmesh.new()
    palm = wrist + Vector((side * 0.045, -0.04, -0.01))
    for f in range(5):
        spread = (f - 2) * 0.32
        thumb = f == 0
        d = Vector((side * math.cos(spread) * (0.4 if thumb else 1.0), -0.55 - 0.2 * thumb, -math.sin(spread) * 0.9 - 0.25))
        length = 0.17 if thumb else (0.29 - 0.03 * abs(f - 2.5))
        merge(claws, blade(palm, d, length, 0.02, -0.3, max(5, q["sides"] // 2), rng, flat=0.6))
    # Spurs on the elbow and forearm, pointing back.
    for k, at in enumerate((0.0, 0.35, 0.6)):
        base = elbow.lerp(wrist, at) + Vector((0, 0.03, 0.02))
        merge(claws, blade(base, Vector((side * 0.3, 0.9, 0.35 - 0.2 * k)), 0.16 - 0.04 * k, 0.03, 0.2, max(4, q["sides"] // 2), rng, flat=0.3))
    shadow, horn, tatter = MATS["shadow"], MATS["horn"], MATS["tatter"]
    mesh_object(f"geo_upperarm_{name}", upper, shadow, c_sh)
    mesh_object(f"geo_forearm_{name}", fore, shadow, c_el)
    mesh_object(f"geo_hand_{name}", hand, shadow, c_wr)
    mesh_object(f"geo_claws_{name}", claws, horn, c_wr, role="claws")
    # Torn sleeves hang from the forearm.
    sleeves = bmesh.new()
    for k in range(2):
        r0 = elbow.lerp(wrist, 0.2 + 0.35 * k)
        tip = r0 + Vector((side * 0.06, 0.12, -0.32 - 0.1 * k))
        pts = bezier(r0, r0 + Vector((0, 0.02, -0.08)), tip + Vector((0, -0.03, 0.12)), tip, q["ribbon"] // 2 + 2)
        merge(sleeves, ribbon(pts, taper(len(pts) - 1, 0.04, 0.018), Vector((1, 0.2, 0)).normalized(), rng))
    mesh_object(f"geo_sleeve_{name}", sleeves, tatter, c_el, role="tatter")


MATS = {}


def build(quality):
    reset()
    q = QUALITY[quality]
    rng = random.Random(2002)
    MATS.clear()
    MATS.update(materials())
    root = empty("UMBRA_ROOT", (0, 0, 0))
    root["ovra_role"] = "root"
    body = empty("CTRL_BODY", P["body"], root)
    torso_c = empty("CTRL_TORSO", P["torso"], body)
    neck = empty("CTRL_NECK", P["neck"], torso_c)
    look = empty("CTRL_LOOK", P["head"] + Vector((0, 0.02, -0.14)), neck)
    head = empty("CTRL_HEAD", P["head"], look)
    mesh_object("geo_head", head_geometry(q), MATS["shadow"], head)
    mesh_object("geo_teeth", teeth(rng), MATS["bone"], head)
    mesh_object("geo_maw", maw(), MATS["maw"], head, role="maw")
    mesh_object("geo_crown", crown(q, rng), MATS["horn"], head)
    mesh_object("geo_hood", hood(q, rng), MATS["tatter"], head, role="tatter")
    for side, name in ((1, "L"), (-1, "R")):
        bm, centre = eye_geometry(side)
        ctrl = empty(f"CTRL_EYE_{name}", centre, head)
        ctrl["ovra_role"] = "eye"
        mesh_object(f"geo_eye_{name}", bm, MATS["eye"], ctrl, role="eye")
    mesh_object("geo_torso", torso(q), MATS["shadow"], torso_c)
    mesh_object("geo_ruff", ruff(q, rng), MATS["horn"], torso_c)
    gem_c = empty("CTRL_GEM", P["neck"] + Vector((0, -0.17, -0.1)), torso_c)
    mesh_object("geo_gem", gem(), MATS["gem"], gem_c, smooth=False, role="gem")
    mesh_object("geo_tatters", tatters(q, rng), MATS["tatter"], torso_c, role="tatter")
    for side, name in ((1, "L"), (-1, "R")):
        mesh_object(f"geo_wing_{name}", wing(side, q, rng), MATS["tatter"], torso_c, role="tatter")
        arm(side, q, rng, torso_c)
    return root


def export(quality):
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    path = os.path.join(PUBLIC_DIR, f"umbra-{quality}.glb")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", export_yup=True, export_apply=True, export_extras=True,
        export_materials="EXPORT", export_vertex_color="ACTIVE", export_all_vertex_colors=False,
        export_animations=False, export_cameras=False, export_lights=False,
    )
    print("exported", path, os.path.getsize(path))


def save_source():
    os.makedirs(SOURCE_DIR, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SOURCE_DIR, "umbra.blend"))


if __name__ == "__main__" and "--" in sys.argv:
    args = sys.argv[sys.argv.index("--") + 1:]
    qualities = [a for a in args if a in QUALITY] or list(QUALITY)
    for quality in qualities:
        build(quality)
        if "--no-export" not in args:
            if quality == "cinematic":
                save_source()
            export(quality)
