"""Deterministic, tileable PBR maps for UMBRA's scorched mineral surface.

Generated in Blender's Python (numpy ships with Blender). The normal and
roughness maps are actual embedded glTF textures, not unexportable shader nodes.
"""
import os
import bpy
import numpy as np


def make_maps(directory, size=512):
    os.makedirs(directory, exist_ok=True)
    y, x = np.mgrid[0:size, 0:size].astype(np.float32) / size
    tau = np.pi * 2
    rng = np.random.default_rng(2002)
    grain = np.zeros_like(x)
    for frequency, amplitude in ((3, .28), (7, .16), (17, .09), (43, .035), (101, .015)):
        for _ in range(4):
            a, b = rng.integers(-frequency, frequency + 1, 2)
            grain += amplitude * np.sin(tau * (a * x + b * y) + rng.random() * tau) / 4
    # Cellular seams, with wrapped seed coordinates so both edges match.
    cell = 9
    gx, gy = x * cell, y * cell
    ix, iy = np.floor(gx), np.floor(gy)
    first, second = np.full_like(x, 20), np.full_like(x, 20)
    jitter = rng.random((cell, cell, 2)).astype(np.float32)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            cx, cy = ix + dx, iy + dy
            j = jitter[cy.astype(int) % cell, cx.astype(int) % cell]
            dist = (gx - cx - j[..., 0]) ** 2 + (gy - cy - j[..., 1]) ** 2
            second = np.minimum(second, np.maximum(first, dist))
            first = np.minimum(first, dist)
    seam = np.exp(-np.maximum(0, np.sqrt(second) - np.sqrt(first)) * 65)
    height = grain - seam * .035
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * 4
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * 4
    normal = np.stack((-dx, -dy, np.ones_like(x)), -1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    normal = normal * .5 + .5
    roughness = np.clip(.53 + grain * .52 + seam * .2, .28, .83)
    maps = {}
    for name, data in (("shadow_normal", normal), ("shadow_roughness", np.repeat(roughness[..., None], 3, -1))):
        rgba = np.concatenate((data, np.ones((size, size, 1), np.float32)), -1)
        image = bpy.data.images.new(name, width=size, height=size, alpha=False)
        image.colorspace_settings.name = "Non-Color"
        image.pixels.foreach_set(rgba.astype(np.float32).ravel())
        image.filepath_raw = os.path.join(directory, name + ".png")
        image.file_format = "PNG"
        image.save()
        image.pack()
        maps[name] = image
    return maps


def apply_maps(material, maps, strength=.45):
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    normal_texture = nodes.new("ShaderNodeTexImage")
    normal_texture.image = maps["shadow_normal"]
    normal = nodes.new("ShaderNodeNormalMap")
    normal.inputs["Strength"].default_value = strength
    links.new(normal_texture.outputs["Color"], normal.inputs["Color"])
    links.new(normal.outputs["Normal"], bsdf.inputs["Normal"])
    roughness = nodes.new("ShaderNodeTexImage")
    roughness.image = maps["shadow_roughness"]
    links.new(roughness.outputs["Color"], bsdf.inputs["Roughness"])
