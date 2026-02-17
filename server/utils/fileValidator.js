const { v4: uuidv4 } = require('uuid');
const path = require('path');

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const MAX_FILE_SIZE = 5 * 1024 * 1024; 

const FILE_SIGNATURES = {
  jpeg: [
    [0xFF, 0xD8, 0xFF, 0xE0], 
    [0xFF, 0xD8, 0xFF, 0xE1], 
    [0xFF, 0xD8, 0xFF, 0xE2], 
    [0xFF, 0xD8, 0xFF, 0xE3], 
    [0xFF, 0xD8, 0xFF, 0xDB]  
  ],
  png: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  gif: [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], 
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]  
  ],
  webp: [[0x52, 0x49, 0x46, 0x46]] 
};


const validateFileExtension = (filename) => {
  if (!filename) {
    return { valid: false, error: 'Filename is required' };
  }

  const ext = path.extname(filename).toLowerCase();
  
  if (!ext) {
    return { valid: false, error: 'File must have an extension' };
  }

  // Check for double extensions (e.x., shell.php.jpg)
  const nameWithoutExt = path.basename(filename, ext);
  const secondExt = path.extname(nameWithoutExt);
  
  if (secondExt) {
    return { 
      valid: false, 
      error: 'Invalid file name. Files with double extensions are not allowed' 
    };
  }

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { 
      valid: false, 
      error: `Invalid file extension. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}` 
    };
  }

  return { valid: true };
};


const validateMimeType = (mimetype) => {
  if (!mimetype) {
    return { valid: false, error: 'MIME type is required' };
  }

  if (!ALLOWED_MIME_TYPES.includes(mimetype.toLowerCase())) {
    return { 
      valid: false, 
      error: 'Invalid file type. Only image files (JPEG, PNG, GIF, WebP) are allowed' 
    };
  }

  return { valid: true };
};


const validateFileSignature = (buffer) => {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'File buffer is empty' };
  }

  // Check against known image signatures
  let isValidSignature = false;

  // Check JPEG signatures
  for (const signature of FILE_SIGNATURES.jpeg) {
    if (matchesSignature(buffer, signature)) {
      isValidSignature = true;
      break;
    }
  }

  // Check PNG signature
  if (!isValidSignature && matchesSignature(buffer, FILE_SIGNATURES.png[0])) {
    isValidSignature = true;
  }

  // Check GIF signatures
  if (!isValidSignature) {
    for (const signature of FILE_SIGNATURES.gif) {
      if (matchesSignature(buffer, signature)) {
        isValidSignature = true;
        break;
      }
    }
  }

  // Check WebP signature 
  if (!isValidSignature && matchesSignature(buffer, FILE_SIGNATURES.webp[0])) {
    if (buffer.length >= 12) {
      const webpMarker = [0x57, 0x45, 0x42, 0x50]; 
      const webpBytes = buffer.slice(8, 12);
      if (matchesSignature(webpBytes, webpMarker)) {
        isValidSignature = true;
      }
    }
  }

  if (!isValidSignature) {
    return { 
      valid: false, 
      error: 'File content does not match allowed image formats. The file may be corrupted or is not a valid image' 
    };
  }

  return { valid: true };
};


const matchesSignature = (buffer, signature) => {
  if (buffer.length < signature.length) {
    return false;
  }

  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) {
      return false;
    }
  }

  return true;
};


const validateFileSize = (size) => {
  if (!size || size === 0) {
    return { valid: false, error: 'File is empty' };
  }

  if (size > MAX_FILE_SIZE) {
    const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024);
    return { 
      valid: false, 
      error: `File size exceeds maximum limit of ${maxSizeMB}MB` 
    };
  }

  return { valid: true };
};


const validateImageFile = (file) => {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Validate file size
  const sizeValidation = validateFileSize(file.size);
  if (!sizeValidation.valid) {
    return sizeValidation;
  }

  // Validate MIME type
  const mimeValidation = validateMimeType(file.mimetype);
  if (!mimeValidation.valid) {
    return mimeValidation;
  }

  // Validate file extension
  const extValidation = validateFileExtension(file.originalname);
  if (!extValidation.valid) {
    return extValidation;
  }

  // Validate file signature 
  const signatureValidation = validateFileSignature(file.buffer);
  if (!signatureValidation.valid) {
    return signatureValidation;
  }

  return { valid: true };
};


const generateSecureFilename = (originalFilename) => {
  const ext = path.extname(originalFilename).toLowerCase();
  const timestamp = Date.now();
  const uniqueId = uuidv4();
  
  // Format: timestamp-uuid.ext
  return `${timestamp}-${uniqueId}${ext}`;
};

module.exports = {
  validateImageFile,
  generateSecureFilename,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE
};
