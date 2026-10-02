import os
from PIL import Image, ImageOps, ImageChops

source_path = r'C:\Users\12ELEVEN\OneDrive\Images\apps\dd logo.jpeg'
base_dir = r'C:\Users\12ELEVEN\Desktop\Mobile Apps\devotional-app'
brand_dir = os.path.join(base_dir, r'assets\brand')
img_dir = os.path.join(base_dir, r'assets\images')

os.makedirs(brand_dir, exist_ok=True)
os.makedirs(img_dir, exist_ok=True)

print(f'Loading uploaded image from {source_path}...')
uploaded_img = Image.open(source_path).convert('RGB')

# Save as daily-dew-logo-full.png
full_brand_path = os.path.join(brand_dir, 'daily-dew-logo-full.png')
uploaded_img.save(full_brand_path, 'PNG')
print(f'✓ Saved {full_brand_path}')

# Create transparent version (remove white/off-white background)
rgba = uploaded_img.convert('RGBA')
datas = rgba.getdata()

newData = []
for item in datas:
    # If pixel is white or near-white (R>242, G>242, B>242)
    if item[0] > 242 and item[1] > 242 and item[2] > 242:
        newData.append((255, 255, 255, 0)) # Make transparent
    else:
        newData.append(item)

rgba.putdata(newData)
transparent_path = os.path.join(brand_dir, 'daily-dew-ministry-source.png')
rgba.save(transparent_path, 'PNG')
print(f'✓ Saved {transparent_path}')

# Crop non-transparent bounding box for emblem
bbox = rgba.getbbox()
cropped_emblem = rgba.crop(bbox) if bbox else rgba

icon_size = (1024, 1024)
bg_color = (246, 243, 236, 255) # #F6F3EC

# 1. Main App Icon (1024x1024 RGB)
app_icon = Image.new('RGBA', icon_size, (255, 255, 255, 255))
scaled_full = ImageOps.contain(uploaded_img.convert('RGBA'), (980, 980), Image.Resampling.LANCZOS)
px = (1024 - scaled_full.width) // 2
py = (1024 - scaled_full.height) // 2
app_icon.paste(scaled_full, (px, py), scaled_full)
app_icon.convert('RGB').save(os.path.join(img_dir, 'icon.png'), 'PNG')
print('✓ Generated assets/images/icon.png (1024x1024)')

# 2. Android Adaptive Background (1024x1024 RGB)
android_bg = Image.new('RGB', icon_size, (255, 255, 255))
android_bg.save(os.path.join(img_dir, 'android-icon-background.png'), 'PNG')
print('✓ Generated assets/images/android-icon-background.png (1024x1024)')

# 3. Android Adaptive Foreground (1024x1024 RGBA) - Safe inner circle ~66% (670px)
android_fg = Image.new('RGBA', icon_size, (0, 0, 0, 0))
scaled_fg = ImageOps.contain(cropped_emblem, (660, 660), Image.Resampling.LANCZOS)
fx = (1024 - scaled_fg.width) // 2
fy = (1024 - scaled_fg.height) // 2
android_fg.paste(scaled_fg, (fx, fy), scaled_fg)
android_fg.save(os.path.join(img_dir, 'android-icon-foreground.png'), 'PNG')
print('✓ Generated assets/images/android-icon-foreground.png (1024x1024)')

# 4. Android Monochrome Icon (1024x1024 RGBA)
android_mono = Image.new('RGBA', icon_size, (0, 0, 0, 0))
alpha = scaled_fg.split()[3]
solid_forest = Image.new('RGBA', scaled_fg.size, (44, 74, 56, 255)) # #2C4A38
android_mono.paste(solid_forest, (fx, fy), alpha)
android_mono.save(os.path.join(img_dir, 'android-icon-monochrome.png'), 'PNG')
print('✓ Generated assets/images/android-icon-monochrome.png (1024x1024)')

# 5. Splash Screen Icon (1024x1024 RGBA)
splash_icon = Image.new('RGBA', icon_size, (0, 0, 0, 0))
scaled_splash = ImageOps.contain(cropped_emblem, (820, 820), Image.Resampling.LANCZOS)
sx = (1024 - scaled_splash.width) // 2
sy = (1024 - scaled_splash.height) // 2
splash_icon.paste(scaled_splash, (sx, sy), scaled_splash)
splash_icon.save(os.path.join(img_dir, 'splash-icon.png'), 'PNG')
print('✓ Generated assets/images/splash-icon.png (1024x1024)')

# 6. Web Favicon (512x512 RGBA)
fav_img = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
scaled_fav = ImageOps.contain(cropped_emblem, (480, 480), Image.Resampling.LANCZOS)
fav_x = (512 - scaled_fav.width) // 2
fav_y = (512 - scaled_fav.height) // 2
fav_img.paste(scaled_fav, (fav_x, fav_y), scaled_fav)
fav_img.save(os.path.join(img_dir, 'favicon.png'), 'PNG')
print('✓ Generated assets/images/favicon.png (512x512)')

print('\n🎉 All app graphics successfully regenerated from uploaded image!')
