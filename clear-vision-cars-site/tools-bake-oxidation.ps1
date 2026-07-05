param(
  [double]$darkT = 68,
  [double]$edge0 = 2.5,
  [double]$edge1 = 9,
  [double]$alphaBase = 0.92,
  [double]$milkR = 226, [double]$milkG = 209, [double]$milkB = 172,
  [double]$mottleAmp = 0.30,
  [double]$ghost = 0.15,
  [int]$seed = 7
)
$src = @"
using System;
using System.IO;
using System.Windows.Media;
using System.Windows.Media.Imaging;

public static class OxBaker {
  static byte[] Load(string path, out int W, out int H){
    var ms = new MemoryStream(File.ReadAllBytes(path));
    var dec = BitmapDecoder.Create(ms, BitmapCreateOptions.PreservePixelFormat, BitmapCacheOption.OnLoad);
    var conv = new FormatConvertedBitmap(dec.Frames[0], PixelFormats.Bgra32, null, 0);
    W = conv.PixelWidth; H = conv.PixelHeight;
    var px = new byte[W*H*4];
    conv.CopyPixels(px, W*4, 0);
    return px;
  }
  static void Save(string path, byte[] bgra, int W, int H, bool png){
    var bs = BitmapSource.Create(W,H,96,96,PixelFormats.Bgra32,null,bgra,W*4);
    BitmapEncoder enc;
    if(png){ enc = new PngBitmapEncoder(); }
    else { var j = new JpegBitmapEncoder(); j.QualityLevel = 92; enc = j; }
    enc.Frames.Add(BitmapFrame.Create(bs));
    using(var fs = File.Create(path)) enc.Save(fs);
  }
  static double Lum(byte[] p, int i){ return 0.299*p[i+2]+0.587*p[i+1]+0.114*p[i]; }
  static byte Cl(double v){ return (byte)(v<0?0:(v>255?255:v)); }

  static byte[] Blur(byte[] srcPx, int W, int H, int r){
    var a = (byte[])srcPx.Clone(); var b = new byte[srcPx.Length];
    for(int pass=0; pass<3; pass++){
      for(int y=0;y<H;y++){
        int row=y*W*4; double sB=0,sG=0,sR=0; int n=2*r+1;
        for(int x=-r;x<=r;x++){ int xx=Math.Min(W-1,Math.Max(0,x)); int i=row+xx*4; sB+=a[i];sG+=a[i+1];sR+=a[i+2]; }
        for(int x=0;x<W;x++){
          int i=row+x*4; b[i]=Cl(sB/n); b[i+1]=Cl(sG/n); b[i+2]=Cl(sR/n); b[i+3]=255;
          int xo=Math.Min(W-1,Math.Max(0,x-r)); int xi=Math.Min(W-1,Math.Max(0,x+r+1));
          int io=row+xo*4, ii=row+xi*4;
          sB+=a[ii]-a[io]; sG+=a[ii+1]-a[io+1]; sR+=a[ii+2]-a[io+2];
        }
      }
      for(int x=0;x<W;x++){
        double sB=0,sG=0,sR=0; int n=2*r+1;
        for(int y=-r;y<=r;y++){ int yy=Math.Min(H-1,Math.Max(0,y)); int i=(yy*W+x)*4; sB+=b[i];sG+=b[i+1];sR+=b[i+2]; }
        for(int y=0;y<H;y++){
          int i=(y*W+x)*4; a[i]=Cl(sB/n); a[i+1]=Cl(sG/n); a[i+2]=Cl(sR/n); a[i+3]=255;
          int yo=Math.Min(H-1,Math.Max(0,y-r)); int yi=Math.Min(H-1,Math.Max(0,y+r+1));
          int io2=(yo*W+x)*4, ii2=(yi*W+x)*4;
          sB+=b[ii2]-b[io2]; sG+=b[ii2+1]-b[io2+1]; sR+=b[ii2+2]-b[io2+2];
        }
      }
    }
    return a;
  }

