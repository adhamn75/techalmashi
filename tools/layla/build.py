import json, math, subprocess, sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import arabic_reshaper
from bidi.algorithm import get_display

EP = int(os.environ.get("EP", "2"))
SRC = f"/home/claude/work/ep{EP}/src_h"
OUT = f"/home/claude/work/ep{EP}"
SUBS = {2: "الحلقة ٢  —  السطر الثاني", 3: "الحلقة ٣  —  الصوت", 4: "الحلقة ٤  —  الجارة الأخرى"}
NXT = {2: "الحلقة ٣ قريبًا", 3: "الحلقة ٤ غدًا", 4: "الحلقة ٥ قريبًا"}
NXT2 = {2: "اشترك حتى لا يفوتك ما سيُكتب بعده", 3: "اشترك لتعرف ما وراء النافذة", 4: "اشترك لتعرف من دورها الليلة"}
W, H, FPS = 1080, 1920, 30
dur = json.load(open(f"{SRC}/dur.json"))
lines = json.load(open(f"{SRC}/lines.json"))
rng = np.random.default_rng(7)

LEAD, TAIL, XF = 0.7, 0.7, 0.5
keys = ["n1", "n2", "n3", "n4", "n5", "n6"]
starts, ends, nstart = [], [], []
t = 0.0
for i, k in enumerate(keys):
    s = t
    e = s + LEAD + dur[k] + TAIL
    if i == len(keys) - 1:
        e += 1.6  # end card hold
    starts.append(s); ends.append(e); nstart.append(s + LEAD)
    t = e - XF
TOTAL = ends[-1]
print("total", round(TOTAL, 2))

# camera: (z0, z1, cx0, cy0, cx1, cy1, shake)
CAM = {
    0: (1.04, 1.30, 0.50, 0.60, 0.50, 0.52, 0.0),
    1: (1.06, 1.26, 0.50, 0.42, 0.50, 0.60, 0.0),
    2: (1.04, 1.34, 0.62, 0.38, 0.60, 0.30, 0.0),
    3: (1.20, 1.04, 0.40, 0.52, 0.52, 0.50, 0.0),
    4: (1.04, 1.30, 0.50, 0.55, 0.50, 0.62, 2.5),
    5: (1.04, 1.45, 0.50, 0.30, 0.50, 0.75, 1.5),
}

UW = 1296
imgs = []
for i in range(6):
    im = Image.open(f"{SRC}/scene_{i+1}.jpg").convert("RGB")
    uh = round(im.height * UW / im.width)
    imgs.append(im.resize((UW, uh), Image.LANCZOS).filter(ImageFilter.UnsharpMask(2, 60, 3)))

# vignette
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
VIG = np.clip(1.0 - 0.55 * np.clip(r - 0.35, 0, 1) ** 1.6, 0.25, 1.0)[..., None].astype(np.float32)
GRAIN = [(rng.normal(0, 7, (H, W, 1))).astype(np.float32) for _ in range(10)]

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def shape(s):
    return get_display(arabic_reshaper.reshape(s))

def wrap(text, font, maxw, d):
    words, out, cur = text.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if d.textlength(shape(trial), font=font) <= maxw:
            cur = trial
        else:
            out.append(cur); cur = w
    if cur: out.append(cur)
    return out

def caption_layer(text, size=66, ypos=1380):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f = ImageFont.truetype(FONT, size, layout_engine=ImageFont.Layout.BASIC)
    ls = wrap(text, f, W - 180, d)
    lh = int(size * 1.55)
    boxh = lh * len(ls) + 50
    y0 = ypos
    d.rounded_rectangle((60, y0, W - 60, y0 + boxh), radius=34, fill=(0, 0, 0, 150))
    for j, l in enumerate(ls):
        s = shape(l); wdt = d.textlength(s, font=f)
        d.text(((W - wdt) / 2, y0 + 25 + j * lh), s, font=f, fill=(255, 245, 225, 255),
               stroke_width=3, stroke_fill=(0, 0, 0, 255))
    return np.asarray(layer).astype(np.float32)

CAPS = [caption_layer(lines[k]) for k in keys]

def title_layer(text, size, ypos, color=(255, 190, 80, 255)):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f = ImageFont.truetype(FONT, size, layout_engine=ImageFont.Layout.BASIC)
    s = shape(text); wdt = d.textlength(s, font=f)
    d.text(((W - wdt) / 2, ypos), s, font=f, fill=color, stroke_width=5, stroke_fill=(0, 0, 0, 255))
    return np.asarray(layer).astype(np.float32)

TITLE = title_layer("دفتر الجارة", 120, 210)
SUB = title_layer(SUBS[EP], 56, 370, (255, 255, 255, 255))
NEXT = title_layer(NXT[EP], 84, 1500)
NEXT2 = title_layer(NXT2[EP], 50, 1640, (255, 255, 255, 255))

