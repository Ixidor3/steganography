import os

def generate_message(byte_size, label):
    # Repeating filler text padded to an exact byte length
    filler = "This is a confidential test message for steganalysis evaluation purposes. "
    repeated = (filler * (byte_size // len(filler) + 1))[:byte_size]

    os.makedirs("test_messages", exist_ok=True)
    path = f"test_messages/message_{label}.txt"
    with open(path, "w") as f:
        f.write(repeated)

    print(f"Created {path} - {byte_size} bytes")

if __name__ == "__main__":
    # Based on your cover.png capacity (~387,000 bytes) - adjust if yours differs
    capacity = 387000

    generate_message(int(capacity * 0.25), "25pct")
    generate_message(int(capacity * 0.50), "50pct")
    generate_message(int(capacity * 0.75), "75pct")