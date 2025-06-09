from uncompyle6 import uncompyle_file

try:
    uncompyle_file('d:\\a1.pyc', sys.stdout, showasm=True, showast=True, showgrammar=True)
    print('')
except Exception as e:
    if hasattr(e, "info"):
        print '\n'+e.info
    else:
        print str(e)

#import marshal
#with open('d:\\a2.pyc','rb') as f:
#   a = marshal.loads(f.read()[8:])
#print a.co_consts[0]