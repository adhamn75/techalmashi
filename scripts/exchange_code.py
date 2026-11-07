"""Exchange a one-time Google OAuth code for a refresh token.

Runs inside GitHub Actions (the auth workflow). The refresh token is never printed:
it is written to token.txt, which the workflow encrypts with YT_CLIENT_SECRET
and commits as youtube_token.enc.
"""
import json
import os
import sys
import urllib.parse
import urllib.request

missing = [k for k in ("YT_CLIENT_ID", "YT_CLIENT_SECRET") if not os.environ.get(k, "").strip()]
if missing:
    print("Missing GitHub secrets:", ", ".join(missing))
    sys.exit(1)
code = os.environ["AUTH_CODE"].strip()
if "code=" in code:  # the whole redirect URL was pasted
    code = urllib.parse.parse_qs(urllib.parse.urlparse(code).query)["code"][0]

body = urllib.parse.urlencode({
    "code": code,
    "client_id": os.environ["YT_CLIENT_ID"],
    "client_secret": os.environ["YT_CLIENT_SECRET"],
    "redirect_uri": os.environ.get("REDIRECT_URI", "http://localhost"),
    "grant_type": "authorization_code",
}).encode()
try:
    resp = json.load(urllib.request.urlopen("https://oauth2.googleapis.com/token", body))
except urllib.error.HTTPError as e:
    print("Google refused the code:", e.read().decode()[:300])
    sys.exit(1)

token = resp.get("refresh_token")
if not token:
    print("No refresh_token in the response; keys returned:", sorted(resp))
    sys.exit(1)
open("token.txt", "w").write(token)
print("Refresh token received (saved encrypted).")
