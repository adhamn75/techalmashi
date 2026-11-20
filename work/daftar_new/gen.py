import json, urllib.request, torch, os
from diffusers import StableDiffusionXLPipeline
P = json.loads(urllib.request.urlopen('https://raw.githubusercontent.com/adhamn75/techalmashi/main/work/daftar_new/prompts.json').read())
pipe = StableDiffusionXLPipeline.from_pretrained('cagliostrolab/animagine-xl-4.0', torch_dtype=torch.float16, use_safetensors=True).to('cuda')
pipe.enable_vae_tiling()
os.makedirs('out', exist_ok=True)
for ep, ps in P['prompts'].items():
    for i, p in enumerate(ps, 1):
        g = torch.Generator('cuda').manual_seed(1000 + int(ep[-1]) * 10 + i)
        im = pipe(prompt=P['style'] + ', ' + p, negative_prompt=P['neg'], width=768, height=1344,
                  num_inference_steps=28, guidance_scale=6, generator=g).images[0]
        im.save(f'out/{ep}_scene_{i}.jpg', quality=80)
        print('done', ep, i, os.path.getsize(f'out/{ep}_scene_{i}.jpg') // 1024, 'KB', flush=True)
print('ALL DONE')
