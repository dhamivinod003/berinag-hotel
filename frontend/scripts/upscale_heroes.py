import sys
from pathlib import Path

import cv2

MODEL = Path(sys.argv[1])
ROOT = Path(sys.argv[2])
THEMES = ["himalayan", "sage", "cosmic", "galaxy", "ocean"]

sr = cv2.dnn_superres.DnnSuperResImpl_create()
sr.readModel(str(MODEL))
sr.setModel("fsrcnn", 2)

for theme in THEMES:
    src = ROOT / theme / "hero.jpg"
    img = cv2.imread(str(src))
    if img is None:
        print("skip", src)
        continue
    print("upscaling", theme, img.shape)
    out = sr.upsample(img)
    cv2.imwrite(str(src), out, [int(cv2.IMWRITE_JPEG_QUALITY), 94])
    print("saved", theme, out.shape)
