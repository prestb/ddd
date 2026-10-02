import os
import urllib.request
import zipfile

jdk_dir = r'C:\Users\12ELEVEN\jdk17'
zip_path = r'C:\Users\12ELEVEN\jdk17.zip'
url = 'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.12%2B7/OpenJDK17U-jdk_x64_windows_hotspot_17.0.12_7.zip'

if not os.path.exists(jdk_dir):
    print(f'Downloading JDK 17 from {url}...')
    urllib.request.urlretrieve(url, zip_path)
    print('Extracting JDK 17...')
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(r'C:\Users\12ELEVEN')
    # Rename extracted directory to jdk17
    extracted_folder = [f for f in os.listdir(r'C:\Users\12ELEVEN') if f.startswith('jdk-17')][0]
    os.rename(os.path.join(r'C:\Users\12ELEVEN', extracted_folder), jdk_dir)
    print('JDK 17 ready at C:\\Users\\12ELEVEN\\jdk17')
else:
    print('JDK 17 already exists at C:\\Users\\12ELEVEN\\jdk17')
