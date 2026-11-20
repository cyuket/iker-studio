# Sound effects

Files named `mixkit-*.mp3` were downloaded on 2026-11-20 from Mixkit under the Mixkit Sound
Effects Free License (https://mixkit.co/license/#sfxFree): free for commercial and personal
projects, no attribution required, no standalone redistribution. Each source file is
`https://assets.mixkit.co/active_storage/sfx/<id>/<id>-preview.mp3`, and each was checked
against the length Mixkit lists for it. Recheck the licence page before publishing.

Files named `synth-*.wav` were generated on this machine with FFmpeg's `aevalsrc` (2026-11-20).
They are original sounds with no third-party rights. Mixkit has no phone vibration sound, so
these were made instead.

The older `.wav` files without a prefix (`click.wav`, `message-pop.wav`, ...) are CC0 sounds
downloaded on 2026-11-20 (Kenney's CC0 interface pack, fetched through OpenGameArt), converted to
48 kHz WAV at about -3 dBFS. See "Interface sounds (CC0)" below. The exact page of each was not
recorded.

Product scenes play action sounds by themselves: `click.wav` on clicks and selections,
`click-soft.wav` on key presses, drags and dismissals, `mixkit-swipe-fast-small-sweep.mp3` on
scrolls, and `mixkit-keyboard-typing.mp3` (desktop) or `mixkit-typing-text-smartphone.mp3`
(phone) while typing. Keep those files: a product scene does not render without them. The list
is `ACTION_SOUNDS` in `src/domain/action-sounds.ts`.

Media is not committed to Git. Use a file on a scene in `storyboard.json`:
`"sounds": [{ "file": "mixkit-tap-light-button.mp3", "cue": "<cue>", "volume": 0.5 }]`

## Interface sounds (CC0)

Short, clean UI sounds. First choice for product scenes: chat messages, taps, confirmations.

| File                    | Use                                      | Length |
| ----------------------- | ---------------------------------------- | ------ |
| `click.wav`             | A tap or button press                    | 0.09s  |
| `click-soft.wav`        | A quieter tap, repeated taps             | 0.22s  |
| `message-pop.wav`       | A chat message or DM arriving            | 0.40s  |
| `bubble.wav`            | A bubble or card popping in              | 0.44s  |
| `bubble-small.wav`      | A small bubble, a chip, a badge          | 0.32s  |
| `pop-alt.wav`           | An alternative pop for a list of items   | 0.28s  |
| `notification.wav`      | A phone notification                     | 1.00s  |
| `notification-bell.wav` | A brighter notification, a new booking   | 1.44s  |
| `seen-tick.wav`         | A message marked seen, a check appearing | 0.37s  |
| `confirm-chime.wav`     | "Confirm booking", a payment marked paid | 2.00s  |
| `stamp-thud.wav`        | A stamp, a status landing ("Paid")       | 0.31s  |
| `reveal.wav`            | A quick reveal of a number or a label    | 0.15s  |

## Phone gestures

| File                                     | Source                                             | Id   |
| ---------------------------------------- | -------------------------------------------------- | ---- |
| `synth-haptic-tick.wav`                  | Generated: one short haptic tap                    | n/a  |
| `synth-phone-vibrate-long.wav`           | Generated: one phone vibration buzz                | n/a  |
| `synth-phone-vibrate-double.wav`         | Generated: two vibration pulses (incoming message) | n/a  |
| `mixkit-tap-light-button.mp3`            | Light button                                       | 2580 |
| `mixkit-tap-plastic-bubble-click.mp3`    | Plastic bubble click                               | 1124 |
| `mixkit-tap-modern-click-check.mp3`      | Modern click box check                             | 1120 |
| `mixkit-tap-modern-select.mp3`           | Modern technology select                           | 3124 |
| `mixkit-swipe-fast-small-sweep.mp3`      | Fast small sweep transition                        | 166  |
| `mixkit-swipe-short-sweep.mp3`           | Short transition sweep                             | 175  |
| `mixkit-swipe-fast-swoosh.mp3`           | Fast transitions swoosh                            | 3115 |
| `mixkit-swipe-tech-slide.mp3`            | Technology transition slide                        | 3120 |
| `mixkit-swipe-fast-zoom.mp3`             | Fast swipe zoom                                    | 2627 |
| `mixkit-swipe-glass-slide.mp3`           | Glass plate slide                                  | 1527 |
| `mixkit-screenshot-digital-shutter.mp3`  | Camera digital shutter                             | 1432 |
| `mixkit-camera-shutter-click.mp3`        | Camera shutter click                               | 1133 |
| `mixkit-lock-digital.mp3`                | Computer digital lock                              | 2859 |
| `mixkit-unlock-success-tone.mp3`         | Success software tone                              | 2865 |
| `mixkit-notification-flute.mp3`          | Flute mobile phone notification alert              | 2316 |
| `mixkit-notification-fairy-message.mp3`  | Fairy message notification                         | 861  |
| `mixkit-phone-ring-bell.mp3`             | Phone ring bell                                    | 593  |
| `mixkit-ringtone-marimba.mp3`            | Marimba ringtone                                   | 1359 |
| `mixkit-smartphone-digital-keyboard.mp3` | Smartphone digital keyboard                        | 1394 |

## Attention grabbers (hooks, reveals, caption hits)

| File                                      | Mixkit title                    | Id   |
| ----------------------------------------- | ------------------------------- | ---- |
| `mixkit-record-scratch.mp3`               | Record player vinyl scratch     | 702  |
| `mixkit-record-stop-scratch.mp3`          | Vinyl stop fast scratch         | 704  |
| `mixkit-riser-cinematic-trailer.mp3`      | Cinematic trailer riser         | 790  |
| `mixkit-riser-cinematic-synth.mp3`        | Cinematic synth riser           | 645  |
| `mixkit-hit-short-bass.mp3`               | Short bass hit                  | 2299 |
| `mixkit-hit-quick-zoom.mp3`               | Quick zoom impact               | 772  |
| `mixkit-hit-trailer-whoosh.mp3`           | Movie trailer whoosh hit        | 2919 |
| `mixkit-hit-cool-trailer-impact.mp3`      | Cool impact movie trailer       | 2909 |
| `mixkit-glitch-intro-text.mp3`            | Intro text glitch               | 2950 |
| `mixkit-glitch-digital-break.mp3`         | Digital glitch break            | 2951 |
| `mixkit-glitch-short.mp3`                 | Glitch short                    | 1031 |
| `mixkit-glitch-rewind-transition.mp3`     | Glitch sci fi rewind transition | 1093 |
| `mixkit-buzzer-wrong-answer.mp3`          | Game show wrong answer buzz     | 950  |
| `mixkit-buzzer-wrong-bass.mp3`            | Wrong answer bass buzzer        | 948  |
| `mixkit-buzzer-game-show-buzz-in.mp3`     | Game show buzz in               | 3090 |
| `mixkit-beep-censor.mp3`                  | Censorship beep                 | 1082 |
| `mixkit-drum-roll.mp3`                    | Drum Roll                       | 566  |
| `mixkit-heartbeat-single.mp3`             | Human single heart beat         | 490  |
| `mixkit-intro-news-sound.mp3`             | Intro news sound                | 1151 |
| `mixkit-reveal-explainer.mp3`             | Explainer video game reveal     | 235  |
| `mixkit-bells-uplifting-notification.mp3` | Uplifting bells notification    | 938  |
| `mixkit-sparkle-transition.mp3`           | Sparkle hybrid transition       | 3060 |
| `mixkit-beep-positive-interface.mp3`      | Positive interface beep         | 221  |
| `mixkit-countdown-melodic.mp3`            | Melodic race countdown          | 1955 |
| `mixkit-clock-fast-ticking.mp3`           | Fast wall clock ticking         | 1063 |
| `mixkit-clock-tick-tock.mp3`              | Tick tock clock close up        | 1059 |
| `mixkit-clock-single-tick.mp3`            | Clock ticker single             | 1061 |

## Whooshes (caption and scene transitions)

| File                                    | Mixkit title                          | Id   |
| --------------------------------------- | ------------------------------------- | ---- |
| `mixkit-cinematic-whoosh-fast.mp3`      | Cinematic whoosh fast transition      | 1492 |
| `mixkit-tunnel-reverb-whoosh.mp3`       | Cinematic tunnel reverb woosh         | 1486 |
| `mixkit-arrow-whoosh.mp3`               | Arrow whoosh                          | 1491 |
| `mixkit-magic-sparkle-whoosh.mp3`       | Magic sparkle whoosh                  | 2350 |
| `mixkit-metal-hit-whoosh.mp3`           | Metal hit woosh                       | 1485 |
| `mixkit-swirling-whoosh.mp3`            | Swirling whoosh                       | 1493 |
| `mixkit-air-woosh.mp3`                  | Air woosh                             | 1489 |
| `mixkit-fast-whoosh-transition.mp3`     | Fast whoosh transition                | 1490 |
| `mixkit-explainer-pop-whoosh.mp3`       | Explainer video pops whoosh light pop | 3005 |
| `mixkit-whoosh-impact-presentation.mp3` | Movie whoosh impact presentation      | 2903 |

## Typing

| File                                   | Mixkit title                     | Id   |
| -------------------------------------- | -------------------------------- | ---- |
| `mixkit-keyboard-typing.mp3`           | Keyboard typing                  | 1386 |
| `mixkit-typing-laptop-keyboard.mp3`    | Typing on a laptop keyboard      | 2531 |
| `mixkit-slow-typing-keyboard.mp3`      | Slow typing on a keyboard        | 2532 |
| `mixkit-fast-keyboard-typing.mp3`      | Fast keyboard typing             | 1387 |
| `mixkit-fast-laptop-typing.mp3`        | Fast laptop keyboard typing      | 1392 |
| `mixkit-keyboard-slow-typing.mp3`      | Keyboard slow typing             | 1391 |
| `mixkit-laptop-typing-sequence.mp3`    | Laptop keyboard typing sequence  | 2537 |
| `mixkit-laptop-backspace-sequence.mp3` | Laptop backspace typing sequence | 2539 |
| `mixkit-single-key-type.mp3`           | Single key type                  | 2533 |
| `mixkit-single-key-press-laptop.mp3`   | Single key press in a laptop     | 2541 |
| `mixkit-keyboard-key-presses.mp3`      | Keyboard key presses             | 2534 |
| `mixkit-chatting-with-laptop.mp3`      | Chatting with a laptop           | 2540 |
| `mixkit-smartphone-typing.mp3`         | Smartphone typing                | 1393 |
| `mixkit-typing-text-smartphone.mp3`    | Typing text on a smartphone      | 1395 |
| `mixkit-phone-keyboard-bit.mp3`        | Phone keyboard bit               | 2535 |
