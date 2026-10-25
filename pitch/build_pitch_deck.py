from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.dml import MSO_LINE_DASH_STYLE

BASE = Path(__file__).resolve().parent
ASSETS = BASE / "assets"

# ---------- design tokens ----------
INK = RGBColor(0x0C, 0x1F, 0x2A)
INK2 = RGBColor(0x16, 0x2E, 0x3A)
RED = RGBColor(0xC8, 0x10, 0x2E)
RED_L = RGBColor(0xE8, 0x5A, 0x63)
TEAL = RGBColor(0x0F, 0x6B, 0x5C)
TEAL_L = RGBColor(0x3E, 0x9B, 0x86)
GOLD = RGBColor(0xB4, 0x8A, 0x2C)
BG = RGBColor(0xF7, 0xF4, 0xEF)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
GRAY = RGBColor(0x5E, 0x6A, 0x70)
GRAY_L = RGBColor(0x9A, 0xA3, 0xA6)
LINE = RGBColor(0xE1, 0xDA, 0xCF)
SOFT_RED = RGBColor(0xF9, 0xE9, 0xEB)
SOFT_TEAL = RGBColor(0xE8, 0xF1, 0xEE)
SOFT_GOLD = RGBColor(0xF5, 0xEE, 0xDD)
DARK = RGBColor(0x10, 0x22, 0x2D)

FONT = "Avenir Next"
JP = "Hiragino Sans"

W, H = 13.333, 7.5
prs = Presentation()
prs.slide_width = Inches(W)
prs.slide_height = Inches(H)
BLANK = prs.slide_layouts[6]


def solid(shape, color):
    shape.fill.solid()
    shape.fill.fore_color.rgb = color


def no_line(shape):
    shape.line.fill.background()


def rect(slide, x, y, w, h, fill=WHITE, line=None, radius=None, shape_type=MSO_SHAPE.ROUNDED_RECTANGLE):
    shp = slide.shapes.add_shape(shape_type, Inches(x), Inches(y), Inches(w), Inches(h))
    if fill is None:
        shp.fill.background()
    else:
        solid(shp, fill)
    if line is None:
        no_line(shp)
    else:
        shp.line.color.rgb = line
        shp.line.width = Pt(1)
    shp.shadow.inherit = False
    if radius is not None and shape_type == MSO_SHAPE.ROUNDED_RECTANGLE:
        shp.adjustments[0] = radius
    return shp


def text(slide, value, x, y, w, h, size=14, bold=False, color=INK, align=PP_ALIGN.LEFT,
         anchor=MSO_ANCHOR.TOP, font=FONT, italic=False, spacing=1.05, margin=0.0):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(margin)
    tf.margin_right = Inches(margin)
    tf.margin_top = Inches(margin)
    tf.margin_bottom = Inches(margin)
    tf.vertical_anchor = anchor
    p = tf.paragraphs[0]
    p.alignment = align
    p.line_spacing = spacing
    r = p.add_run()
    r.text = value
    r.font.name = font
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.italic = italic
    r.font.color.rgb = color
    return box


def rich(slide, runs, x, y, w, h, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, spacing=1.05, margin=0.0):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(margin)
    tf.margin_right = Inches(margin)
    tf.margin_top = Inches(margin)
    tf.margin_bottom = Inches(margin)
    tf.vertical_anchor = anchor
    p = tf.paragraphs[0]
    p.alignment = align
    p.line_spacing = spacing
    for value, opts in runs:
        r = p.add_run()
        r.text = value
        r.font.name = opts.get("font", FONT)
        r.font.size = Pt(opts.get("size", 14))
        r.font.bold = opts.get("bold", False)
        r.font.italic = opts.get("italic", False)
        r.font.color.rgb = opts.get("color", INK)
    return box


def shape_text(shp, value, size=13, bold=False, color=INK, align=PP_ALIGN.CENTER,
               anchor=MSO_ANCHOR.MIDDLE, font=FONT, margin=0.08, spacing=1.0):
    tf = shp.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(margin)
    tf.margin_right = Inches(margin)
    tf.margin_top = Inches(margin)
    tf.margin_bottom = Inches(margin)
    tf.vertical_anchor = anchor
    p = tf.paragraphs[0]
    p.alignment = align
    p.line_spacing = spacing
    r = p.add_run()
    r.text = value
    r.font.name = font
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.color.rgb = color
    return shp


def line(slide, x1, y1, x2, y2, color=LINE, width=1.0, dash=None):
    c = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    c.line.color.rgb = color
    c.line.width = Pt(width)
    if dash:
        c.line.dash_style = dash
    return c


def dot(slide, x, y, d, color=RED):
    shp = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(d), Inches(d))
    solid(shp, color)
    no_line(shp)
    shp.shadow.inherit = False
    return shp


def arrow(slide, x, y, w=0.32, h=0.24, color=RED):
    shp = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(x), Inches(y), Inches(w), Inches(h))
    solid(shp, color)
    no_line(shp)
    shp.shadow.inherit = False
    return shp


def bg(slide):
    rect(slide, 0, 0, W, H, BG, None, shape_type=MSO_SHAPE.RECTANGLE)
    rect(slide, 0, 0, 0.09, H, RED, None, shape_type=MSO_SHAPE.RECTANGLE)


def header(slide, kicker, title, subtitle=None, title_size=30):
    bg(slide)
    text(slide, kicker, 0.65, 0.38, 10.5, 0.25, 8.5, True, RED)
    # A two-line title needs more vertical room; drop the subtitle rather than
    # letting it collide with the second line. The visual and notes carry it.
    two_lines = "\n" in title
    text(slide, title, 0.63, 0.68, 12.0, 1.15, 28 if two_lines else title_size, True, INK, spacing=0.95)
    if subtitle and not two_lines:
        text(slide, subtitle, 0.65, 1.48, 11.8, 0.55, 12, False, GRAY, spacing=1.1)


