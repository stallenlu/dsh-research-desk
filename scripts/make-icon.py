import os
from PIL import Image, ImageDraw

S = 180
img = Image.new('RGB', (S, S), (13, 17, 26))
d = ImageDraw.Draw(img)

TEAL = (56, 189, 168)
SLATE = (37, 50, 72)
WHITE = (232, 240, 248)
GOLD = (242, 184, 96)
BG = (13, 17, 26)

d.rounded_rectangle([26, 34, 116, 74], radius=6, fill=SLATE)
d.rounded_rectangle([32, 26, 122, 66], radius=6, fill=TEAL)
d.rectangle([46, 38, 108, 43], fill=WHITE)
d.rectangle([46, 50, 92, 54], fill=SLATE)
d.rounded_rectangle([42, 86, 114, 108], radius=5, fill=SLATE)
d.rectangle([52, 94, 104, 98], fill=WHITE)
d.rectangle([52, 104, 88, 107], fill=WHITE)
d.ellipse([66, 96, 126, 156], outline=GOLD, width=7, fill=BG)
d.line([118, 148, 142, 172], fill=GOLD, width=9)

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, 'assets', 'icon-180.png')
os.makedirs(os.path.dirname(out), exist_ok=True)
img.save(out, 'PNG')
print('wrote', out, os.path.getsize(out))
