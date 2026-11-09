"""Cancel a scheduled upload: keep the video, but make it plain private with no publish time.
Usage (GitHub Actions): python unschedule.py <videoId> <account>"""
import sys

from publish import youtube_client

vid, account = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "tech")
yt = youtube_client(account)
v = yt.videos().list(part="status", id=vid).execute()["items"][0]
st = v["status"]
body = {"id": vid, "status": {"privacyStatus": "private", "selfDeclaredMadeForKids": st.get("selfDeclaredMadeForKids", False)}}
yt.videos().update(part="status", body=body).execute()
print(f"{vid}: was {st.get('privacyStatus')} publishAt={st.get('publishAt')} -> now private, not scheduled")
