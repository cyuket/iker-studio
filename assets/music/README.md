# Music

Background music lives here and is not committed to Git: a music licence usually forbids
passing the audio file on by itself. Each track is recorded below so anyone can fetch it
again and check the terms.

| File                                | Track                                                               | Source                                                                                                     | Licence                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `soft-corporate-paulyudin.mp3`      | "Soft Corporate - Soft Corporate Music" by PaulYudin, 3:08          | https://pixabay.com/music/corporate-soft-corporate-soft-corporate-music-607620/ (downloaded 2026-10-08)    | Pixabay Content License: free to use, commercial use allowed, no attribution required, no standalone redistribution |
| `kevin-macleod-study-and-relax.mp3` | "Study And Relax" by Kevin MacLeod, 3:43, 72 bpm, saxophones, piano | https://incompetech.com/music/royalty-free/mp3-royaltyfree/Study%20And%20Relax.mp3 (downloaded 2026-11-20) | CC BY 4.0: free, commercial and monetised use allowed, credit required                                              |
| `kevin-macleod-jazz-brunch.mp3`     | "Jazz Brunch" by Kevin MacLeod, 5:23, 100 bpm, electric piano       | https://incompetech.com/music/royalty-free/mp3-royaltyfree/Jazz%20Brunch.mp3 (downloaded 2026-11-20)       | CC BY 4.0, credit required                                                                                          |
| `kevin-macleod-lobby-time.mp3`      | "Lobby Time" by Kevin MacLeod, 3:13, 128 bpm, vibraphone, piano     | https://incompetech.com/music/royalty-free/mp3-royaltyfree/Lobby%20Time.mp3 (downloaded 2026-11-20)        | CC BY 4.0, credit required                                                                                          |

The Pixabay page marks this track "Content ID Registered". On YouTube that can raise an
automatic copyright claim against a video that uses it. Pixabay's guidance is that such a claim
can be disputed as licensed use; check the track page for the current steps before publishing.

The PaulYudin track is listed for reference; its file is not on this machine today.

Kevin MacLeod's tracks (incompetech.com) are free under Creative Commons Attribution 4.0 on one
condition: every video that uses one credits it. His required wording is:

```
"Study And Relax" Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0
https://creativecommons.org/licenses/by/4.0/
```

Put that wording in the cut's `music.credit`; `pnpm studio export` then prints it under "Music"
in the YouTube description and the LinkedIn and Shorts captions. The X caption has no room for
it: add the credit yourself if a music cut goes to X. His tracks are pre-registered with YouTube
Content ID, so a claim can still appear after upload. His advice (incompetech.com, "YouTube
Content ID"): make sure the credit is in the description, then dispute the claim; it is released
within about 72 hours.

To use a track, set `music` on a cut in the video's `storyboard.json`:

```json
"music": {
  "file": "kevin-macleod-study-and-relax.mp3",
  "volume": 0.08,
  "licence": "CC BY 4.0",
  "credit": "\"Study And Relax\" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0, https://creativecommons.org/licenses/by/4.0/"
}
```

The mix lowers the music whenever there is speech and fades it in and out with the video.

## Mixkit tracks (downloaded 2026-11-20)

Licence: Mixkit Stock Music Free License (https://mixkit.co/license/#musicFree): free for
commercial and personal video projects, no attribution required, no standalone redistribution.
Source file: `https://assets.mixkit.co/music/<id>/<id>.mp3`. Recheck the licence page before publishing.

| File                                                  | Track                   | Artist                   | Genre           | Length | Mixkit id |
| ----------------------------------------------------- | ----------------------- | ------------------------ | --------------- | ------ | --------- |
| `mixkit-dreaming-big-ahjay-stelino.mp3`               | Dreaming Big            | Ahjay Stelino            | Film Score      | 1m50s  | 31        |
| `mixkit-driving-ambition-ahjay-stelino.mp3`           | Driving Ambition        | Ahjay Stelino            | Film Score      | 1m42s  | 32        |
| `mixkit-motivating-mornings-ahjay-stelino.mp3`        | Motivating Mornings     | Ahjay Stelino            | Corporate Music | 1m36s  | 33        |
| `mixkit-raising-me-higher-ahjay-stelino.mp3`          | Raising Me Higher       | Ahjay Stelino            | Corporate Music | 1m38s  | 34        |
| `mixkit-uplift-me-ahjay-stelino.mp3`                  | Uplift Me               | Ahjay Stelino            | Pop             | 1m45s  | 35        |
| `mixkit-happy-times-alejandro-magana.mp3`             | Happy Times             | Alejandro Magaña (A. M.) | Pop             | 1m40s  | 158       |
| `mixkit-better-times-are-coming-alejandro-magana.mp3` | Better Times are Coming | Alejandro Magaña (A. M.) | Synthpop        | 1m40s  | 173       |
| `mixkit-digital-clouds-alejandro-magana.mp3`          | Digital Clouds          | Alejandro Magaña (A. M.) | Chillout        | 1m41s  | 175       |
| `mixkit-sweet-september-arulo.mp3`                    | Sweet September         | Arulo                    | Hip Hop         | 1m39s  | 282       |
| `mixkit-serene-view-arulo.mp3`                        | Serene View             | Arulo                    | Chillout        | 1m54s  | 443       |
| `mixkit-curiosity-diego-nava.mp3`                     | Curiosity               | Diego Nava               | Chillout        | 1m40s  | 480       |
| `mixkit-lo-fi-01-lily-j.mp3`                          | Lo-Fi 01                | Lily J                   | Electronica     | 1m42s  | 763       |
| `mixkit-lo-fi-02-lily-j.mp3`                          | Lo-Fi 02                | Lily J                   | Chillout        | 1m38s  | 764       |
| `mixkit-lo-fi-04-lily-j.mp3`                          | Lo-Fi 04                | Lily J                   | Corporate Music | 2m44s  | 766       |
| `mixkit-feel-alive-michael-ramir-c.mp3`               | Feel Alive              | Michael Ramir C.         | Soul            | 1m46s  | 953       |
| `mixkit-proud-of-you-michael-ramir-c.mp3`             | Proud of You            | Michael Ramir C.         | Rock            | 1m44s  | 1117      |

Use: `"music": { "file": "mixkit-lo-fi-01-lily-j.mp3", "volume": 0.07, "licence": "Mixkit Stock Music Free License, mixkit.co, Lily J" }`
