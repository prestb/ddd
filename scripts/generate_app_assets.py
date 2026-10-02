import os
from PIL import Image, ImageOps

base_dir = r'C:\Users\12ELEVEN\Desktop\Mobile Apps\devotional-app'
brand_full = os.path.join(base_dir, r'assets\brand\daily-dew-logo-full.png')
brand_source = os.path.join(base_dir, r'assets\brand\daily-dew-ministry-source.png')
img_dir = os.path.join(base_dir, r'assets\images')

os.makedirs(img_dir, exist_ok=True)

# 1. Open source images
full_img = Image.open(brand_full).convert('RGBA')
source_img = Image.open(brand_source).convert('RGBA')

# 2. Main App Icon (1024x1024 RGB/RGBA on canvas background)
icon_size = (1024, 1024)
bg_color = (246, 243, 236, 255) # #F6F3EC

main_icon = Image.new('RGBA', icon_size, bg_color)
# Scale full_img to fit neatly within 1024x1024
scaled_full = ImageOps.contain(full_img, (960, 960), Image.Resampling.LANCZOS)
paste_x = (1024 - scaled_full.width) // 2
paste_y = (1024 - scaled_full.height) // 2
main_icon.paste(scaled_full, (paste_x, paste_y), scaled_full)
main_icon.convert('RGB').save(os.path.join(img_dir, 'icon.png'), 'PNG')
print('Generated icon.png (1024x1024)')

# 3. Android Adaptive Icon Background (1024x1024)
bg_icon = Image.new('RGB', icon_size, (246, 243, 236))
bg_icon.save(os.path.join(img_dir, 'android-icon-background.png'), 'PNG')
print('Generated android-icon-background.png')

# 4. Android Adaptive Icon Foreground (1024x1024 with transparent padding for adaptive safe area)
fg_icon = Image.new('RGBA', icon_size, (0, 0, 0, 0))
# Safe inner circle is ~66% of 1024 = ~670px
scaled_fg = ImageOps.contain(source_img, (670, 670), Image.Resampling.LANCZOS)
fg_x = (1024 - scaled_fg.width) // 2
fg_y = (1024 - scaled_fg.height) // 2
fg_icon.paste(scaled_fg, (fg_x, fg_y), scaled_fg)
fg_icon.save(os.path.join(img_dir, 'android-icon-foreground.png'), 'PNG')
print('Generated android-icon-foreground.png')

# 5. Android Monochrome Icon (1024x1024)
mono_icon = Image.new('RGBA', icon_size, (0, 0, 0, 0))
# Create solid forest green mask from foreground
alpha = scaled_fg.split()[3]
solid_forest = Image.new('RGBA', scaled_fg.size, (44, 74, 56, 255))
mono_icon.paste(solid_forest, (fg_x, fg_y), alpha)
mono_icon.save(os.path.join(img_dir, 'android-icon-monochrome.png'), 'PNG')
print('Generated android-icon-monochrome.png')

# 6. Splash Screen Logo (1024x1024 RGBA)
splash_icon = Image.new('RGBA', icon_size, (0, 0, 0, 0))
scaled_splash = ImageOps.contain(source_img, (760, 760), Image.Resampling.LANCZOS)
splash_x = (1024 - scaled_splash.width) // 2
splash_y = (1024 - scaled_splash.height) // 2
splash_icon.paste(scaled_splash, (splash_x, splash_y), scaled_splash)
splash_icon.save(os.path.join(img_dir, 'splash-icon.png'), 'PNG')
print('Generated splash-icon.png')

# 7. Favicon (512x512 RGBA)
favicon = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
scaled_fav = ImageOps.contain(source_img, (480, 480), Image.Resampling.LANCZOS)
fav_x = (512 - scaled_fav.width) // 2
fav_y = (512 - scaled_fav.height) // 2
favicon.paste(scaled_fav, (fav_x, fav_y), scaled_fav)
favicon.save(os.path.join(img_dir, 'favicon.png'), 'PNG')
print('Generated favicon.png')

print('\nAll app graphics successfully generated and saved!')
