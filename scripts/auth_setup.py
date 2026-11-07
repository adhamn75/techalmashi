"""One-time setup: run this on YOUR computer to let the publisher upload to your channel.

1. pip install google-auth-oauthlib
2. Put the client_secret.json you downloaded from Google Cloud next to this file.
3. python auth_setup.py
4. A Google page opens: pick the account that owns the channel and allow access.
5. Copy the three values it prints into GitHub → Settings → Secrets and variables → Actions.

Requested: manage your YouTube videos (upload, add to playlists, read view counts). Your password is never seen by this script.
You can revoke access any time at https://myaccount.google.com/permissions
"""
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/youtube"]  # upload + playlists + reading stats
secret = Path(__file__).with_name("client_secret.json")

flow = InstalledAppFlow.from_client_secrets_file(str(secret), SCOPES)
creds = flow.run_local_server(port=0, prompt="consent", access_type="offline")

print("\nAdd these as GitHub secrets:\n")
print(f"YT_CLIENT_ID      = {creds.client_id}")
print(f"YT_CLIENT_SECRET  = {creds.client_secret}")
print(f"YT_REFRESH_TOKEN  = {creds.refresh_token}")
print("\nDone. Delete client_secret.json if you like; GitHub now has what it needs.")
