from pathlib import Path

import fitz

source = Path("attached_assets/JOBENAPP_Preview_1-Page_Sleek_1793020480261.pdf")
output_dir = Path(".agents/outputs")
output_dir.mkdir(parents=True, exist_ok=True)

document = fitz.open(source)
print(f"pages={document.page_count}")

for index, page in enumerate(document, start=1):
    image = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    destination = output_dir / f"jobenapp-reference-page-{index}.png"
    image.save(destination)
    print(f"{destination}: {image.width}x{image.height}")
