import { useState } from 'react';
import './App.css';

const API_URL = 'https://steganography-i1s2.onrender.com';

function App() {
  const [mode, setMode] = useState('hide');

  return (
    <div className="page">
      <div className="container">

        <h1>Steganographic<br />Communication System</h1>
        <p className="subtitle">Encrypt a message, then hide it in plain sight.</p>

        <div className="tabs">
          <button
            className={mode === 'hide' ? 'active' : ''}
            onClick={() => setMode('hide')}
          >
            Hide a Message
          </button>
          <button
            className={mode === 'reveal' ? 'active' : ''}
            onClick={() => setMode('reveal')}
          >
            Reveal a Message
          </button>
        </div>

        {mode === 'hide' ? <HideForm /> : <RevealForm />}

      </div>
    </div>
  );
}

function HideForm() {
  const [image, setImage] = useState(null);
  const [message, setMessage] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [capacity, setCapacity] = useState(null);
  const [checkingCapacity, setCheckingCapacity] = useState(false);

  // Rough estimate of encrypted payload size: message bytes + 48 bytes overhead
  // (16 salt + 16 IV + up to 16 padding bytes from AES-CBC block alignment)
  const estimatedSize = new TextEncoder().encode(message).length + 48;
  const overCapacity = capacity && estimatedSize > capacity.maxBytes;

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    setImage(file);
    setCapacity(null);

    if (!file) return;

    setCheckingCapacity(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`${API_URL}/image-capacity`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) setCapacity(data);
    } catch (err) {
      // Silently fail - capacity display is a nice-to-have, not critical
    } finally {
      setCheckingCapacity(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResultUrl('');

    if (!image || !message || !passphrase) {
      setError('Please fill in all fields.');
      return;
    }

    if (overCapacity) {
      setError('Your message is too large for this image. Choose a bigger image or shorten the message.');
      return;
    }

    const formData = new FormData();
    formData.append('image', image);
    formData.append('message', message);
    formData.append('passphrase', passphrase);

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/encrypt-embed`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Something went wrong');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <label>
        Cover Image
        <input
          type="file"
          accept="image/png"
          onChange={handleImageChange}
        />
      </label>

      {checkingCapacity && <p className="hint">Checking image capacity…</p>}

      {capacity && (
        <p className="hint">
          {capacity.width}×{capacity.height}px &middot; holds up to {capacity.maxBytes.toLocaleString()} bytes
        </p>
      )}

      <label>
        Secret Message
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your secret message here"
        />
      </label>

      {capacity && (
        <p className={overCapacity ? 'hint hint-warning' : 'hint'}>
          ~{estimatedSize.toLocaleString()} / {capacity.maxBytes.toLocaleString()} bytes
          {overCapacity && ' — too large for this image'}
        </p>
      )}

      <label>
        Passphrase
        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Enter a strong passphrase"
        />
      </label>

      <button type="submit" disabled={loading || overCapacity}>
        {loading ? 'Processing...' : 'Encrypt & Hide Message'}
      </button>

      {error && <p className="error">{error}</p>}

      {resultUrl && (
        <div className="result">
          <p>Your stego image is ready:</p>
          <img src={resultUrl} alt="Stego result" />
          <a href={resultUrl} download="stego.png">Download Stego Image</a>
        </div>
      )}
    </form>
  );
}

function RevealForm() {
  const [image, setImage] = useState(null);
  const [passphrase, setPassphrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revealedMessage, setRevealedMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setRevealedMessage('');

    if (!image || !passphrase) {
      setError('Please provide both the image and passphrase.');
      return;
    }

    const formData = new FormData();
    formData.append('image', image);
    formData.append('passphrase', passphrase);

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/extract-decrypt`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      setRevealedMessage(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form">
      <label>
        Stego Image
        <input
          type="file"
          accept="image/png"
          onChange={(e) => setImage(e.target.files[0])}
        />
      </label>

      <label>
        Passphrase
        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Enter the passphrase used to hide the message"
        />
      </label>

      <button type="submit" disabled={loading}>
        {loading ? 'Extracting...' : 'Reveal Message'}
      </button>

      {error && <p className="error">{error}</p>}

      {revealedMessage && (
        <div className="result">
          <p>Hidden message:</p>
          <p className="revealed-message">{revealedMessage}</p>
        </div>
      )}
    </form>
  );
}

export default App;