import numpy as np
from PIL import Image
from scipy.stats import chisquare

def load_image_as_array(path):
    img = Image.open(path).convert('RGB')
    return np.array(img)

def chi_square_attack(image_path, label):
    img = load_image_as_array(image_path)
    flat = img.flatten()

    # Count how many pixel values fall into each byte value (0-255)
    observed, _ = np.histogram(flat, bins=256, range=(0, 256))

    # Pair up values that LSB flipping swaps between (0<->1, 2<->3, etc.)
    # and get the expected (average) count for each pair
    expected = observed.copy().astype(float)
    for i in range(0, 256, 2):
        avg = (observed[i] + observed[i + 1]) / 2
        expected[i] = avg
        expected[i + 1] = avg

    # Avoid zero-expected-value errors
    expected = np.where(expected == 0, 1, expected)

    chi2_stat, p_value = chisquare(observed, expected)

    print(f"[{label}]")
    print(f"  Chi-square statistic: {chi2_stat:.2f}")
    print(f"  p-value: {p_value:.6f}")

    if p_value > 0.05:
        print("  Verdict: LIKELY CLEAN (no strong statistical evidence of hidden data)")
    else:
        print("  Verdict: SUSPICIOUS (statistical pattern suggests possible hidden data)")
    print()

if __name__ == "__main__":
    chi_square_attack("../cover.png", "Cover (untouched original)")
    chi_square_attack("stego_batch/stego_50pct.png", "Stego (50% payload)")