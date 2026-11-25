"""Exchange a one-time Google OAuth code for the READ-ONLY analytics refresh token.

Runs inside GitHub Actions (auth workflow, purpose=analytics). Same exchange as exchange_code.py,
plus one safety check: the granted scopes must be exactly yt-analytics.readonly. A code that grants
anything else (for example the publishing scopes) is refused and nothing is written, so a
publishing-capable token can never be stored as the analytics token. The token is never printed:
it is written to token.txt, which the workflow encrypts and commits as youtube_analytics_<account>.enc.
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

CLIENT_ID = "1098334853097-svmse3o063e65tfumg0q23u3cml9mttt.apps.googleusercontent.com"
ANALYTICS_SCOPE = "https://www.googleapis.com/auth/yt-analytics.readonly"


def check_response(resp: dict) -> str:
    """Return the refresh token if the response grants exactly the analytics scope, else raise ValueError."""
    scope = resp.get("scope")
    if not scope:
        raise ValueError("Google did not report which access was granted; refusing to save the token.")
    granted = set(scope.split())
    if granted != {ANALYTICS_SCOPE}:
        extra = sorted(granted - {ANALYTICS_SCOPE})
        raise ValueError("This sign-in grants more or other access than read-only analytics "
                         f"({', '.join(extra) or 'analytics scope missing'}). Use the address from "
                         "scripts/analytics_auth_url.py and try again.")
    token = resp.get("refresh_token")
    if not token:
        raise ValueError(f"No refresh_token in the response; keys returned: {sorted(resp)}")
    return token


def exchange(code: str, secret: str, redirect_uri: str) -> dict:
    if "code=" in code:  # the whole redirect URL was pasted
        code = urllib.parse.parse_qs(urllib.parse.urlparse(code).query)["code"][0]
    body = urllib.parse.urlencode({
        "code": code,
        "client_id": CLIENT_ID,
        "client_secret": secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }).encode()
    return json.load(urllib.request.urlopen("https://oauth2.googleapis.com/token", body))


def main() -> int:
    secret = os.environ.get("YT_CLIENT_SECRET", "").strip()
    if not secret:
        print("Missing GitHub secret: YT_CLIENT_SECRET")
        return 1
    try:
        resp = exchange(os.environ["AUTH_CODE"].strip(), secret, os.environ.get("REDIRECT_URI", "http://localhost"))
    except urllib.error.HTTPError as e:
        print("Google refused the code:", e.read().decode()[:300])
        return 1
    try:
        token = check_response(resp)
    except ValueError as e:
        print(e)
        return 1
    with open("token.txt", "w") as f:
        f.write(token)
    print("Read-only analytics token received (saved encrypted).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
