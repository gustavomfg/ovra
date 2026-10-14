"""Builds ENTITY 002 — UMBRA: a floating shadow wraith, and exports the web asset.

Run:  blender -b --factory-startup --python tools/blender/entity-002/build_umbra.py -- [cinematic|optimized|all] [--no-export]

Blender space: +Z up, -Y is the creature's front. The figure is ~1.6 m tall and
floats; nothing touches the ground. Every number is an art decision:
- a broad, angular mask with real eye sockets and an open, interlocking grin;
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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from surface_textures import apply_maps, make_maps

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
    "neck": Vector((0, 0.03, 1.13)),
    "head": Vector((0, 0.0, 1.47)),
    "shoulder_l": Vector((0.31, 0.02, 1.12)),
    "shoulder_r": Vector((-0.31, 0.02, 1.12)),
}
HEAD_R = Vector((0.365, 0.265, 0.30))


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
    if smooth is not None:
        for poly in mesh.polygons:
            poly.use_smooth = smooth
    if mesh.color_attributes:
        # The exporter writes only the active colour layer (COLOR_0).
        mesh.color_attributes.active_color = mesh.color_attributes[0]
        mesh.color_attributes.render_color_index = 0
    mesh.materials.append(material)
    # Cylindrical UVs, with a corrected seam per face. Preserve the separate
    # vertex-colour channel: it carries cloth motion weights, never albedo.
    uv = mesh.uv_layers.new(name="Surface")
    coords = [v.co for v in mesh.vertices]
    min_z, max_z = min(v.z for v in coords), max(v.z for v in coords)
    for poly in mesh.polygons:
        us = [math.atan2(mesh.vertices[mesh.loops[i].vertex_index].co.x,
                        -mesh.vertices[mesh.loops[i].vertex_index].co.y) / (2 * math.pi) + .5 for i in poly.loop_indices]
        crosses = max(us) - min(us) > .5
        for i, u in zip(poly.loop_indices, us):
            co = mesh.vertices[mesh.loops[i].vertex_index].co
            uv.data[i].uv = (u + (1 if crosses and u < .5 else 0), (co.z - min_z) / max(.001, max_z - min_z))
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
    result = {
        # Living shadow: near-black violet with a purple sheen at grazing angles.
        "shadow": principled("M_Shadow", "#29232e", 0.52, metallic=.22, sheen=.15, sheen_tint="#796586", coat=.035),
        # Tatters: matte, slightly translucent-looking cloth of the same shadow.
        "tatter": principled("M_Tatter", "#332b39", 0.74, sheen=.18, sheen_tint="#746278"),
        # Horn blades and claws: glossy obsidian.
        "horn": principled("M_Horn", "#2a2431", 0.34, metallic=.4, coat=.22),
        "bone": principled("M_Bone", "#c3afb8", 0.62),
        "eye": principled("M_EyeGlow", "#260411", 0.24, emission="#ff467d", strength=2.8, coat=.25),
        "gem": principled("M_Gem", "#42091f", 0.18, emission="#f62462", strength=1.6, coat=.65),
        "maw": principled("M_MawGlow", "#09040a", 0.9, emission="#6c1230", strength=.12),
    }
    maps = make_maps(os.path.join(SOURCE_DIR, "textures"))
    for name in ("shadow", "horn", "tatter"):
        apply_maps(result[name], maps, .38 if name == "horn" else .65)
    return result


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
        notch = 1.0 - tear * max(0.0, rng.random() - .35) * 1.7 * t
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
            if i > n * .3 and segments_across > 2 and 0 < j < segments_across - 1 and rng.random() < .10:
                continue
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
    return -0.40 + 0.57 * u * u


def grin_half(u):
    return 0.14 * (1 - 0.8 * min(1.0, abs(u) / 0.92))


def head_geometry(q):
    """Broad hooded skull: heavy V brow, sunken slanted eyes, a grin from cheek to cheek."""
    bm = bmesh.new()
    u_seg, v_seg = q["head"]
    bmesh.ops.create_uvsphere(bm, u_segments=u_seg, v_segments=v_seg, radius=1.0)
    reference = {v: v.co.copy() for v in bm.verts}
    for v in bm.verts:
        x, y, z = v.co
        X, Y, Z = x * HEAD_R.x, y * HEAD_R.y, z * HEAD_R.z
        # Cheeks widen at eye level; the jaw narrows to a blunt chin.
        X *= 1 + 0.12 * math.exp(-((z + 0.05) / 0.35) ** 2)
        if z < 0:
            k = (-z) ** 1.6
            X *= 1 - 0.28 * k
            Y *= 1 - 0.18 * k
            Z *= 1 + 0.18 * (-z) ** 2
        front = max(0.0, -y)
        # Overhanging brow ridge following the V line.
        b = math.exp(-((z - brow_line(x)) / 0.1) ** 2) * front ** 1.5 * (1 - 0.3 * abs(x))
        Y -= b * 0.045
        Z -= b * 0.012
        # The crown sweeps back into a hood.
        back = max(0.0, y) * max(0.0, z + 0.3)
        Y += back ** 2 * 0.11
        Z += back ** 2 * 0.035
        # Three raised, swept forehead ridges join the crown to the mask.
        for side in (-1, 0, 1):
            ridge = math.exp(-((x - side * (.18 + .32 * max(0, z))) / .07) ** 2)
            Y -= ridge * max(0, z) * front ** 2 * .018
        if y < -0.1:
            u, w = x, z
            depth = 0.0
            for side in (-1, 1):
                cu, cw, ang = side * 0.43, 0.08, side * math.radians(27)
                du, dw = u - cu, w - cw
                a = du * math.cos(ang) + dw * math.sin(ang)
                bb = -du * math.sin(ang) + dw * math.cos(ang)
                e = (a / 0.33) ** 2 + (bb / 0.17) ** 2
                if e < 1.8:
                    depth = max(depth, 0.04 * max(0.0, 1 - e / 1.8) ** 0.6)
            if abs(u) < 0.9:
                half = grin_half(u)
                e = abs(w - grin_line(u)) / max(half, 1e-3)
                if e < 1.4:
                    depth = max(depth, 0.035 * max(0.0, 1 - e / 1.4) ** 0.5 * (1 - (abs(u) / 0.9) ** 4))
            Y += depth * front
        v.co = (X, Y, Z)
    # Open the grin and the eye sockets. Teeth sit inside a real cavity, rather
    # than on top of a closed sphere. The back of the skull remains continuous.
    openings = []
    for face in bm.faces:
        centre = sum((reference[v] for v in face.verts), Vector()) / len(face.verts)
        if centre.y > -.4:
            continue
        u, w = centre.x, centre.z
        mouth = abs(u) < .86 and abs(w - grin_line(u)) < grin_half(u) * .96
        eye = False
        for side in (-1, 1):
            ang = side * math.radians(27)
            du, dw = u - side * .43, w - .08
            a, b = du * math.cos(ang) + dw * math.sin(ang), -du * math.sin(ang) + dw * math.cos(ang)
            eye = eye or (a / .31) ** 2 + (b / .18) ** 2 < .92
        if mouth or eye:
            openings.append(face)
    bmesh.ops.delete(bm, geom=openings, context="FACES")
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
        X *= 1 - 0.28 * k
        Y *= 1 - 0.18 * k
        Z *= 1 + 0.18 * (-z) ** 2
    return P["head"] + Vector((X, Y + inset, Z))


def teeth(rng):
    """Few, large, uneven fangs; the rows interlock like a trap."""
    bm = bmesh.new()
    for sign, count, offset in ((-1, 13, 0.0), (1, 12, 0.5)):
        for i in range(count):
            u = -0.74 + 1.48 * (i + offset) / (count - 1 + offset)
            half = grin_half(u)
            base = face_point(u, grin_line(u) - sign * half * .78, inset=.022)
            size = (.046 - .017 * abs(u)) * rng.uniform(.8, 1.25)
            tip = base + Vector((rng.uniform(-.003, .003), -.009, sign * size))
            merge(bm, sweep([base, base.lerp(tip, .4), tip], [size * .32, size * .23, .0008], 5, flat=.72))
    return bm


def maw():
    """The dark cavity behind the grin; it glows faintly crimson when amused."""
    cavity = bmesh.new()
    rows = []
    for i in range(33):
        u = -.88 + 1.76 * i / 32
        row = []
        for j in range(5):
            w = grin_line(u) + (j / 4 * 2 - 1) * grin_half(u) * 1.18
            row.append(cavity.verts.new(face_point(u, w, inset=.045)))
        rows.append(row)
    for i in range(32):
        for j in range(4):
            cavity.faces.new((rows[i][j], rows[i][j+1], rows[i+1][j+1], rows[i+1][j]))
    bmesh.ops.recalc_face_normals(cavity, faces=cavity.faces[:])
    return cavity


def eye_geometry(side):
    """Slanted almond lens set in the socket; the web shader draws a slit pupil."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=24, radius=1.0)
    for v in bm.verts:
        v.co.x *= .115
        v.co.y *= .018
        v.co.z *= .058 * max(.15, max(0, 1 - (v.co.x / .115) ** 2) ** .3)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(side * math.radians(-27), 3, "Y"))
    centre = face_point(side * .43, .08, inset=.012)
    bmesh.ops.translate(bm, verts=bm.verts, vec=centre)
    return bm, centre


