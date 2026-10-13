"""Shared helpers for the ENTITY 001 Blender pipeline.

Coordinates follow Blender: +Z up, -Y is the character's front. The glTF
exporter converts to +Y up / +Z front for Three.js.
"""
import math
import os

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SOURCE_DIR = os.path.join(REPO, "assets", "source", "entity-001")
PUBLIC_DIR = os.path.join(REPO, "public", "3d", "entity-001")
PREVIEW_DIR = os.path.join(REPO, "docs", "entity-001", "previews")
BLEND_PATH = os.path.join(SOURCE_DIR, "entity-001.blend")

FPS = 30


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.unit_settings.system = "METRIC"
    return scene


def collection(name, parent=None):
    col = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if col.name not in (parent or bpy.context.scene.collection).children:
        (parent or bpy.context.scene.collection).children.link(col)
    return col


def empty(name, location=(0, 0, 0), parent=None, col=None, size=0.05, display="PLAIN_AXES"):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = display
    obj.empty_display_size = size
    (col or bpy.context.scene.collection).objects.link(obj)
    if parent is not None:
        obj.parent = parent
        obj.matrix_parent_inverse = Matrix.Identity(4)
        obj.location = Vector(location) - parent_world(parent)
    else:
        obj.location = location
    return obj


def parent_world(parent):
    """World position of a parent made only of translations (our control rig)."""
    total = Vector((0, 0, 0))
    node = parent
    while node is not None:
        total += node.location
        node = node.parent
    return total


def mesh_object(name, mesh, parent=None, col=None, material=None):
    obj = bpy.data.objects.new(name, mesh)
    (col or bpy.context.scene.collection).objects.link(obj)
    if material is not None:
        mesh.materials.append(material)
    if parent is not None:
        obj.parent = parent
        obj.matrix_parent_inverse = Matrix.Identity(4)
        # Mesh data is authored in world space; shift it into the parent's frame.
        offset = parent_world(parent)
        mesh.transform(Matrix.Translation(-offset))
    return obj


# --------------------------------------------------------------------------- shells

class Shell:
    """An ellipsoid parameterized around the lateral X axis (the hinge axis).

    s: angle around X. 0 = front (-Y), pi/2 = top, pi = back, -pi/2 = underside.
    w: lateral latitude. 0 = midline, +-pi/2 = the hinge poles at the sides.
    Plates are rectangles in (s, w) so their borders are clean analytic curves,
    and rotating a plate about X slides it along s, like a visor.
    """

    def __init__(self, center, radii, sweep=0.0, taper=0.0):
        self.center = Vector(center)
        self.radii = Vector(radii)
        self.sweep = sweep
        self.taper = taper

    @staticmethod
    def direction(s, w):
        return Vector((math.sin(w), -math.cos(s) * math.cos(w), math.sin(s) * math.cos(w)))

    def point(self, s, w, inset=0.0):
        d = self.direction(s, w)
        x, y, z = d.x * self.radii.x, d.y * self.radii.y, d.z * self.radii.z
        # Sweep the crown back and up: an elongated, leaning cranium.
        back_top = max(0.0, (d.y * 0.62 + d.z * 0.78))
        y += self.sweep * back_top ** 2
        z += self.sweep * 0.45 * back_top ** 2
        # Taper the lower half toward a narrow jaw.
        if d.z < 0:
            x *= 1.0 - self.taper * (-d.z) ** 1.4
        p = Vector((x, y, z))
        if inset:
            p -= self.normal(s, w) * inset
        return self.center + p

    def normal(self, s, w, h=1e-3):
        a = self._raw(s + h, w) - self._raw(s - h, w)
        b = self._raw(s, w + h) - self._raw(s, w - h)
        n = b.cross(a)
        if n.dot(self._raw(s, w)) < 0:
            n = -n
        return n.normalized()

    def _raw(self, s, w):
        return self.point(s, w) - self.center


