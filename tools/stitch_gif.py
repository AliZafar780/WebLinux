#!/usr/bin/env python3
"""Stitch _frames/frame_*.png into demo.gif (Pillow, palette-optimized).
Usage: python tools/stitch_gif.py [--width 640] [--fps 5]
"""
import os, sys, glob
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
FRAMES = os.path.join(ROOT, '_frames')
OUT = os.path.join(ROOT, 'demo.gif')

width = 640
fps = 6
args = sys.argv[1:]
for i, a in enumerate(args):
    if a == '--width' and i + 1 < len(args): width = int(args[i + 1])
    if a == '--fps' and i + 1 < len(args): fps = int(args[i + 1])

files = sorted(glob.glob(os.path.join(FRAMES, 'frame_*.[pj][np][g]')))
if not files:
    print('no frames — run capture_demo.js first'); sys.exit(1)

# drop byte-identical consecutive frames (headless screenshots repeat during idle)
prev = None
unique = []
for f in files:
    with open(f, 'rb') as fh:
        data = fh.read()
    if data != prev:
        unique.append(f)
        prev = data
print(f'{len(files)} frames -> {len(unique)} unique -> {OUT} ({width}px, {fps}fps)')
if not unique:
    print('nothing to stitch'); sys.exit(1)

images = []
for f in unique:
    im = Image.open(f).convert('RGB')
    im.thumbnail((width, int(width * im.height / im.width)), Image.LANCZOS)
    images.append(im.convert('P', palette=Image.ADAPTIVE, colors=256))

duration = int(1000 / fps)
images[0].save(OUT, save_all=True, append_images=images[1:],
               duration=duration, loop=0, optimize=True)
size_mb = os.path.getsize(OUT) / 1048576
print(f'done: demo.gif = {size_mb:.1f} MB, {len(images)} frames @ {duration}ms')