def footer(slide, n):
    line(slide, 0.65, 7.1, 12.68, 7.1, LINE, 0.75)
    text(slide, "CABINBRIDGE  ×  JAPAN AIRLINES", 0.65, 7.17, 7, 0.2, 7.5, True, GRAY_L)
    text(slide, f"{n:02d}", 12.0, 7.17, 0.68, 0.2, 7.5, False, GRAY_L, align=PP_ALIGN.RIGHT)


def notes(slide, value):
    slide.notes_slide.notes_text_frame.text = value


def picture(slide, path, x, y, w, h, line_color=LINE):
    pic = slide.shapes.add_picture(str(path), Inches(x), Inches(y), Inches(w), Inches(h))
    pic.line.color.rgb = line_color
    pic.line.width = Pt(0.75)
    return pic


def phone_frame(slide, path, x, y, w, h):
    rect(slide, x, y, w, h, INK, None, 0.13)
    picture(slide, path, x + 0.07, y + 0.10, w - 0.14, h - 0.20)
    rect(slide, x + w * 0.36, y + 0.035, w * 0.28, 0.045, RGBColor(0x3A, 0x4A, 0x52), None, 0.03, MSO_SHAPE.ROUNDED_RECTANGLE)


def tablet_frame(slide, path, x, y, w, h):
    rect(slide, x, y, w, h, INK, None, 0.09)
    picture(slide, path, x + 0.08, y + 0.10, w - 0.16, h - 0.20)


def chip(slide, label, x, y, w, fill=WHITE, color=INK, size=8.5, bold=True, line_color=LINE):
    shp = rect(slide, x, y, w, 0.28, fill, line_color, 0.5)
    shape_text(shp, label, size, bold, color)
    return shp


def num_circle(slide, n, x, y, d=0.42, fill=RED, color=WHITE):
    shp = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(d), Inches(d))
    solid(shp, fill)
    no_line(shp)
    shp.shadow.inherit = False
    shape_text(shp, str(n), 11, True, color)
    return shp


# ============================================================
# 01 TITLE
# ============================================================
s = prs.slides.add_slide(BLANK)
bg(s)
# soft depth shapes
circ = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(8.4), Inches(1.15), Inches(5.6), Inches(5.6))
solid(circ, SOFT_RED); no_line(circ); circ.shadow.inherit = False
arc = s.shapes.add_shape(MSO_SHAPE.ARC, Inches(-2.2), Inches(4.0), Inches(7.6), Inches(7.6))
arc.fill.background(); arc.line.color.rgb = LINE; arc.line.width = Pt(1.1)
arc.line.dash_style = MSO_LINE_DASH_STYLE.DASH
arc.shadow.inherit = False

text(s, "CABINBRIDGE  ·  JAL DEMO DAY 2026", 0.72, 0.62, 8, 0.25, 9, True, RED)
text(s, "The cabin,\ntranslated.", 0.7, 1.18, 7.6, 1.9, 43, True, INK, spacing=0.88)
text(s, "A local-first communication layer for passengers and crew —\non two devices, in under two seconds.", 0.72, 3.28, 7.2, 0.9, 15.5, False, GRAY, spacing=1.15)
# value chips
chip(s, "0.7 s  JP → EN", 0.72, 4.48, 1.65, WHITE, INK, 9)
chip(s, "1.2 s  VOICE", 2.47, 4.48, 1.45, WHITE, INK, 9)
chip(s, "100% ON-DEVICE", 4.02, 4.48, 1.85, SOFT_TEAL, TEAL, 9)
text(s, "Live demo  ·  two devices  ·  one judge", 0.72, 5.18, 6.5, 0.3, 10, False, GRAY)
rich(s, [("すべての乗客に、伝わる。", {"font": JP, "size": 13, "color": GRAY})], 0.72, 6.28, 6.5, 0.35)

# devices
text(s, "CREW", 9.18, 1.92, 1.4, 0.2, 7.5, True, GRAY, align=PP_ALIGN.CENTER)
text(s, "PASSENGER", 10.62, 2.52, 1.6, 0.2, 7.5, True, GRAY, align=PP_ALIGN.CENTER)
tablet_frame(s, ASSETS / "crew.png", 9.05, 2.14, 2.95, 2.0)
phone_frame(s, ASSETS / "passenger_mobile.png", 10.82, 2.55, 1.55, 3.35)
# connector + latency chip
line(s, 9.05, 4.2, 10.82, 4.2, RED, 1.4, MSO_LINE_DASH_STYLE.DASH)
chip(s, "0.7 s", 9.62, 4.33, 0.62, WHITE, RED, 8)
text(s, "One session. Two devices. Local.", 9.05, 5.98, 3.6, 0.25, 8.5, False, GRAY, align=PP_ALIGN.CENTER)
notes(s, "Open: thank you, and frame this as a demo not a deck. One of us will be the passenger, one the crew. The judge will hold the passenger phone. Ask them to pick a need, and watch the crew tablet. We are going to show that a cabin request can be understood and acted on in under two seconds, without the internet.")

# ============================================================
# 02 PROBLEM
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "01  ·  THE PROBLEM", "Language is a safety system,\nnot a convenience.",
       "On one flight, a crew handles dozens of needs across languages — in noise, under time pressure, often with no connectivity.")
