import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "../lib/supabaseClient";

const READER_ID = "meetup-qr-reader";

export default function MeetupScanner({ open, transaction, onClose, onConfirmed }) {
  const [status, setStatus] = useState("scanning"); // scanning | verifying | error | done
  const [error, setError] = useState("");
  const scannerRef = useRef(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;

    setStatus("scanning");
    setError("");

    if (!document.getElementById(READER_ID)) return;
    const scanner = new Html5Qrcode(READER_ID);
    scannerRef.current = scanner;
    let handled = false;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        async (decodedText) => {
          if (handled) return;
          handled = true;
          await scanner.stop().catch(() => {});
          handleScanned(decodedText.trim());
        },
        () => {} // per-frame "no QR found yet" — expected, ignore
      )
      .catch(() => {
        setStatus("error");
        setError("Couldn't access the camera. Check browser permissions and try again.");
      });

    return () => {
      handled = true;
      (async () => {
        try {
          await scanner.stop();
        } catch {
          // scanner was never started or already stopped
        }
        try {
          scanner.clear();
        } catch {
          // element already removed from the DOM
        }
      })();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [open, transaction?.id, attempt]);
  const handleScanned = async (scannedId) => {
    if (scannedId !== transaction.id) {
      setStatus("error");
      setError("That QR doesn't match this transaction — make sure you're scanning this buyer's code.");
      return;
    }

    setStatus("verifying");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("You're signed out. Please log in again.");
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-meetup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ transaction_id: transaction.id }),
          signal: controller.signal,
        }
      );

      const result = await res.json();

      if (!res.ok || result.error) {
        setStatus("error");
        setError(result.error || "Something went wrong confirming the meetup.");
        return;
      }

      setStatus("done");
      onConfirmed(transaction.id);
    } catch (err) {
      setStatus("error");
      setError(
        err.name === "AbortError"
          ? "The server took too long to respond. Check your connection and try again."
          : err.message || "Couldn't reach the server. Check your connection and try again."
      );
    } finally {
      clearTimeout(timeout);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card meetup-scanner-card" onClick={(e) => e.stopPropagation()}>
        <h3>Confirm meetup</h3>
        <p className="equipment-note-detail" style={{ marginBottom: 14 }}>
          Scan {transaction?.otherPartyName ? `${transaction.otherPartyName}'s` : "the buyer's"} QR code to confirm the handoff.
        </p>

        {status === "scanning" && <div id={READER_ID} className="meetup-qr-reader" />}

        {status === "verifying" && (
          <div className="requests-panel-loading">
            <span className="loading-orb-inline" />
          </div>
        )}

        {status === "error" && (
          <>
            <div className="form-banner error">{error}</div>
            <button
              type="button"
              className="btn btn-primary btn-block"
              style={{ marginTop: 10 }}
              onClick={() => {
                setStatus("scanning");
                setError("");
                setAttempt((a) => a + 1);
              }}
            >
              Try again
            </button>
          </>
        )}

        {status === "done" && (
          <div className="form-banner success">✓ Meetup confirmed! This transaction is now complete.</div>
        )}

        <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 12 }} onClick={onClose}>
          {status === "done" ? "Close" : "Cancel"}
        </button>
      </div>
    </div>,
    document.body
  );
}
