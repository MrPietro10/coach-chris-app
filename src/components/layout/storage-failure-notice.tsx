"use client";

import { useEffect, useState } from "react";
import {
  STORAGE_WRITE_FAILED_EVENT,
  STORAGE_WRITE_FAILURE_MESSAGE,
} from "@/lib/alpha-scoped-json-write";

export function StorageFailureNotice() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleStorageWriteFailed() {
      setOpen(true);
    }
    window.addEventListener(STORAGE_WRITE_FAILED_EVENT, handleStorageWriteFailed);
    return () => {
      window.removeEventListener(STORAGE_WRITE_FAILED_EVENT, handleStorageWriteFailed);
    };
  }, []);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-zinc-900/50 px-5 py-8"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="storage-failure-title"
      aria-describedby="storage-failure-description"
    >
      <section className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6 shadow-xl">
        <h2 id="storage-failure-title" className="text-lg font-semibold text-zinc-900">
          Could not save in browser
        </h2>
        <p id="storage-failure-description" className="mt-2 text-sm text-zinc-600">
          {STORAGE_WRITE_FAILURE_MESSAGE}
        </p>
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
          >
            OK
          </button>
        </div>
      </section>
    </div>
  );
}
