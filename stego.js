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
    let image;
    try {
        image = await Jimp.read(imagePath);
    } catch (err) {
        throw new Error('The uploaded image could not be read. Please try uploading again.');
    }

    const { width, height, data } = image.bitmap;
    const capacityBits = width * height * 3;
    const totalBitsNeeded = 32 + payload.length * 8;

    if (totalBitsNeeded > capacityBits) {
        throw new Error("Image too small to hold this payload");
    }

    // Build a small header buffer (4 bytes) encoding the payload length
    const lengthHeader = Buffer.alloc(4);
    lengthHeader.writeUInt32BE(payload.length, 0);

    // Helper: get the bit at a given index across [lengthHeader + payload] without
    // ever building a giant string - reads directly from the two buffers
    function getPayloadBit(bitIndex) {
        const byteIndex = Math.floor(bitIndex / 8);
        const bitOffset = 7 - (bitIndex % 8); // MSB-first, matches original string-based order
        const sourceByte = byteIndex < 4
            ? lengthHeader[byteIndex]
            : payload[byteIndex - 4];
        return (sourceByte >> bitOffset) & 1;
    }

    let bitIndex = 0;
    for (let pixelIndex = 0; pixelIndex < width * height && bitIndex < totalBitsNeeded; pixelIndex++) {
        const idx = pixelIndex * 4; // Jimp stores RGBA, 4 bytes per pixel
        for (let channel = 0; channel < 3 && bitIndex < totalBitsNeeded; channel++) {
            const bit = getPayloadBit(bitIndex);
            data[idx + channel] = (data[idx + channel] & 0xFE) | bit;
            bitIndex++;
        }
    }

    await image.writeAsync(outputPath);
}

// ---- EXTRACT PAYLOAD FROM IMAGE ----
async function extractFromImage(imagePath) {
    const image = await Jimp.read(imagePath);
    const { width, height, data } = image.bitmap;

    // Read only the first 32 bits to get payload length, without scanning the whole image
    let lengthBits = '';
    let pixelsRead = 0;
    const totalPixels = width * height;

    function getBitAt(bitIndex) {
        const pixelIndex = Math.floor(bitIndex / 3);
        const channel = bitIndex % 3;
        const idx = pixelIndex * 4; // Jimp stores RGBA, 4 bytes per pixel
        return data[idx + channel] & 1;
    }

    for (let i = 0; i < 32; i++) lengthBits += getBitAt(i);
    const payloadLength = parseInt(lengthBits, 2);
    const totalBitsNeeded = 32 + payloadLength * 8;

    // Now extract only the exact number of bits needed, into a byte buffer directly
    const outputBytes = Buffer.alloc(payloadLength);
    for (let byteIndex = 0; byteIndex < payloadLength; byteIndex++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
            const bitIndex = 32 + byteIndex * 8 + bit;
            byte = (byte << 1) | getBitAt(bitIndex);
        }
        outputBytes[byteIndex] = byte;
    }

    return outputBytes;
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