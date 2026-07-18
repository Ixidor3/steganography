import requests
import os

API_URL = "http://localhost:3001/encrypt-embed"
COVER_IMAGE = "../cover.png"
PASSPHRASE = "testPassphrase123"

def create_stego(message_path, output_path):
    with open(message_path, "r") as f:
        message = f.read()

    with open(COVER_IMAGE, "rb") as img_file:
        files = {"image": img_file}
        data = {"message": message, "passphrase": PASSPHRASE}

        response = requests.post(API_URL, files=files, data=data)

    if response.status_code == 200:
        with open(output_path, "wb") as out:
            out.write(response.content)
        print(f"Created {output_path} ({len(message)} char message)")
    else:
        print(f"FAILED for {message_path}: {response.text}")

if __name__ == "__main__":
    os.makedirs("stego_batch", exist_ok=True)

    labels = ["25pct", "50pct", "75pct"]

    for label in labels:
        message_path = f"test_messages/message_{label}.txt"
        output_path = f"stego_batch/stego_{label}.png"
        create_stego(message_path, output_path)