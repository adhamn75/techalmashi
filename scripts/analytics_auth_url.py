"""Print the Google sign-in address for the READ-ONLY analytics token.

This token can only read YouTube Analytics (retention, average view %, subscribers gained).
It cannot upload, edit, delete or reply. The publishing token is not touched.

1. Run: python scripts/analytics_auth_url.py
2. Open the address, pick the CHANNEL (the Brand Account, not your personal account) and allow.
3. The browser lands on a "localhost" page that does not load: copy that whole address.
4. GitHub -> Actions -> "Connect YouTube (one time)" -> Run workflow:
   paste the address, pick the channel, purpose = analytics.
Repeat for each channel.
"""
import urllib.parse

CLIENT_ID = "1098334853097-svmse3o063e65tfumg0q23u3cml9mttt.apps.googleusercontent.com"
SCOPE = "https://www.googleapis.com/auth/yt-analytics.readonly"
REDIRECT_URI = "http://localhost"


def auth_url() -> str:
    query = urllib.parse.urlencode({
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",
        "prompt": "consent",
    })
    return "https://accounts.google.com/o/oauth2/v2/auth?" + query


if __name__ == "__main__":
    print(auth_url())