# passenger quote card
pc = rect(s, 0.65, 2.05, 4.15, 2.15, WHITE, LINE, 0.08)
text(s, "PASSENGER  ·  12A  ·  JAPANESE", 0.92, 2.26, 3.5, 0.2, 7.5, True, GRAY)
rich(s, [("お水をください。", {"font": JP, "size": 26, "bold": True, "color": INK})], 0.92, 2.62, 3.6, 0.6)
text(s, "“I would like some water, please.”", 0.92, 3.32, 3.6, 0.3, 10.5, False, GRAY)
# crew card
cc = rect(s, 8.53, 2.05, 4.15, 2.15, WHITE, LINE, 0.08)
text(s, "CREW  ·  ENGLISH", 8.8, 2.26, 3.5, 0.2, 7.5, True, GRAY)
text(s, "?", 8.8, 2.52, 1.0, 1.0, 44, True, RED)
text(s, "Which seat?\nWater now?\nAllergy?", 9.65, 2.72, 2.6, 1.0, 13, False, GRAY, spacing=1.25)
# gap
line(s, 4.9, 3.1, 8.4, 3.1, RED, 1.5, MSO_LINE_DASH_STYLE.DASH)
g = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(6.38), Inches(2.93), Inches(0.38), Inches(0.38))
solid(g, RED); no_line(g); g.shadow.inherit = False
shape_text(g, "!", 12, True, WHITE)
text(s, "meaning lost", 6.3, 3.38, 1.0, 0.2, 7.5, True, RED, align=PP_ALIGN.CENTER)
# three pain cards
pain = [
    ("01", "Mixed nationalities", "The crew’s first language is rarely the passenger’s."),
    ("02", "Crew repetition", "The same simple request is rephrased, repeated, guessed."),
    ("03", "High-stakes nuance", "“No”, “not”, “allergy”, “2 tablets” can flip meaning."),
]
for i, (n, head, body) in enumerate(pain):
    x = 0.65 + i * 4.12
    rect(s, x, 4.72, 3.92, 1.55, WHITE, LINE, 0.08)
    text(s, n, x + 0.22, 4.9, 0.5, 0.2, 8, True, RED)
    text(s, head, x + 0.22, 5.12, 3.5, 0.3, 13, True, INK)
    text(s, body, x + 0.22, 5.48, 3.45, 0.6, 9.5, False, GRAY, spacing=1.1)
footer(s, 2)
notes(s, "This is not a translation problem in the abstract. It is a passenger who feels unwell at 35,000 feet, and a crew member who needs the right information in seconds. The words matter, but so do seat, urgency, history, and confirmation. Today those are held in the crew's head, not in the tool.")

# ============================================================
# 03 GAP
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "02  ·  THE GAP", "Google Translate translates words.\nIt doesn’t run a cabin.",
       "A generic translator gives you a sentence. A cabin needs a closed loop.")
steps = [("Hear", "Voice or text"), ("Translate", "One sentence"), ("Triage", "Who? How urgent?"), ("Respond", "Seat + reply"), ("Confirm", "Did it land?")]
for i, (head, sub) in enumerate(steps):
    x = 0.65 + i * 2.42
    covered = i < 2
    card = rect(s, x, 2.0, 2.12, 1.35, WHITE if covered else SOFT_RED, LINE if covered else RED_L, 0.09)
    num_circle(s, i + 1, x + 0.16, 2.15, 0.34, TEAL if covered else RED)
    text(s, head, x + 0.6, 2.18, 1.4, 0.3, 13, True, INK)
    text(s, sub, x + 0.16, 2.66, 1.85, 0.45, 9, False, GRAY)
    if i < 4:
        arrow(s, x + 2.14, 2.53, 0.24, 0.2, LINE)
# status strip
text(s, "A translator covers this", 0.65, 3.55, 4.6, 0.25, 9, True, TEAL)
text(s, "The cabin workflow lives here", 5.7, 3.55, 6.8, 0.25, 9, True, RED)
line(s, 5.2, 3.82, 12.6, 3.82, RED, 1.2, MSO_LINE_DASH_STYLE.DASH)
# bottom compare
left = rect(s, 0.65, 4.2, 5.5, 1.65, WHITE, LINE, 0.08)
text(s, "A translator gives you…", 0.9, 4.4, 4.8, 0.25, 10, True, GRAY)
text(s, "a sentence, in isolation.", 0.9, 4.72, 4.9, 0.35, 16, True, INK)
text(s, "No seat. No urgency. No queue. No confirmation.", 0.9, 5.18, 4.9, 0.3, 9, False, GRAY)
right = rect(s, 6.55, 4.2, 6.15, 1.65, SOFT_RED, RED_L, 0.08)
text(s, "A cabin needs…", 6.8, 4.4, 5.5, 0.25, 10, True, RED)
text(s, "a closed loop.", 6.8, 4.72, 5.4, 0.35, 16, True, INK)
text(s, "Who asked · how urgent · what we promised · did it land?", 6.8, 5.18, 5.6, 0.3, 9, False, GRAY)
footer(s, 3)
notes(s, "We are not saying Google Translate is bad. It is excellent at the word. But the cabin needs a workflow: who asked, how urgent, what did we promise, and did it land? That is the gap we close. The next slide is the loop.")

# ============================================================
# 04 SOLUTION
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "03  ·  THE SOLUTION", "One tap to speak.\nOne queue to act.",
       "The passenger chooses what they need. CabinBridge chooses the fastest, safest path.")
cards = [
    ("01", "CAPTURE", "Voice, type, or one tap.\nNo language menu, no keyboard.", ["MediaRecorder", "6 needs", "7 languages"], SOFT_RED),
    ("02", "UNDERSTAND", "Phrasebook first.\nLocal AI only when needed.", ["Whisper", "Argos", "Qwen 7B"], SOFT_GOLD),
    ("03", "ACT", "Seat, urgency, summary.\nReply in one tap.", ["Jev / local", "WebSocket", "Queue"], SOFT_TEAL),
]
for i, (n, head, body, chips, soft) in enumerate(cards):
    x = 0.65 + i * 4.22
    rect(s, x, 2.0, 4.0, 2.95, WHITE, LINE, 0.08)
    rect(s, x, 2.0, 4.0, 0.12, RED if i == 2 else (TEAL if i == 1 else GOLD), None, 0.1, MSO_SHAPE.RECTANGLE)
    text(s, n, x + 0.24, 2.24, 0.5, 0.2, 8.5, True, RED)
    text(s, head, x + 0.24, 2.52, 3.5, 0.35, 20, True, INK)
    text(s, body, x + 0.24, 3.0, 3.45, 0.75, 10.5, False, GRAY, spacing=1.15)
    for j, label in enumerate(chips):
        chip(s, label, x + 0.24 + j * 1.18, 4.25, 1.1, soft, INK, 7.5, True, None)
    if i < 2:
        arrow(s, x + 4.02, 3.3, 0.18, 0.2, RED)
