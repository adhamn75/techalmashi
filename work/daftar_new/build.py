#!/usr/bin/env python3
"""Build one دفتر الجارة episode. Env EP=5..8.
Inputs: work/daftar_new/img/layla_epN_scene_i.jpg (6 imgs, 768x1344), voice/layla_epN/n1..n7.mp3, lines.json captions.
Scene plan: 7 narration lines over 6 images (line 1 on image 1 as the hook, lines 6+7 share image 6).
Output: out/daftar-aljara-epN.mp4 1080x1920 30fps, Ken-Burns, vignette, grain, drone+heartbeat, loudnorm -15."""
import os, json, subprocess, math, random, glob
from PIL import Image, ImageDraw, ImageFont, ImageFilter
EP = os.environ.get("EP", "5"); W, H, FPS = 1080, 1920, 30
root = os.path.dirname(os.path.abspath(__file__))
imgd = os.environ.get("IMG", f"{root}/img"); vd = os.environ.get("VOICE", f"{root}/voice/layla_ep{EP}")
tmp = f"{root}/tmp{EP}"; os.makedirs(tmp, exist_ok=True)
caps = json.load(open(f"{root}/lines.json", encoding="utf-8"))[f"layla_ep{EP}"]
caps = [c[1] if isinstance(c, list) else c for c in caps]
def dur(p): return float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p]).decode())
voices = [f"{vd}/n{i+1}.mp3" for i in range(len(caps))]
ds = [dur(v) for v in voices]; GAP = 0.18; LEAD = 0.05
starts = []; t = LEAD
for d in ds: starts.append(t); t += d + GAP
total = t + 0.6
img_of = [1,2,3,4,5,6,6][:len(caps)]
font = ImageFont.truetype(f"{root}/fonts/Cairo.ttf", 66)
try: font.set_variation_by_axes([0, 900])
except Exception: pass
try:
    from arabic_reshaper import reshape; from bidi.algorithm import get_display
    sh = lambda s: get_display(reshape(s))
except Exception: sh = lambda s: s
def wrap(s, maxw, d):
    words, lines, cur = s.split(), [], ""
    for w in words:
        n = (cur + " " + w).strip()
        if d.textlength(sh(n), font=font) <= maxw: cur = n
        else: lines.append(cur); cur = w
    lines.append(cur); return lines
def frame_text(idx):
    im = Image.new("RGBA", (W, H), (0,0,0,0)); d = ImageDraw.Draw(im)
    ls = wrap(caps[idx], W-160, d); y = 1380
    for l in ls:
        tw = d.textlength(sh(l), font=font)
        for ox,oy in [(-3,0),(3,0),(0,-3),(0,3),(0,6)]: d.text(((W-tw)/2+ox, y+oy), sh(l), font=font, fill=(0,0,0,255))
        d.text(((W-tw)/2, y), sh(l), font=font, fill=(255,235,120,255)); y += 90
    p = f"{tmp}/cap{idx}.png"; im.save(p); return p
# vignette
vg = Image.new("L", (W, H), 0); dd = ImageDraw.Draw(vg)
for i in range(60): dd.ellipse((-i*14-200, -i*20-300, W+i*14+200, H+i*20+300), outline=int(255*(i/60)**2.2), width=30)
# render each segment: image (Ken-Burns) with caption, duration = line + gap (last extra)
segs = []
for i, c in enumerate(caps):
    n = img_of[i]; seg_d = ds[i] + GAP + (LEAD if i == 0 else 0) + (0.6 if i == len(caps)-1 else 0)
    src = f"{imgd}/layla_ep{EP}_scene_{n}.jpg"
    z0, z1 = (1.04, 1.16) if i % 2 == 0 else (1.16, 1.04)
    out = f"{tmp}/seg{i}.mp4"; cap = frame_text(i); frames = int(seg_d*FPS)+1
    zexpr = f"{z0}+({z1}-{z0})*on/{frames}"
    vf = (f"[0:v]scale=2160:-1,zoompan=z='{zexpr}':x='iw/2-(iw/zoom/2)+sin(on/40)*12':y='ih/2-(ih/zoom/2)':d={frames}:s={W}x{H}:fps={FPS},"
          f"eq=contrast=1.12:brightness=-0.06:saturation=0.85,noise=alls=9:allf=t,vignette=PI/3.2[b];[b][1:v]overlay=0:0,format=yuv420p[v]")
    subprocess.run(["ffmpeg","-y","-loglevel","error","-loop","1","-i",src,"-i",cap,"-filter_complex",vf,"-map","[v]","-t",f"{seg_d:.3f}","-r",str(FPS),"-c:v","libx264","-crf","24","-preset","veryfast",out],check=True)
    segs.append(out)
open(f"{tmp}/list.txt","w").write("".join(f"file '{s}'\n" for s in segs))
subprocess.run(["ffmpeg","-y","-loglevel","error","-f","concat","-safe","0","-i",f"{tmp}/list.txt","-c","copy",f"{tmp}/video.mp4"],check=True)
# audio: voice at starts + drone + heartbeat + sting before last line
ins = []; fl = []
for i, v in enumerate(voices):
    ins += ["-i", v]; fl.append(f"[{i}:a]adelay={int(starts[i]*1000)}|{int(starts[i]*1000)},volume=1.5[v{i}]")
k = len(voices)
fl.append(f"anoisesrc=d={total:.2f}:c=brown:a=0.5,lowpass=f=120,volume=0.35[dr]")
fl.append(f"sine=f=55:d={total:.2f},tremolo=f=1.1:d=0.9,volume=0.12[hb]")
mix = "".join(f"[v{i}]" for i in range(k)) + "[dr][hb]"
fl.append(f"{mix}amix=inputs={k+2}:normalize=0:duration=longest,loudnorm=I=-15:TP=-1.5:LRA=11[a]")
subprocess.run(["ffmpeg","-y","-loglevel","error"]+ins+["-filter_complex",";".join(fl),"-map","[a]","-t",f"{total:.2f}","-ar","44100",f"{tmp}/audio.wav"],check=True)
os.makedirs(f"{root}/out", exist_ok=True)
outp = f"{root}/out/daftar-aljara-ep{EP}.mp4"
subprocess.run(["ffmpeg","-y","-loglevel","error","-i",f"{tmp}/video.mp4","-i",f"{tmp}/audio.wav","-c:v","copy","-c:a","aac","-b:a","160k","-shortest",outp],check=True)
print("built", outp, f"{total:.1f}s")