  static bool[] Flood(byte[] srcPx, int W, int H, double darkT, int dil){
    int N=W*H;
    var dark = new bool[N];
    for(int i=0;i<N;i++) dark[i] = Lum(srcPx,i*4) < darkT;
    var darkD = dark;
    for(int pass=0; pass<dil; pass++){
      var nd = new bool[N];
      for(int y=0;y<H;y++) for(int x=0;x<W;x++){
        int i=y*W+x; bool d=darkD[i];
        if(!d){
          if(x>0 && darkD[i-1]) d=true;
          else if(x<W-1 && darkD[i+1]) d=true;
          else if(y>0 && darkD[i-W]) d=true;
          else if(y<H-1 && darkD[i+W]) d=true;
        }
        nd[i]=d;
      }
      darkD=nd;
    }
    var outside = new bool[N];
    var q = new int[N]; int qh=0, qt=0;
    for(int x=0;x<W;x++){
      int p1=x; if(!outside[p1] && !darkD[p1]){ outside[p1]=true; q[qt++]=p1; }
      int p2=(H-1)*W+x; if(!outside[p2] && !darkD[p2]){ outside[p2]=true; q[qt++]=p2; }
    }
    for(int y=0;y<H;y++){
      int p1=y*W; if(!outside[p1] && !darkD[p1]){ outside[p1]=true; q[qt++]=p1; }
      int p2=y*W+W-1; if(!outside[p2] && !darkD[p2]){ outside[p2]=true; q[qt++]=p2; }
    }
    while(qh<qt){
      int p=q[qh++]; int px=p%W, py=p/W;
      if(px>0){ int n2=p-1; if(!outside[n2]&&!darkD[n2]){ outside[n2]=true; q[qt++]=n2; } }
      if(px<W-1){ int n2=p+1; if(!outside[n2]&&!darkD[n2]){ outside[n2]=true; q[qt++]=n2; } }
      if(py>0){ int n2=p-W; if(!outside[n2]&&!darkD[n2]){ outside[n2]=true; q[qt++]=n2; } }
      if(py<H-1){ int n2=p+W; if(!outside[n2]&&!darkD[n2]){ outside[n2]=true; q[qt++]=n2; } }
    }
    return outside;
  }

