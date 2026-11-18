#!/usr/bin/env python3
"""Rend un Reel a partir d'une fiche JSON.
usage : make_reel.py fiche.json voix.mp3 musique.mp3 sortie.mp4 couverture.jpg
La voix est gardee telle quelle (aucun filtre, aucun gain). La musique est mixee tres bas (-27 dB)."""
import sys, os, json, subprocess, shutil, urllib.parse, tempfile
from playwright.sync_api import sync_playwright
HERE=os.path.dirname(os.path.abspath(__file__))
fiche,voix,musique,out,cover=sys.argv[1:6]
F=json.load(open(fiche,encoding='utf-8')); S=F['fiche']; T=dict(F['temps'])
need=['h2','n1','n2','n3','ans','ex1','ex2','end','e3']
miss=[k for k in need if k not in T]
if miss: sys.exit('temps manquants : %s'%miss)
order=[T[k] for k in need]
if order!=sorted(order): sys.exit('temps non croissants : %s'%order)
d=float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',voix],capture_output=True,text=True).stdout)
T['cd']=round(T['n1']-0.08,2); T['ex1']=round(T['ex1']-0.08,2); T['ex2']=round(T['ex2']-0.08,2); T['end']=round(T['end']-0.1,2)
total=round(int((d+1.0)*30+0.999)/30,4); T['total']=total
FPS=30; N=int(round(total*FPS)); B=tempfile.mkdtemp(prefix='reel_')
url='file://'+HERE+'/reel.html?S=%s&T=%s'%(urllib.parse.quote(json.dumps(S)),urllib.parse.quote(json.dumps(T)))
chrome='/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') else None
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=chrome,args=['--no-sandbox']) if chrome else p.chromium.launch(args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1080,'height':1920}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(url); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(500)
    if errs: sys.exit('erreur page : %s'%errs[:2])
    pg.evaluate('render(%f)'%(T['cd']-0.25)); pg.screenshot(path=cover,type='jpeg',quality=92)
    ff=subprocess.Popen(['ffmpeg','-v','error','-y','-f','image2pipe','-framerate',str(FPS),'-i','-','-c:v','libx264','-preset','medium','-crf','17',
        '-pix_fmt','yuv420p','-r',str(FPS),B+'/video.mp4'],stdin=subprocess.PIPE)
    for i in range(N):
        pg.evaluate('render(%f)'%(i/FPS)); ff.stdin.write(pg.screenshot(type='jpeg',quality=95))
    ff.stdin.close(); ff.wait(); b.close()
tmp=out[:-4]+'.tmp.mp4'
subprocess.run(['ffmpeg','-v','error','-y','-i',B+'/video.mp4','-i',voix,'-ss','20','-t',str(total),'-i',musique,
    '-filter_complex','[2:a]volume=-27dB,afade=t=in:d=0.4,afade=t=out:st=%f:d=1.2[m];[1:a][m]amix=inputs=2:duration=longest:normalize=0[a]'%(total-1.2),
    '-map','0:v','-map','[a]','-c:v','copy','-ar','48000','-ac','2','-c:a','aac','-b:a','256k','-t',str(total),'-movflags','+faststart',tmp],check=True)
os.replace(tmp,out)
# planche de controle
ctl=out[:-4]+'-controle.jpg'
ts=[T['h2']+0.3,(T['n1']+T['n2'])/2,T['ans']+0.5,T['ex1']+0.8,T['ex2']+0.8,T['end']+1.2,T['e3']+1.6]
sel='+'.join('eq(n,%d)'%min(N-1,int(t*FPS)) for t in ts)
subprocess.run(['ffmpeg','-v','error','-y','-i',out,'-vf',"select='%s',scale=270:480,tile=%dx1"%(sel,len(ts)),'-frames:v','1',ctl],check=True)
shutil.rmtree(B,ignore_errors=True)
print(json.dumps({'ok':True,'sortie':out,'duree':total,'controle':ctl,'couverture':cover}))