def over(frame, layer, a):
    al = layer[..., 3:4] / 255.0 * a
    return frame * (1 - al) + layer[..., :3] * al

def ease(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)

def bright(i, tl, tt):
    """brightness multiplier per scene at local time tl (seconds); tt = local narration start"""
    if i == 3:  # lamp flicker
        return 0.92 + 0.08 * math.sin(tl * 23) * math.sin(tl * 7.3) + (0.1 if (int(tl * 9) % 11 == 0) else 0)
    if i == 4 and EP == 2:
        d = dur["n5"]
        k0 = tt + d * 0.55
        for kk in range(3):
            if 0 <= tl - (k0 + kk * 0.62) < 0.12:
                return 0.55
        return 0.9 + 0.06 * math.sin(tl * 3.1)
    if i == 2:
        return 0.9 + 0.1 * math.sin(tl * 2.1)
    return 1.0

def render_scene(i, T):
    tl = T - starts[i]
    sd = ends[i] - starts[i]
    p = ease(tl / sd)
    z0, z1, cx0, cy0, cx1, cy1, sh = CAM[i]
    z = z0 + (z1 - z0) * p
    cx = cx0 + (cx1 - cx0) * p
    cy = cy0 + (cy1 - cy0) * p
    im = imgs[i]
    cw = im.width / z
    ch = cw * H / W
    if ch > im.height:
        ch = im.height; cw = ch * W / H
    sx = (math.sin(T * 9.1) + math.sin(T * 5.3)) * sh
    sy = (math.sin(T * 7.7) + math.sin(T * 4.1)) * sh
    x0 = min(max(cx * im.width - cw / 2 + sx, 0), im.width - cw)
    y0 = min(max(cy * im.height - ch / 2 + sy, 0), im.height - ch)
    fr = im.resize((W, H), Image.BICUBIC, box=(x0, y0, x0 + cw, y0 + ch))
    a = np.asarray(fr).astype(np.float32)
    a = a * bright(i, tl, LEAD)
    if i == 5:  # red pulse
        k = 0.5 + 0.5 * math.sin(tl * 2.4)
        a[..., 0] *= 1 + 0.16 * k; a[..., 2] *= 1 - 0.08 * k
    a = a * VIG
    return a

def caption_alpha(i, T):
    tl = T - nstart[i]
    if tl < -0.1: return 0.0
    a = ease((tl + 0.1) / 0.35)
    end = dur[keys[i]] + 0.5
    if tl > end: a *= 1 - ease((tl - end) / 0.4)
    return a

def frame(T):
    act = [i for i in range(6) if starts[i] <= T < ends[i] + 1e-6]
    if not act: act = [5]
    if len(act) == 1:
        f = render_scene(act[0], T)
    else:
        i, j = act[0], act[-1]
        mix = ease((T - starts[j]) / XF)
        f = render_scene(i, T) * (1 - mix) + render_scene(j, T) * mix
    i = act[-1]
    f = over(f, CAPS[i], caption_alpha(i, T)) if i != 5 or T < ends[5] - 1.6 else f
    if T < 3.2:
        ta = ease(T / 0.6) * (1 - ease((T - 2.6) / 0.6))
        f = over(f, TITLE, ta); f = over(f, SUB, ta)
    if T > ends[5] - 1.6:
        ta = ease((T - (ends[5] - 1.6)) / 0.5)
        f = f * (1 - 0.35 * ta)
        f = over(f, NEXT, ta); f = over(f, NEXT2, ta)
    # global fade in/out
    g = ease(T / 0.5) * (1 - ease((T - (TOTAL - 0.5)) / 0.5))
    f = f * g
    f = f + GRAIN[int(T * FPS) % 10]
    return np.clip(f, 0, 255).astype(np.uint8)

if __name__ == "__main__":
    n = int(TOTAL * FPS)
    only = int(sys.argv[1]) if len(sys.argv) > 1 else None
    if only:  # test stills
        for T in [1.0, nstart[1] + 1, nstart[2] + 2, nstart[3] + 3, nstart[4] + dur["n5"] * 0.8, TOTAL - 0.8]:
            Image.fromarray(frame(T)).resize((360, 640)).save(f"{OUT}/test_{T:.1f}.png")
        sys.exit()
    p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                          "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "veryfast",
                          "-crf", "20", "-pix_fmt", "yuv420p", f"{OUT}/video_silent.mp4"], stdin=subprocess.PIPE)
    for k in range(n):
        p.stdin.write(frame(k / FPS).tobytes())
        if k % 150 == 0: print("frame", k, "/", n, flush=True)
    p.stdin.close(); p.wait()
    json.dump({"starts": starts, "nstart": nstart, "total": TOTAL, "ends": ends}, open(f"{OUT}/timing.json", "w"))
    print("video done")
