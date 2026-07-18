import numpy as np
from PIL import Image
from skimage.metrics import peak_signal_noise_ratio as psnr
from skimage.metrics import structural_similarity as ssim

def load_image_as_array(path):
    img = Image.open(path).convert('RGB')
    return np.array(img)

def analyze(cover_path, stego_path, label):
    cover = load_image_as_array(cover_path)
    stego = load_image_as_array(stego_path)

    if cover.shape != stego.shape:
        print(f"[{label}] ERROR: dimension mismatch")
        return None

    psnr_value = psnr(cover, stego, data_range=255)
    ssim_value = ssim(cover, stego, channel_axis=2, data_range=255)

    return {"label": label, "psnr": psnr_value, "ssim": ssim_value}

if __name__ == "__main__":
    cover = "../cover.png"

    tests = [
        ("25pct", "stego_batch/stego_25pct.png"),
        ("50pct", "stego_batch/stego_50pct.png"),
        ("75pct", "stego_batch/stego_75pct.png"),
    ]

    results = []
    for label, stego_path in tests:
        result = analyze(cover, stego_path, label)
        if result:
            results.append(result)

    print("=" * 60)
    print(f"{'Payload':<10}{'PSNR (dB)':<15}{'SSIM':<15}{'Verdict'}")
    print("-" * 60)
    for r in results:
        verdict = "Excellent" if r["psnr"] > 40 else ("Good" if r["psnr"] > 30 else "Poor")
        print(f"{r['label']:<10}{r['psnr']:<15.2f}{r['ssim']:<15.6f}{verdict}")
    print("=" * 60)