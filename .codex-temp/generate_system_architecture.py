from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


WIDTH = 700
HEIGHT = 1800
MARGIN_X = 35
BOX_WIDTH = WIDTH - (MARGIN_X * 2)
BOX_GAP = 115
TOP = 55

OUTPUT = Path(
    r"C:\Users\Dell\.codex\visualizations\2026\07\16\019f6b2b-2366-7772-86b1-21629300feec\mangrovelens-system-architecture.png"
)


def load_font(size: int, bold: bool = False):
    candidates = [
        Path(r"C:\Windows\Fonts\timesbd.ttf" if bold else r"C:\Windows\Fonts\times.ttf"),
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


TITLE_FONT = load_font(20, bold=True)
SUBTITLE_FONT = load_font(18, bold=True)
BODY_FONT = load_font(16)


def centered_text(draw, text, y, font):
    bounds = draw.textbbox((0, 0), text, font=font)
    text_width = bounds[2] - bounds[0]
    draw.text(((WIDTH - text_width) / 2, y), text, fill="black", font=font)


def draw_arrow(draw, start_y, end_y):
    center_x = WIDTH // 2
    draw.line((center_x, start_y, center_x, end_y - 20), fill="black", width=4)
    draw.polygon(
        [
            (center_x, end_y),
            (center_x - 14, end_y - 24),
            (center_x + 14, end_y - 24),
        ],
        fill="black",
    )


def draw_layer(draw, y, height, title, subtitle, bullets):
    x1 = MARGIN_X
    x2 = WIDTH - MARGIN_X
    y2 = y + height

    draw.rounded_rectangle(
        (x1, y, x2, y2),
        radius=14,
        fill="white",
        outline="black",
        width=3,
    )

    header_bottom = y + 125
    draw.line((x1, header_bottom, x2, header_bottom), fill="black", width=2)

    centered_text(draw, title, y + 13, TITLE_FONT)
    centered_text(draw, subtitle, y + 68, SUBTITLE_FONT)

    bullet_x = x1 + 35
    text_x = bullet_x + 38
    current_y = header_bottom + 25

    for bullet in bullets:
        draw.line(
            (bullet_x, current_y + 17, bullet_x + 25, current_y + 17),
            fill="black",
            width=3,
        )
        draw.polygon(
            [
                (bullet_x + 36, current_y + 17),
                (bullet_x + 23, current_y + 8),
                (bullet_x + 23, current_y + 26),
            ],
            fill="black",
        )
        draw.text((text_x, current_y), bullet, fill="black", font=BODY_FONT)
        current_y += 47


image = Image.new("RGB", (WIDTH, HEIGHT), "white")
draw = ImageDraw.Draw(image)

layers = [
    (
        "REMOTE-SENSING AND ANALYSIS LAYER",
        "(Google Earth Engine)",
        [
            "Sentinel-2 and reference datasets",
            "SCL cloud masking and image filtering",
            "Annual median compositing",
            "MVI-based potential mangrove mapping",
            "NDVI vegetation-condition analysis",
            "Temporal change analysis",
            "Outputs: map tiles, summaries, and metadata",
        ],
    ),
    (
        "APPLICATION AND API LAYER",
        "(Next.js API Routes)",
        [
            "Receives and validates user parameters",
            "Connects securely to Google Earth Engine",
            "Requests satellite-data processing",
            "Returns map URLs, summaries, and metadata",
            "Communicates with the frontend using fetch()",
        ],
    ),
    (
        "WEB-BASED VISUALIZATION LAYER",
        "(Next.js  •  React  •  Leaflet)",
        [
            "Interactive Leaflet map",
            "Location, year, and layer selection",
            "MVI and NDVI map visualization",
            "Area summaries and trend charts",
            "Metadata and study limitations",
            "Loading and error messages",
            "Material UI and SCSS styling",
        ],
    ),
]

box_heights = [505, 410, 505]
positions = [
    TOP,
    TOP + box_heights[0] + BOX_GAP,
    TOP + box_heights[0] + BOX_GAP + box_heights[1] + BOX_GAP,
]

for index, ((title, subtitle, bullets), y, height) in enumerate(
    zip(layers, positions, box_heights)
):
    draw_layer(draw, y, height, title, subtitle, bullets)
    if index < len(layers) - 1:
        draw_arrow(draw, y + height + 14, positions[index + 1] - 14)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
image.save(OUTPUT, format="PNG", dpi=(300, 300), optimize=True)
print(OUTPUT)
