import os
from PIL import Image, ImageOps

base_dir = r'C:\Users\12ELEVEN\Desktop\Mobile Apps\devotional-app'
brand_full_path = os.path.join(base_dir, r'assets\brand\daily-dew-logo-full.png')
brand_source_path = os.path.join(base_dir, r'assets\brand\daily-dew-ministry-source.png')
img_dir = os.path.join(base_dir, r'assets\images')

os.makedirs(img_dir, exist_ok=True)

# Open uploaded source images
full_img = Image.open(brand_full_path).convert('RGBA')
source_img = Image.open(brand_source_path).convert('RGBA')

# Get cropped bounding box of emblem for transparent/adaptive icons
bbox = source_img.getbbox()
emblem_img = source_img.crop(bbox) if bbox else source_img

canvas_color = (246, 243, 236, 255) # #F6F3EC

print("Starting generation of all app graphic assets...")

# 1. Main App Icon (1024x1024 RGB)
icon_size = (1024, 1024)
app_icon = Image.new('RGBA', icon_size, canvas_color)
scaled_full = ImageOps.contain(full_img, (960, 960), Image.Resampling.LANCZOS)
px = (1024 - scaled_full.width) // 2
py = (1024 - scaled_full.height) // 2
app_icon.paste(scaled_full, (px, py), scaled_full)
app_icon.convert('RGB').save(os.path.join(img_dir, 'icon.png'), 'PNG')
print('✓ Generated assets/images/icon.png (1024x1024)')

# 2. Android Adaptive Icon Background (1024x1024 RGB)
android_bg = Image.new('RGB', icon_size, (246, 243, 236))
android_bg.save(os.path.join(img_dir, 'android-icon-background.png'), 'PNG')
print('✓ Generated assets/images/android-icon-background.png (1024x1024)')

# 3. Android Adaptive Icon Foreground (1024x1024 RGBA)
# Adaptive foreground safe area is inner 66% circle (~670px)
android_fg = Image.new('RGBA', icon_size, (0, 0, 0, 0))
scaled_fg = ImageOps.contain(emblem_img, (670, 670), Image.Resampling.LANCZOS)
fx = (1024 - scaled_fg.width) // 2
fy = (1024 - scaled_fg.height) // 2
android_fg.paste(scaled_fg, (fx, fy), scaled_fg)
android_fg.save(os.path.join(img_dir, 'android-icon-foreground.png'), 'PNG')
print('✓ Generated assets/images/android-icon-foreground.png (1024x1024)')

# 4. Android Monochrome Themed Icon (1024x1024 RGBA)
android_mono = Image.new('RGBA', icon_size, (0, 0, 0, 0))
alpha = scaled_fg.split()[3]
solid_forest = Image.new('RGBA', scaled_fg.size, (44, 74, 56, 255)) # #2C4A38
android_mono.paste(solid_forest, (fx, fy), alpha)
android_mono.save(os.path.join(img_dir, 'android-icon-monochrome.png'), 'PNG')
print('✓ Generated assets/images/android-icon-monochrome.png (1024x1024)')

# 5. Splash Screen Icon (1024x1024 RGBA)
splash_img = Image.new('RGBA', icon_size, (0, 0, 0, 0))
scaled_splash = ImageOps.contain(source_img, (800, 800), Image.Resampling.LANCZOS)
sx = (1024 - scaled_splash.width) // 2
sy = (1024 - scaled_splash.height) // 2
splash_img.paste(scaled_splash, (sx, sy), scaled_splash)
splash_img.save(os.path.join(img_dir, 'splash-icon.png'), 'PNG')
print('✓ Generated assets/images/splash-icon.png (1024x1024)')

# 6. Web Favicon (512x512 RGBA)
fav_img = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
scaled_fav = ImageOps.contain(emblem_img, (480, 480), Image.Resampling.LANCZOS)
fav_x = (512 - scaled_fav.width) // 2
fav_y = (512 - scaled_fav.height) // 2
fav_img.paste(scaled_fav, (fav_x, fav_y), scaled_fav)
fav_img.save(os.path.join(img_dir, 'favicon.png'), 'PNG')
print('✓ Generated assets/images/favicon.png (512x512)')

print('\n🎉 All app images successfully regenerated!')
