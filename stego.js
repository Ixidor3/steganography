const crypto = require('crypto');
const Jimp = require('jimp');

// ---- ENCRYPTION ----
function encryptMessage(message, passphrase) {
    // 1. Create a random "salt" - used to derive a unique key from the passphrase
    const salt = crypto.randomBytes(16);

    // 2. Derive a 256-bit key from the passphrase + salt using PBKDF2
    //    (this turns a human passphrase into a proper AES key)
    const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');

    // 3. Create a random IV (Initialization Vector) - required for CBC mode
    const iv = crypto.randomBytes(16);

    // 4. Encrypt the message using AES-256-CBC
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(message, 'utf8'), cipher.final()]);

    // 5. Combine salt + iv + encrypted data into one payload
    //    (we need salt and iv later to decrypt, so we attach them)
    const payload = Buffer.concat([salt, iv, encrypted]);

    return payload;
}

// ---- DECRYPTION ----
function decryptMessage(payload, passphrase) {
    // Pull the salt, iv, and ciphertext back apart
    const salt = payload.subarray(0, 16);
    const iv = payload.subarray(16, 32);
    const encrypted = payload.subarray(32);

    // Re-derive the same key using the same salt
    const key = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return decrypted.toString('utf8');
}

// ---- CONVERT PAYLOAD (Buffer) TO A STRING OF BITS ----
function bufferToBits(buffer) {
    let bits = '';
    for (let byte of buffer) {
        bits += byte.toString(2).padStart(8, '0'); // each byte -> 8 bits
    }
    return bits;
}

// ---- CONVERT BITS BACK TO A BUFFER ----
function bitsToBuffer(bits) {
    const bytes = [];
    for (let i = 0; i < bits.length; i += 8) {
        bytes.push(parseInt(bits.substr(i, 8), 2));
    }
    return Buffer.from(bytes);
}

// ---- EMBED PAYLOAD INTO IMAGE ----
async function embedInImage(imagePath, payload, outputPath) {
    const image = await Jimp.read(imagePath);

    // Prefix the payload with its own length (32 bits = 4 bytes)
    // so during extraction we know exactly how many bits to read back
    const lengthBits = payload.length.toString(2).padStart(32, '0');
    const payloadBits = bufferToBits(payload);
    const allBits = lengthBits + payloadBits;

    // Capacity check: each pixel gives us 3 usable bits (R,G,B)
    const capacityBits = image.bitmap.width * image.bitmap.height * 3;
    if (allBits.length > capacityBits) {
        throw new Error("Image too small to hold this payload");
    }

    let bitIndex = 0;
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
        if (bitIndex >= allBits.length) return;

        // idx points to the Red byte; idx+1 = Green, idx+2 = Blue, idx+3 = Alpha
        for (let channel = 0; channel < 3; channel++) {
            if (bitIndex >= allBits.length) return;
            const bit = parseInt(allBits[bitIndex]);
            // Clear the last bit, then set it to our bit
            this.bitmap.data[idx + channel] = (this.bitmap.data[idx + channel] & 0xFE) | bit;
            bitIndex++;
        }
    });

    await image.writeAsync(outputPath);
    console.log("Stego image saved:", outputPath);
}

// ---- EXTRACT PAYLOAD FROM IMAGE ----
async function extractFromImage(imagePath) {
    const image = await Jimp.read(imagePath);

    let bits = '';
    let lengthBits = '';
    let payloadLength = null;
    let payloadBits = '';

    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
        for (let channel = 0; channel < 3; channel++) {
            const bit = this.bitmap.data[idx + channel] & 1; // read last bit
            bits += bit;
        }
    });

    // First 32 bits = payload length
    lengthBits = bits.substring(0, 32);
    payloadLength = parseInt(lengthBits, 2);

    // Next (payloadLength * 8) bits = actual payload
    payloadBits = bits.substring(32, 32 + payloadLength * 8);

    return bitsToBuffer(payloadBits);
}

// ---- CALCULATE HOW MANY BYTES AN IMAGE CAN HOLD ----
async function getImageCapacity(imagePath) {
    const image = await Jimp.read(imagePath);
    const totalBits = image.bitmap.width * image.bitmap.height * 3; // 3 usable bits per pixel (R,G,B)
    const usableBits = totalBits - 32; // reserve 32 bits for the length header
    const maxBytes = Math.floor(usableBits / 8);
    return {
        width: image.bitmap.width,
        height: image.bitmap.height,
        maxBytes
    };
}

module.exports = {
    encryptMessage,
    decryptMessage,
    embedInImage,
    extractFromImage,
    getImageCapacity
};