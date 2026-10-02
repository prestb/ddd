import os
from PIL import Image, ImageOps

base_dir = r'C:\Users\12ELEVEN\Desktop\Mobile Apps/devotional-app'
brand_source = os.path.join(base_dir, r'assets\brand\daily-dew-ministry-source.png')
brand_full = os.path.join(base_dir, r'assets\brand\daily-dew-logo-full.png')
favicon_path = os.path.join(base_dir, r'assets\images\favicon.png')

source_img = Image.open(brand_source).convert('RGBA')

# Crop the bounding box of non-transparent emblem pixels to maximize favicon visibility
bbox = source_img.getbbox()
if bbox:
    cropped = source_img.crop(bbox)
else:
    cropped = source_img

# Create high-resolution 512x512 favicon
fav_size = (512, 512)
favicon = Image.new('RGBA', fav_size, (0, 0, 0, 0))

# Contain emblem with slight padding
scaled_emblem = ImageOps.contain(cropped, (480, 480), Image.Resampling.LANCZOS)
paste_x = (512 - scaled_emblem.width) // 2
paste_y = (512 - scaled_emblem.height) // 2

favicon.paste(scaled_emblem, (paste_x, paste_y), scaled_emblem)
favicon.save(favicon_path, 'PNG')

print(f'Favicon generated successfully at {favicon_path} (size: 512x512)!')
