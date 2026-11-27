# Same minimax as files/tictactoe.bas; prints Excel's score per empty square for the filmed game.
import sys
L=[(0,1,2),(3,4,5),(6,7,8),(0,3,6),(1,4,7),(2,5,8),(0,4,8),(2,4,6)]
def win(b):
    for a,c,d in L:
        if b[a] and b[a]==b[c]==b[d]: return b[a]
    return 0
def mm(b,t,dp):
    w=win(b)
    if w==2: return 10-dp
    if w==1: return dp-10
    if all(b): return 0
    best=-1000 if t==2 else 1000
    for i in range(9):
        if not b[i]:
            b[i]=t; s=mm(b,3-t,dp+1); b[i]=0
            best=max(best,s) if t==2 else min(best,s)
    return best
def move(b):
    sc={}
    for i in range(9):
        if not b[i]:
            b[i]=2; sc[i]=mm(b,1,1); b[i]=0
    p=max(sc,key=lambda k:(sc[k],-k)); return p,sc
b=[0]*9
for x in map(int,sys.argv[1:]):
    b[x]=1
    if win(b) or all(b): break
    p,sc=move(b); b[p]=2; print('X',x,'-> O',p,sc, 'win' if win(b) else '')
print(b)