# bottom strip
rect(s, 0.65, 5.28, 12.05, 0.82, INK, None, 0.1)
rich(s, [("ONE SESSION", {"size": 8.5, "bold": True, "color": RED_L}),
         ("   passenger  ↔  crew  ·  local  ·  auditable", {"size": 12, "bold": True, "color": WHITE})],
     0.9, 5.5, 10.5, 0.3)
footer(s, 4)
notes(s, "Three moves. Capture: the passenger does not choose an engine; they choose a need. Understand: the phrasebook is the fast, deterministic path; local models handle free text. Act: the crew does not read a paragraph; they see a short decision and a reply button. That is the entire product.")

# ============================================================
# 05 PRODUCT
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "04  ·  THE PRODUCT", "Two devices. One conversation.",
       "The actual demo build — passenger phone on the left, crew tablet on the right.")
text(s, "PASSENGER  ·  PHONE", 0.72, 1.8, 2.2, 0.2, 7.5, True, GRAY)
text(s, "CREW  ·  TABLET", 3.62, 1.8, 2.2, 0.2, 7.5, True, GRAY)
phone_frame(s, ASSETS / "passenger_mobile.png", 0.65, 2.05, 2.05, 4.42)
tablet_frame(s, ASSETS / "crew.png", 3.55, 2.05, 6.3, 4.2)
# callouts
callouts = [
    (2.25, "One tap. No keyboard.", "Six needs, voice, and type — in the passenger’s language."),
    (3.65, "Short summary, not a paragraph.", "“Passenger wants water.” Next action, keywords, urgency."),
    (5.05, "Reply, resolve, keep the queue clean.", "One action row; the request moves to Resolved."),
]
for y, head, body in callouts:
    dot(s, 10.28, y + 0.08, 0.12, RED)
    line(s, 9.9, y + 0.14, 10.28, y + 0.14, RED_L, 1)
    text(s, head, 10.5, y, 2.45, 0.45, 11.5, True, INK)
    text(s, body, 10.5, y + 0.38, 2.45, 0.7, 8.5, False, GRAY, spacing=1.1)
# bottom line
text(s, "The judge can hold the phone. The crew tablet is the other half of the same session.", 0.65, 6.55, 12, 0.3, 9, False, GRAY)
footer(s, 5)
notes(s, "This is the actual product, not a mockup. On the left, the passenger sees six one-tap needs, voice, and type. On the right, the crew sees the request as a short decision: seat, water, keywords, next action. The full message is still there behind Show full message, but the crew does not have to read it to act. During the demo, hand the phone to a judge and let them tap.")

# ============================================================
# 06 ENGINE
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "05  ·  THE ENGINE", "The right model for the job —\nnot one model for everything.",
       "Fast, deterministic paths first. Local AI only where it earns its latency.")
stages = [
    ("01", "VOICE / TYPE", "16 kHz · opus\nbrowser capture", "browser", GRAY),
    ("02", "ASR", "Whisper small\nJP: turbo fallback", "1.2 s", GOLD),
    ("03", "MEANING", "Phrasebook · Argos\nQwen 7B (JP)", "0 / 60 / 700 ms", RED),
    ("04", "TRIAGE", "Intent · urgency\nkeywords", "1–200 ms", TEAL),
    ("05", "CREW", "Summary + reply\nWebSocket", "<100 ms", TEAL),
]
for i, (n, head, body, metric, color) in enumerate(stages):
    x = 0.65 + i * 2.45
    rect(s, x, 2.0, 2.22, 2.15, WHITE, LINE, 0.08)
    rect(s, x, 2.0, 2.22, 0.08, color, None, 0.05, MSO_SHAPE.RECTANGLE)
    text(s, n, x + 0.16, 2.18, 0.4, 0.2, 7.5, True, GRAY_L)
    text(s, head, x + 0.16, 2.42, 1.95, 0.3, 12.5, True, INK)
    text(s, body, x + 0.16, 2.8, 1.95, 0.7, 8.5, False, GRAY, spacing=1.12)
    chip(s, metric, x + 0.16, 3.72, 1.75, SOFT_TEAL if color == TEAL else (SOFT_RED if color == RED else SOFT_GOLD), color if color != GOLD else RGBColor(0x7A, 0x5A, 0x10), 7.5, True, None)
    if i < 4:
        arrow(s, x + 2.23, 2.95, 0.18, 0.18, RED)
# why order
rect(s, 0.65, 4.45, 12.05, 1.3, WHITE, LINE, 0.08)
cols = [
    ("PHRASEBOOK FIRST", "0 ms, deterministic. 40 cabin phrases × 7 languages."),
    ("LOCAL MODELS", "No cloud in the loop. Hindi: Argos. Japanese: Qwen 7B."),
    ("CONFIDENCE, NOT GUESSWORK", "Empty is blocked. Low/medium is reviewed and editable."),
]
for i, (head, body) in enumerate(cols):
    x = 0.9 + i * 3.95
    text(s, head, x, 4.65, 3.6, 0.22, 8, True, RED)
    text(s, body, x, 4.92, 3.6, 0.55, 9, False, GRAY, spacing=1.1)
# tts mini
text(s, "Browser voice out  ·  free, offline-capable  ·  no server TTS", 0.9, 5.95, 10, 0.25, 8.5, False, GRAY)
footer(s, 6)
notes(s, "We do not use one giant model for everything. Common phrases hit a deterministic catalog at zero milliseconds. English↔Hindi uses a 60ms Argos model. Japanese free text uses local Qwen 7B at about 0.7 seconds. Hard Japanese audio escalates to Whisper turbo. That ordering is how we keep both speed and accuracy. Browser speech handles the voice out; no server TTS.")

