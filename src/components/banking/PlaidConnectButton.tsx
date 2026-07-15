"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useRouter } from "next/navigation";
import { Landmark, Loader2 } from "lucide-react";

export function PlaidConnectButton({ locationId }: { locationId: string }) {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchLinkToken() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/plaid/link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't start bank connection.");
        setLoading(false);
        return;
      }
      setLinkToken(data.linkToken);
    } catch {
      setError("Couldn't reach the server.");
      setLoading(false);
    }
  }

  const onSuccess = useCallback(
    async (publicToken: string) => {
      setLoading(true);
      const res = await fetch("/api/integrations/plaid/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, publicToken }),
      });
      setLoading(false);
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error ?? "Couldn't finish connecting.");
      }
    },
    [locationId, router]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: () => setLoading(false),
  });

  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={fetchLinkToken}
        disabled={loading}
        className="flex items-center gap-2 rounded-xl gradient-brand px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Landmark size={15} />}
        Connect bank account
      </button>
      {error ? <p className="text-xs text-danger max-w-xs text-center">{error}</p> : null}
    </div>
  );
}
