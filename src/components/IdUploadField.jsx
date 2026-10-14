import { useState } from "react";

export default function IdUploadField({ file, onFileChange, error }) {
  const [previewUrl, setPreviewUrl] = useState(null);

  const handleChange = (e) => {
    const selected = e.target.files?.[0] || null;
    onFileChange(selected);

    if (selected && selected.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(selected));
    } else {
      setPreviewUrl(null);
    }
  };

  return (
    <div className={`field${error ? " has-error" : ""}`}>
      <label htmlFor="idUpload">Government-issued ID</label>
      <label className="upload-dropzone" htmlFor="idUpload">
        {previewUrl ? (
          <img src={previewUrl} alt="ID preview" className="upload-preview" />
        ) : (
          <>
            <span className="upload-dropzone-icon">📄</span>
            <span className="upload-dropzone-text">
              {file ? file.name : "Click to upload a photo or scan of your ID"}
            </span>
            <span className="upload-dropzone-hint">JPG, PNG, or PDF · Max 10MB</span>
          </>
        )}
      </label>
      <input
        id="idUpload"
        name="idUpload"
        type="file"
        accept="image/*,.pdf"
        onChange={handleChange}
        style={{ display: "none" }}
      />
      {file && !error && <span className="upload-filename">Selected: {file.name}</span>}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}