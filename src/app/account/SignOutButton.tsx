"use client";

import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        router.push("/");
        router.refresh();
      }}
      className="rounded-full border border-stone-300 px-4 py-1.5 text-sm text-stone-600 hover:border-moss hover:text-moss"
    >
      Sign out
    </button>
  );
}
