# Weekly website audit: run "node build.mjs" first, then "python3 scripts/site-audit.py". Reports broken internal links, missing/duplicate titles, descriptions, h1 and image alt text.
import os,re,html,collections,urllib.parse,json,sys
import pathlib
R=str(pathlib.Path(__file__).resolve().parent.parent/'_site')
pages={}
for d,_,fs in os.walk(R):
    for f in fs:
        if f.endswith('.html'):
            p=os.path.join(d,f); rel='/'+os.path.relpath(p,R).replace('index.html','')
            pages[rel]=open(p,encoding='utf-8',errors='ignore').read()
redir=open(R+'/_redirects').read() if os.path.exists(R+'/_redirects') else ''
rsrc=set(l.split()[0] for l in redir.splitlines() if l.strip() and not l.startswith('#'))
def exists(u):
    u=u.split('#')[0].split('?')[0]
    if not u or u=='/': return True
    u=urllib.parse.unquote(u)
    if u in rsrc or u.rstrip('/') in rsrc or (u.rstrip('/')+'/') in rsrc: return True
    for pat in rsrc:
        if pat.endswith('*') and u.startswith(pat[:-1]): return True
    f=R+u
    return os.path.exists(f) or os.path.exists(f+'index.html') or os.path.exists(f.rstrip('/')+'.html') or os.path.exists(f+'/index.html')
broken=collections.defaultdict(set); titles=collections.defaultdict(list); issues=collections.defaultdict(list)
for rel,h in pages.items():
    noindex='noindex' in (re.search(r'<meta name="robots"[^>]*>',h) or [''])[0] if re.search(r'<meta name="robots"[^>]*>',h) else False
    t=re.search(r'<title>(.*?)</title>',h,re.S); t=html.unescape(t.group(1).strip()) if t else ''
    if not t: issues['no title'].append(rel)
    elif not noindex: titles[t].append(rel)
    if t and len(t)>70 and not noindex: issues['title >70 chars'].append(f'{rel} ({len(t)})')
    d=re.search(r'<meta name="description" content="([^"]*)"',h)
    if not d and not noindex: issues['no meta description'].append(rel)
    elif d and not noindex and (len(d.group(1))<70 or len(d.group(1))>170): issues['description length'].append(f'{rel} ({len(d.group(1))})')
    if not noindex and len(re.findall(r'<h1[\s>]',h))!=1: issues['h1 count != 1'].append(f'{rel} ({len(re.findall(r"<h1[\\s>]",h))})')
    for m in re.finditer(r'<img\b([^>]*)>',h):
        a=m.group(1)
        if 'alt=' not in a: issues['img without alt'].append(rel)
    for m in re.finditer(r'(?:href|src)="(/[^"#][^"]*)"',h):
        u=html.unescape(m.group(1))
        if u.startswith('//'): continue
        if not exists(u): broken[u].add(rel)
    if 'lorem' in h.lower() or 'TODO' in h or 'undefined' in re.sub(r'<script.*?</script>','',h,flags=re.S): issues['placeholder/undefined text'].append(rel)
    if re.search(r'>\s*NaN\s*<|\$NaN|₹NaN|null\b</',h): issues['NaN/null shown'].append(rel)
print('pages',len(pages))
print('BROKEN LINKS',len(broken))
for u,s in sorted(broken.items())[:60]: print(' ',u,'<-',sorted(s)[:3],len(s))
dup={t:p for t,p in titles.items() if len(p)>1}
print('DUP TITLES',len(dup))
for t,p in list(dup.items())[:20]: print(' ',t[:80],p[:4])
for k,v in issues.items(): print(k,len(v),v[:12])
