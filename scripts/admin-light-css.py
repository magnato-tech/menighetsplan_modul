"""Writes src/admin-light.css: the dark palette the admin tabs are written in, turned light for «Lyst innhold».

Run after a class in a dark hue (bg-*-950, text-*-300, border-*-800 …) is added to the admin:
    python3 scripts/admin-light-css.py > src/admin-light.css
tests/admin-light-css.test.ts fails while a class is missing.
"""
import re,subprocess,sys
P={ # 50,100,200,500,600,700 (Tailwind v3 hexes)
'slate':['#f8fafc','#f1f5f9','#e2e8f0','#64748b','#475569','#334155'],
'gray':['#f9fafb','#f3f4f6','#e5e7eb','#6b7280','#4b5563','#374151'],
'zinc':['#fafafa','#f4f4f5','#e4e4e7','#71717a','#52525b','#3f3f46'],
'stone':['#fafaf9','#f5f5f4','#e7e5e4','#78716c','#57534e','#44403c'],
'neutral':['#fafafa','#f5f5f5','#e5e5e5','#737373','#525252','#404040'],
'red':['#fef2f2','#fee2e2','#fecaca','#ef4444','#dc2626','#b91c1c'],
'rose':['#fff1f2','#ffe4e6','#fecdd3','#f43f5e','#e11d48','#be123c'],
'pink':['#fdf2f8','#fce7f3','#fbcfe8','#ec4899','#db2777','#be185d'],
'orange':['#fff7ed','#ffedd5','#fed7aa','#f97316','#ea580c','#c2410c'],
'amber':['#fffbeb','#fef3c7','#fde68a','#f59e0b','#d97706','#b45309'],
'yellow':['#fefce8','#fef9c3','#fef08a','#eab308','#ca8a04','#a16207'],
'lime':['#f7fee7','#ecfccb','#d9f99d','#84cc16','#65a30d','#4d7c0f'],
'green':['#f0fdf4','#dcfce7','#bbf7d0','#22c55e','#16a34a','#15803d'],
'emerald':['#ecfdf5','#d1fae5','#a7f3d0','#10b981','#059669','#047857'],
'teal':['#f0fdfa','#ccfbf1','#99f6e4','#14b8a6','#0d9488','#0f766e'],
'cyan':['#ecfeff','#cffafe','#a5f3fc','#06b6d4','#0891b2','#0e7490'],
'sky':['#f0f9ff','#e0f2fe','#bae6fd','#0ea5e9','#0284c7','#0369a1'],
'blue':['#eff6ff','#dbeafe','#bfdbfe','#3b82f6','#2563eb','#1d4ed8'],
'indigo':['#eef2ff','#e0e7ff','#c7d2fe','#6366f1','#4f46e5','#4338ca'],
'violet':['#f5f3ff','#ede9fe','#ddd6fe','#8b5cf6','#7c3aed','#6d28d9'],
'purple':['#faf5ff','#f3e8ff','#e9d5ff','#a855f7','#9333ea','#7e22ce'],
'fuchsia':['#fdf4ff','#fae8ff','#f5d0fe','#d946ef','#c026d3','#a21caf'],
}
slate_text={'200':'#1e293b','300':'#334155','400':'#64748b'}
files=sys.argv[1:] or ['src/pages/admin','src/components/admin','src/pages/AdminGroupDetailPage.tsx','src/pages/AdminPersonDetailPage.tsx','src/pages/AdminTaskDetailPage.tsx']
txt=subprocess.run(['grep','-rhoE',r'\b((hover|group-hover|focus):)?(bg|text|border)-('+'|'.join(P)+r')-(950|900|800|700|400|300|200|100)(/[0-9]+)?\b']+files,capture_output=True,text=True).stdout.split()
rules=[];darkbg=[]
def esc(c): return re.sub(r'([:/.])',r'\\\1',c)
for tok in sorted(set(txt)):
    m=re.match(r'((hover|group-hover|focus):)?(bg|text|border)-(\w+)-(\d+)(/\d+)?$',tok); v,_,kind,h,sh,op=m.groups(); pal=P[h]
    val=None
    if kind=='bg' and sh in('950','900','800'): val=pal[1] if v else pal[0]
    elif kind=='bg' and sh=='700': val=pal[2] if v else pal[1]
    elif kind=='text' and sh in('200','300','400','100'):
        val=slate_text.get(sh,pal[5]) if h=='slate' else pal[5]
    elif kind=='border' and sh in('700','800','900'): val=pal[2]
    if not val: continue
    prop={'bg':'background-color','text':'color','border':'border-color'}[kind]
    sel='.'+esc(tok)
    if v=='hover': sel+=':hover'
    elif v=='focus': sel+=':focus'
    elif v=='group-hover': sel='.group:hover '+sel
    rules.append(f'  {sel}:not(.site-theme *, [data-ui="light"] *) {{ {prop}: {val}; }}')
    if kind=='bg' and not v and sh in('950','900','800','700'): darkbg.append('.'+esc(tok))
print('/* Admin Studio, light content («Lyst innhold»): the dark palette the tabs are written in, turned light.')
print('   Written by scripts/admin-light-css.py: run it again when a class in a dark hue is added to the admin.')
print('   Website previews (.site-theme) and screens drawn for a light background ([data-ui="light"]) keep their colors. */')
print('[data-studio-theme="light"] {')
print('\n'.join(rules))
print(f'  :is({", ".join(darkbg)}).text-white:not(.site-theme *, [data-ui="light"] *) {{ color: #0f172a; }}')
# White text inside a panel that was dark and is now light, unless it sits on a coloured button of its own
strong=", ".join(f".bg-{h}-{n}" for h in P for n in ("500","600"))
print(f'  :is({", ".join(darkbg)}) .text-white:not([class*="bg-"], :is({strong}) *, .site-theme *, [data-ui="light"] *) {{ color: #0f172a; }}')
print('}')
