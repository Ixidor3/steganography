const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { encryptMessage, decryptMessage, embedInImage, extractFromImage, getImageCapacity } = require('./stego');

const app = express();
app.use(cors());
app.use(express.json());

// Store uploaded files temporarily in an "uploads" folder
const upload = multer({
    dest: 'uploads/',
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/png', 'image/jpeg', 'image/bmp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Unsupported file type. Please upload a PNG, JPG, or BMP image.'));
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 }
});

// Make sure output folder exists
if (!fs.existsSync('output')) fs.mkdirSync('output');
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// ---- ROUTE 1: Encrypt message + hide it in uploaded image ----
app.post('/encrypt-embed', upload.single('image'), async (req, res) => {
    try {
        const { message, passphrase } = req.body;
        const imagePath = req.file.path;

        if (!message || !passphrase) {
            return res.status(400).json({ error: 'Message and passphrase are required' });
        }

        const encrypted = encryptMessage(message, passphrase);

        const outputFilename = `stego-${Date.now()}.png`;
        const outputPath = path.join('output', outputFilename);

        await embedInImage(imagePath, encrypted, outputPath);

        // Clean up the uploaded original
        fs.unlinkSync(imagePath);

        // Send the stego image back as a downloadable file
        res.download(outputPath, outputFilename);

    } catch (err) {
        console.error(err);
        // Clean up the uploaded file if something went wrong
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(400).json({ error: err.message });
    }
});

// ---- ROUTE 2: Extract + decrypt message from uploaded stego image ----
app.post('/extract-decrypt', upload.single('image'), async (req, res) => {
    try {
        const { passphrase } = req.body;
        const imagePath = req.file.path;

        if (!passphrase) {
            return res.status(400).json({ error: 'Passphrase is required' });
        }

        const extractedPayload = await extractFromImage(imagePath);
        const decrypted = decryptMessage(extractedPayload, passphrase);

        fs.unlinkSync(imagePath);

        res.json({ message: decrypted });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to extract message. Wrong passphrase or invalid image.' });
    }
});

// ---- ROUTE 3: Check how much an image can hold ----
app.post('/image-capacity', upload.single('image'), async (req, res) => {
    try {
        const imagePath = req.file.path;
        const capacity = await getImageCapacity(imagePath);
        fs.unlinkSync(imagePath);
        res.json(capacity);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not read image.' });
    }
});

app.use((err, req, res, next) => {
    res.status(400).json({ error: err.message || 'Upload failed.' });
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});