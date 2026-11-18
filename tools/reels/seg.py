# Repere les phrases d'une prise de voix par les silences. usage: seg.py a.mp3 ...
import numpy as np, subprocess, sys, json
def segments(f):
    r=subprocess.run(['ffmpeg','-v','error','-i',f,'-ar','16000','-ac','1','-f','f32le','-'],capture_output=True).stdout
    x=np.frombuffer(r,dtype=np.float32); fr=320
    e=np.array([np.sqrt((x[i:i+fr]**2).mean()) for i in range(0,len(x)-fr,fr)]); thr=0.02*e.max()
    segs=[];on=None
    for i,v in enumerate(e):
        if v>thr and on is None: on=i
        if v<=thr and on is not None:
            if i-on>3: segs.append([round(on*0.02,2),round(i*0.02,2)])
            on=None
    if on is not None: segs.append([round(on*0.02,2),round(len(e)*0.02,2)])
    m=[segs[0]]
    for a,b in segs[1:]:
        if a-m[-1][1]<0.14: m[-1][1]=b
        else: m.append([a,b])
    return m,len(x)/16000
if __name__=='__main__':
    for f in sys.argv[1:]:
        m,d=segments(f); print(f,round(d,2),len(m),m)

def creux(f, t0, t1, seuil=0.06, mini=0.04):
    """Petites pauses a l'interieur d'un passage (pour separer deux phrases dites d'une traite)."""
    r=subprocess.run(['ffmpeg','-v','error','-i',f,'-ar','16000','-ac','1','-f','f32le','-'],capture_output=True).stdout
    x=np.frombuffer(r,dtype=np.float32); fr=160
    e=np.array([np.sqrt((x[i:i+fr]**2).mean()) for i in range(0,len(x)-fr,fr)]); thr=seuil*e.max()
    out=[]; i=int(t0*100)
    while i<int(t1*100) and i<len(e):
        if e[i]<thr:
            j=i
            while j<int(t1*100) and j<len(e) and e[j]<thr: j+=1
            if (j-i)/100>=mini: out.append([round(i/100,2),round(j/100,2)])
            i=j
        else: i+=1
    return out