def plate_mesh(name, shell, w0, w1, s0, s1, res=(24, 24), inset=0.0, uv_scale=4.0):
    """Surface patch between w0..w1 and s0(w)..s1(w). s bounds may be callables."""
    s0f = s0 if callable(s0) else (lambda w, v=s0: v)
    s1f = s1 if callable(s1) else (lambda w, v=s1: v)
    nu, nv = res
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    grid = []
    coords = []
    for i in range(nu + 1):
        w = w0 + (w1 - w0) * i / nu
        a, b = s0f(w), s1f(w)
        row = []
        for j in range(nv + 1):
            s = a + (b - a) * j / nv
            row.append(bm.verts.new(shell.point(s, w, inset)))
            coords.append((w, s))
        grid.append(row)
    for i in range(nu):
        for j in range(nv):
            face = bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
            for loop, (ii, jj) in zip(face.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                w, s = coords[ii * (nv + 1) + jj]
                loop[uv_layer].uv = (w * shell.radii.x * uv_scale, s * shell.radii.y * uv_scale)
    bm.normal_update()
    # Faces should point away from the shell center.
    centroid = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
    bm.faces.ensure_lookup_table()
    face = bm.faces[0]
    if face.normal.dot(face.calc_center_median() - shell.center) < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return mesh, centroid


def hard_surface(obj, thickness, bevel, segments, offset=-1.0):
    """Solidify + bevel on the plate borders + weighted normals."""
    sol = obj.modifiers.new("solidify", "SOLIDIFY")
    sol.thickness = thickness
    sol.offset = offset
    sol.use_even_offset = True
    if bevel > 0 and segments > 0:
        bev = obj.modifiers.new("bevel", "BEVEL")
        bev.width = bevel
        bev.segments = segments
        bev.limit_method = "ANGLE"
        bev.angle_limit = math.radians(35)
        bev.harden_normals = False
    wn = obj.modifiers.new("weighted", "WEIGHTED_NORMAL")
    wn.keep_sharp = True
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def apply_modifiers(obj):
    """Bake modifiers into the mesh so the exported geometry matches the render."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
    old = obj.data
    obj.modifiers.clear()
    obj.data = mesh
    if old.users == 0:
        bpy.data.meshes.remove(old)


# --------------------------------------------------------------------------- primitives

def cylinder_mesh(name, radius, depth, verts=32, axis="Z", bevel_ring=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts,
                          radius1=radius, radius2=radius, depth=depth)
    if axis == "Y":
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "X"))
    elif axis == "X":
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "Y"))
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def torus_mesh(name, major, minor, major_seg=64, minor_seg=12, arc=(0.0, 2 * math.pi), closed=True):
    bm = bmesh.new()
    rings = []
    count = major_seg if closed else major_seg + 1
    for i in range(count):
        t = arc[0] + (arc[1] - arc[0]) * i / major_seg
        ring = []
        for j in range(minor_seg):
            p = 2 * math.pi * j / minor_seg
            r = major + minor * math.cos(p)
            ring.append(bm.verts.new((r * math.cos(t), r * math.sin(t), minor * math.sin(p))))
        rings.append(ring)
    span = count if closed else count - 1
    for i in range(span):
        a, b = rings[i], rings[(i + 1) % count]
        for j in range(minor_seg):
            bm.faces.new((a[j], b[j], b[(j + 1) % minor_seg], a[(j + 1) % minor_seg]))
    if not closed:
        bm.faces.new(rings[0][::-1])
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    return mesh


def box_mesh(name, size):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def ellipsoid_mesh(name, radii, seg=48, rings=24):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    bmesh.ops.scale(bm, vec=radii, verts=bm.verts)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    return mesh


def place(mesh, location, normal=None, up=Vector((0, 0, 1)), spin=0.0):
    """Orient a mesh authored along +Z so +Z follows `normal`, then move it."""
    rot = Matrix.Identity(4)
    if normal is not None:
        rot = Vector((0, 0, 1)).rotation_difference(Vector(normal).normalized()).to_matrix().to_4x4()
    mesh.transform(rot @ Matrix.Rotation(spin, 4, "Z"))
    mesh.transform(Matrix.Translation(Vector(location)))
    return mesh


def join_meshes(name, meshes):
    bm = bmesh.new()
    materials = []
    for mesh in meshes:
        # One slot per distinct material: every slot becomes a draw call in glTF.
        remap = []
        for mat in mesh.materials:
            if mat not in materials:
                materials.append(mat)
            remap.append(materials.index(mat))
        tmp = bmesh.new()
        tmp.from_mesh(mesh)
        for face in tmp.faces:
            face.material_index = remap[face.material_index] if remap else 0
        tmp_mesh = bpy.data.meshes.new("tmp")
        tmp.to_mesh(tmp_mesh)
        tmp.free()
        bm.from_mesh(tmp_mesh)
        bpy.data.meshes.remove(tmp_mesh)
    out = bpy.data.meshes.new(name)
    bm.to_mesh(out)
    bm.free()
    for mat in materials:
        out.materials.append(mat)
    return out


# --------------------------------------------------------------------------- materials

def brushed_normal_image(size, path):
    """Tileable micro-detail: fine directional brushing with sparse scratches."""
    rng = np.random.default_rng(1001)
    noise = rng.standard_normal((size, size))
    # Brush along U: heavy blur in X, almost none in Y (FFT, so it tiles).
    fy = np.fft.fftfreq(size)[:, None]
    fx = np.fft.fftfreq(size)[None, :]
    spectrum = np.fft.fft2(noise) * np.exp(-(fx * 60) ** 2 - (fy * 2.2) ** 2)
    height = np.real(np.fft.ifft2(spectrum))
    height /= np.abs(height).max() + 1e-9
    # Sparse diagonal scratches.
    for _ in range(18):
        x0, y0 = rng.integers(0, size, 2)
        length = rng.integers(size // 8, size // 3)
        angle = rng.uniform(-0.5, 0.5)
        for t in range(length):
            x = int(x0 + t * math.cos(angle)) % size
            y = int(y0 + t * math.sin(angle)) % size
            height[y, x] -= 0.6
    gy, gx = np.gradient(height)
    strength = 2.2
    nx, ny, nz = -gx * strength, -gy * strength, np.ones_like(height)
    length = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
    rgb = np.stack([nx / length, ny / length, nz / length], axis=-1) * 0.5 + 0.5
    rgba = np.concatenate([rgb, np.ones((size, size, 1))], axis=-1).astype(np.float32)
    image = bpy.data.images.new("ovra_brushed_normal", size, size, alpha=False, float_buffer=False)
    image.colorspace_settings.name = "Non-Color"
    image.pixels.foreach_set(rgba.ravel())
    image.filepath_raw = path
    image.file_format = "PNG"
    image.save()
    image.pack()
    return image


def srgb(hex_color):
    hex_color = hex_color.lstrip("#")
    c = [int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c) + (1.0,)


def principled(name, base, metallic=0.0, roughness=0.5, normal_image=None, normal_strength=0.3,
               emission=None, emission_strength=0.0, clearcoat=0.0, anisotropy=0.0, uv_scale=1.0, specular=0.5,
               coat_roughness=0.18):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = base
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Specular IOR Level"].default_value = specular
    if clearcoat:
        bsdf.inputs["Coat Weight"].default_value = clearcoat
        bsdf.inputs["Coat Roughness"].default_value = coat_roughness
    if anisotropy:
        bsdf.inputs["Anisotropic"].default_value = anisotropy
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    if normal_image is not None:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = normal_image
        tex.interpolation = "Linear"
        nmap = nodes.new("ShaderNodeNormalMap")
        nmap.inputs["Strength"].default_value = normal_strength
        links.new(tex.outputs["Color"], nmap.inputs["Color"])
        links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
        if uv_scale != 1.0:
            mapping = nodes.new("ShaderNodeMapping")
            coord = nodes.new("ShaderNodeTexCoord")
            mapping.inputs["Scale"].default_value = (uv_scale, uv_scale, 1)
            links.new(coord.outputs["UV"], mapping.inputs["Vector"])
            links.new(mapping.outputs["Vector"], tex.inputs["Vector"])
    return mat


def build_materials(texture_size):
    os.makedirs(os.path.join(SOURCE_DIR, "textures"), exist_ok=True)
    normal = brushed_normal_image(texture_size, os.path.join(SOURCE_DIR, "textures", f"brushed_normal_{texture_size}.png"))
    return {
        # Darkened titanium: the body of every articulated plate. A metal's base color
        # is its reflectance (F0); ~0.1 linear keeps it dark yet able to hold
        # reflections. The earlier #23272d (~0.02) read as black plastic.
        "titanium": principled("M_Titanium", srgb("#545a63"), 1.0, 0.38, normal, 0.35),
        # Technical ceramic: the face mask and crest. Neutral bone, matte under a
        # crisp coat so highlights draw lines; warm tints read as brown haze.
        "ceramic": principled("M_Ceramic", srgb("#cfcac0"), 0.0, 0.5, None, 0.0, clearcoat=0.55, coat_roughness=0.24),
        # Brushed steel: hubs, rings, vertebrae, iris blades.
        # No anisotropy: Three.js derives its direction from UVs, which primitives lack.
        "brushed": principled("M_Brushed", srgb("#a4a9b0"), 1.0, 0.3, normal, 0.4),
        # Inner structure: absorbs light so the plates read against it.
        "inner": principled("M_Inner", srgb("#08090b"), 0.0, 0.82, specular=0.08),
        # Glossy black glass of the lens.
        "lens": principled("M_Lens", srgb("#050608"), 0.0, 0.06, clearcoat=1.0, coat_roughness=0.03),
        # Emissive: the chest core and the inner glow of the skull.
        "ember": principled("M_CoreEmber", srgb("#2a160a"), 0.0, 0.5, emission=srgb("#ed9b56"), emission_strength=7.0),
        # Emissive: the pupil of the sensor.
        "sensor": principled("M_SensorGlow", srgb("#1a1610"), 0.0, 0.3, emission=srgb("#f3dfbd"), emission_strength=14.0),
        # Emissive: thin cold status rings on the hubs.
        "frost": principled("M_FrostSignal", srgb("#0b1013"), 0.0, 0.4, emission=srgb("#93b8cb"), emission_strength=3.0),
    }
