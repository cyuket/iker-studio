# Music

Background music lives here and is not committed to Git: a music licence usually forbids
passing the audio file on by itself. Each track is recorded below so anyone can fetch it
again and check the terms.

| File                           | Track                                                      | Source                                                                                                  | Licence                                                                                                             |
| ------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `soft-corporate-paulyudin.mp3` | "Soft Corporate - Soft Corporate Music" by PaulYudin, 3:08 | https://pixabay.com/music/corporate-soft-corporate-soft-corporate-music-607620/ (downloaded 2026-10-08) | Pixabay Content License: free to use, commercial use allowed, no attribution required, no standalone redistribution |

The Pixabay page marks this track "Content ID Registered". On YouTube that can raise an
automatic copyright claim against a video that uses it. Pixabay's guidance is that such a claim
can be disputed as licensed use; check the track page for the current steps before publishing.

To use a track, set `music` on a cut in the video's `storyboard.json`:

```json
"music": { "file": "soft-corporate-paulyudin.mp3", "volume": 0.07, "licence": "Pixabay Content License" }
```

The mix lowers the music whenever there is speech and fades it in and out with the video.
