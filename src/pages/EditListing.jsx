import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import NavHeader from "../components/NavHeader";
import ImageUploadField from "../components/ImageUploadField";
import { supabase } from "../lib/supabaseClient";
import { pathFromPublicUrl } from "../lib/storagePaths";

const CATEGORIES = [
  "Cycling",
  "Basketball",
  "Badminton",
  "Swimming",
  "Running",
  "Camping & Outdoor",
  "Gym & Fitness",
  "Team Sports",
  "Other",
];

const CONDITIONS = ["New", "Fairly New", "Good", "Fairly used", "Well-used"];
const MAX_PHOTOS = 4;

export default function EditListing() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [form, setForm] = useState({ name: "", category: "", condition: "", description: "" });
  const [rentEnabled, setRentEnabled] = useState(false);
  const [rentPrice, setRentPrice] = useState("");
  const [buyEnabled, setBuyEnabled] = useState(false);
  const [buyPrice, setBuyPrice] = useState("");
  const [tryToBuy, setTryToBuy] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");

  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
            const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/login");
        return;
      }

      const { data: myProfile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (myProfile?.is_admin) {
        navigate("/admin", { replace: true });
        return;
      }

      const { data, error } = await supabase.from("equipment").select("*").eq("id", id).single();

      if (error || !data || data.owner_id !== user.id) {
        navigate("/dashboard", { replace: true });
        return;
      }

      if (active) {
        setForm({
          name: data.name,
          category: data.category,
          condition: data.condition,
          description: data.description || "",
        });
        setRentEnabled(Boolean(data.rent_price_per_day));
        setRentPrice(data.rent_price_per_day ? String(data.rent_price_per_day) : "");
        setBuyEnabled(Boolean(data.buy_price));
        setBuyPrice(data.buy_price ? String(data.buy_price) : "");
        setTryToBuy(Boolean(data.try_to_buy));
        setDepositAmount(data.deposit_amount ? String(data.deposit_amount) : "");
        setExistingImages(data.images || []);
        setAllowed(true);
        setChecking(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [id, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((er) => ({ ...er, [name]: "" }));
  };

  const removeExisting = (url) => {
    setExistingImages((imgs) => imgs.filter((i) => i !== url));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Enter a name for this item.";
    if (!form.category) next.category = "Choose a category.";
    if (!form.condition) next.condition = "Choose a condition.";
    if (!rentEnabled && !buyEnabled) next.pricing = "Enable at least one of rent or buy.";
    if (rentEnabled && !rentPrice) next.rentPrice = "Enter a daily rental price.";
    if (buyEnabled && !buyPrice) next.buyPrice = "Enter a sale price.";
    return next;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const newUrls = [];
    for (const file of newImages) {
      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("equipment-images")
        .upload(path, file);

      if (uploadError) {
        setFormError(`Photo upload failed: ${uploadError.message}`);
        setSubmitting(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("equipment-images")
        .getPublicUrl(path);
      newUrls.push(publicUrlData.publicUrl);
    }

    const { error: updateError } = await supabase
      .from("equipment")
      .update({
        name: form.name.trim(),
        category: form.category,
        condition: form.condition,
        description: form.description.trim(),
        rent_price_per_day: rentEnabled ? Number(rentPrice) : null,
        buy_price: buyEnabled ? Number(buyPrice) : null,
        try_to_buy: rentEnabled && buyEnabled ? tryToBuy : false,
        deposit_amount: rentEnabled ? Math.max(0, Number(depositAmount) || 0) : 0,
        images: [...existingImages, ...newUrls],
      })
      .eq("id", id);

    setSubmitting(false);

    if (updateError) {
      setFormError(updateError.message);
      return;
    }

    navigate(`/equipment/${id}`);
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Delete "${form.name}"? This can't be undone, and any pending or approved requests for it will be removed too.`
    );
    if (!confirmed) return;

    for (const url of existingImages) {
      const path = pathFromPublicUrl(url, "equipment-images");
      if (path) await supabase.storage.from("equipment-images").remove([path]);
    }

    const { error } = await supabase.from("equipment").delete().eq("id", id);

    if (error) {
      setFormError(error.message);
      return;
    }

    navigate("/dashboard");
  };

  if (checking || !allowed) {
    return (
      <div className="page-loading">
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="app-page">
      <NavHeader onLogout={handleLogout} />

      <main className="listing-form-main">
        <div className="dashboard-welcome">
          <span className="eyebrow">Edit listing</span>
          <h1>{form.name}</h1>
        </div>

        {formError && <div className="form-banner error">{formError}</div>}

        <form onSubmit={handleSubmit} noValidate className="listing-form-card">
          <div className={`field${errors.name ? " has-error" : ""}`}>
            <label htmlFor="name">Item name</label>
            <input id="name" name="name" type="text" value={form.name} onChange={handleChange} />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>

          <div className="field-row">
            <div className={`field${errors.category ? " has-error" : ""}`}>
              <label htmlFor="category">Category</label>
              <select id="category" name="category" value={form.category} onChange={handleChange}>
                <option value="" disabled>
                  Select category
                </option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {errors.category && <span className="field-error">{errors.category}</span>}
            </div>

            <div className={`field${errors.condition ? " has-error" : ""}`}>
              <label htmlFor="condition">Condition</label>
              <select id="condition" name="condition" value={form.condition} onChange={handleChange}>
                <option value="" disabled>
                  Select condition
                </option>
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {errors.condition && <span className="field-error">{errors.condition}</span>}
            </div>
          </div>

          <div className="field">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              rows={4}
              value={form.description}
              onChange={handleChange}
            />
          </div>

          <div className="field">
            <label>Availability & pricing</label>
            {errors.pricing && <span className="field-error">{errors.pricing}</span>}

            <label className="pricing-toggle-row">
              <input
                type="checkbox"
                checked={rentEnabled}
                onChange={(e) => setRentEnabled(e.target.checked)}
              />
              <span>Available to rent</span>
              {rentEnabled && (
                <input
                  type="number"
                  min="0"
                  className="pricing-inline-input"
                  placeholder="₱ per day"
                  value={rentPrice}
                  onChange={(e) => setRentPrice(e.target.value)}
                  onWheel={(e) => e.target.blur()}
                />
              )}
            </label>
{errors.rentPrice && <span className="field-error">{errors.rentPrice}</span>}

            {rentEnabled && (
              <>
                <label className="pricing-toggle-row">
                  <span>Refundable deposit (optional)</span>
                  <input
                    type="number"
                    min="0"
                    className="pricing-inline-input"
                    placeholder="₱ deposit"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                  />
                </label>
                <p className="equipment-note-detail">
                  Paid directly to you at pickup (cash or e-wallet). GearGrid doesn't hold deposits.
                </p>
              </>
            )}

            <label className="pricing-toggle-row">
              <input
                type="checkbox"
                checked={buyEnabled}
                onChange={(e) => setBuyEnabled(e.target.checked)}
              />
              <span>Available to buy</span>
              {buyEnabled && (
                <input
                  type="number"
                  min="0"
                  className="pricing-inline-input"
                  placeholder="₱ total"
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                  onWheel={(e) => e.target.blur()}
                />
              )}
            </label>
                        {errors.buyPrice && <span className="field-error">{errors.buyPrice}</span>}

            {rentEnabled && buyEnabled && (
              <label className="pricing-toggle-row">
                <input type="checkbox" checked={tryToBuy} onChange={(e) => setTryToBuy(e.target.checked)} />
                <span>Allow Try-to-Buy (rental fee counts toward the purchase price)</span>
              </label>
            )}
          </div>

          {existingImages.length > 0 && (
            <div className="field">
              <label>Current photos</label>
              <div className="image-upload-grid">
                {existingImages.map((url) => (
                  <div className="image-upload-thumb" key={url}>
                    <img src={url} alt="" />
                    <button
                      type="button"
                      className="image-upload-remove"
                      onClick={() => removeExisting(url)}
                      aria-label="Remove photo"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {existingImages.length < MAX_PHOTOS && (
            <ImageUploadField
              files={newImages}
              onChange={setNewImages}
              maxFiles={MAX_PHOTOS - existingImages.length}
            />
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? "Saving…" : "Save Changes"}
          </button>
          <button
            type="button"
            className="btn btn-danger btn-block"
            style={{ marginTop: 10 }}
            onClick={handleDelete}
            disabled={submitting}
          >
            Delete Listing
          </button>
        </form>
      </main>
    </div>
  );
}