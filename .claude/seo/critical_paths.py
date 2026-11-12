"""Fail the scheduled measurement when a customer's entry point or canonical host breaks."""
import os
import re
from html.parser import HTMLParser
from urllib.request import Request, urlopen, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError
from urllib.parse import urlsplit

class Titles(HTMLParser):
    def __init__(self):
        super().__init__(); self.tags = []
    def handle_starttag(self, tag, attrs):
        self.tags.append(tag)

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args): return None

CHECKS = {
    "xn--y43bx4q.kr": [("/", "h1"), ("/compare/", "h1"), ("/cars/", "h1"), ("/llms.txt", "/cars/"), ("/sitemap.xml", "/cars/")],
    "noahgroup.co.kr": [("/", "h1"), ("/contact.html", "form"), ("/pay-result.html", "noindex")],
    "noahhomepage.co.kr": [("/", "h1"), ("/contact", "form"), ("/checkout", "form"), ("/robots.txt", "ai-train=yes")],
    "selfmarketing.ai.kr": [("/", "h1"), ("/pricing/", "application/ld+json"), ("/start/", "noindex")],
}
def get(url, follow=True, ua="CC-Operations-Check/1.0"):
    try:
        with (urlopen if follow else build_opener(NoRedirect).open)(Request(url,headers={"User-Agent":ua}),timeout=20) as r:
            return r.status,r.geturl(),r.read(3000000).decode("utf-8","replace"),r.headers
    except HTTPError as e: return e.code, url, "", e.headers
def check(test, ok):
    print(("OK   " if ok else "FAIL ")+test)
    if not ok: failures.append(test)
site=os.environ["SITE"].rstrip("/"); host=urlsplit(site).hostname
failures=[]
for path, marker in CHECKS[host]:
    status, final, body, _=get(site+path)
    parser=Titles();parser.feed(body)
    valid=marker in parser.tags if marker in ("h1","form") else marker in body
    check(path + " " + str(status) + " " + marker, status==200 and urlsplit(final).hostname==host and valid)
probe="/?utm_source=ops_scheme_check"
s,_,_,h=get("http://"+host+probe,False)
check("HTTP to HTTPS preserving query",s in (301,308) and h.get("Location")==site+probe)
if host=="noahhomepage.co.kr":
    s,_,_,h=get("https://www."+host+probe,False)
    check("www to apex preserving query",s in (301,308) and h.get("Location")==site+probe)
    for ua in ("GPTBot","ClaudeBot","OAI-SearchBot"):
        s,_,_,_=get(site+"/",ua=ua);check(ua+" "+str(s),s==200)
if failures: raise SystemExit(1)
