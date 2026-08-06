export const NEXUS_PUBLIC_FIDELITY_V2 = `[center][size=6][b]Nexus Public Fidelity Fixture v2[/b][/size]
[i]Fixture ID: MDW-PUBLIC-V2 · compare every labelled case independently[/i][/center]

[line]

[heading]01 · Typography and inline marks[/heading]
[size=1]SIZE-1 · The quick brown fox 0123456789[/size]
[size=2]SIZE-2 · The quick brown fox 0123456789[/size]
[size=3]SIZE-3 · The quick brown fox 0123456789[/size]
[size=4]SIZE-4 · The quick brown fox 0123456789[/size]
[size=5]SIZE-5 · The quick brown fox 0123456789[/size]
[size=6]SIZE-6 · The quick brown fox 0123456789[/size]

INLINE-PLAIN · Plain text
INLINE-BOLD · [b]Bold text[/b]
INLINE-ITALIC · [i]Italic text[/i]
INLINE-UNDERLINE · [u]Underlined text[/u]
INLINE-STRIKE · [s]Struck text[/s]
INLINE-NESTED · [b]Bold with [i]nested italic and [u]underline[/u][/i][/b]
INLINE-COLOUR-ORANGE · [color=#d98f39]Orange hex colour[/color]
INLINE-COLOUR-BLUE · [color=#4da3ff]Blue hex colour[/color]
INLINE-FONT-COURIER · [font=Courier New]Courier New 0123456789[/font]
INLINE-FONT-ARIAL · [font=Arial]Arial 0123456789[/font]

[heading]02 · Alignment and block boundaries[/heading]
[left]ALIGN-LEFT · left edge marker[/left]
[center]ALIGN-CENTRE · centre marker[/center]
[right]ALIGN-RIGHT · right edge marker[/right]
[left]ALIGN-ADJACENT-A · no blank source line after this block[/left]
[center]ALIGN-ADJACENT-B · follows the previous block directly[/center]

BOUNDARY-BEFORE · one blank source line above and below the next block

[right]BOUNDARY-BLOCK · isolated right-aligned block[/right]

BOUNDARY-AFTER · ordinary text resumes here

[heading]03 · Quotes[/heading]
[quote]QUOTE-PLAIN · A short quotation.[/quote]
[quote=Fixture author]QUOTE-ATTRIBUTED · A quotation with an author.[/quote]
[quote=Nested fixture]
QUOTE-MULTILINE-A · First line with [b]bold[/b].
QUOTE-MULTILINE-B · Second line with [i]italic[/i] and [color=#d98f39]colour[/color].
[/quote]
[quote]QUOTE-ADJACENT-A · first adjacent quote[/quote]
[quote]QUOTE-ADJACENT-B · second adjacent quote[/quote]

[heading]04 · Code[/heading]
[code]CODE-SHORT · const ready = true;[/code]
[code]CODE-MULTILINE-A · function measure(value) {
  return { width: value, symbols: "<>&'" };
}
CODE-MULTILINE-B · 0123456789 0123456789 0123456789[/code]
[code]CODE-WRAP · this_is_an_intentionally_long_code_line_used_to_measure_horizontal_overflow_and_wrapping_ABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789[/code]

[heading]05 · Lists[/heading]
LIST-UNORDERED
[list]
[*]UL-1 · plain item
[*]UL-2 · item with [b]bold[/b]
[*]UL-3 · item with [i]italic[/i] and [color=#4da3ff]colour[/color]
[/list]

LIST-ORDERED
[list=1]
[*]OL-1 · first numbered item
[*]OL-2 · second numbered item with [b]bold[/b]
[*]OL-3 · third numbered item
[/list]

LIST-NESTED
[list]
[*]NESTED-PARENT-1 · first parent
[list]
[*]NESTED-CHILD-1 · first child
[*]NESTED-CHILD-2 · second child
[/list]
[*]NESTED-PARENT-2 · second parent
[/list]

[heading]06 · Spoilers[/heading]
SPOILER-SHORT
[spoiler]SPOILER-CONTENT-SHORT · hidden text[/spoiler]

SPOILER-FORMATTED
[spoiler]
SPOILER-CONTENT-A · First hidden line with [b]bold[/b].
SPOILER-CONTENT-B · Second hidden line with [i]italic[/i] and [color=#d98f39]colour[/color].
[/spoiler]

[heading]07 · Links and separators[/heading]
LINK-LABELLED · [url=https://example.com/?fixture=mdw-v2]Example labelled link[/url]
LINK-BARE · [url]https://example.com/path?fixture=mdw-v2[/url]

SEPARATOR-BEFORE
[line]
SEPARATOR-AFTER

[heading]08 · Wrapping and Unicode[/heading]
UNICODE · café · naïve · résumé · en dash – · em dash — · © · ™ · ★ · 🎁
WRAP-WORDS · This deliberately long sentence measures normal word wrapping across desktop and mobile widths while keeping every word readable and preserving the expected public description line height.
WRAP-TOKEN · NDW_ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz_0123456789_UNBROKEN_END

[heading]09 · Newline boundaries[/heading]
NEWLINE-A · next line follows immediately in source
NEWLINE-B · immediate source neighbour

NEWLINE-C · one empty source line above


NEWLINE-D · two empty source lines above
[center][b]FIXTURE-END · MDW-PUBLIC-V2[/b][/center]`

export const NEXUS_PUBLIC_FIDELITY_V2_MEDIA = `[heading]Optional media appendix · replace every token before use[/heading]

IMAGE-DEFAULT
[img]REPLACE_WITH_OWNED_IMAGE_URL[/img]

IMAGE-WIDTH
[img width=640]REPLACE_WITH_OWNED_WIDE_IMAGE_URL[/img]

IMAGE-HEIGHT
[img height=360]REPLACE_WITH_OWNED_WIDE_IMAGE_URL[/img]

IMAGE-WIDTH-HEIGHT
[img width=640 height=360]REPLACE_WITH_OWNED_WIDE_IMAGE_URL[/img]

IMAGE-ALIGN-LEFT
[aimg=left]REPLACE_WITH_OWNED_IMAGE_URL[/aimg]

IMAGE-ALIGN-CENTRE
[aimg=center]REPLACE_WITH_OWNED_IMAGE_URL[/aimg]

IMAGE-ALIGN-RIGHT
[aimg=right]REPLACE_WITH_OWNED_IMAGE_URL[/aimg]

YOUTUBE-EMBED
[youtube]REPLACE_WITH_OWNED_OR_APPROVED_VIDEO_ID[/youtube]

VIDEO-EMBED
[video]REPLACE_WITH_OWNED_OR_APPROVED_VIDEO_URL[/video]

SOUNDCLOUD-EMBED
[soundcloud]REPLACE_WITH_OWNED_OR_APPROVED_AUDIO_URL[/soundcloud]`