  public static string Bake(string afterP, string fogP, string outBefore, string outDebug,
      double darkT, double edge0, double edge1, double alphaBase,
      double milkR, double milkG, double milkB, double mottleAmp, double ghost, int seed){
    int W,H; var srcPx = Load(afterP, out W, out H);
    int Wf,Hf; var fog = Load(fogP, out Wf, out Hf);
    int N = W*H;

    // flood the outside; auto-escalate until the gasket ring seals
    // (leak test: a region that is unquestionably lens interior)
    int cx0=(int)(W*0.20), cx1=(int)(W*0.72), cy0=(int)(H*0.34), cy1=(int)(H*0.60);
    bool[] outside = null;
    double dT = darkT; int dil = 1; string tries="";
    for(int attempt=0; attempt<7; attempt++){
      outside = Flood(srcPx, W, H, dT, dil);
      int leak=0, tot=0;
      for(int y=cy0;y<cy1;y+=2) for(int x=cx0;x<cx1;x+=2){ tot++; if(outside[y*W+x]) leak++; }
      double lf = (double)leak/tot;
      tries += "[dT="+dT+" dil="+dil+" leak="+lf.ToString("0.000")+"]";
      if(lf < 0.002) break;
      dT += 12; dil = Math.Min(4, dil+1);
    }

    // keep only the largest enclosed island (the lens); everything else -> outside
    var lbl = new int[N];
    var q2 = new int[N];
    int nextLbl = 0, bestLbl = -1, bestSize = 0;
    for(int s=0;s<N;s++){
      if(outside[s] || lbl[s]!=0) continue;
      nextLbl++;
      int size=0, h2=0, t2=0;
      lbl[s]=nextLbl; q2[t2++]=s;
      while(h2<t2){
        int p=q2[h2++]; size++;
        int px=p%W, py=p/W;
        if(px>0 && !outside[p-1] && lbl[p-1]==0){ lbl[p-1]=nextLbl; q2[t2++]=p-1; }
        if(px<W-1 && !outside[p+1] && lbl[p+1]==0){ lbl[p+1]=nextLbl; q2[t2++]=p+1; }
        if(py>0 && !outside[p-W] && lbl[p-W]==0){ lbl[p-W]=nextLbl; q2[t2++]=p-W; }
        if(py<H-1 && !outside[p+W] && lbl[p+W]==0){ lbl[p+W]=nextLbl; q2[t2++]=p+W; }
      }
      if(size>bestSize){ bestSize=size; bestLbl=nextLbl; }
    }
    for(int i=0;i<N;i++) if(!outside[i] && lbl[i]!=bestLbl) outside[i]=true;

    // chamfer distance from the outside
    var dist = new double[N];
    for(int i=0;i<N;i++) dist[i] = outside[i]?0:1e9;
    for(int y=0;y<H;y++) for(int x=0;x<W;x++){
      int i=y*W+x; double d=dist[i];
      if(x>0) d=Math.Min(d, dist[i-1]+1);
      if(y>0){
        d=Math.Min(d, dist[i-W]+1);
        if(x>0) d=Math.Min(d, dist[i-W-1]+1.41421356);
        if(x<W-1) d=Math.Min(d, dist[i-W+1]+1.41421356);
      }
      dist[i]=d;
    }
    for(int y=H-1;y>=0;y--) for(int x=W-1;x>=0;x--){
      int i=y*W+x; double d=dist[i];
      if(x<W-1) d=Math.Min(d, dist[i+1]+1);
      if(y<H-1){
        d=Math.Min(d, dist[i+W]+1);
        if(x<W-1) d=Math.Min(d, dist[i+W+1]+1.41421356);
        if(x>0) d=Math.Min(d, dist[i+W-1]+1.41421356);
      }
      dist[i]=d;
    }

    var bl = Blur(srcPx, W, H, Math.Max(2, W/90));
    var rnd = new Random(seed);
    var outPx = (byte[])srcPx.Clone();
    var dbg = (byte[])srcPx.Clone();

    for(int y=0;y<H;y++) for(int x=0;x<W;x++){
      int i=y*W+x; int i4=i*4;
      double d = dist[i];
      double t = (d-edge0)/(edge1-edge0); t = t<0?0:(t>1?1:t);
      double aM = t*t*(3-2*t);
      if(aM>0.003){
        int fx=(int)((double)x/W*(Wf-1)); int fy=(int)((double)y/H*(Hf-1));
        double fd = Lum(fog,(fy*Wf+fx)*4)/255.0;
        double mottle = 1.0 - mottleAmp*0.5 + mottleAmp*fd;
        // faint vertical weather-streaks (fast variation across x, slow down y)
        int sfx=(int)(((double)x*2.7)%(Wf-1)); int sfy=(int)((double)y/H*0.30*(Hf-1));
        double streak = Lum(fog,(sfy*Wf+sfx)*4)/255.0;
        mottle += (streak-0.5)*0.11;
        // oxidation sits heavier in a ring just inside the gasket
        double edgeW = (28.0-d)/20.0; edgeW = edgeW<0?0:(edgeW>1?1:edgeW);
        mottle *= (1.0 - 0.09*edgeW);
        // soft top light on the curved lens face
        mottle *= (1.05 - 0.10*((double)y/H));
        double alpha = aM * Math.Min(1.0, alphaBase + 0.05*(fd-0.5) + 0.04*edgeW);
        double hcR = (milkR*mottle)*(1-ghost) + bl[i4+2]*ghost;
        double hcG = (milkG*mottle)*(1-ghost) + bl[i4+1]*ghost;
        double hcB = (milkB*mottle)*(1-ghost) + bl[i4]*ghost;
        double gr = (rnd.NextDouble()-0.5)*10*alpha;
        outPx[i4+2] = Cl(srcPx[i4+2]*(1-alpha) + hcR*alpha + gr);
        outPx[i4+1] = Cl(srcPx[i4+1]*(1-alpha) + hcG*alpha + gr);
        outPx[i4]   = Cl(srcPx[i4]  *(1-alpha) + hcB*alpha + gr);
      }
      if(d>edge0 && d<edge1){
        dbg[i4+2]=255; dbg[i4+1]=(byte)(dbg[i4+1]/3); dbg[i4]=(byte)(dbg[i4]/3);
      }
    }
    Save(outBefore, outPx, W, H, false);
    Save(outDebug, dbg, W, H, true);
    return "OK " + W + "x" + H + " " + tries;
  }
}
"@
Add-Type -TypeDefinition $src -ReferencedAssemblies PresentationCore, WindowsBase, System.Xaml
$assets = "C:\Users\LukeNorquist\clear-vision-cars\assets"
$sp = Split-Path -Parent $MyInvocation.MyCommand.Path
[OxBaker]::Bake("$assets\headlight-after.jpg", "$assets\haze.jpg",
  "$sp\before_try.jpg", "$sp\mask_debug.png",
  $darkT, $edge0, $edge1, $alphaBase, $milkR, $milkG, $milkB, $mottleAmp, $ghost, $seed)
