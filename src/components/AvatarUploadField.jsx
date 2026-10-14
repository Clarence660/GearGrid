import { useRef, useState } from "react";

export default function AvatarUploadField({ avatarUrl, initials, onFileSelected, uploading }) {
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreviewUrl(URL.createObjectURL(file));
    onFileSelected(file);
    e.target.value = "";
  };

  const displaySrc = previewUrl || avatarUrl;

  return (
    <div className="avatar-upload">
      <button
        type="button"
        className="avatar-upload-circle"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label="Change profile picture"
      >
        {displaySrc ? (
          <img src={displaySrc} alt="Profile" />
        ) : (
          <span className="avatar-upload-initials">{initials}</span>
        )}
        <span className="avatar-upload-overlay">{uploading ? "…" : "Change"}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        hidden
      />
    </div>
  );
}