# ============================================================
# 07 RELIABILITY
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "06  ·  WHY RELIABLE", "Designed to fail safely.",
       "In a cabin, a confident wrong answer is worse than no answer.")
cards = [
    ("12", "APPROVED SAFETY PHRASES", "Exact match only. Safety wording never passes through machine translation.", RED),
    ("0", "EMPTY SENDS", "Empty or unclear speech is blocked. Low confidence is reviewed, not guessed.", GOLD),
    ("100%", "LOCAL PATH", "Phrasebook and models on the device. No internet required; cached fallback.", TEAL),
    ("1", "AUDIT TRAIL", "Per-request status and latency. Audio is processed in memory, never stored.", INK),
]
for i, (big, head, body, color) in enumerate(cards):
    x = 0.65 + i * 3.12
    rect(s, x, 2.0, 2.9, 3.35, WHITE, LINE, 0.08)
    text(s, big, x + 0.22, 2.2, 2.45, 0.55, 24, True, color)
    text(s, head, x + 0.22, 2.85, 2.45, 0.5, 8, True, GRAY)
    text(s, body, x + 0.22, 3.35, 2.4, 1.2, 9.5, False, GRAY, spacing=1.18)
    # small marker
    dot(s, x + 2.45, 2.28, 0.1, color)
# bottom bar
rect(s, 0.65, 5.62, 12.05, 0.85, INK, None, 0.08)
rich(s, [("HUMAN IN THE LOOP", {"size": 8.5, "bold": True, "color": RED_L}),
         ("   the crew sends the final reply  ·  we never claim delivery without confirmation", {"size": 11.5, "bold": True, "color": WHITE})],
     0.9, 5.85, 11.4, 0.3)
footer(s, 7)
notes(s, "Reliability here is not a model accuracy claim. It is system design. Safety phrases are exact-match. Empty speech is blocked. Low confidence is surfaced for editing. The local path works without internet. And we keep an audit trail without storing audio. The crew remains the human in the loop.")

# ============================================================
# 08 PROOF
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "07  ·  PROOF", "Fast enough to use.\nMeasured, not estimated.",
       "Warm, on this Mac. Cold start is eliminated by keeping the local model loaded.")
rows = [
    ("Phrasebook match", "0 ms", 0.28, TEAL, "40 curated phrases"),
    ("Argos en ↔ hi", "60 ms", 1.05, TEAL, "local CTranslate2"),
    ("Qwen 7B ja ↔ en", "0.7 s", 3.1, RED, "local Ollama"),
    ("Whisper small", "1.2 s", 4.7, GOLD, "2 s Japanese clip"),
    ("Whisper turbo", "5.5 s", 7.1, GRAY, "only when confidence is low"),
]
for i, (label, value, width, color, sub) in enumerate(rows):
    y = 2.05 + i * 0.66
    text(s, label, 0.65, y, 2.4, 0.25, 10.5, True, INK)
    text(s, sub, 0.65, y + 0.24, 2.4, 0.2, 7.5, False, GRAY)
    rect(s, 3.2, y + 0.05, 8.2, 0.26, RGBColor(0xEE, 0xE9, 0xE1), None, 0.5)
    rect(s, 3.2, y + 0.05, max(0.18, width), 0.26, color, None, 0.5)
    text(s, value, 11.55, y - 0.01, 1.05, 0.28, 10.5, True, color, align=PP_ALIGN.RIGHT)
# callouts
rect(s, 0.65, 5.62, 5.9, 0.72, SOFT_RED, RED_L, 0.08)
rich(s, [("COLD START: ", {"size": 8, "bold": True, "color": RED}), ("24 h warm model + persistent phrase cache.", {"size": 10, "bold": True, "color": INK})], 0.85, 5.82, 5.4, 0.25)
rect(s, 6.75, 5.62, 5.95, 0.72, SOFT_TEAL, TEAL_L, 0.08)
rich(s, [("END-TO-END: ", {"size": 8, "bold": True, "color": TEAL}), ("~1.5–2.5 s per voice turn, warm.", {"size": 10, "bold": True, "color": INK})], 6.95, 5.82, 5.4, 0.25)
text(s, "Bar length is illustrative; labels are measured. No formal WER/COMET yet — the pilot will measure in cabin noise.", 0.65, 6.55, 12, 0.25, 8, False, GRAY)
footer(s, 8)
notes(s, "These are the numbers we can defend. A catalog phrase is instant. Argos is sixty milliseconds. Japanese free text is about seven hundred milliseconds. A two-second Japanese clip is about one point two seconds on the small model; the turbo fallback is only for hard audio. Cold start is gone because we keep the model warm. What we have not done yet is a formal WER/COMET study in cabin noise; that is a pilot deliverable, not a claim.")

# ============================================================
# 09 GOOGLE COMPARISON
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "08  ·  WHY US", "Keep Google Translate for the word.\nUse CabinBridge for the cabin.",
       "Different job. Different guarantees.")
