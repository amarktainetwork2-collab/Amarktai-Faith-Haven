from pathlib import Path
from PIL import Image, ImageDraw

output = Path(__file__).resolve().parents[1] / 'public' / 'icons'
output.mkdir(parents=True, exist_ok=True)

for size in (192, 512):
    image = Image.new('RGBA', (size, size), '#0D3B66')
    draw = ImageDraw.Draw(image)
    padding = int(size * 0.12)
    draw.ellipse((padding, padding, size - padding, size - padding), fill='#F7E7A6')
    arm = int(size * 0.12)
    center_x = size // 2
    top = int(size * 0.28)
    bottom = int(size * 0.72)
    draw.rounded_rectangle((center_x - arm // 2, top, center_x + arm // 2, bottom), radius=arm // 3, fill='#0D3B66')
    draw.rounded_rectangle((int(size * 0.34), int(size * 0.43), int(size * 0.66), int(size * 0.57)), radius=arm // 3, fill='#0D3B66')
    image.save(output / f'faithhaven-{size}.png', optimize=True)
