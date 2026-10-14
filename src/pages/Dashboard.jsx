import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import NavHeader from "../components/NavHeader";
import StarRating from "../components/StarRating";
import { supabase } from "../lib/supabaseClient";
import useLiveRefresh from "../lib/useLiveRefresh";
import { pathFromPublicUrl } from "../lib/storagePaths";

const formatPeso = (amount) => `₱${Number(amount).toLocaleString()}`;

const PAGE_SIZE = 12;
const MY_LISTINGS_PAGE_SIZE = 6;

const isRecentlyListed = (createdAt) => {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  return Date.now() - created <= 7 * 24 * 60 * 60 * 1000;
};

const getSport = (item) => item.sport || item.category || "Other";

// Filters run in the database so categories/types work across ALL listings,
// not just the page that happens to be loaded.
const applyFilters = (query, { hideOwn, uid, sport, type }) => {
  if (hideOwn && uid) query = query.neq("owner_id", uid);
  if (sport && sport !== "All") query = query.eq("category", sport);
  if (type === "Rent") query = query.gt("rent_price_per_day", 0);
  else if (type === "Buy") query = query.gt("buy_price", 0);
  else if (type === "Try-to-Buy") query = query.eq("try_to_buy", true);
  return query;
};

function ListingCard({ item, ownerControls, onDelete, verifiedOwnerIds, ownerRatingStats }) {
  const tags = [];
  if (item.rent_price_per_day) tags.push("RENT");
  if (item.buy_price) tags.push("BUY");

  const priceLines = [];
  if (item.rent_price_per_day) priceLines.push(`${formatPeso(item.rent_price_per_day)}/day`);
  if (item.buy_price) priceLines.push(formatPeso(item.buy_price));

  const verified = verifiedOwnerIds?.has(item.owner_id);
  const isNew = isRecentlyListed(item.created_at);
  const ratingStats = ownerRatingStats?.[item.owner_id] || { avg: 0, count: 0 };
  const isTrusted = ratingStats.count >= 3 && ratingStats.avg >= 4.5;

  return (
    <article className="listing-card">
      <Link to={`/equipment/${item.id}`} className="listing-card-link">
        <div className="listing-thumb-wrap">
          {item.images?.[0] ? (
            <div
              className="listing-thumb"
              style={{ backgroundImage: `url(${item.images[0]})` }}
              aria-label={item.name}
            />
          ) : (
            <div className="listing-thumb listing-thumb-empty">
              <span className="listing-thumb-empty-label">No photo</span>
            </div>
          )}

            <div className="listing-card-topline">
            {item.is_sold && <span className="listing-status listing-status-sold">SOLD</span>}
            {!item.is_sold && isNew && <span className="listing-status listing-status-new">NEW</span>}
            {isTrusted && <span className="listing-status listing-status-trusted">★ Trusted</span>}
            {verified && (
              <span className="listing-status listing-status-verified" title="Owner identity verified">
                ✓ Verified owner
              </span>
            )}
          </div>
        </div>

        <div className="listing-card-content">
          <div className="listing-tags">
            {tags.map((t) => (
              <span className="mini-tag listing-mode" key={t}>
                {t}
              </span>
            ))}
            <span className="mini-tag listing-sport">{getSport(item)}</span>
          </div>

                    <h3 className="listing-name">{item.name}</h3>
          <p className="listing-price">{priceLines.join(" · ")}</p>
          {ratingStats.count > 0 && (
            <p className="listing-rating-line">
              <StarRating value={Math.round(ratingStats.avg)} readOnly size={12} />
              {ratingStats.avg.toFixed(1)} ({ratingStats.count})
            </p>
          )}
          <span className="listing-view-link">View listing <span aria-hidden="true">→</span></span>
        </div>
      </Link>

      {ownerControls && (
        <div className="listing-card-actions">
          <Link to={`/edit-listing/${item.id}`} className="btn btn-ghost btn-sm">
            Edit
          </Link>
          <button className="btn btn-danger btn-sm" onClick={() => onDelete(item)}>
            Delete
          </button>
        </div>
      )}
    </article>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hideOwnListings, setHideOwnListings] = useState(false);

  const [listings, setListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [myListings, setMyListings] = useState([]);
  const [hasMoreMyListings, setHasMoreMyListings] = useState(true);
  const [loadingMoreMyListings, setLoadingMoreMyListings] = useState(false);
  const [verifiedOwnerIds, setVerifiedOwnerIds] = useState(new Set());
  const [ownerRatingStats, setOwnerRatingStats] = useState({});
  const [allSports, setAllSports] = useState([]);
  const requestId = useRef(0);
  const [selectedSport, setSelectedSport] = useState("All");
  const [selectedListingType, setSelectedListingType] = useState("All");
  const [deleteError, setDeleteError] = useState("");

        const loadOwnerVerification = async (items) => {
    const ownerIds = [...new Set(items.map((item) => item.owner_id).filter(Boolean))];
    if (!ownerIds.length) return;

    const { data: owners } = await supabase
      .from("public_profiles")
      .select("id, verification_status")
      .in("id", ownerIds);

    setVerifiedOwnerIds((prev) => {
      const next = new Set(prev);
      (owners || [])
        .filter((owner) => owner.verification_status === "verified")
        .forEach((owner) => next.add(owner.id));
      return next;
    });
  };

  const loadOwnerRatings = async (items) => {
    const ownerIds = [...new Set(items.map((item) => item.owner_id).filter(Boolean))];
    if (!ownerIds.length) return;

    const { data: ratings } = await supabase
      .from("ratings")
      .select("rated_user_id, rating")
      .in("rated_user_id", ownerIds);

    setOwnerRatingStats((prev) => {
      const next = { ...prev };
      ownerIds.forEach((id) => {
        const rows = (ratings || []).filter((r) => r.rated_user_id === id);
        const count = rows.length;
        const avg = count ? rows.reduce((s, r) => s + r.rating, 0) / count : 0;
        next[id] = { avg, count };
      });
      return next;
    });
  };

  const loadCategories = async () => {
    const { data } = await supabase.from("equipment").select("category").eq("is_sold", false);
    setAllSports([...new Set((data || []).map((r) => r.category).filter(Boolean))]);
  };

const loadListings = async (uid, role, hideOwn = false, sport = "All", type = "All", silent = false) => {
    const myRequest = ++requestId.current;
if (!silent) setListingsLoading(true);

    let query = supabase
      .from("equipment")
      .select("*")
      .eq("is_sold", false)
      .order("created_at", { ascending: false })
      .range(0, PAGE_SIZE - 1);

    query = applyFilters(query, { hideOwn, uid, sport, type });

    const { data: firstPage } = await query;
    if (myRequest !== requestId.current) return; // a newer filter click superseded this one

    const nextListings = firstPage || [];
    setListings(nextListings);
    setHasMore(nextListings.length === PAGE_SIZE);
    setListingsLoading(false);

    // Fetch verification state once so trust is visible directly on cards.
    // Uses public_profiles (not profiles) since RLS only allows a user to
    // read their own row in profiles — reading other owners' verification
    // status has to go through the public-safe view, same as EquipmentDetails.jsx.
    await loadOwnerVerification(nextListings);
    await loadOwnerRatings(nextListings);

    if (role === "owner") {
      const { data: owned } = await supabase
        .from("equipment")
        .select("*")
        .eq("owner_id", uid)
        .order("created_at", { ascending: false })
        .range(0, MY_LISTINGS_PAGE_SIZE - 1);

      const ownedList = owned || [];
      setMyListings(ownedList);
      setHasMoreMyListings(ownedList.length === MY_LISTINGS_PAGE_SIZE);
    }
  };

  const handleLoadMoreMyListings = async () => {
    setLoadingMoreMyListings(true);

    const { data: nextPage } = await supabase
      .from("equipment")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .range(myListings.length, myListings.length + MY_LISTINGS_PAGE_SIZE - 1);

    const newItems = nextPage || [];
    setMyListings((prev) => [...prev, ...newItems]);
    setHasMoreMyListings(newItems.length === MY_LISTINGS_PAGE_SIZE);
    setLoadingMoreMyListings(false);
  };

  const handleToggleHideOwn = async () => {
    const next = !hideOwnListings;
    setHideOwnListings(next);
    await loadListings(userId, profile?.role, next);
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);

    let query = supabase
      .from("equipment")
      .select("*")
      .eq("is_sold", false)
      .order("created_at", { ascending: false })
      .range(listings.length, listings.length + PAGE_SIZE - 1);

    query = applyFilters(query, {
      hideOwn: hideOwnListings,
      uid: userId,
      sport: selectedSport,
      type: selectedListingType,
    });

    const myRequest = requestId.current;
    const { data: nextPage } = await query;
    if (myRequest !== requestId.current) {
      setLoadingMore(false);
      return;
    }

    const newItems = nextPage || [];
    setListings((prev) => [...prev, ...newItems]);
    setHasMore(newItems.length === PAGE_SIZE);
    setLoadingMore(false);

    await loadOwnerVerification(newItems);
    await loadOwnerRatings(newItems);
  };

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

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data?.is_admin) {
        navigate("/admin", { replace: true });
        return;
      }

      const defaultHideOwn = data?.role === "owner";

      if (active) {
        setUserId(user.id);
        setProfile(data);
        setHideOwnListings(defaultHideOwn);
        setLoading(false);
      }

      await loadListings(user.id, data?.role, defaultHideOwn, "All", "All");
      loadCategories();
    })();

    return () => {
      active = false;
    };
}, [navigate]);

  useLiveRefresh(
    ["equipment"],
() => loadListings(userId, profile?.role, hideOwnListings, selectedSport, selectedListingType, true),
    Boolean(userId)
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleDeleteListing = async (item) => {
    setDeleteError("");
    const confirmed = window.confirm(
      `Delete "${item.name}"? This can't be undone, and any pending or approved requests for it will be removed too.`
    );
    if (!confirmed) return;

    for (const url of item.images || []) {
      const path = pathFromPublicUrl(url, "equipment-images");
      if (path) await supabase.storage.from("equipment-images").remove([path]);
    }

    const { error } = await supabase.from("equipment").delete().eq("id", item.id);

    if (error) {
      setDeleteError(error.message);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    await loadListings(user.id, profile?.role, hideOwnListings);
    loadCategories();
  };

  const sportOptions = ["All", ...[...allSports].sort((a, b) => a.localeCompare(b))];

  // Filtering now happens in the query, so the loaded list is already filtered.
  const filteredListings = listings;

  const handleSelectSport = (sport) => {
    setSelectedSport(sport);
    loadListings(userId, profile?.role, hideOwnListings, sport, selectedListingType);
  };

  const handleResetFilters = () => {
    setSelectedSport("All");
    setSelectedListingType("All");
    loadListings(userId, profile?.role, hideOwnListings, "All", "All");
  };

  const handleSelectType = (type) => {
    setSelectedListingType(type);
    loadListings(userId, profile?.role, hideOwnListings, selectedSport, type);
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-orb" />
        <p>Loading your dashboard…</p>
      </div>
    );
  }

  const isVerifiedOwner =
    profile?.role === "owner" && profile?.verification_status === "verified";
  const isOwnerButUnverified =
    profile?.role === "owner" && profile?.verification_status !== "verified";

  return (
    <div className="app-page">
      <NavHeader onLogout={handleLogout} />

      <main className="dashboard-main">
        {profile?.verification_status === "pending" && (
          <div className="form-banner pending">
            <strong>Verification in progress.</strong> Your ID is still under review. You&apos;ll
            have full access once verification is complete.
          </div>
        )}

        {profile?.verification_status === "rejected" && (
          <div className="form-banner error">
            <strong>Verification needs attention.</strong> Your ID was not approved. Contact
            support or try re-submitting.
          </div>
        )}

{profile?.role === "renter" && !profile?.is_admin && profile?.verification_status === "verified" && (
          <div className="form-banner pending">
            Have equipment to rent out or sell? <Link to="/profile"><strong>Become an owner</strong></Link>
          </div>
        )}

        <div className="dashboard-welcome">
          <div>
            <span className="eyebrow">Your equipment hub</span>
            <h1>Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}.</h1>
            <p className="dashboard-sub">
              Find gear from verified local owners. Rent what you need or buy what you love.
            </p>
          </div>
        </div>

        <section className="trust-bar" aria-label="Why use GearGrid">
          <div className="trust-item">
            <span className="trust-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
                <path d="M9.5 12l1.8 1.8L15 10" />
              </svg>
            </span>
            <div><strong>Verified owners</strong><span>Identity checked before listing</span></div>
          </div>
          <div className="trust-item">
            <span className="trust-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <path d="M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </span>
            <div><strong>Rent or buy</strong><span>Choose what works for you</span></div>
          </div>
          <div className="trust-item">
            <span className="trust-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M8.5 12.5l2.5 2.5 5-5" />
              </svg>
            </span>
            <div><strong>Owner-approved</strong><span>Every request goes to the owner</span></div>
          </div>
          <div className="trust-item">
            <span className="trust-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
            </span>
            <div><strong>Local pickup</strong><span>Keep handoffs close and simple</span></div>
          </div>
        </section>

        {profile?.role === "owner" && (
          <section className="dashboard-section owner-section">
            <div className="dashboard-section-header">
              <div>
                <span className="section-kicker">Manage</span>
                <h2 className="dashboard-section-title">My Listings</h2>
              </div>
              {isVerifiedOwner && (
                <Link to="/list-equipment" className="btn btn-primary">
                  + List New Equipment
                </Link>
              )}
            </div>

            {deleteError && <div className="form-banner error">{deleteError}</div>}

            {isOwnerButUnverified ? (
              <p className="owner-section-empty">
                You&apos;ll be able to list equipment once your ID verification is approved.
              </p>
            ) : myListings.length === 0 ? (
              <p className="owner-section-empty">
                You haven&apos;t listed any equipment yet. Add your first item when you&apos;re ready.
              </p>
            ) : (
              <>
                <div className="listing-grid">
                  {myListings.map((item) => (
                    <ListingCard
                      item={item}
                      ownerControls
                      onDelete={handleDeleteListing}
                      verifiedOwnerIds={verifiedOwnerIds}
                      ownerRatingStats={ownerRatingStats}
                      key={item.id}
                    />
                  ))}
                </div>
                {hasMoreMyListings && (
                  <div className="load-more-wrap">
                    <button className="btn btn-ghost" onClick={handleLoadMoreMyListings} disabled={loadingMoreMyListings}>
                      {loadingMoreMyListings ? "Loading…" : "Load more of my listings"}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        <section className="dashboard-section browse-section">
          <div className="dashboard-section-header browse-header">
            <div>
              <span className="section-kicker">Explore the marketplace</span>
              <h2 className="dashboard-section-title">Browse Equipment</h2>
            </div>
            {!listingsLoading && (
              <span className="results-count">
                {filteredListings.length}{hasMore ? "+" : ""} {filteredListings.length === 1 && !hasMore ? "listing" : "listings"}
              </span>
            )}
          </div>

          {!listingsLoading && (listings.length > 0 || selectedSport !== "All" || selectedListingType !== "All") && (
            <>
              <div className="filters-toolbar">
                <div>
                  <p className="filter-row-label">Category</p>
                  <div className="sport-filters" aria-label="Filter by sport">
                    {sportOptions.map((sport) => (
                      <button
                        type="button"
                        key={sport}
                        className={`filter-pill ${selectedSport === sport ? "active" : ""}`}
                        onClick={() => handleSelectSport(sport)}
                        aria-pressed={selectedSport === sport}
                      >
                        {sport}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="filter-row-label">Type</p>
                  <div className="sport-filters listing-type-filters" aria-label="Filter by listing type">
                    {["All", "Rent", "Buy", "Try-to-Buy"].map((type) => (
                      <button
                        type="button"
                        key={type}
                        className={`filter-pill ${selectedListingType === type ? "active" : ""}`}
                        onClick={() => handleSelectType(type)}
                        aria-pressed={selectedListingType === type}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {profile?.role === "owner" && (
                <button
                  type="button"
                  className={`filter-pill hide-own-toggle ${hideOwnListings ? "active" : ""}`}
                  onClick={handleToggleHideOwn}
                >
                  {hideOwnListings ? "👁 Show my own listings too" : "👁 Hide my own listings"}
                </button>
              )}
            </>
          )}

                        {listingsLoading ? (
            <div className="requests-panel-loading">
              <span className="loading-orb-inline" />
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="empty-marketplace">
              <span className="empty-marketplace-icon">⌕</span>
              <h3>No gear in this category yet</h3>
              <p>Try another sport or switch back to all equipment.</p>
                <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleResetFilters}
              >
                Show all equipment
              </button>
            </div>
          ) : (
            <>
              <div className="listing-grid">
                {filteredListings.map((item) => (
                  <ListingCard
                  item={item}
                  key={item.id}
                  verifiedOwnerIds={verifiedOwnerIds}
                  ownerRatingStats={ownerRatingStats}
                />
                ))}
              </div>
              {hasMore && (
                <div className="load-more-wrap">
                  <button className="btn btn-ghost" onClick={handleLoadMore} disabled={loadingMore}>
                    {loadingMore ? "Loading…" : "Load more equipment"}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}