# top cards
rect(s, 0.65, 1.95, 5.85, 0.9, WHITE, LINE, 0.1)
text(s, "GOOGLE TRANSLATE", 0.9, 2.12, 4.8, 0.22, 9, True, GRAY)
text(s, "A great general translator.", 0.9, 2.38, 4.8, 0.3, 12, True, INK)
rect(s, 6.8, 1.95, 5.9, 0.9, SOFT_RED, RED_L, 0.1)
text(s, "CABINBRIDGE", 7.05, 2.12, 4.8, 0.22, 9, True, RED)
text(s, "A cabin communication system.", 7.05, 2.38, 5.2, 0.3, 12, True, INK)
rows = [
    ("Translate a sentence", True, True),
    ("Crew queue + seat context", False, True),
    ("Urgency + short summary", False, True),
    ("Approved safety wording", False, True),
    ("Works with no internet", False, True),
    ("Local audio, no persistence", False, True),
    ("Metrics + airline integration", False, True),
]
for i, (label, g, c) in enumerate(rows):
    y = 3.1 + i * 0.43
    if i % 2 == 0:
        rect(s, 0.65, y - 0.02, 12.05, 0.4, RGBColor(0xF1, 0xEC, 0xE4), None, 0.05, MSO_SHAPE.RECTANGLE)
    text(s, label, 3.7, y, 5.8, 0.26, 10, True if i == 0 else False, INK)
    # left / right marks
    for cx, ok in ((2.05, g), (10.6, c)):
        o = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(cx), Inches(y + 0.02), Inches(0.26), Inches(0.26))
        solid(o, TEAL if ok else RGBColor(0xE9, 0xE4, 0xDB)); no_line(o); o.shadow.inherit = False
        shape_text(o, "✓" if ok else "–", 8, True, WHITE if ok else GRAY_L)
# bottom callout
rect(s, 0.65, 6.15, 12.05, 0.62, INK, None, 0.08)
rich(s, [("THE POINT  ", {"size": 8, "bold": True, "color": RED_L}),
         ("Google Translate is an interpreter. CabinBridge is the cabin workflow around it.", {"size": 11, "bold": True, "color": WHITE})],
     0.9, 6.33, 11.5, 0.25)
footer(s, 9)
notes(s, "We are not trying to beat Google on generic translation. They are excellent. We win on the cabin workflow: seat context, a queue, urgency, a short summary, an approved safety catalog, offline operation, privacy, and metrics. If a passenger just wants a word, Google is fine. If a crew needs to act, they need the loop.")

# ============================================================
# 10 BUSINESS VALUE
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "09  ·  BUSINESS VALUE", "Minutes back to the crew.\nConfidence back to the passenger.",
       "A simple value model. The pilot replaces assumptions with measured minutes.")
# value chain
chain = [("Faster response", "Less waiting, fewer repeats"), ("Crew capacity", "Time returned to service"), ("Higher NPS", "A calmer, clearer cabin"), ("Safer outcomes", "Nuance preserved")]
for i, (head, body) in enumerate(chain):
    y = 2.0 + i * 1.02
    rect(s, 0.65, y, 5.3, 0.82, WHITE, LINE, 0.08)
    num_circle(s, i + 1, 0.85, y + 0.19, 0.38, TEAL if i < 2 else RED)
    text(s, head, 1.38, y + 0.16, 4.3, 0.28, 12, True, INK)
    text(s, body, 1.38, y + 0.45, 4.3, 0.25, 8.5, False, GRAY)
    if i < 3:
        arrow(s, 3.1, y + 0.84, 0.18, 0.16, LINE)
# calc card
rect(s, 6.35, 1.98, 6.35, 4.15, SOFT_RED, RED_L, 0.08)
text(s, "ILLUSTRATIVE  ·  PER AIRCRAFT  ·  YEAR", 6.62, 2.18, 5.8, 0.22, 8, True, RED)
text(s, "250–1,000", 6.62, 2.48, 5.6, 0.85, 36, True, RED, spacing=0.9)
text(s, "crew-hours returned per aircraft, per year", 6.62, 3.28, 5.6, 0.3, 10, True, INK)
line(s, 6.62, 3.66, 12.4, 3.66, RED_L, 0.8)
lines = [
    "250 passengers  ×  20% need help  =  50 interactions / flight",
    "30–120 s saved per interaction",
    "2 flights / day  ×  300 days",
    "≈ 250–1,000 crew-hours / aircraft / year",
    "At ¥4,000 / crew-hour  ≈  ¥1M–¥4M",
]
for i, value in enumerate(lines):
    text(s, value, 6.62, 3.82 + i * 0.32, 5.75, 0.28, 9.5 if i < 3 else 10.5, i >= 3, INK if i >= 3 else GRAY)
text(s, "Pilot will measure actual minutes, repeat rate, and NPS.", 6.62, 5.8, 5.7, 0.22, 7.8, False, GRAY, italic=True)
footer(s, 10)
notes(s, "This is an illustrative model, not a claim. If a widebody carries 250 passengers and twenty percent need some crew assistance, that is fifty interactions. Saving thirty to one hundred twenty seconds each, across two flights a day, is two hundred fifty to one thousand crew-hours per aircraft per year. The pilot will measure the real number. The point is that the value is operational, not just a nicer app.")

# ============================================================
# 11 DEPLOYMENT
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "10  ·  DEPLOYMENT", "Fits the aircraft you already fly.",
       "No aircraft modification. Start with existing crew devices and a local edge.")
# top strip
rect(s, 0.65, 1.95, 12.05, 0.55, INK, None, 0.08)
rich(s, [("LOCAL-FIRST  ", {"size": 8, "bold": True, "color": RED_L}),
         ("no passenger audio leaves the aircraft  ·  optional cloud only for consented summaries", {"size": 9.5, "bold": True, "color": WHITE})],
     0.9, 2.11, 11.4, 0.25)
cards = [
    ("ONBOARD EDGE", "Recommended", "Small local device on the aircraft. Crew tablets connect over the cabin network. No internet.", "Pilot · one route"),
    ("CREW TABLET", "Fast start", "Runs on existing crew tablets with local models. Syncs when the aircraft is on the ground.", "Pilot · two aircraft"),
    ("GROUND-HOSTED", "Lounge / gate", "For ground staff and gates. Optional Jev summary API, with consent and data controls.", "Phase 2"),
]
for i, (head, tag, body, foot) in enumerate(cards):
    x = 0.65 + i * 4.12
    rect(s, x, 2.8, 3.92, 2.75, WHITE, LINE, 0.08)
    text(s, tag.upper(), x + 0.22, 3.0, 3.4, 0.2, 7.5, True, RED if i == 0 else GRAY)
    text(s, head, x + 0.22, 3.26, 3.4, 0.3, 15, True, INK)
    text(s, body, x + 0.22, 3.68, 3.45, 1.0, 9.5, False, GRAY, spacing=1.15)
    text(s, foot, x + 0.22, 5.02, 3.4, 0.25, 8.5, True, TEAL)
