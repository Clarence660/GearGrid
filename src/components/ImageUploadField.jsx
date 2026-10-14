import { useState } from "react";

export default function ImageUploadField({ files, onChange, maxFiles = 4 }) {
  const [previews, setPreviews] = useState([]);

  const handleFilePick = (e) => {
    const picked = Array.from(e.target.files || []);
    const combined = [...files, ...picked].slice(0, maxFiles);
    onChange(combined);
    setPreviews(combined.map((f) => URL.createObjectURL(f)));
    e.target.value = "";
  };

  const removeAt = (index) => {
    const next = files.filter((_, i) => i !== index);
    onChange(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  return (
    <div className="field">
      <label>Photos</label>
      <div className="image-upload-grid">
        {previews.map((src, i) => (
          <div className="image-upload-thumb" key={i}>
            <img src={src} alt={`Upload ${i + 1}`} />
            <button
              type="button"
              className="image-upload-remove"
              onClick={() => removeAt(i)}
              aria-label="Remove photo"
            >
              ✕
            </button>
          </div>
        ))}
        {files.length < maxFiles && (
          <label className="image-upload-add">
            <span>+ Add</span>
            <input type="file" accept="image/*" multiple onChange={handleFilePick} hidden />
          </label>
        )}
      </div>
      <span className="upload-dropzone-hint">Up to {maxFiles} photos, JPG or PNG.</span>
    </div>
  );
}