import { useEffect, useState } from "react";
import { WifiOff, CloudOff } from "lucide-react";
import { NETWORK_EVENT, networkState, watchConnectivity } from "../lib/offline/net";
import { clearCache } from "../lib/offline/responseCache";
import { supabase } from "../lib/supabaseClient";
import "./OfflineBanner.css";

// Says what the phone is doing, in plain words, only when it matters.
// Three states, only two of which show anything:
//   online            -> nothing
//   offline, no cache -> "You are offline" (screens show their own retry buttons)
//   offline, cache    -> "Showing what was saved <time>"
//
// It also empties the cache on sign-out: cached rows belong to one account and
// must not be readable by the next person to use the phone.
function when(storedAt) {
  if (!storedAt) return "";
  const minutes = Math.round((Date.now() - storedAt) / 60000);
  if (minutes < 1) return "a moment ago";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} day${hours >= 48 ? "s" : ""} ago`;
}

export default function OfflineBanner() {
  const [state, setState] = useState(networkState());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onChange = (event) => {
      setState(event.detail);
      setDismissed(false);
    };
    window.addEventListener(NETWORK_EVENT, onChange);
    const stop = watchConnectivity();
    return () => {
      window.removeEventListener(NETWORK_EVENT, onChange);
      stop?.();
    };
  }, []);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") clearCache();
    });
    return () => data?.subscription?.unsubscribe();
  }, []);

  if ((state.online && !state.fromCache) || dismissed) return null;

  const cached = state.fromCache;
  return (
    <div className={`fc-offline ${cached ? "fc-offline--cached" : "fc-offline--down"}`} role="status" aria-live="polite">
      {cached ? <CloudOff size={16} aria-hidden="true" /> : <WifiOff size={16} aria-hidden="true" />}
      <span>
        {cached
          ? `No connection — showing what was saved ${when(state.cachedAt)}. New changes will not save until you are back online.`
          : "No connection. Anything you change now cannot be saved."}
      </span>
      <button type="button" onClick={() => setDismissed(true)} className="fc-offline-close" aria-label="Hide this message">
        ×
      </button>
    </div>
  );
}
