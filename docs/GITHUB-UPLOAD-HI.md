================================================================
  CodeLite  ->  GitHub pe upload karne ki poori guide
  (Hinglish me, taaki aapko aasani se samajh aaye)
================================================================


Aapko kya kya milega
----------------------------------------------------------------
1) CodeLite-Setup-1.0.0.exe   -> Windows installer (logo)
2) CodeLite-Portable-1.0.0.zip -> bina installer wala version
3) CodeLite-1.0.0-source.zip  -> poora source code (GitHub ke liye)


STEP 1 - GitHub account check
----------------------------------------------------------------
Agar aapka GitHub account nahi hai to pehle yahan banayein (free):
    https://github.com/signup


STEP 2 - Naya repository banao
----------------------------------------------------------------
1)  Browser me kholo:  https://github.com/new

2)  Owner            : aapka username
    Repository name  : CodeLite
    Description      : A lightweight, fully offline code editor for Windows
    Visibility       : PUBLIC  (aapne yahi chaha tha)

3)  "Add a README file"      -> UNCHECK kar dein
    ".gitignore"             -> None chuno
    License                  -> None chuno

    (Kyunki hum khud files upload karenge)

4)  "Create repository" dabao.


STEP 3 - Source code upload karo  (EASIER - recommended)
----------------------------------------------------------------
1)  Apna CodeLite-1.0.0-source.zip kholo aur usme se CodeLite folder
    nikaal lo (ya poora folder copy kar lo).

2)  Apna GitHub repository page kholo.

3)  Upar link padega:  "uploading an existing file"  -> us par click karo

4)  Sab files ko drag & drop kar do (poora CodeLite folder contents,
    folder ko andar tak kholke).

    Upload hone me 1-2 minute lagenge.

5)  Neeche green "Commit changes" button dabao.

    BAS. Code aapke GitHub par aa gaya.


STEP 4 - Release (installer) upload karo
----------------------------------------------------------------
Ye zaroori nahi hai, lekin bahut accha lagta hai.

1)  Apne repo page par jao
2)  Right side me "Releases" par click karo
3)  "Create a new release" dabao
4)  Tag      : v1.0.0
    Title    : CodeLite 1.0.0
    Description:

        First release.

        - Syntax highlighting for 30+ languages
        - File explorer, tabs, find & replace, search
        - Command palette, minimap, outline
        - Dark+ / Light+ / High Contrast themes
        - Fully offline, no telemetry

5)  Assets me ye 2 files drag & drop karo:
        CodeLite-Setup-1.0.0.exe
        CodeLite-Portable-1.0.0.zip

6)  "Publish release" dabao.


STEP 5 - README me screenshot sahi dikhega?
----------------------------------------------------------------
README.md me images ka link aisa hai:

    docs/screenshots/editor-dark.png

Jab aap source folder ke andar ka "docs" folder upload karenge, to ye
link khud se sahi kaam karega. Kuch nahi karna padega.


IMPORTANT - kya NAHI karna
----------------------------------------------------------------
*  "dist" folder upload MAT karein.  (.gitignore se automatically
   exclude ho jayega - wo theek hai)
*  Installer .exe ko repo ke andar mat rakhein, wo "Releases" me jata hai
*  Apna personal folder ka path kahin mat likhein


QUICK CHECK - upload hone ke baad ye dekhein
----------------------------------------------------------------
*  README.md ka text + 4 screenshots dikh rahe hain?
*  "CodeLite 1.0.0-source" me src, installer, docs folders hain?
*  Releases me 2 files (exe + zip) hain?

Agar teeno haan hain, to aapka project live hai.


Aage kya kar sakte hain (optional)
----------------------------------------------------------------
*  Stars dena  ->  log aapke repo ko like kar sakte hain
*  Issues tab  ->  log bugs report kar sakte hain
*  Apna naam "CodeLite Project" ki jagah apna actual naam kar sakte hain
   (installer\CodeLite.iss me AppPublisher)


================================================================
Shubhkam! Ab aapka code editor GitHub par live hai.
================================================================