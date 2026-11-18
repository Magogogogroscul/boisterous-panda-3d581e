#!/usr/bin/env python3
"""Rend une video noir et blanc (compte @tuto_blackjack) a partir d'une fiche de scenes.
usage : make_nb.py fiche.json voix.mp3 musique.mp3 sortie.mp4 couverture.jpg
La voix est gardee telle quelle (aucun filtre, aucun gain). La musique est mixee tres bas (-27 dB)."""
import sys, os, json, subprocess, shutil, urllib.parse, tempfile
from playwright.sync_api import sync_playwright
HERE=os.path.dirname(os.path.abspath(__file__))
fiche,voix,musique,out,cover=sys.argv[1:6]
F=json.load(open(fiche,encoding='utf-8')); SC=F['scenes']
ts=[s['t'] for s in SC]
if ts!=sorted(ts) or ts[0]!=0: sys.exit('les scenes doivent commencer a 0 et etre en ordre croissant : %s'%ts)
TYPES={'mots','cartes','chiffre','grille','jetons','fin'}
bad=[s.get('type') for s in SC if s.get('type') not in TYPES]
if bad: sys.exit('types inconnus : %s'%bad)
if SC[-1]['type']!='fin': sys.exit('la derniere scene doit etre de type fin')
d=float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',voix],capture_output=True,text=True).stdout)
if ts[-1]>=d: sys.exit('une scene commence apres la fin de la voix')
FPS=30; total=round(int((d+1.0)*FPS+0.999)/FPS,4); F['total']=total; N=int(round(total*FPS)); B=tempfile.mkdtemp(prefix='nb_')
url='file://'+HERE+'/nb.html?F='+urllib.parse.quote(json.dumps(F))
chrome='/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') else None
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=chrome,args=['--no-sandbox']) if chrome else p.chromium.launch(args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1080,'height':1920}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(url); pg.evaluate('document.fonts.load("400 100px Anton").then(()=>document.fonts.ready)'); pg.wait_for_timeout(500)
    if errs: sys.exit('erreur page : %s'%errs[:2])
    pg.evaluate('render(%f)'%(F.get('couverture_t',min(2.6,ts[1]-0.05)))); pg.screenshot(path=cover,type='jpeg',quality=92)
    ff=subprocess.Popen(['ffmpeg','-v','error','-y','-f','image2pipe','-framerate',str(FPS),'-i','-','-c:v','libx264','-preset','medium','-crf','17',
        '-pix_fmt','yuv420p','-r',str(FPS),B+'/video.mp4'],stdin=subprocess.PIPE)
    for i in range(N):
        pg.evaluate('render(%f)'%(i/FPS)); ff.stdin.write(pg.screenshot(type='jpeg',quality=95))
    ff.stdin.close(); ff.wait(); b.close()
    if errs: sys.exit('erreur page : %s'%errs[:2])
tmp=out[:-4]+'.tmp.mp4'
subprocess.run(['ffmpeg','-v','error','-y','-i',B+'/video.mp4','-i',voix,'-ss','20','-t',str(total),'-i',musique,
    '-filter_complex','[2:a]volume=-27dB,afade=t=in:d=0.4,afade=t=out:st=%f:d=1.2[m];[1:a][m]amix=inputs=2:duration=longest:normalize=0[a]'%(total-1.2),
    '-map','0:v','-map','[a]','-c:v','copy','-ar','48000','-ac','2','-c:a','aac','-b:a','256k','-t',str(total),'-movflags','+faststart',tmp],check=True)
os.replace(tmp,out)
# planche de controle : une image par scene, a mi-parcours
ctl=out[:-4]+'-controle.jpg'
mids=[min(total-0.1,(ts[i]+(ts[i+1] if i+1<len(ts) else total))/2+0.25) for i in range(len(ts))]
sel='+'.join('eq(n,%d)'%min(N-1,int(t*FPS)) for t in mids); cols=min(7,len(mids)); rows=-(-len(mids)//cols)
subprocess.run(['ffmpeg','-v','error','-y','-i',out,'-vf',"select='%s',scale=270:480,tile=%dx%d"%(sel,cols,rows),'-frames:v','1',ctl],check=True)
shutil.rmtree(B,ignore_errors=True)
print(json.dumps({'ok':True,'sortie':out,'duree':total,'controle':ctl,'couverture':cover}))