# commercial chips
chips = ["Per aircraft / month", "Integration fee", "8-week pilot", "No passenger data stored"]
for i, label in enumerate(chips):
    chip(s, label, 0.65 + i * 3.08, 5.95, 2.75, WHITE, INK, 8.5, True, LINE)
footer(s, 11)
notes(s, "The simplest deployment is a crew tablet plus a small local edge device. It does not require aircraft modification. We can also run on existing crew tablets for a fast pilot, and move to ground-hosted for lounge and gate use later. Commercial model is per aircraft per month plus integration; the pilot is the first step.")

# ============================================================
# 12 TECH STACK
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "11  ·  STACK", "Boring where it matters.\nLocal where it counts.",
       "Every layer is chosen for latency, privacy, and graceful failure.")
layers = [
    ("EXPERIENCE", ["React 18", "Vite", "MediaRecorder", "Web Speech"], SOFT_RED, RED),
    ("REALTIME", ["FastAPI", "WebSocket", "Session snapshots", "Reconnect"], SOFT_GOLD, GOLD),
    ("INTELLIGENCE", ["Whisper small / turbo", "Argos", "Qwen 2.5 7B", "Jev / local classifier"], SOFT_TEAL, TEAL),
    ("TRUST", ["Local-first", "No audio stored", "Confidence gates", "Metrics + audit"], WHITE, INK),
]
for i, (label, chips, soft, color) in enumerate(layers):
    y = 1.95 + i * 1.12
    rect(s, 0.65, y, 2.2, 0.9, color if color != INK else INK, None, 0.08)
    text(s, label, 0.85, y + 0.31, 1.9, 0.25, 9, True, WHITE)
    rect(s, 2.95, y, 9.75, 0.9, WHITE, LINE, 0.08)
    for j, item in enumerate(chips):
        chip(s, item, 3.15 + j * 2.3, y + 0.31, 2.1, soft, INK, 8, True, None)
# badge
badge = rect(s, 10.85, 1.6, 1.85, 0.32, INK, None, 0.5)
shape_text(badge, "100% LOCAL PATH", 7.5, True, WHITE)
text(s, "Optional cloud only for Jev crew summaries, with consent and data controls.", 0.65, 6.55, 12, 0.25, 8, False, GRAY)
footer(s, 12)
notes(s, "The stack is deliberately small. React and Vite for the two screens. FastAPI and WebSocket for the session. Whisper, Argos, Qwen, and Jev for the intelligence. The trust layer is the important one: local-first, no stored audio, confidence gates, and metrics. We are not hiding a cloud dependency in the critical path.")

# ============================================================
# 13 PILOT
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "12  ·  PILOT", "One route. Eight weeks.\nFive numbers.",
       "A small, supervised pilot with a joint scorecard — not a fleet rollout.")
# chips
for i, label in enumerate(["1 route", "2 aircraft", "20 crew", "500 passengers"]):
    chip(s, label, 0.65 + i * 1.7, 1.95, 1.5, WHITE, INK, 9, True, LINE)
# timeline
line(s, 0.9, 3.0, 12.45, 3.0, INK, 1.4)
for i, week in enumerate(["0", "2", "4", "6", "8"]):
    x = 0.9 + i * 2.88
    dot(s, x - 0.09, 2.91, 0.18, RED if i in (0, 4) else INK)
    text(s, f"W{week}", x - 0.2, 3.15, 0.5, 0.2, 8, True, GRAY)
phases = [
    ("SET UP", "W0–2", "Devices, seats, safety review, baseline."),
    ("LIVE", "W3–6", "Supervised flights, two crew per flight."),
    ("EVALUATE", "W7–8", "Compare to baseline, decide next route."),
]
for i, (head, when, body) in enumerate(phases):
    x = 0.65 + i * 4.12
    rect(s, x, 3.6, 3.9, 1.05, WHITE, LINE, 0.08)
    text(s, head, x + 0.2, 3.76, 1.4, 0.25, 10, True, RED)
    text(s, when, x + 2.8, 3.76, 0.9, 0.2, 8, True, GRAY, align=PP_ALIGN.RIGHT)
    text(s, body, x + 0.2, 4.08, 3.5, 0.45, 8.5, False, GRAY)
# kpis
kpis = [("MEDIAN RESPONSE", "< 2 s"), ("REPEAT RATE", "−30%"), ("TASK COMPLETION", "> 90%"), ("CREW CSAT", "≥ 4/5"), ("WER / COMET", "baseline +")]
for i, (label, value) in enumerate(kpis):
    x = 0.65 + i * 2.45
    rect(s, x, 4.95, 2.25, 1.05, SOFT_TEAL if i < 2 else WHITE, TEAL_L if i < 2 else LINE, 0.08)
    text(s, value, x + 0.18, 5.12, 1.9, 0.35, 16, True, TEAL if i < 2 else INK)
    text(s, label, x + 0.18, 5.56, 1.95, 0.2, 7, True, GRAY)
text(s, "Targets are illustrative until JAL signs off the baseline; the pilot defines the final thresholds.", 0.65, 6.25, 12, 0.25, 8, False, GRAY, italic=True)
footer(s, 13)
notes(s, "We are asking for a small pilot: one route, two aircraft, twenty crew, about five hundred passengers over eight weeks. We define the baseline and the thresholds with JAL before we start. The scorecard is response time, repeat rate, task completion, crew satisfaction, and WER/COMET on the real audio.")