def blade(base, direction, length, width, curl, sides, rng, flat=0.45, face=Vector((0, -1, 0)), smooth=True):
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
    result = sweep(pts, radii, sides, flat=flat, twist_up=face)
    for poly in result.faces:
        poly.smooth = smooth
    return result


def crown(q, rng):
    """Five broad flame blades, asymmetric, plus a mane of smaller spikes."""
    h = P["head"]
    bm = bmesh.new()
    # Mane: a shaggy ring of jagged spikes around the back and sides of the skull.
    for i in range(22):
        # The mane only frames the back of the skull and the nape.
        a = math.radians(-70 + 140 * i / 21) + rng.uniform(-0.05, 0.05)
        el = rng.uniform(-0.7, 0.15)
        d = Vector((math.sin(a) * math.cos(el), math.cos(a) * math.cos(el) * 0.9 + 0.35, math.sin(el)))
        base = h + Vector((d.x * HEAD_R.x * 0.85, d.y * HEAD_R.y * 0.85, d.z * HEAD_R.z * 0.85))
        out = d + Vector((0, 0.5, -0.2))
        merge(bm, blade(base, out, rng.uniform(0.09, 0.2), rng.uniform(0.025, 0.04), 0.1, max(4, q["sides"] // 2), rng, flat=0.3))
    # Layered cheek blades: their front faces frame the eyes and the grin.
    for side in (-1, 1):
        for layer in range(3):
            for i in range(7):
                z = -.19 + i * .047 + layer * .018
                base = h + Vector((side * (.27 + layer * .025), .012 + layer * .062, z))
                direction = Vector((side * .92, .18, -.5 + i * .115))
                merge(bm, blade(base, direction, rng.uniform(.13, .25), rng.uniform(.027, .052), .14,
                                max(6, q["sides"] - 2), rng, flat=.28))
    return bm


def ruff(q, rng):
    """A chest of layered blades, like scorched feathers, framing the gem."""
    bm = bmesh.new()
    centre = P["neck"] + Vector((0, 0.0, -0.05))
    for layer in range(3):
        n = 12 + layer * 3
        z = centre.z + 0.02 - layer * 0.1
        radius = 0.17 + layer * 0.04
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


def mask_panels():
    """Continuous V-brow and crests rooted in the face, not separate radial cones.
    The polygon outlines are authored from the supplied reference silhouette.
    Each plate has a raised ridge, a rear skin and a thin closed edge.
    """
    bm = bmesh.new()
    h = P["head"]

    def plate(points, ridge, thickness=.014):
        front = [bm.verts.new(h + Vector(p)) for p in points]
        back = [bm.verts.new(h + Vector(p) + Vector((0, thickness, 0))) for p in points]
        centre = bm.verts.new(h + Vector(ridge))
        rear = bm.verts.new(h + Vector(ridge) + Vector((0, .045, 0)))
        for i in range(len(points)):
            j = (i + 1) % len(points)
            bm.faces.new((front[i], front[j], centre))
            bm.faces.new((back[j], back[i], rear))
            bm.faces.new((front[j], front[i], back[i], back[j]))

    # One broad, faceted brow follows the eye apertures and ends in the nose.
    brow = [(-.86, .32), (-.68, .40), (-.34, .16), (0, -.16), (.34, .16),
            (.68, .40), (.86, .32), (.70, .60), (.32, .72), (0, .84), (-.32, .72), (-.70, .60)]
    points = [tuple(face_point(u, w, -.038) - h) for u, w in brow]
    plate(points, (0, -.315, .12))
    # The tallest crest grows from the bridge between the eyes. Its irregular
    # shoulders interrupt the slope, and its tip bends away from the camera.
    plate([(-.08, -.286, .10), (-.15, -.225, .33), (-.14, -.135, .60),
           (-.22, .005, 1.06), (-.12, -.025, .79), (-.015, -.055, .64),
           (.13, -.15, .36), (.08, -.27, .14), (0, -.306, -.065)], (-.035, -.27, .36))
    for side in (-1, 1):
        height = .94 if side > 0 else .84
        pts = [(.20, -.225, .13), (.32, -.215, .17), (.47, -.09, .39),
               (.55, .04, .66), (.63, .095, height), (.42, 0, .58), (.25, -.10, .38)]
        plate([(x*side, y, z) for x,y,z in pts], (.32*side, -.245, .35))
        # Swept temple blades meet the cheek scales at their roots.
        pts = [(.32, -.07, -.02), (.45, -.025, 0), (.73, .01, .32),
               (.95, .055, .47), (.59, -.05, .12), (.35, -.14, .15)]
        plate([(x*side, y, z) for x,y,z in pts], (.50*side, -.13, .13))
    # A smaller dorsal crest completes the unseen side without competing with
    # the three primary forehead masses.
    plate([(-.10, .14, .23), (-.08, .18, .56), (.02, .24, .79),
           (.10, .22, .51), (.13, .16, .25)], (.01, .12, .41))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


def gem_mount(q, rng):
    bm = bmesh.new()
    c = P["neck"] + Vector((0, -.173, -.10))
    pts = [c + Vector(p) for p in [(0, -.035, .083), (.06, -.035, 0), (0, -.035, -.098), (-.06, -.035, 0), (0, -.035, .083)]]
    merge(bm, sweep(pts, [.008] * len(pts), max(6, q["sides"])))
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
    # A continuous swept cloak, torn along its hem, carries the body volume.
    # Layered strips then peel away from that volume; no wire cage of ribbons.
    color = bm.loops.layers.color.new("Col")
    rings, weights = [], {}
    count, sections = 40, q["ribbon"] * 2
    centres = bezier(P["torso"] + Vector((0, .02, -.04)), Vector((-.08, .08, .45)),
                     Vector((.02, .08, .08)), Vector((.55, .09, .16)), sections)
    for j, centre in enumerate(centres):
        t = j / sections
        radius = (.20 + .12 * math.sin(math.pi * t)) * (1 - t ** 1.2) + .004
        tangent = (centres[min(sections, j+1)] - centres[max(0, j-1)]).normalized()
        normal = tangent.cross(Vector((0, -1, 0))).normalized()
        binormal = tangent.cross(normal).normalized()
        ring = []
        for i in range(count):
            a = 2 * math.pi * i / count
            r = radius * (1 + .10 * math.sin(a * 9 + t * 5))
            v = bm.verts.new(centre + normal * math.cos(a) * r + binormal * math.sin(a) * r * .73)
            ring.append(v)
            weights[v] = (t * .8, max(0, t - .68) * 1.8)
        rings.append(ring)
    for j in range(sections):
        t = j / sections
        for i in range(count):
            # Ragged openings are geometry, stable even with reduced motion.
            if t > .60 + .25 * math.sin(i * 2.3) and i % 5 in (0, 1):
                continue
            face = bm.faces.new((rings[j][i], rings[j][(i+1) % count], rings[j+1][(i+1) % count], rings[j+1][i]))
            for loop in face.loops:
                f, e = weights[loop.vert]
                loop[color] = (f, e, 0, 1)
    n = 16
    for i in range(n):
        a = 2 * math.pi * (i + rng.uniform(-0.3, 0.3)) / n
        out = Vector((math.sin(a), -math.cos(a) * 0.85, 0))
        back = max(0.0, -math.cos(a + math.pi))  # 1 at the back
        root = P["torso"] + out * 0.15 + Vector((0, 0, -0.12))
        length = rng.uniform(.45, .77)
        tip = root + out * length * .3 + Vector((.18, .10 * back, -length))
        sway = Vector((rng.uniform(-0.06, 0.06), 0, 0))
        pts = bezier(root, root + Vector((0, 0, -length * 0.35)) + out * 0.03, tip + Vector((0, 0, length * 0.25)) + sway, tip, q["ribbon"])
        widths = flame(q["ribbon"], rng.uniform(.055, .10))
        sideways = Vector((math.cos(a), math.sin(a) * 0.85, 0)).normalized()
        merge(bm, ribbon(pts, widths, sideways, rng))
    return bm


def wing(side, q, rng):
    """Torn wing-capes: three long strips per shoulder, sweeping out and back."""
    bm = bmesh.new()
    s = P["shoulder_l"] if side > 0 else P["shoulder_r"]
    for k in range(4):
        root = s + Vector((side * -0.03 * k, 0.07 + 0.03 * k, 0.03 - 0.06 * k))
        reach = .67 + .10 * (3 - k) + rng.uniform(-.05, .05)
        tip = root + Vector((side * reach * (.73 + .08 * k), .18 + .03 * k, -.16 - .23 * k))
        c1 = root + Vector((side * reach * .47, .05, .40 - .07 * k))
        c2 = tip + Vector((side * .25, -.05, .25 + .03 * k))
        pts = bezier(root, c1, c2, tip, q["ribbon"])
        widths = flame(q["ribbon"], .035 + .017 * (3 - k))
        sideways = Vector((0, 0.35, 1.0)).normalized()
        merge(bm, ribbon(pts, widths, sideways, rng, tear=.85, segments_across=4))
    return bm


def arm(side, q, rng, root):
    """Shoulder → elbow → wrist → hand chain; each joint is a control node."""
    shoulder = P["shoulder_l"] if side > 0 else P["shoulder_r"]
    elbow = shoulder + Vector((side * .22, -.08, -.18))
    wrist = elbow + Vector((-side * .035, -.35, .13 if side > 0 else .03))
    name = "L" if side > 0 else "R"
    c_sh = empty(f"CTRL_SHOULDER_{name}", shoulder, root)
    c_el = empty(f"CTRL_ELBOW_{name}", elbow, c_sh)
    c_wr = empty(f"CTRL_WRIST_{name}", wrist, c_el)
    upper = sweep(bezier(shoulder, shoulder.lerp(elbow, 0.33) + Vector((0, 0, 0.03)), shoulder.lerp(elbow, 0.7), elbow, 8),
                  taper(8, 0.07, 0.048), q["sides"])
    fore = sweep(bezier(elbow, elbow.lerp(wrist, 0.35), elbow.lerp(wrist, 0.7), wrist, 8), [0.048, 0.056, 0.055, 0.05, 0.045, 0.04, 0.036, 0.033, 0.032], q["sides"])
    hand = bmesh.new()
    bmesh.ops.create_uvsphere(hand, u_segments=12, v_segments=8, radius=1.0)
    bmesh.ops.scale(hand, vec=(.095, .08, .055), verts=hand.verts)
    bmesh.ops.translate(hand, verts=hand.verts, vec=wrist + Vector((side * 0.03, -0.025, -0.005)))
    claws = bmesh.new()
    palm = wrist + Vector((side * 0.045, -0.04, -0.01))
    for f in range(5):
        base = palm + Vector((side * (f - 2) * .05, -.025, .004))
        if f == 0:
            pts = bezier(base, base + Vector((-side * .10, -.07, .01)),
                         base + Vector((-side * .14, -.10, -.12)), base + Vector((-side * .055, -.10, -.18)), 14)
        else:
            length = .33 - .028 * abs(f - 2)
            pts = bezier(base, base + Vector((side * .035, -.075, -.035)),
                         base + Vector((side * .07, -.045, -length * .75)), base + Vector((side * .01, -.13, -length)), 14)
        finger = sweep(pts, taper(14, .023, .0008, 1.5), max(7, q["sides"]), flat=.8)
        ctrl = empty(f"CTRL_CLAW_{name}_{f}", base, c_wr)
        mesh_object(f"geo_finger_{name}_{f}", finger, MATS["horn"], ctrl, role="claws")
    # Spurs on the elbow and forearm, pointing back.
    for k, at in enumerate((0.0, 0.35, 0.6)):
        base = elbow.lerp(wrist, at) + Vector((0, 0.03, 0.02))
        merge(claws, blade(base, Vector((side * 0.3, 0.9, 0.35 - 0.2 * k)), 0.16 - 0.04 * k, 0.03, 0.2, max(4, q["sides"] // 2), rng, flat=0.3))
    shadow, horn, tatter = MATS["shadow"], MATS["horn"], MATS["tatter"]
    mesh_object(f"geo_upperarm_{name}", upper, shadow, c_sh)
    mesh_object(f"geo_forearm_{name}", fore, shadow, c_el)
    armor = bmesh.new()
    for k in range(4):
        base = elbow.lerp(wrist, .12 + .19 * k) + Vector((0, -.025, .024))
        direction = (wrist - elbow).normalized() + Vector((side * .4, -.1, .06))
        merge(armor, blade(base, direction, .14, .056 - k * .006, -.12, 4, rng, flat=.5))
    mesh_object(f"geo_arm_plates_{name}", armor, horn, c_el, smooth=False)
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
    mesh_object("geo_mask_plates", mask_panels(), MATS["horn"], head, smooth=False)
    mesh_object("geo_teeth", teeth(rng), MATS["bone"], head)
    mesh_object("geo_maw", maw(), MATS["maw"], head, role="maw")
    mesh_object("geo_crown", crown(q, rng), MATS["horn"], head, smooth=None)
    for side, name in ((1, "L"), (-1, "R")):
        bm, centre = eye_geometry(side)
        ctrl = empty(f"CTRL_EYE_{name}", centre, head)
        ctrl["ovra_role"] = "eye"
        mesh_object(f"geo_eye_{name}", bm, MATS["eye"], ctrl, role="eye")
    mesh_object("geo_torso", torso(q), MATS["shadow"], torso_c)
    mesh_object("geo_ruff", ruff(q, rng), MATS["horn"], torso_c)
    gem_c = empty("CTRL_GEM", P["neck"] + Vector((0, -0.17, -0.1)), torso_c)
    mesh_object("geo_gem", gem(), MATS["gem"], gem_c, smooth=False, role="gem")
    mesh_object("geo_gem_mount", gem_mount(q, rng), MATS["horn"], gem_c)
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