# ============================================================
# 14 DEMO
# ============================================================
s = prs.slides.add_slide(BLANK)
header(s, "13  ·  LIVE DEMO", "Three minutes. Two devices.\nOne judge.",
       "Let the judge drive. The point is the loop, not the script.")
steps = [
    ("Hand the phone to a judge.", "Passenger workspace, seat 12A, Japanese."),
    ("Ask them to tap Water — or say “毛布をください”.", "One tap is enough; no language menu."),
    ("Show the crew tablet.", "Seat, summary, next action, keywords — in under a second."),
    ("Crew replies.", "The judge sees and hears the reply in Japanese."),
    ("Disconnect the Wi-Fi. Do it again.", "The local path still works. That is the point."),
]
for i, (head, body) in enumerate(steps):
    y = 1.95 + i * 0.82
    num_circle(s, i + 1, 0.65, y + 0.05, 0.4, RED if i < 4 else TEAL)
    text(s, head, 1.22, y, 6.4, 0.28, 11.5, True, INK)
    text(s, body, 1.22, y + 0.3, 6.4, 0.25, 8.5, False, GRAY)
# runbook card
rect(s, 8.15, 1.95, 4.55, 3.95, WHITE, LINE, 0.08)
text(s, "BEFORE WE START", 8.4, 2.15, 4.0, 0.22, 8.5, True, RED)
checks = ["Vite running with --host", "Phone + tablet on the same hotspot", "Open http://<mac-ip>:5173", "Seats: 12A / CREW-1"]
for i, value in enumerate(checks):
    y = 2.52 + i * 0.55
    box = rect(s, 8.4, y, 0.22, 0.22, SOFT_TEAL, TEAL_L, 0.1)
    shape_text(box, "✓", 8, True, TEAL, margin=0)
    text(s, value, 8.75, y - 0.01, 3.7, 0.25, 9, False, INK)
text(s, "If the venue network fails, use the local hotspot. The app does not need the internet.", 8.4, 4.85, 3.95, 0.7, 8.5, False, GRAY, spacing=1.15)
# bottom note
rect(s, 0.65, 6.1, 12.05, 0.55, SOFT_RED, RED_L, 0.08)
rich(s, [("FALLBACK  ", {"size": 8, "bold": True, "color": RED}),
         ("if anything fails, the phrase cards still work — local, deterministic, no network.", {"size": 9.5, "bold": True, "color": INK})],
     0.9, 6.27, 11.4, 0.22)
footer(s, 14)
notes(s, "Keep the demo to three minutes. Hand the phone to a judge, let them choose. Show the crew tablet. Reply. Then disconnect the Wi-Fi and do one more — that is the memorable moment. If anything fails, the phrase cards still work locally. The runbook is on the slide: Vite with --host, same hotspot, Mac IP, seats 12A and CREW-1.")

# ============================================================
# 15 CLOSE
# ============================================================
s = prs.slides.add_slide(BLANK)
rect(s, 0, 0, W, H, INK, None, shape_type=MSO_SHAPE.RECTANGLE)
rect(s, 0, 0, 0.09, H, RED, None, shape_type=MSO_SHAPE.RECTANGLE)
# route arc
arc = s.shapes.add_shape(MSO_SHAPE.ARC, Inches(7.2), Inches(-1.4), Inches(7.0), Inches(7.0))
arc.fill.background(); arc.line.color.rgb = RED; arc.line.width = Pt(1.6)
arc.line.dash_style = MSO_LINE_DASH_STYLE.DASH
arc.shadow.inherit = False
for x, y in ((8.3, 4.4), (9.5, 2.8), (11.6, 2.0), (12.4, 3.0)):
    dot(s, x, y, 0.08, RED_L)
text(s, "THE ASK", 0.72, 0.85, 4, 0.25, 9, True, RED_L)
text(s, "Start with\none route.", 0.7, 1.35, 7.3, 2.0, 42, True, WHITE, spacing=0.9)
text(s, "An eight-week pilot on one route, with a joint scorecard.\nIf the numbers hold, we scale with you.", 0.72, 3.55, 6.7, 0.8, 13.5, False, RGBColor(0xC9, 0xD2, 0xD6), spacing=1.15)
asks = [("01", "PILOT ONE ROUTE", "2 aircraft · 8 weeks"), ("02", "SECURITY REVIEW", "local-first · no audio stored"), ("03", "DEFINE THE KPIs", "speed · repeats · safety")]
for i, (n, head, body) in enumerate(asks):
    x = 0.72 + i * 2.55
    rect(s, x, 5.0, 2.35, 1.15, RGBColor(0x18, 0x32, 0x3E), RGBColor(0x3A, 0x53, 0x5E), 0.08)
    text(s, n, x + 0.16, 5.14, 0.4, 0.2, 7.5, True, RED_L)
    text(s, head, x + 0.16, 5.35, 2.0, 0.25, 9, True, WHITE)
    text(s, body, x + 0.16, 5.66, 2.05, 0.35, 7.5, False, RGBColor(0xB9, 0xC4, 0xC9))
text(s, "Thank you.", 0.72, 6.48, 3, 0.3, 11, True, WHITE)
text(s, "CabinBridge  ·  JAL Demo Day 2026", 3.4, 6.48, 5.5, 0.3, 9, False, RGBColor(0xB9, 0xC4, 0xC9))
rich(s, [("ありがとうございました。", {"font": JP, "size": 11, "color": RGBColor(0xB9, 0xC4, 0xC9)})], 10.4, 6.48, 2.5, 0.3, align=PP_ALIGN.RIGHT)
notes(s, "Close on the ask, not the technology: one route, eight weeks, a joint scorecard. Thank the judges. If they remember one thing, it should be that the loop is local, fast, and safe — and that they just used it themselves.")

out = BASE / "CabinBridge_JAL_Pitch.pptx"
prs.save(out)
print("saved", out, "slides", len(prs.slides))
